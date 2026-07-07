export default function TryOnPreview({
  loading,
  error,
  tryOnSrc,
  productSrc,
  showingTryOn,
  onGenerate,
  onShowProduct,
  onShowTryOn,
}) {
  return (
    <div className="mt-4">
      {!showingTryOn && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="btn-ghost w-full text-sm"
        >
          {loading ? 'Generating preview…' : 'See how it looks on you'}
        </button>
      )}

      {showingTryOn && tryOnSrc && (
        <div className="flex gap-2">
          <button type="button" onClick={onShowTryOn} className="btn-primary flex-1 text-sm">
            Try-on preview
          </button>
          <button type="button" onClick={onShowProduct} className="btn-ghost flex-1 text-sm">
            Product photo
          </button>
        </div>
      )}

      {error && <p className="text-sm text-clay mt-2">{error}</p>}

      <p className="text-[11px] text-ink-soft/70 mt-3 leading-relaxed">
        Your photo stays on this device. It is only sent temporarily to generate a preview and is
        never stored on our servers.
      </p>

      {loading && (
        <p className="text-xs text-ink-soft mt-2 animate-pulse">This may take 15–30 seconds…</p>
      )}

      {!loading && !error && !tryOnSrc && productSrc && (
        <p className="text-xs text-ink-soft mt-2">
          Uses your scan photo with the selected product image.
        </p>
      )}
    </div>
  );
}
