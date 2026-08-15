/**
 * The cart, backed by the API.
 *
 * Lines live on the server (one open cart per user), so a refresh or a second tab sees the same
 * cart. The lines held here are an optimistic mirror: an edit updates local state immediately and
 * pushes the whole list to the server behind it, because a nurse tapping a quantity stepper should
 * never wait for a round trip.
 *
 * Writes are serialised and last-write-wins. Each push sends the complete line list rather than a
 * delta, so a request that overtakes another cannot leave the server holding a half-applied edit.
 * If a write fails, the server's copy is pulled back in and the user is told — a cart that silently
 * disagreed with what gets ordered would be worse than a visible error.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GlobalCartDrawer } from '../components/catalog/GlobalCartDrawer';
import { patients } from '../data/db';
import {
  buildCartGroups,
  buildCatalogItems,
  cartTotals,
  projectedOrderCount,
  setCartLineQty,
  totalUnitsInCart,
  type CartLine,
  type PriceUnit,
} from '../lib/catalog';
import { checkoutCart, fetchCart, updateCart, type CartDto, type CartLineInput } from '../lib/api';
import type { AgentAddedLine } from '../types/ai';

interface CartContextValue {
  lines: CartLine[];
  cartCount: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  setLines: React.Dispatch<React.SetStateAction<CartLine[]>>;
  setCartLineQty: (offerId: string, patientId: string, unit: PriceUnit, qty: number) => void;
  clearCart: () => void;
  cartGroups: ReturnType<typeof buildCartGroups>;
  cartTotals: ReturnType<typeof cartTotals>;
  /** Orders this cart will become on checkout — one per patient and vendor. */
  orderCount: number;
  /** Checks out through the API, then empties the cart. Shared so every route orders identically.
   *  Resolves true when orders were created, false when nothing was placed. */
  placeOrder: () => Promise<boolean>;
  /** True while a checkout is in flight, so the button can disable itself. */
  placing: boolean;
  /** Current transient message, or '' when nothing is showing. */
  toast: string;
  say: (message: string) => void;
  /** The line the AI agent just added, so the drawer can spotlight it. */
  agentAdded: AgentAddedLine | null;
  setAgentAdded: (line: AgentAddedLine | null) => void;
  /**
   * Take the server's cart as-is, without pushing it back.
   *
   * The ordering agent writes the cart on the API before this browser hears about it, so the
   * response is already authoritative — echoing it back with `setLines` would be a redundant write
   * and could race the agent's own.
   */
  adoptServerCart: (cart: CartDto) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Narrow either a local line or a server line down to the four fields the API accepts. */
const toInput = (lines: readonly CartLineInput[]): CartLineInput[] =>
  lines.map(({ offerId, patientId, unit, qty }) => ({ offerId, patientId, unit, qty }));

export function CartProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [lines, setLinesState] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [agentAdded, setAgentAdded] = useState<AgentAddedLine | null>(null);

  // Serialises pushes so two quick edits reach the server in the order they were made.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const say = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Load the signed-in user's cart. Signing out drops back to an empty one.
  useEffect(() => {
    if (!userId) {
      setLinesState([]);
      return;
    }

    let cancelled = false;
    fetchCart(userId)
      .then((cart) => {
        if (!cancelled) setLinesState(toInput(cart.lines));
      })
      .catch(() => {
        // An unreachable cart is not worth blocking the catalog for: the user starts empty and the
        // first edit surfaces the failure.
        if (!cancelled) setLinesState([]);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Push the full line list, rolling back to the server's copy if the write fails. */
  const push = useCallback(
    (next: CartLine[]) => {
      if (!userId) return;
      queue.current = queue.current
        .then(() => updateCart(userId, toInput(next)))
        .catch(async () => {
          say('Could not save your cart — reloading it');
          try {
            const cart = await fetchCart(userId);
            setLinesState(toInput(cart.lines));
          } catch {
            // Leave the local lines alone; the next edit will try again.
          }
        });
    },
    [userId, say],
  );

  /** Render a cart the server already holds. Deliberately does not push — see the interface. */
  const adoptServerCart = useCallback((cart: CartDto) => {
    setLinesState(toInput(cart.lines));
  }, []);

  /** Apply an edit locally, then send the result. */
  const setLines = useCallback<React.Dispatch<React.SetStateAction<CartLine[]>>>(
    (update) => {
      setLinesState((prev) => {
        const next = typeof update === 'function' ? update(prev) : update;
        push(next);
        return next;
      });
    },
    [push],
  );

  const setLineQty = useCallback(
    (offerId: string, patientId: string, unit: PriceUnit, qty: number) => {
      setLines((prev) => setCartLineQty(prev, offerId, patientId, unit, qty));
    },
    [setLines],
  );

  const clearCart = useCallback(() => setLines([]), [setLines]);

  const placeOrder = useCallback(async (): Promise<boolean> => {
    if (lines.length === 0) {
      say('Cart is empty');
      return false;
    }
    if (!userId) {
      say('Sign in to place this order');
      return false;
    }

    setPlacing(true);
    try {
      // Let any in-flight line edit land first, so checkout orders what the user sees.
      await queue.current;
      const { orders } = await checkoutCart(userId);

      const patientCount = new Set(orders.map((o) => o.patientId)).size;
      setLinesState([]);
      setCartOpen(false);
      say(
        `Order placed — ${orders.length} order${orders.length > 1 ? 's' : ''} across ${patientCount} patient${patientCount > 1 ? 's' : ''}`,
      );
      return true;
    } catch (error) {
      say(error instanceof Error ? `Could not place order: ${error.message}` : 'Could not place order');
      return false;
    } finally {
      setPlacing(false);
    }
  }, [lines, userId, say]);

  /**
   * Built here rather than at module load: this module is imported before DataProvider has fetched
   * the snapshot, so a module-level call would read an empty vendorOffers() and cache [] forever —
   * which silently drops every cart line, since buildCartGroups skips lines with no matching offer.
   * CartProvider renders only inside DataProvider, so by now the tables are populated.
   */
  const catalogItems = useMemo(() => buildCatalogItems(), []);

  const value = useMemo(
    () => ({
      lines,
      cartCount: totalUnitsInCart(lines),
      cartOpen,
      setCartOpen,
      setLines,
      setCartLineQty: setLineQty,
      clearCart,
      cartGroups: buildCartGroups(lines, catalogItems, patients()),
      cartTotals: cartTotals(lines, catalogItems),
      orderCount: projectedOrderCount(lines, catalogItems),
      placeOrder,
      placing,
      toast,
      say,
      agentAdded,
      setAgentAdded,
      adoptServerCart,
    }),
    [
      lines,
      cartOpen,
      setLines,
      adoptServerCart,
      setLineQty,
      clearCart,
      catalogItems,
      placeOrder,
      placing,
      toast,
      say,
      agentAdded,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <GlobalCartDrawer />
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
