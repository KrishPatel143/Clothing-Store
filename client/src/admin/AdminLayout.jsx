import { NavLink, Outlet, Link } from 'react-router-dom';

const link = ({ isActive }) =>
  `block px-4 py-2.5 text-sm tracking-wide transition-colors ${
    isActive ? 'bg-ink text-ivory' : 'text-ink-soft hover:bg-parchment'
  }`;

export default function AdminLayout() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-[200px_1fr] gap-10">
      <aside>
        <div className="label-caps mb-3">Admin</div>
        <nav className="border border-ink/10 divide-y divide-ink/10">
          <NavLink to="/admin" end className={link}>Dashboard</NavLink>
          <NavLink to="/admin/products" className={link}>Products</NavLink>
          <NavLink to="/admin/categories" className={link}>Categories</NavLink>
          <NavLink to="/admin/orders" className={link}>Orders</NavLink>
        </nav>
        <Link to="/" className="block mt-4 text-xs text-ink-soft/70 hover:text-clay">← Back to store</Link>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
