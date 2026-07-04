import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard.jsx';

const CATEGORIES = [
  { slug: 'men', label: 'Men', tint: 'bg-[#3b5b7c]' },
  { slug: 'women', label: 'Women', tint: 'bg-[#8d5b4c]' },
  { slug: 'kids', label: 'Kids', tint: 'bg-[#7d8471]' },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    api('/products?featured=true&limit=8', { auth: false })
      .then((d) => setFeatured(d.items))
      .catch(() => {});
    api('/products?sort=newest&limit=4', { auth: false })
      .then((d) => setTrending(d.items))
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          <p className="rise label-caps text-clay">AI-fitted fashion</p>
          <h1 className="rise rise-1 font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.04] font-light">
            Never guess your
            <em className="text-clay font-normal"> size </em>
            again.
          </h1>
          <p className="rise rise-2 mt-6 text-lg text-ink-soft max-w-lg leading-relaxed">
            A 20-second camera scan measures you — privately, right in your browser — and matches
            every garment in our store to your true fit.
          </p>
          <div className="rise rise-3 mt-8 flex flex-wrap gap-4">
            <Link to="/scan" className="btn-accent">Scan me — find my fit</Link>
            <Link to="/shop" className="btn-ghost">Browse the collection</Link>
          </div>
          <p className="rise rise-3 mt-5 text-xs text-ink-soft/70 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Photos never leave your device. Only your measurements do — if you say so.
          </p>
        </div>

        <div className="lg:col-span-5 relative hidden lg:block">
          <div className="aspect-[3/4] bg-parchment border border-ink/10 relative overflow-hidden shadow-lift">
            {/* Stylised silhouette + scanline */}
            <svg viewBox="0 0 300 400" className="absolute inset-0 w-full h-full text-ink/15">
              <path
                d="M150 40a26 26 0 1 1 0 52 26 26 0 0 1 0-52Zm-38 70h76c18 0 30 14 30 32l-8 78h-18l-4 120h-24l-6-90h-4l-6 90h-24l-4-120H102l-8-78c0-18 12-32 30-32Z"
                fill="currentColor"
              />
            </svg>
            <div className="scanline absolute left-6 right-6 h-px bg-clay shadow-[0_0_18px_2px_rgba(180,83,42,0.6)]" />
            <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] tracking-[0.2em] uppercase text-ink-soft">
              <span>Shoulder ✓</span><span>Chest ✓</span><span>Hip ✓</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-8 bg-ink text-ivory px-5 py-4 shadow-lift">
            <div className="font-display text-2xl">98%</div>
            <div className="text-[10px] tracking-[0.18em] uppercase opacity-70">fit confidence</div>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid sm:grid-cols-3 gap-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to={`/shop?category=${c.slug}`}
              className={`${c.tint} group relative h-44 flex items-end p-6 overflow-hidden`}
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <span className="relative font-display text-3xl text-ivory group-hover:translate-x-2 transition-transform duration-300">
                {c.label} <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-3xl font-light">The edit</h2>
            <Link to="/shop" className="text-[12px] tracking-[0.16em] uppercase text-clay hover:text-clay-deep">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
            {featured.map((p) => (
              <ProductCard key={p._id} product={p} badge="Featured" />
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="bg-ink text-ivory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="font-display text-3xl font-light mb-12 text-center">
            Your fit, in three steps
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              ['01', 'Stand & scan', 'Open the camera, follow the outline, hold still for a moment. That’s all.'],
              ['02', 'We measure', 'On-device AI reads your shoulders, chest, waist and hips — no photo is ever uploaded.'],
              ['03', 'Shop your size', 'Every product shows your best-matching size, ranked by fit confidence.'],
            ].map(([n, title, body]) => (
              <div key={n} className="text-center md:text-left">
                <div className="font-display text-5xl text-clay/80 mb-4">{n}</div>
                <h3 className="font-display text-xl mb-2">{title}</h3>
                <p className="text-sm text-ivory/60 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* New arrivals */}
      {trending.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="font-display text-3xl font-light mb-6">Just in</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
            {trending.map((p) => (
              <ProductCard key={p._id} product={p} badge="New" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
