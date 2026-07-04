import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AdminCategories() {
  const [tree, setTree] = useState([]);
  const [newRoot, setNewRoot] = useState('');
  const [newSub, setNewSub] = useState({});
  const [error, setError] = useState('');

  const load = () => api('/categories', { auth: false }).then((d) => setTree(d.tree));
  useEffect(() => {
    load();
  }, []);

  const create = async (name, parentCategory) => {
    if (!name?.trim()) return;
    setError('');
    try {
      await api('/categories', { method: 'POST', body: { name: name.trim(), parentCategory } });
      setNewRoot('');
      setNewSub({});
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const rename = async (cat) => {
    const name = window.prompt(`Rename "${cat.name}" to:`, cat.name);
    if (!name || name === cat.name) return;
    await api(`/categories/${cat._id}`, { method: 'PUT', body: { name } });
    load();
  };

  const del = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    setError('');
    try {
      await api(`/categories/${cat._id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-light mb-8">Categories</h1>

      <div className="flex gap-2 mb-8">
        <input
          className="input-field max-w-xs"
          placeholder="New top-level category (e.g. Men)"
          value={newRoot}
          onChange={(e) => setNewRoot(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create(newRoot, null)}
        />
        <button onClick={() => create(newRoot, null)} className="btn-primary">Add</button>
      </div>

      {error && <p className="text-sm text-clay mb-4">{error}</p>}

      <div className="space-y-6">
        {tree.map((root) => (
          <div key={root._id} className="border border-ink/10">
            <div className="flex items-center justify-between bg-parchment px-4 py-3">
              <span className="font-display text-lg">{root.name}</span>
              <span className="space-x-4 text-sm">
                <button onClick={() => rename(root)} className="text-clay hover:text-clay-deep">Rename</button>
                <button onClick={() => del(root)} className="text-ink-soft/60 hover:text-clay">Delete</button>
              </span>
            </div>
            <ul className="divide-y divide-ink/10">
              {root.children.map((sub) => (
                <li key={sub._id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{sub.name}</span>
                  <span className="space-x-4">
                    <button onClick={() => rename(sub)} className="text-clay hover:text-clay-deep">Rename</button>
                    <button onClick={() => del(sub)} className="text-ink-soft/60 hover:text-clay">Delete</button>
                  </span>
                </li>
              ))}
              <li className="flex gap-2 px-4 py-2.5">
                <input
                  className="input-field py-1.5 text-sm"
                  placeholder={`New sub-category under ${root.name}…`}
                  value={newSub[root._id] || ''}
                  onChange={(e) => setNewSub((s) => ({ ...s, [root._id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && create(newSub[root._id], root._id)}
                />
                <button
                  onClick={() => create(newSub[root._id], root._id)}
                  className="text-sm text-clay hover:text-clay-deep whitespace-nowrap"
                >
                  + Add
                </button>
              </li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
