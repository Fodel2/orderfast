import { useCart } from '../../context/CartContext';
import CustomerLayout from '../../components/CustomerLayout';
import CartDrawer from '../../components/CartDrawer';

export default function CartPage() {
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <CustomerLayout cartCount={itemCount}>
      <CartDrawer inline />
    </CustomerLayout>
  );
}

export async function getStaticProps() {
  return {
    props: {
      customerMode: true,
      cartCount: 0,
    },
  };
}
