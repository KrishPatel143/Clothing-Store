import { TRY_ON_STAGE_LABELS } from '../scan/tryOnTrace.js';

export default function TryOnPreview({
  loading,
  stage,
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
          {loading ? 'Generating preview…' : tryOnSrc ? 'Regenerate preview' : 'See how it looks on you'}
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

      {error && (
        <div className="text-sm text-clay mt-2 space-y-1">
          <p>{error}</p>
          <p className="text-[11px] text-ink-soft/80">
            Open the browser console (F12) for the full try-on trace — request id, stage timings,
            and server response details.
          </p>
        </div>
      )}

      <p className="text-[11px] text-ink-soft/70 mt-3 leading-relaxed">
        Your photo stays on this device. It is only sent temporarily to generate a preview and is
        never stored on our servers.
      </p>

      {loading && (
        <div className="text-xs text-ink-soft mt-2 space-y-1">
          <p className="animate-pulse">{TRY_ON_STAGE_LABELS[stage] || 'Working…'}</p>
          {(stage === 'api_request' || !stage) && (
            <p>AI generation may take 1–2 minutes. Do not close this tab.</p>
          )}
        </div>
      )}

      {!loading && !error && !tryOnSrc && productSrc && (
        <p className="text-xs text-ink-soft mt-2">
          Uses your scan photo with the selected product image. Generation usually takes 1–2 minutes.
        </p>
      )}
    </div>
  );
}
