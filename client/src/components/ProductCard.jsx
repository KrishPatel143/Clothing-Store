import { Link } from 'react-router-dom';

export function formatINR(n) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

export default function ProductCard({ product, badge, recommendedSize }) {
  return (
    <Link
      to={`/product/${product._id}`}
      state={recommendedSize ? { recommendedSize } : undefined}
      className="group block"
    >
      <div className="relative overflow-hidden bg-parchment aspect-[4/5]">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-soft/40 font-display text-lg">
            {product.name}
          </div>
        )}
        {badge && (
          <span className="absolute top-3 left-3 bg-ink/85 text-ivory text-[11px] tracking-[0.14em] uppercase px-3 py-1">
            {badge}
          </span>
        )}
        {recommendedSize && (
          <span className="absolute bottom-3 left-3 bg-clay text-ivory text-[11px] tracking-[0.12em] uppercase px-3 py-1">
            Your size: {recommendedSize}
          </span>
        )}
      </div>
      <div className="pt-3 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-[17px] leading-snug group-hover:text-clay transition-colors">
            {product.name}
          </h3>
          <p className="text-xs text-ink-soft mt-0.5 tracking-wide uppercase">
            {product.subCategory?.name || product.category?.name}
          </p>
        </div>
        <div className="text-sm font-medium whitespace-nowrap">{formatINR(product.price)}</div>
      </div>
    </Link>
  );
}
