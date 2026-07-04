import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/products/admin/analytics').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-clay text-sm">{error}</p>;
  if (!stats) return <div className="h-40 bg-parchment shimmer" />;

  return (
    <div>
      <h1 className="font-display text-3xl font-light mb-8">Dashboard</h1>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {[
          ['Products', stats.totalProducts],
          ['Units in stock', stats.totalStock],
          ['Low stock alerts', stats.lowStock.length],
        ].map(([label, value]) => (
          <div key={label} className="border border-ink/10 bg-parchment/50 p-5">
            <div className="font-display text-4xl font-light">{value}</div>
            <div className="label-caps mt-1 mb-0">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <section>
          <h2 className="label-caps">Most viewed</h2>
          <ul className="divide-y divide-ink/10 border-y border-ink/10 text-sm">
            {stats.mostViewed.map((p) => (
              <li key={p._id} className="py-2.5 flex justify-between gap-3">
                <span className="truncate">{p.name}</span>
                <span className="text-ink-soft">{p.views}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="label-caps">Most recommended</h2>
          <ul className="divide-y divide-ink/10 border-y border-ink/10 text-sm">
            {stats.mostRecommended.map((p) => (
              <li key={p._id} className="py-2.5 flex justify-between gap-3">
                <span className="truncate">{p.name}</span>
                <span className="text-ink-soft">{p.recommendedCount}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="label-caps">Low stock (≤5)</h2>
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-ink-soft py-2">All healthy.</p>
          ) : (
            <ul className="divide-y divide-ink/10 border-y border-ink/10 text-sm">
              {stats.lowStock.map((p) => (
                <li key={p._id} className="py-2.5 flex justify-between gap-3">
                  <Link to={`/admin/products/${p._id}/edit`} className="truncate hover:text-clay">{p.name}</Link>
                  <span className={p.stock === 0 ? 'text-clay font-medium' : 'text-gold'}>{p.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
