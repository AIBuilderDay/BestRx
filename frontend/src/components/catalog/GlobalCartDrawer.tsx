import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { Toast } from '../ui/Toast';
import { CartDrawer } from './CartDrawer';

/**
 * The one cart drawer for the whole app. Mounted by CartProvider so the header's cart button
 * opens it from every route, not only the views that used to render their own copy.
 */
export function GlobalCartDrawer() {
  const {
    cartGroups,
    cartTotals,
    setCartLineQty,
    cartOpen,
    setCartOpen,
    placeOrder,
    placing,
    toast,
    agentAdded,
    setAgentAdded,
  } = useCart();
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
        onRemove={(offerId, patientId, unit) => setCartLineQty(offerId, patientId, unit, 0)}
        onClose={() => {
          setCartOpen(false);
          setAgentAdded(null); // the spotlight is a one-time confirmation, not a permanent badge
        }}
        onViewCart={() => {
          setCartOpen(false);
          navigate('/cart');
        }}
        onPlaceOrder={placeOrderAndLeave}
        placing={placing}
        agentAdded={agentAdded}
      />
      <Toast message={toast} />
    </>
  );
}
