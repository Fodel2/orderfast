import { useCart } from '../../context/CartContext';
import CustomerLayout from '../../components/CustomerLayout';
import CartView from '@/components/CartView';

export default function CartPage() {
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <CustomerLayout cartCount={itemCount}>
      <div className="mx-auto max-w-screen-sm px-4 pt-6 pb-16">
        <CartView />
      </div>
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
