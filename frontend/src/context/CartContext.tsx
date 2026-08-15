import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { GlobalCartDrawer } from '../components/catalog/GlobalCartDrawer';
import { patients } from '../data/db';
import {
  buildCartGroups,
  buildCatalogItems,
  cartTotals,
  setCartLineQty,
  totalUnitsInCart,
  type CartLine,
} from '../lib/catalog';

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
  /** Empties the cart and announces the result. Shared so every route places orders identically. */
  placeOrder: () => void;
  /** Current transient message, or '' when nothing is showing. */
  toast: string;
  say: (message: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const catalogItems = buildCatalogItems();

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }, []);

  const setLineQty = useCallback((offerId: string, patientId: string, qty: number) => {
    setLines((prev) => setCartLineQty(prev, offerId, patientId, qty));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const placeOrder = useCallback(() => {
    if (lines.length === 0) {
      say('Cart is empty');
      return;
    }
    const lineCount = lines.length;
    const patientCount = new Set(lines.map((l) => l.patientId)).size;
    clearCart();
    setCartOpen(false);
    say(
      `Order placed — ${lineCount} line${lineCount > 1 ? 's' : ''} across ${patientCount} patient${patientCount > 1 ? 's' : ''}`,
    );
  }, [lines, clearCart, say]);

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
      placeOrder,
      toast,
      say,
    }),
    [lines, cartOpen, setLineQty, clearCart, placeOrder, toast, say],
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
