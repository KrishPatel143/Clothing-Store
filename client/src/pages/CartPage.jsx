import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { formatINR } from '../components/ProductCard.jsx';

export default function CartPage() {
  const { items, update, remove, total } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-light mb-3">Your cart is empty</h1>
        <p className="text-ink-soft mb-8">Find something that fits — literally.</p>
        <div className="flex justify-center gap-3">
          <Link to="/shop" className="btn-primary">Browse the collection</Link>
          <Link to="/scan" className="btn-ghost">Find my fit</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-display text-4xl font-light mb-8">Cart</h1>
      <div className="divide-y divide-ink/10 border-y border-ink/10">
        {items.map((item, i) => (
          <div key={`${item.product._id}-${item.size}-${item.color}`} className="py-5 flex gap-5">
            <Link to={`/product/${item.product._id}`} className="w-24 h-30 shrink-0 bg-parchment overflow-hidden">
              {item.product.images?.[0] && (
                <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between gap-4">
                <div>
                  <Link to={`/product/${item.product._id}`} className="font-display text-lg hover:text-clay">
                    {item.product.name}
                  </Link>
                  <p className="text-xs text-ink-soft mt-1 uppercase tracking-wide">
                    Size {item.size}{item.color ? ` · ${item.color}` : ''}
                  </p>
                </div>
                <div className="font-medium">{formatINR(item.product.price * item.quantity)}</div>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center border border-ink/20">
                  <button onClick={() => update(i, item.quantity - 1)} className="w-8 h-8 hover:bg-parchment">−</button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <button onClick={() => update(i, item.quantity + 1)} className="w-8 h-8 hover:bg-parchment">+</button>
                </div>
                <button onClick={() => remove(i)} className="text-xs text-ink-soft/60 hover:text-clay uppercase tracking-wide">
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-8">
        <div>
          <div className="label-caps">Total</div>
          <div className="font-display text-3xl">{formatINR(total)}</div>
        </div>
        <button onClick={() => navigate('/checkout')} className="btn-accent">Checkout →</button>
      </div>
    </div>
  );
}
