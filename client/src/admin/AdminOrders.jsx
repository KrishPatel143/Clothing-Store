import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatINR } from '../components/ProductCard.jsx';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api('/orders').then((d) => setOrders(d.orders)).catch(() => {});
  }, []);

  const setStatus = async (id, status) => {
    const updated = await api(`/orders/${id}/status`, { method: 'PUT', body: { status } });
    setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, status: updated.status } : o)));
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-light mb-8">Orders</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-ink-soft">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto border border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-parchment text-left">
              <tr>
                {['Order', 'Customer', 'Items', 'Total', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[11px] tracking-[0.14em] uppercase font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {orders.map((o) => (
                <tr key={o._id}>
                  <td className="px-3 py-2.5 font-mono text-xs">#{o._id.slice(-8)}</td>
                  <td className="px-3 py-2.5">
                    {o.user?.name}
                    <div className="text-xs text-ink-soft">{o.user?.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft max-w-xs">
                    {o.items.map((i) => `${i.name} (${i.size}×${i.quantity})`).join(', ')}
                  </td>
                  <td className="px-3 py-2.5">{formatINR(o.total)}</td>
                  <td className="px-3 py-2.5">
                    <select
                      value={o.status}
                      onChange={(e) => setStatus(o._id, e.target.value)}
                      className="input-field py-1.5 w-36"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
