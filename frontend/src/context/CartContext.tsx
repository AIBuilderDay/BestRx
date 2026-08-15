import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { patients } from '../data/db';
import {
  buildCartGroups,
  buildCatalogItems,
  cartTotals,
  setCartLineQty,
  totalUnitsInCart,
  type CartLine,
} from '../lib/catalog';
import type { AgentOrderAction } from '../types/ai';

interface CartContextValue {
  lines: CartLine[];
  cartCount: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  setLines: React.Dispatch<React.SetStateAction<CartLine[]>>;
  setCartLineQty: (offerId: string, patientId: string, qty: number) => void;
  clearCart: () => void;
  cartGroups: ReturnType<typeof buildCartGroups>;
  cartTotals: ReturnType<typeof cartTotals>;
  /** The line the AI agent just added, so the drawer can spotlight it. */
  agentAdded: AgentOrderAction | null;
  setAgentAdded: (action: AgentOrderAction | null) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const catalogItems = buildCatalogItems();

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [agentAdded, setAgentAdded] = useState<AgentOrderAction | null>(null);

  const setLineQty = useCallback((offerId: string, patientId: string, qty: number) => {
    setLines((prev) => setCartLineQty(prev, offerId, patientId, qty));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({
      lines,
      cartCount: totalUnitsInCart(lines),
      cartOpen,
      setCartOpen,
      setLines,
      setCartLineQty: setLineQty,
      clearCart,
      cartGroups: buildCartGroups(lines, catalogItems, patients),
      cartTotals: cartTotals(lines, catalogItems),
      agentAdded,
      setAgentAdded,
    }),
    [lines, cartOpen, setLineQty, clearCart, agentAdded],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
