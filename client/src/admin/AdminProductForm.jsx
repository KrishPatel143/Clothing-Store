import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
// Keep in sync with server/src/models/Product.js sizeRowSchema
const DIMS = [
  ['shoulder', 'Shoulder'],
  ['chest', 'Chest'],
  ['hip', 'Hip'],
];
const BODY_TYPES = ['Rectangle', 'Hourglass', 'Pear', 'Inverted Triangle', 'Apple', 'Athletic'];
const SKIN_TONES = ['Fair', 'Wheatish', 'Medium', 'Deep'];

const toIn = (cm) => (cm === '' || cm == null ? '' : Math.round((cm / 2.54) * 10) / 10);
const toCm = (inch) => (inch === '' || inch == null ? '' : Math.round(inch * 2.54 * 10) / 10);

const emptyRow = (size) => ({ size, shoulder: '', chest: '', hip: '' });

export default function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [cats, setCats] = useState({ tree: [] });
  const [unit, setUnit] = useState('cm'); // size chart entry unit; stored as cm
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    subCategory: '',
    price: '',
    stock: '',
    images: [''],
    colors: '',
    suitedBodyTypes: [],
    suitedSkinTones: [],
    featured: false,
    sizeChart: [emptyRow('S'), emptyRow('M'), emptyRow('L')],
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/categories', { auth: false }).then(setCats).catch(() => {});
    if (editing) {
      api(`/products/${id}`, { auth: false }).then((p) =>
        setForm({
          name: p.name,
          description: p.description || '',
          category: p.category?._id || '',
          subCategory: p.subCategory?._id || '',
          price: p.price,
          stock: p.stock,
          images: p.images?.length ? p.images : [''],
          colors: (p.colors || []).join(', '),
          suitedBodyTypes: p.suitedBodyTypes || [],
          suitedSkinTones: p.suitedSkinTones || [],
          featured: Boolean(p.featured),
          sizeChart: p.sizeChart?.length
            ? p.sizeChart.map((r) => ({
                size: r.size,
                shoulder: r.shoulder ?? '',
                chest: r.chest ?? '',
                hip: r.hip ?? '',
              }))
            : [emptyRow('M')],
        })
      );
    }
  }, [id, editing]);

  const subOptions = useMemo(() => {
    const root = cats.tree.find((r) => r._id === form.category);
    return root?.children || [];
  }, [cats, form.category]);

  const categoryOptions = useMemo(
    () => (cats.tree || []).filter((r) => r.slug !== 'kids'),
    [cats]
  );

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setChartCell = (idx, key, value) => {
    setForm((f) => {
      const chart = [...f.sizeChart];
      chart[idx] = {
        ...chart[idx],
        [key]: key === 'size' ? value : unit === 'in' ? toCm(Number(value) || '') : value,
      };
      return { ...f, sizeChart: chart };
    });
  };

  const availableSizes = ALL_SIZES.filter((s) => !form.sizeChart.some((r) => r.size === s));

  const toggleIn = (list, value) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const submit = async () => {
    setError('');
    if (!form.name || !form.category || form.price === '') {
      setError('Name, category and price are required.');
      return;
    }
    setBusy(true);
    const body = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock) || 0,
      images: form.images.map((s) => s.trim()).filter(Boolean),
      colors: form.colors.split(',').map((s) => s.trim()).filter(Boolean),
      subCategory: form.subCategory || null,
      sizeChart: form.sizeChart
        .filter((r) => r.size)
        .map((r) => ({
          size: r.size,
          shoulder: r.shoulder === '' ? undefined : Number(r.shoulder),
          chest: r.chest === '' ? undefined : Number(r.chest),
          hip: r.hip === '' ? undefined : Number(r.hip),
        })),
    };
    try {
      if (editing) await api(`/products/${id}`, { method: 'PUT', body });
      else await api('/products', { method: 'POST', body });
      navigate('/admin/products');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-light">{editing ? 'Edit product' : 'New product'}</h1>
        <Link to="/admin/products" className="text-sm text-ink-soft hover:text-clay">← All products</Link>
      </div>

      <div className="space-y-6">
        <div>
          <label className="label-caps">Name</label>
          <input className="input-field" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        <div>
          <label className="label-caps">Description</label>
          <textarea
            rows={3}
            className="input-field resize-y"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-caps">Category</label>
            <select
              className="input-field"
              value={form.category}
              onChange={(e) => {
                set('category', e.target.value);
                set('subCategory', '');
              }}
            >
              <option value="">Select…</option>
              {categoryOptions.map((r) => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-caps">Sub-category</label>
            <select
              className="input-field"
              value={form.subCategory}
              onChange={(e) => set('subCategory', e.target.value)}
              disabled={!subOptions.length}
            >
              <option value="">None</option>
              {subOptions.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label-caps">Price (₹)</label>
            <input type="number" min="0" className="input-field" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div>
            <label className="label-caps">Stock</label>
            <input type="number" min="0" className="input-field" value={form.stock} onChange={(e) => set('stock', e.target.value)} />
          </div>
          <label className="flex items-end gap-2 pb-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => set('featured', e.target.checked)}
              className="accent-clay w-4 h-4"
            />
            <span className="text-sm">Featured</span>
          </label>
        </div>

        <div>
          <label className="label-caps">Image URLs</label>
          {form.images.map((url, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                className="input-field"
                placeholder="https://… or data:image/…"
                value={url}
                onChange={(e) =>
                  set('images', form.images.map((u, j) => (j === i ? e.target.value : u)))
                }
              />
              <button
                onClick={() => set('images', form.images.filter((_, j) => j !== i))}
                className="px-3 border border-ink/20 hover:border-clay hover:text-clay"
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          ))}
          <button onClick={() => set('images', [...form.images, ''])} className="text-sm text-clay hover:text-clay-deep">
            + Add image
          </button>
        </div>

        <div>
          <label className="label-caps">Colours (comma-separated)</label>
          <input
            className="input-field"
            placeholder="Sky Blue, White"
            value={form.colors}
            onChange={(e) => set('colors', e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-caps">Flatters body types (empty = all)</label>
            <div className="flex flex-wrap gap-1.5">
              {BODY_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => set('suitedBodyTypes', toggleIn(form.suitedBodyTypes, t))}
                  className={`px-2.5 py-1 text-xs border transition-colors ${
                    form.suitedBodyTypes.includes(t)
                      ? 'bg-ink text-ivory border-ink'
                      : 'border-ink/20 text-ink-soft hover:border-ink'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label-caps">Suits skin tones (empty = all)</label>
            <div className="flex flex-wrap gap-1.5">
              {SKIN_TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => set('suitedSkinTones', toggleIn(form.suitedSkinTones, t))}
                  className={`px-2.5 py-1 text-xs border transition-colors ${
                    form.suitedSkinTones.includes(t)
                      ? 'bg-ink text-ivory border-ink'
                      : 'border-ink/20 text-ink-soft hover:border-ink'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Size chart editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label-caps mb-0">Size chart</label>
            <div className="flex border border-ink/20 text-[11px] tracking-[0.14em] uppercase">
              {['cm', 'in'].map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`px-3 py-1 ${unit === u ? 'bg-ink text-ivory' : 'text-ink-soft hover:text-ink'}`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto border border-ink/15">
            <table className="w-full text-sm">
              <thead className="bg-parchment text-left">
                <tr>
                  <th className="px-3 py-2 text-[11px] tracking-[0.12em] uppercase font-medium">Size</th>
                  {DIMS.map(([, label]) => (
                    <th key={label} className="px-3 py-2 text-[11px] tracking-[0.12em] uppercase font-medium">
                      {label} ({unit})
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {form.sizeChart.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">
                      <select
                        value={row.size}
                        onChange={(e) => setChartCell(i, 'size', e.target.value)}
                        className="input-field py-1.5"
                      >
                        <option value={row.size}>{row.size}</option>
                        {availableSizes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    {DIMS.map(([key]) => (
                      <td key={key} className="px-3 py-1.5">
                        <input
                          type="number"
                          step="0.1"
                          className="input-field py-1.5"
                          value={unit === 'in' ? toIn(row[key]) : row[key]}
                          onChange={(e) => setChartCell(i, key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="px-2 text-center">
                      <button
                        onClick={() => set('sizeChart', form.sizeChart.filter((_, j) => j !== i))}
                        className="text-ink-soft/50 hover:text-clay"
                        aria-label="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {availableSizes.length > 0 && (
            <button
              onClick={() => set('sizeChart', [...form.sizeChart, emptyRow(availableSizes[0])])}
              className="mt-2 text-sm text-clay hover:text-clay-deep"
            >
              + Add size row
            </button>
          )}
          <p className="text-[11px] text-ink-soft/70 mt-1">
            Values are stored in cm; the {unit === 'in' ? 'inch' : 'cm'} view converts automatically.
          </p>
        </div>

        {error && <p className="text-sm text-clay">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={submit} disabled={busy} className="btn-accent">
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
          </button>
          <Link to="/admin/products" className="btn-ghost">Cancel</Link>
        </div>
      </div>
    </div>
  );
}
