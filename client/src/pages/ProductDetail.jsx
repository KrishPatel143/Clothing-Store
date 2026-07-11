import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, tryOn } from '../api/client';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import SizeChartTable from '../components/SizeChartTable.jsx';
import TryOnPreview from '../components/TryOnPreview.jsx';
import { formatINR } from '../components/ProductCard.jsx';
import { bestSizeFromChart, loadLocalMeasurements } from '../scan/fit.js';
import { hasUserPhoto, loadUserPhoto, blobToBase64 } from '../scan/userPhoto.js';
import {
  createTryOnTrace,
  formatTryOnError,
  newTryOnRequestId,
  TRY_ON_STAGE_LABELS,
} from '../scan/tryOnTrace.js';
import { loadTryOnPreview, saveTryOnPreview } from '../scan/tryOnCache.js';

/** Sarees and similar pieces are sold without body sizing. */
function productHasSizing(product) {
  if (!product) return false;
  const text = [
    product.name,
    product.subCategory?.name,
    product.subCategory?.slug,
    product.category?.name,
    product.category?.slug,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/\b(saree|sari|dupatta|stole|shawl|scarf)\b/.test(text)) return false;
  if (!product.sizeChart?.length) return false;
  const bodySizes = product.sizeChart.filter((r) => {
    const s = String(r.size || '').toLowerCase().trim();
    return s && !/^(os|one\s*size|free\s*size|freesize|u)$/.test(s);
  });
  return bodySizes.length > 0;
}

export default function ProductDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { add } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [size, setSize] = useState(location.state?.recommendedSize || '');
  const [color, setColor] = useState('');
  const [added, setAdded] = useState(false);
  const [userHasPhoto, setUserHasPhoto] = useState(false);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnError, setTryOnError] = useState('');
  const [tryOnStage, setTryOnStage] = useState('');
  const [tryOnSrc, setTryOnSrc] = useState('');
  const [showingTryOn, setShowingTryOn] = useState(false);
  const tryOnUrlRef = useRef(null);

  const setTryOnImage = useCallback((url) => {
    if (tryOnUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(tryOnUrlRef.current);
    }
    tryOnUrlRef.current = url;
    setTryOnSrc(url || '');
  }, []);

  useEffect(() => () => {
    if (tryOnUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(tryOnUrlRef.current);
    }
  }, []);

  useEffect(() => {
    setProduct(null);
    api(`/products/${id}`, { auth: false }).then(setProduct).catch(() => {});
  }, [id]);

  useEffect(() => {
    hasUserPhoto().then(setUserHasPhoto);
  }, []);

  const measurements = useMemo(
    () => user?.savedMeasurements || loadLocalMeasurements(),
    [user]
  );

  const hasSizing = useMemo(() => productHasSizing(product), [product]);

  const fit = useMemo(() => {
    if (!product || !hasSizing || !measurements) return null;
    return bestSizeFromChart(measurements, product.sizeChart);
  }, [product, hasSizing, measurements]);

  useEffect(() => {
    if (!hasSizing) {
      setSize('One Size');
      return;
    }
    if (!size && fit?.size) setSize(fit.size);
  }, [fit, hasSizing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (product && !color && product.colors?.length) setColor(product.colors[0]);
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    setTryOnError('');
    setShowingTryOn(false);
    setTryOnImage('');

    loadTryOnPreview(id, imgIdx).then((record) => {
      if (cancelled || !record?.blob) return;
      const url = URL.createObjectURL(record.blob);
      setTryOnImage(url);
      setShowingTryOn(true);
    });

    return () => {
      cancelled = true;
    };
  }, [id, imgIdx, setTryOnImage]);

  const productImageUrl = product?.images?.[imgIdx];
  const gallerySrc = showingTryOn && tryOnSrc ? tryOnSrc : productImageUrl;

  const handleTryOn = useCallback(async () => {
    if (!productImageUrl) return;
    const trace = createTryOnTrace(newTryOnRequestId());
    setTryOnLoading(true);
    setTryOnError('');
    setTryOnStage('load_photo');
    try {
      trace.step('load_photo');
      const blob = await loadUserPhoto();
      if (!blob) {
        setUserHasPhoto(false);
        const err = new Error('No scan photo found. Complete a body scan first.');
        trace.fail('load_photo', err);
        setTryOnError(formatTryOnError(err, trace));
        return;
      }

      setTryOnStage('encode_person');
      trace.step('encode_person', { photoBytes: blob.size, photoType: blob.type });
      const personImageBase64 = await blobToBase64(blob);

      setTryOnStage('api_request');
      trace.step('api_request', {
        productUrl: productImageUrl.slice(0, 120),
        personBase64Chars: personImageBase64.length,
      });
      const { imageBase64, mimeType } = await tryOn({
        personImageBase64,
        productImageUrl,
        requestId: trace.requestId,
      });

      trace.step('render_preview');
      const previewBlob = await saveTryOnPreview({
        productId: id,
        imgIdx,
        productImageUrl,
        imageBase64,
        mimeType,
      });
      setTryOnImage(URL.createObjectURL(previewBlob));
      setShowingTryOn(true);
      trace.success({ outputMime: mimeType });
    } catch (err) {
      const failStage = err.stage || 'api_request';
      trace.fail(failStage, err, {
        serverSteps: err.steps,
        geminiMs: err.geminiMs,
        geminiMeta: err.geminiMeta,
      });
      setTryOnError(formatTryOnError(err, trace));
    } finally {
      setTryOnLoading(false);
      setTryOnStage('');
    }
  }, [productImageUrl, id, imgIdx, setTryOnImage]);

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-12">
        <div className="aspect-[4/5] bg-parchment shimmer" />
        <div className="space-y-4 pt-6">
          <div className="h-8 w-2/3 bg-parchment shimmer" />
          <div className="h-4 w-1/3 bg-parchment shimmer" />
        </div>
      </div>
    );
  }

  const handleAdd = () => {
    if (!size) return;
    add(product, size, color);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-2 gap-12">
      {/* Gallery */}
      <div>
        <div className="aspect-[4/5] bg-parchment overflow-hidden relative">
          {gallerySrc && (
            <img src={gallerySrc} alt={product.name} className="w-full h-full object-cover" />
          )}
          {tryOnLoading && (
            <div className="absolute inset-0 bg-ink/40 flex flex-col items-center justify-center text-ivory px-6 text-center">
              <p className="text-sm tracking-wide">
                {TRY_ON_STAGE_LABELS[tryOnStage] || 'Creating your try-on preview…'}
              </p>
              {tryOnStage === 'api_request' && (
                <p className="text-xs text-ivory/70 mt-2">This may take 1–2 minutes. Please keep this tab open.</p>
              )}
            </div>
          )}
        </div>
        {product.images?.length > 1 && !showingTryOn && (
          <div className="flex gap-2 mt-3">
            {product.images.map((src, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                className={`w-16 h-20 overflow-hidden border ${i === imgIdx ? 'border-clay' : 'border-transparent'}`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {userHasPhoto ? (
          <TryOnPreview
            loading={tryOnLoading}
            stage={tryOnStage}
            error={tryOnError}
            tryOnSrc={tryOnSrc}
            productSrc={productImageUrl}
            showingTryOn={showingTryOn}
            onGenerate={handleTryOn}
            onShowProduct={() => setShowingTryOn(false)}
            onShowTryOn={() => setShowingTryOn(true)}
          />
        ) : (
          <p className="text-sm text-ink-soft mt-4">
            Want to see it on you?{' '}
            <Link to="/scan" className="text-clay underline underline-offset-4 hover:text-clay-deep">
              Scan yourself first
            </Link>{' '}
            — your photo stays on this device.
          </p>
        )}
      </div>

      {/* Info */}
      <div>
        <p className="label-caps">{product.subCategory?.name || product.category?.name}</p>
        <h1 className="font-display text-4xl font-light leading-tight">{product.name}</h1>
        <p className="text-2xl mt-3">{formatINR(product.price)}</p>
        <p className="text-ink-soft mt-5 leading-relaxed">{product.description}</p>

        {/* Fit callout — only for sized garments */}
        {hasSizing && (
          <div className="mt-6 border border-clay/40 bg-clay/5 p-4">
            {fit ? (
              <p className="text-sm">
                <span className="text-clay font-medium">Based on your scan,</span> size{' '}
                <span className="font-display text-lg">{fit.size}</span> should fit you best
                <span className="text-ink-soft"> ({fit.confidence}% fit confidence)</span>.
              </p>
            ) : (
              <p className="text-sm text-ink-soft">
                Not sure of your size?{' '}
                <Link to="/scan" className="text-clay underline underline-offset-4 hover:text-clay-deep">
                  Scan yourself in 20 seconds
                </Link>{' '}
                and we'll pick it for you.
              </p>
            )}
          </div>
        )}

        {/* Color */}
        {product.colors?.length > 0 && (
          <div className="mt-6">
            <div className="label-caps">Colour — {color}</div>
            <div className="flex gap-2">
              {product.colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`px-4 py-2 text-sm border transition-colors ${
                    color === c ? 'bg-ink text-ivory border-ink' : 'border-ink/20 hover:border-ink'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sizes */}
        {hasSizing && (
          <div className="mt-6">
            <div className="label-caps">Size {fit && <span className="text-clay normal-case">· we picked {fit.size} for you</span>}</div>
            <div className="flex flex-wrap gap-2">
              {product.sizeChart?.map((row) => (
                <button
                  key={row.size}
                  onClick={() => setSize(row.size)}
                  className={`w-12 h-11 text-sm border transition-colors relative ${
                    size === row.size ? 'bg-ink text-ivory border-ink' : 'border-ink/20 hover:border-ink'
                  }`}
                >
                  {row.size}
                  {fit?.size === row.size && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-clay" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button onClick={handleAdd} disabled={!size || product.stock === 0} className="btn-primary flex-1">
            {product.stock === 0 ? 'Out of stock' : added ? 'Added ✓' : 'Add to cart'}
          </button>
          {hasSizing && (
            <Link to="/scan" className="btn-ghost whitespace-nowrap">Fits me?</Link>
          )}
        </div>
        {product.stock > 0 && product.stock <= 5 && (
          <p className="text-xs text-clay mt-2">Only {product.stock} left</p>
        )}

        {hasSizing && (
          <div className="mt-10">
            <SizeChartTable sizeChart={product.sizeChart} highlightSize={fit?.size} />
            <p className="text-[11px] text-ink-soft/70 mt-2">
              Recommendations are estimates from your scan — not tailor-grade. When between sizes, size up.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
