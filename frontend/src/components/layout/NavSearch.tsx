import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { patients } from '../../data/db';
import { buildCatalogItems, upsertCartLine } from '../../lib/catalog';
import { looksLikeOrderCommand, parseAgentOrder } from '../../lib/ai/agentOrder';
import { burstAtCart, flyCometToCart } from '../../lib/fx/agentComet';
import type { User } from '../../types/domain';
import { useCart } from '../../context/CartContext';

type Mode = 'search' | 'ai';

const PLACEHOLDERS: Record<Mode, string> = {
  search: 'Search equipment…',
  ai: 'Ask, or command — "order a hospital bed for Harold"',
};

/**
 * The top-nav search bar with the Search / ✦ AI switch (mockups/enhanced-search.html).
 * Plain mode is exactly the old keyword search. AI mode routes deterministically:
 * order-shaped commands go to the agent (fills the cart, human confirms checkout);
 * everything else becomes an AI-ranked search on the catalog. Any AI failure lands
 * on plain search results — this bar never dead-ends.
 */
export function NavSearch({ user }: { user: User }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [mode, setMode] = useState<Mode>(searchParams.get('ai') === '1' ? 'ai' : 'search');
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(true);
  const { setLines, setCartOpen, setAgentAdded } = useCart();

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

  const switchMode = (next: Mode) => {
    setMode(next);
    setNotice('');
    inputRef.current?.focus();
  };

  const runAgentOrder = async (command: string) => {
    const items = buildCatalogItems();
    const assignable = patients.filter((p) => p.hospiceId === user.orgId && p.status !== 'deceased');
    setThinking(true);
    setNotice('');
    try {
      const action = await parseAgentOrder(command, items, assignable);
      if (!aliveRef.current) return;
      if (!action) {
        // Model couldn't safely resolve a patient or product — fall back to AI search.
        setNotice("Couldn't match a patient or item — showing results instead");
        navigate(`/catalog?q=${encodeURIComponent(command)}&ai=1`);
        return;
      }
      // Cart state first — the order is never lost to a visual effect.
      setLines((prev) => upsertCartLine(prev, action.offerId, action.patientId, action.quantity));
      setAgentAdded(action);
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
      navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog');
      return;
    }
    if (!q) {
      navigate('/catalog');
      return;
    }
    if (looksLikeOrderCommand(q)) {
      void runAgentOrder(q);
      return;
    }
    navigate(`/catalog?q=${encodeURIComponent(q)}&ai=1`);
  };

  return (
    <div className="w-full min-w-0">
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder={PLACEHOLDERS[mode]}
            aria-label={mode === 'ai' ? 'Ask AI or give an order command' : 'Search equipment'}
            data-testid="nav-search-input"
            className="w-full min-w-0 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3"
          />
          {thinking && (
            <span className="ai-status shrink-0 whitespace-nowrap pr-1 text-[11px]" data-testid="ai-status">
              Placing the order…
            </span>
          )}
        </form>
      </div>
      {notice && (
        <div className="absolute mt-1 text-[11px] text-ink-3" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
