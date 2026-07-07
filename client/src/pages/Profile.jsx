import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR } from '../components/ProductCard.jsx';
import { hasUserPhoto, clearUserPhoto } from '../scan/userPhoto.js';

const STATUS_TINT = {
  pending: 'text-gold',
  confirmed: 'text-sage',
  shipped: 'text-sage',
  delivered: 'text-ink',
  cancelled: 'text-clay',
};

export default function Profile() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [photoCleared, setPhotoCleared] = useState(false);

  useEffect(() => {
    api('/orders/mine').then((d) => setOrders(d.orders)).catch(() => {});
  }, []);

  useEffect(() => {
    hasUserPhoto().then(setPhotoSaved);
  }, [photoCleared]);

  const handleDeletePhoto = async () => {
    await clearUserPhoto();
    setPhotoCleared((c) => !c);
    setPhotoSaved(false);
  };

  const m = user?.savedMeasurements;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-display text-4xl font-light mb-1">Hi, {user?.name?.split(' ')[0]}</h1>
      <p className="text-sm text-ink-soft mb-10">{user?.email}</p>

      {/* Fit profile */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-light">Your fit profile</h2>
          <Link to="/scan" className="text-[12px] tracking-[0.14em] uppercase text-clay hover:text-clay-deep">
            {m ? 'Rescan' : 'Scan now'} →
          </Link>
        </div>
        {m ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-ink/10 border border-ink/10">
            {[
              ['Height', m.height && `${m.height} cm`],
              ['Shoulder', m.shoulder && `${m.shoulder} cm`],
              ['Chest', m.chest && `${m.chest} cm`],
              ['Waist', m.waist && `${m.waist} cm`],
              ['Hip', m.hip && `${m.hip} cm`],
              ['Body type', m.bodyType],
              ['Tone', m.skinTone],
            ].map(([label, value]) => (
              <div key={label} className="bg-ivory px-3 py-4 text-center">
                <div className="font-display text-lg">{value || '—'}</div>
                <div className="text-[10px] tracking-[0.16em] uppercase text-ink-soft mt-1">{label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-ink/25 p-8 text-center text-ink-soft">
            <p className="mb-4">No measurements saved yet — scan once and every product will show your size.</p>
            <Link to="/scan" className="btn-accent">Find my fit</Link>
          </div>
        )}
        {m?.measuredAt && (
          <p className="text-xs text-ink-soft/60 mt-2">
            Measured {new Date(m.measuredAt).toLocaleDateString()}
          </p>
        )}
        {photoSaved && (
          <div className="mt-4 border border-ink/10 bg-parchment/40 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft max-w-md">
              A scan photo is saved on this device for virtual try-on. It is never stored on our
              servers.
            </p>
            <button type="button" onClick={handleDeletePhoto} className="btn-ghost text-sm">
              Delete my photo
            </button>
          </div>
        )}
      </section>

      {/* Orders */}
      <section>
        <h2 className="font-display text-2xl font-light mb-4">Orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-ink-soft">No orders yet.</p>
        ) : (
          <div className="divide-y divide-ink/10 border-y border-ink/10">
            {orders.map((o) => (
              <div key={o._id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {o.items.map((i) => `${i.name} (${i.size}×${i.quantity})`).join(', ')}
                  </div>
                  <div className="text-xs text-ink-soft mt-1">
                    {new Date(o.createdAt).toLocaleDateString()} · #{o._id.slice(-8)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatINR(o.total)}</div>
                  <div className={`text-[11px] uppercase tracking-[0.14em] ${STATUS_TINT[o.status] || ''}`}>
                    {o.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
