import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';

export default function Footer() {
  return (
    <footer className="border-t border-ink/10 mt-20 bg-parchment/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-3">
        <div>
          <BrandLogo className="h-14 w-auto mb-3" />
          <p className="text-sm text-ink-soft max-w-xs leading-relaxed">
            Clothes that fit like they were made for you. Scan once, shop your true size everywhere.
          </p>
        </div>
        <div>
          <div className="label-caps mb-3">Shop</div>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li><Link to="/shop?category=men" className="hover:text-clay">Men</Link></li>
            <li><Link to="/shop?category=women" className="hover:text-clay">Women</Link></li>
            <li><Link to="/scan" className="hover:text-clay">Find my fit</Link></li>
          </ul>
        </div>
        <div>
          <div className="label-caps mb-3">Privacy promise</div>
          <p className="text-sm text-ink-soft leading-relaxed max-w-xs">
            Body scans run entirely in your browser. We never upload photos — only the measurements
            you choose to save.
          </p>
        </div>
      </div>
      <div className="text-center text-xs text-ink-soft/60 pb-6">
        © {new Date().getFullYear()} linencut & more. Size recommendations are estimates — always check the chart.
      </div>
    </footer>
  );
}
