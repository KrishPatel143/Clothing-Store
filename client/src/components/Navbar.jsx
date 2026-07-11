import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import BrandLogo from './BrandLogo.jsx';

const navLink = ({ isActive }) =>
  `text-[13px] tracking-[0.16em] uppercase transition-colors ${
    isActive ? 'text-clay' : 'text-ink-soft hover:text-ink'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-ivory/85 backdrop-blur-md border-b border-ink/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        <Link to="/" className="block">
          <BrandLogo />
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          <NavLink to="/shop?category=men" className={navLink}>Men</NavLink>
          <NavLink to="/shop?category=women" className={navLink}>Women</NavLink>
          <NavLink to="/shop" className={navLink} end>All</NavLink>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            to="/scan"
            className="hidden sm:inline-flex items-center gap-2 border border-clay text-clay px-4 py-1.5 text-[12px] tracking-[0.16em] uppercase hover:bg-clay hover:text-ivory transition-all"
          >
            <span className="relative flex h-2 w-2">
              <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-clay" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-clay" />
            </span>
            Find my fit
          </Link>

          <Link to="/cart" className="relative text-ink-soft hover:text-ink transition-colors" aria-label="Cart">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 7h12l-1.2 12H7.2L6 7Z" />
              <path d="M9 7a3 3 0 0 1 6 0" />
            </svg>
            {count > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-clay text-ivory text-[10px] w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              {user.role === 'admin' && (
                <Link to="/admin" className="text-[12px] tracking-[0.14em] uppercase text-sage hover:text-ink">
                  Admin
                </Link>
              )}
              <Link to="/profile" className="text-[12px] tracking-[0.14em] uppercase text-ink-soft hover:text-ink">
                {user.name.split(' ')[0]}
              </Link>
              <button onClick={logout} className="text-[12px] tracking-[0.14em] uppercase text-ink-soft/60 hover:text-clay">
                Exit
              </button>
            </div>
          ) : (
            <Link to="/login" className="text-[12px] tracking-[0.14em] uppercase text-ink-soft hover:text-ink">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
