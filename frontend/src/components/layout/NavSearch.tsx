import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { looksLikeOrderCommand } from '../../lib/ai/agentOrder';
import { askAgent, runAgentOrder } from '../../lib/ai/client';
import { flattenCommands, searchCommands } from '../../lib/commandSearch';
import type { CommandResult } from '../../lib/commandSearch';
import { burstAtCart, flyCometToCart } from '../../lib/fx/agentComet';
import type { AskResult } from '../../types/ai';
import type { User } from '../../types/domain';
import { useCart } from '../../context/CartContext';
import { AskAnswer } from './AskAnswer';
import { CommandResults, FILTER_ROW_ID } from './CommandResults';
import type { FilterRow } from './CommandResults';
import type { NavSection } from './TopNav';

type Mode = 'search' | 'ai';

const PLACEHOLDERS: Record<Mode, string> = {
  search: 'Search patients, orders, equipment, or pages…',
  ai: 'Ask about orders, patients, or equipment — or say "order a bed for Harold"',
};

/**
 * Routes that own a searchable list. On these, typing keeps filtering the page in place through
 * `?q=` — the behavior the old per-section bar had — *and* opens the jump dropdown, whose first row
 * just names the filtering that already happened.
 *
 * Keyed by pathname rather than by section on purpose: a patient's detail page reports the
 * "patients" section so its nav link stays lit, but it has no list, and filtering there would
 * navigate the user off the record they are reading.
 */
const FILTERABLE: Record<string, { noun: string }> = {
  '/orders': { noun: 'Orders' },
  '/patients': { noun: 'Patients' },
  '/assignments': { noun: 'Assignments' },
};

/**
 * The app-wide command bar: search, jump, and the AI ordering agent in one input.
 *
 * Search mode is deterministic and instant — every row comes from the in-memory snapshot through
 * `searchCommands`, which does the permission scoping so this component never decides who may see
 * what. AI mode is unchanged: order-shaped commands run the agent, everything else becomes an
 * AI-ranked catalog search. The dropdown is suppressed in AI mode, where Enter submits rather than
 * picks, so the two interaction models never overlap.
 *
 * The agent runs on the API and writes the cart there through its MCP tools, so what comes back is
 * the cart the server already holds — this component renders it rather than building one.
 */
export function NavSearch({ user, activeSection }: { user: User; activeSection: NavSection }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [mode, setMode] = useState<Mode>(searchParams.get('ai') === '1' ? 'ai' : 'search');
  const [thinking, setThinking] = useState(false);
  const [focused, setFocused] = useState(false);
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(true);
  const { adoptServerCart, setCartOpen, setAgentAdded } = useCart();

  const filterable = FILTERABLE[pathname] ?? null;

  // Keep the input in step when the URL's q changes underneath us (back button, cleared search).
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // The fallback notice is transient — it explains the navigation that just happened, then clears.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const groups = useMemo(
    () => (mode === 'search' && query.trim() ? searchCommands(user, query) : []),
    [user, query, mode],
  );

  const filterRow: FilterRow | null =
    filterable && mode === 'search' && query.trim()
      ? {
          label: `Filter ${filterable.noun} for “${query.trim()}”`,
          meta: 'Showing matches on this page',
        }
      : null;

  // The arrow keys walk the filter row first, then every group in render order.
  const walkable = useMemo(
    () => [
      ...(filterRow ? [FILTER_ROW_ID] : []),
      ...flattenCommands(groups).map((r) => r.id),
    ],
    [filterRow, groups],
  );

  const resultsById = useMemo(() => {
    const map = new Map<string, CommandResult>();
    for (const result of flattenCommands(groups)) map.set(result.id, result);
    return map;
  }, [groups]);

  const showDropdown = open && mode === 'search' && (filterRow !== null || groups.length > 0);

  const closeDropdown = () => {
    setOpen(false);
    setActiveId(null);
  };

  // A click outside dismisses the dropdown without disturbing the query or any live filtering.
  useEffect(() => {
    if (!showDropdown) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeDropdown();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showDropdown]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setNotice('');
    closeDropdown();
    inputRef.current?.focus();
  };

  // Cmd/Ctrl+K focuses the bar from anywhere in the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const pick = (result: CommandResult) => {
    closeDropdown();
    inputRef.current?.blur();
    navigate(result.to);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Tab inside the bar flips Search ↔ AI instead of leaving it. Shift+Tab still tabs out
    // backwards, so the bar is never a keyboard trap.
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      switchMode(mode === 'search' ? 'ai' : 'search');
      return;
    }
    if (e.key === 'Escape' && showDropdown) {
      e.preventDefault();
      closeDropdown();
      return;
    }
    if (!showDropdown || walkable.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const current = activeId ? walkable.indexOf(activeId) : -1;
      const next = (current + step + walkable.length) % walkable.length;
      setActiveId(walkable[next] ?? null);
    }
  };

  const placeAgentOrder = async (command: string) => {
    setThinking(true);
    setNotice('');
    try {
      const { cart, added } = await runAgentOrder(command, user.id);
      if (!aliveRef.current) return;
      if (!cart || added.length === 0) {
        // The agent couldn't safely resolve a patient or product — fall back to AI search.
        setNotice("Couldn't match a patient or item — showing results instead");
        navigate(`/catalog?q=${encodeURIComponent(command)}&ai=1`);
        return;
      }
      // Cart state first — the order is never lost to a visual effect. The API already wrote it,
      // so this renders the server's copy rather than pushing one back.
      adoptServerCart(cart);
      setAgentAdded(added);
      setQuery('');
      setThinking(false); // calm the bar before the comet leaves it
      navigate('/catalog');
      // The hand-off show: comet to the cart icon, burst, then the drawer opens
      // on the ringed line. Every step is defensive — worst case it's instant.
      await flyCometToCart(shellRef.current);
      burstAtCart();
      await new Promise((r) => setTimeout(r, 350));
      if (!aliveRef.current) return;
      setCartOpen(true);
    } catch {
      if (!aliveRef.current) return;
      // AI down or key missing: quiet fallback to the deterministic search.
      setNotice('AI unavailable — showing standard search');
      navigate(`/catalog?q=${encodeURIComponent(command)}`);
    } finally {
      if (aliveRef.current) setThinking(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (thinking) return;

    if (mode === 'search') {
      // Enter on a highlighted row jumps to it. The filter row needs no action — its filtering is
      // already live — so it just closes.
      if (showDropdown && activeId) {
        if (activeId === FILTER_ROW_ID) {
          closeDropdown();
          return;
        }
        const result = resultsById.get(activeId);
        if (result) {
          pick(result);
          return;
        }
      }
      closeDropdown();
      // Nothing highlighted: a section with its own list has already filtered it, so Enter is done.
      // Everywhere else Enter means the catalog search it has always meant.
      if (!filterable) navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog');
      return;
    }

    if (!q) {
      navigate('/catalog');
      return;
    }
    if (looksLikeOrderCommand(q)) {
      void placeAgentOrder(q);
      return;
    }
    navigate(`/catalog?q=${encodeURIComponent(q)}&ai=1`);
  };

  const onChange = (value: string) => {
    setQuery(value);
    // AI mode waits for Enter — each submit is a model call, so we never fire one per keystroke.
    if (mode !== 'search') return;
    setOpen(true);
    setActiveId(null);
    const q = value.trim();
    // A section with its own list filters in place; the catalog drives its storefront search the
    // way it always has. On a section with no list (dashboard) typing only opens the dropdown.
    if (filterable) {
      navigate(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { replace: true });
    } else if (activeSection === 'catalog') {
      navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog', { replace: true });
    }
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <div ref={shellRef} className={`ai-shell ${mode === 'ai' ? 'ai-on' : ''} ${thinking ? 'ai-thinking' : ''}`}>
        <form
          onSubmit={submit}
          role="search"
          className="flex items-center gap-2 rounded-full bg-surface py-[5.5px] pl-[5.5px] pr-3.5"
        >
          <div className="flex shrink-0 gap-0.5 rounded-full bg-hover p-[2.5px]">
            <button
              type="button"
              onClick={() => switchMode('search')}
              aria-pressed={mode === 'search'}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[10.5px] font-semibold tracking-[0.05em] transition-colors ${
                mode === 'search' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              Search
            </button>
            <button
              type="button"
              onClick={() => switchMode('ai')}
              aria-pressed={mode === 'ai'}
              data-testid="ai-mode-button"
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[10.5px] font-semibold tracking-[0.05em] transition-colors ${
                mode === 'ai' ? 'bg-surface text-ai-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  className={mode === 'ai' ? 'ai-spark' : undefined}
                  d="M12 4l1.7 4.7L18.5 10l-4.8 1.6L12 16.5l-1.7-4.9L5.5 10l4.8-1.3L12 4Z"
                />
                <path d="M19 2.5l.7 1.9 1.9.6-1.9.7-.7 2-.7-2-1.9-.7 1.9-.6.7-1.9Z" />
              </svg>
              AI
            </button>
          </div>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onInputKeyDown}
            onFocus={() => {
              setFocused(true);
              if (query.trim()) setOpen(true);
            }}
            onBlur={() => setFocused(false)}
            placeholder={PLACEHOLDERS[mode]}
            aria-label={
              mode === 'ai'
                ? 'Ask AI or give an order command'
                : 'Search patients, orders, equipment, or pages'
            }
            aria-keyshortcuts="Meta+K Control+K Tab"
            aria-describedby="nav-search-tab-hint"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? 'command-results' : undefined}
            data-testid="nav-search-input"
            className="w-full min-w-0 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3"
          />
          {thinking ? (
            <svg
              className="shrink-0 animate-spin text-ai-ink"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              data-testid="ai-spinner"
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : focused ? (
            // Focused, the useful hint is the mode switch — nobody discovers Tab on their own.
            <span
              aria-hidden="true"
              className="hidden shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-medium text-ink-3 sm:flex"
              data-testid="nav-search-tab-hint"
            >
              <kbd className="rounded border border-line px-1.5 py-0.5">Tab</kbd>
              for {mode === 'search' ? 'AI' : 'Search'}
            </span>
          ) : (
            // The shortcut hint is a discovery aid — once the bar has focus it has done its job.
            <kbd
              aria-hidden="true"
              className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3 sm:block"
            >
              ⌘K
            </kbd>
          )}
        </form>
      </div>

      {showDropdown ? (
        <div id="command-results">
          <CommandResults
            groups={groups}
            filterRow={filterRow}
            activeId={activeId}
            onPick={pick}
            onPickFilter={closeDropdown}
            onHoverItem={setActiveId}
          />
        </div>
      ) : null}

      {/* Always present so aria-describedby resolves; the visible hint above is decorative. */}
      <span id="nav-search-tab-hint" className="sr-only">
        Press Tab to switch between Search and AI mode.
      </span>
      {/* Status toast under the bar: the agent's progress, then any fallback notice. */}
      {(thinking || notice) && (
        <div className="absolute left-0 mt-1.5 flex w-full justify-center" role="status" aria-live="polite">
          <span
            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1 text-center text-[11px] shadow-sm"
            data-testid="ai-status"
          >
            {thinking ? <span className="ai-status">Placing the order…</span> : <span className="text-ink-2">{notice}</span>}
          </span>
        </div>
      )}
    </div>
  );
}
