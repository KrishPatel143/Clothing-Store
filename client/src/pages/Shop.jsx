import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard.jsx';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  const category = params.get('category') === 'kids' ? '' : (params.get('category') || '');
  const subCategory = params.get('subCategory') || '';
  const size = params.get('size') || '';
  const maxPrice = params.get('maxPrice') || '';
  const search = params.get('search') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page') || 1);

  useEffect(() => {
    api('/categories', { auth: false })
      .then((d) => setTree((d.tree || []).filter((r) => r.slug !== 'kids')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (category) q.set('category', category);
    if (subCategory) q.set('subCategory', subCategory);
    if (size) q.set('size', size);
    if (maxPrice) q.set('maxPrice', maxPrice);
    if (search) q.set('search', search);
    q.set('sort', sort);
    q.set('page', page);
    api(`/products?${q}`, { auth: false })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, subCategory, size, maxPrice, search, sort, page]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    if (key === 'category') next.delete('subCategory');
    setParams(next);
  };

  const activeRoot = useMemo(
    () => tree.find((r) => r.slug === category),
    [tree, category]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-4xl font-light capitalize">
            {activeRoot?.name || 'All clothing'}
          </h1>
          <p className="text-sm text-ink-soft mt-1">{data.total} pieces</p>
        </div>
        <input
          type="search"
          placeholder="Search the collection…"
          defaultValue={search}
          onKeyDown={(e) => e.key === 'Enter' && setParam('search', e.currentTarget.value)}
          className="input-field max-w-xs"
        />
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-10">
        {/* Filters */}
        <aside className="space-y-8">
          <div>
            <div className="label-caps">Category</div>
            <div className="space-y-1.5">
              <button
                onClick={() => setParam('category', '')}
                className={`block text-sm ${!category ? 'text-clay' : 'text-ink-soft hover:text-ink'}`}
              >
                Everything
              </button>
              {tree.map((root) => (
                <div key={root._id}>
                  <button
                    onClick={() => setParam('category', root.slug)}
                    className={`block text-sm ${category === root.slug ? 'text-clay' : 'text-ink-soft hover:text-ink'}`}
                  >
                    {root.name}
                  </button>
                  {category === root.slug &&
                    root.children.map((sub) => (
                      <button
                        key={sub._id}
                        onClick={() => setParam('subCategory', subCategory === sub.slug ? '' : sub.slug)}
                        className={`block text-[13px] ml-4 mt-1 ${
                          subCategory === sub.slug ? 'text-clay' : 'text-ink-soft/70 hover:text-ink'
                        }`}
                      >
                        {sub.name}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="label-caps">Size</div>
            <div className="flex flex-wrap gap-1.5">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setParam('size', size === s ? '' : s)}
                  className={`w-10 h-9 text-xs border transition-colors ${
                    size === s
                      ? 'bg-ink text-ivory border-ink'
                      : 'border-ink/20 text-ink-soft hover:border-ink'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label-caps">Max price — ₹{maxPrice || '5,000+'}</div>
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={maxPrice || 5000}
              onChange={(e) => setParam('maxPrice', e.target.value === '5000' ? '' : e.target.value)}
              className="w-full accent-clay"
            />
          </div>

          <div>
            <div className="label-caps">Sort</div>
            <select value={sort} onChange={(e) => setParam('sort', e.target.value)} className="input-field">
              <option value="newest">Newest</option>
              <option value="price">Price: low → high</option>
              <option value="-price">Price: high → low</option>
            </select>
          </div>
        </aside>

        {/* Grid */}
        <div>
          {loading ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-parchment shimmer" />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <div className="py-24 text-center text-ink-soft">
              <p className="font-display text-2xl mb-2">Nothing here yet</p>
              <p className="text-sm">Try loosening a filter or two.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-8">
                {data.items.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
              {data.pages > 1 && (
                <div className="flex justify-center gap-2 mt-12">
                  {Array.from({ length: data.pages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setParam('page', String(i + 1))}
                      className={`w-9 h-9 text-sm border ${
                        page === i + 1 ? 'bg-ink text-ivory border-ink' : 'border-ink/20 hover:border-ink'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
