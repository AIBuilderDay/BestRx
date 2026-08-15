import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { Toast } from '../ui/Toast';
import { CartDrawer } from './CartDrawer';

/**
 * The one cart drawer for the whole app. Mounted by CartProvider so the header's cart button
 * opens it from every route, not only the views that used to render their own copy.
 */
export function GlobalCartDrawer() {
  const { cartGroups, cartTotals, setCartLineQty, cartOpen, setCartOpen, placeOrder, placing, toast } = useCart();
  const navigate = useNavigate();

  /** A placed order has nothing left in the drawer to show, so the user lands on the board. */
  const placeOrderAndLeave = async () => {
    if (await placeOrder()) navigate('/orders');
  };

  return (
    <>
      <CartDrawer
        open={cartOpen}
        groups={cartGroups}
        totals={cartTotals}
        onQtyChange={setCartLineQty}
        onRemove={(offerId, patientId) => setCartLineQty(offerId, patientId, 0)}
        onClose={() => setCartOpen(false)}
        onViewCart={() => {
          setCartOpen(false);
          navigate('/cart');
        }}
        onPlaceOrder={placeOrderAndLeave}
        placing={placing}
      />
      <Toast message={toast} />
    </>
  );
}
