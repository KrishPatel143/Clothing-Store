import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../context/CartContext.jsx';
import { formatINR } from '../components/ProductCard.jsx';

const FIELDS = [
  ['fullName', 'Full name', 'sm:col-span-2'],
  ['line1', 'Address line 1', 'sm:col-span-2'],
  ['line2', 'Address line 2 (optional)', 'sm:col-span-2'],
  ['city', 'City', ''],
  ['state', 'State', ''],
  ['postalCode', 'PIN code', ''],
  ['phone', 'Phone', ''],
];

export default function Checkout() {
  const { items, total, clear } = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState({});
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState(null);

  if (orderId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="font-display text-5xl text-clay mb-4">✓</div>
        <h1 className="font-display text-4xl font-light mb-3">Order placed</h1>
        <p className="text-ink-soft mb-8">
          Thank you — order <span className="font-mono text-sm">{orderId.slice(-8)}</span> is confirmed.
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/profile" className="btn-primary">View my orders</Link>
          <Link to="/shop" className="btn-ghost">Keep shopping</Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-ink-soft">Your cart is empty.</p>
        <Link to="/shop" className="btn-primary mt-6">Browse the collection</Link>
      </div>
    );
  }

  const placeOrder = async () => {
    const required = ['fullName', 'line1', 'city', 'state', 'postalCode', 'phone'];
    if (required.some((f) => !address[f]?.trim())) {
      setError('Please fill in all address fields.');
      return;
    }
    setPlacing(true);
    setError('');
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: {
          items: items.map((i) => ({
            product: i.product._id,
            size: i.size,
            color: i.color,
            quantity: i.quantity,
          })),
          address,
        },
      });
      clear();
      setOrderId(order._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-[1fr_320px] gap-12">
      <div>
        <h1 className="font-display text-4xl font-light mb-8">Checkout</h1>
        <div className="grid sm:grid-cols-2 gap-4">
          {FIELDS.map(([key, label, span]) => (
            <div key={key} className={span}>
              <label className="label-caps">{label}</label>
              <input
                className="input-field"
                value={address[key] || ''}
                onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-soft/70 mt-4">
          Payment: cash on delivery for this demo build.
        </p>
        {error && <p className="text-sm text-clay mt-4">{error}</p>}
        <button onClick={placeOrder} disabled={placing} className="btn-accent mt-6">
          {placing ? 'Placing order…' : `Place order — ${formatINR(total)}`}
        </button>
      </div>

      <aside className="border border-ink/10 bg-parchment/50 p-6 h-fit">
        <div className="label-caps mb-4">Order summary</div>
        <div className="space-y-3">
          {items.map((i, idx) => (
            <div key={idx} className="flex justify-between text-sm gap-3">
              <span className="text-ink-soft">
                {i.product.name} <span className="text-ink-soft/60">×{i.quantity} · {i.size}</span>
              </span>
              <span>{formatINR(i.product.price * i.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-ink/15 mt-4 pt-4 flex justify-between font-medium">
          <span>Total</span><span>{formatINR(total)}</span>
        </div>
      </aside>
    </div>
  );
}
