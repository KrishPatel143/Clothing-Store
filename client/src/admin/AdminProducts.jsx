import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatINR } from '../components/ProductCard.jsx';

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({ sort, limit: 60 });
    if (search) q.set('search', search);
    api(`/products?${q}`, { auth: false })
      .then((d) => setItems(d.items))
      .finally(() => setLoading(false));
  };

  useEffect(load, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const del = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await api(`/products/${p._id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((x) => x._id !== p._id));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl font-light">Products</h1>
        <Link to="/admin/products/new" className="btn-accent">+ New product</Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="search"
          placeholder="Search products…"
          className="input-field max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field w-44">
          <option value="newest">Newest</option>
          <option value="price">Price ↑</option>
          <option value="-price">Price ↓</option>
        </select>
      </div>

      {loading ? (
        <div className="h-60 bg-parchment shimmer" />
      ) : (
        <div className="overflow-x-auto border border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-parchment text-left">
              <tr>
                {['Product', 'Category', 'Price', 'Stock', 'Sizes', ''].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[11px] tracking-[0.14em] uppercase font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {items.map((p) => (
                <tr key={p._id} className="hover:bg-parchment/40">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-9 h-11 object-cover" />}
                      <span className="font-medium">{p.name}</span>
                      {p.featured && <span className="text-[10px] uppercase tracking-wide text-gold">★</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {p.category?.name}{p.subCategory ? ` / ${p.subCategory.name}` : ''}
                  </td>
                  <td className="px-3 py-2.5">{formatINR(p.price)}</td>
                  <td className={`px-3 py-2.5 ${p.stock <= 5 ? 'text-clay font-medium' : ''}`}>{p.stock}</td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {p.sizeChart?.map((r) => r.size).join(' ') || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <Link to={`/admin/products/${p._id}/edit`} className="text-clay hover:text-clay-deep mr-4">Edit</Link>
                    <button onClick={() => del(p)} className="text-ink-soft/60 hover:text-clay">Delete</button>
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
