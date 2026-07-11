import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import HeightInput, { validateHeightInput } from '../components/HeightInput.jsx';
import FitProfileDisplay from '../components/FitProfileDisplay.jsx';
import { getPoseLandmarker, getSegmenter } from '../scan/vision.js';
import { framingFeedback, computeMeasurements } from '../scan/measure.js';
import { classifyBodyType, sampleSkinTone } from '../scan/classify.js';
import { saveLocalMeasurements } from '../scan/fit.js';
import { inToCm } from '../scan/units.js';
import { saveUserPhoto, canvasToBlob, clearUserPhoto } from '../scan/userPhoto.js';

const HOLD_FRAMES = 45; // ~1.5s of continuous good framing before capture

const SHOP_CATEGORIES = [
  { slug: 'men', label: 'Men' },
  { slug: 'women', label: 'Women' },
];

export default function ScanPage() {
  const navigate = useNavigate();
  const { user, saveMeasurements } = useAuth();

  // intro | camera | analyzing | results | manual
  const [stage, setStage] = useState('intro');
  const [category, setCategory] = useState(''); // 'men' | 'women'
  const [heightCm, setHeightCm] = useState(170);
  const [heightUnit, setHeightUnit] = useState('cm');
  const [feedback, setFeedback] = useState({ ok: false, message: 'Starting camera…' });
  const [holdProgress, setHoldProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [recs, setRecs] = useState([]);
  const [saved, setSaved] = useState(false);
  const [photoDeleted, setPhotoDeleted] = useState(false);
  const [manual, setManual] = useState({ shoulder: '', chest: '', waist: '', hip: '' });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const holdRef = useRef(0);
  const capturingRef = useRef(false);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ---------- capture & analysis ----------
  const analyze = useCallback(
    async (landmarks) => {
      capturingRef.current = true;
      setStage('analyzing');

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0);
      stopCamera();

      try {
        const photoBlob = await canvasToBlob(canvas);
        if (photoBlob) await saveUserPhoto(photoBlob);
      } catch {
        /* photo save is optional — measurements still work */
      }

      let mask = null;
      let maskW = 0;
      let maskH = 0;
      try {
        const segmenter = await getSegmenter();
        const seg = segmenter.segment(canvas);
        const conf = seg.confidenceMasks?.[0];
        if (conf) {
          mask = conf.getAsFloat32Array();
          maskW = conf.width;
          maskH = conf.height;
        }
        seg.close?.();
      } catch {
        // segmentation is an enhancement — landmark fallback still works
      }

      const measurements = computeMeasurements({
        landmarks,
        mask,
        maskW,
        maskH,
        heightCm: Number(heightCm),
        aspect: canvas.width / canvas.height,
      });

      if (!measurements) {
        setError('We could not read your pose clearly. Try again with better lighting.');
        setStage('intro');
        capturingRef.current = false;
        return;
      }

      const bodyType = classifyBodyType(measurements);
      let skinSample = null;
      try {
        skinSample = sampleSkinTone(ctx, canvas.width, canvas.height, landmarks);
      } catch {
        /* optional */
      }

      const profile = {
        ...measurements,
        bodyType,
        skinTone: skinSample?.category ?? null,
        skinColorHex: skinSample?.hex ?? null,
        heightUnit,
        category,
      };

      // A brief beat so the "analyzing" moment feels considered, not jumpy
      await new Promise((r) => setTimeout(r, 1600));
      finishWithProfile(profile);
    },
    [heightCm, heightUnit, category, stopCamera] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const finishWithProfile = async (profile) => {
    setResult(profile);
    saveLocalMeasurements(profile);
    setStage('results');
    capturingRef.current = false;
    try {
      const d = await api('/recommendations', {
        method: 'POST',
        body: {
          measurements: profile,
          bodyType: profile.bodyType,
          skinTone: profile.skinTone,
          category: profile.category || undefined,
          limit: 8,
        },
        auth: false,
      });
      setRecs(d.recommendations || []);
    } catch {
      setRecs([]);
    }
  };

  // ---------- live camera loop ----------
  const startCamera = async () => {
    setError('');
    if (!category) {
      setError('Choose Men or Women so we can match the right collection.');
      return;
    }
    const heightErr = validateHeightInput(heightCm);
    if (heightErr) {
      setError(heightErr);
      return;
    }
    setStage('camera');
    setFeedback({ ok: false, message: 'Loading the fit engine…' });
    try {
      const [stream, landmarker] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }),
        getPoseLandmarker(),
      ]);
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      holdRef.current = 0;
      const loop = () => {
        if (!streamRef.current || capturingRef.current) return;
        if (video.readyState >= 2) {
          const res = landmarker.detectForVideo(video, performance.now());
          const lms = res.landmarks?.[0];
          const fb = framingFeedback(lms);
          setFeedback(fb);
          holdRef.current = fb.ok ? holdRef.current + 1 : 0;
          setHoldProgress(Math.min(1, holdRef.current / HOLD_FRAMES));
          if (holdRef.current >= HOLD_FRAMES) {
            analyze(lms);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      stopCamera();
      setStage('intro');
      setError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission was declined — no problem. You can enter measurements manually below.'
          : 'Could not start the camera or load the model. You can still enter measurements manually.'
      );
    }
  };

  const submitManual = () => {
    setError('');
    if (!category) {
      setError('Choose Men or Women so we can match the right collection.');
      return;
    }
    const heightErr = validateHeightInput(heightCm);
    if (heightErr) {
      setError(heightErr);
      return;
    }
    const m = {
      height: heightCm || undefined,
      shoulder: inToCm(manual.shoulder) || undefined,
      chest: inToCm(manual.chest) || undefined,
      waist: inToCm(manual.waist) || undefined,
      hip: inToCm(manual.hip) || undefined,
    };
    if (!m.chest && !m.waist && !m.hip && !m.shoulder) {
      setError('Enter at least one measurement.');
      return;
    }
    finishWithProfile({
      ...m,
      bodyType: classifyBodyType(m),
      skinTone: null,
      skinColorHex: null,
      heightUnit,
      category,
    });
  };

  const handleHeightChange = ({ heightCm: cm, heightUnit: unit }) => {
    setHeightCm(cm);
    setHeightUnit(unit);
  };

  const handleSave = async () => {
    if (!user) {
      navigate('/login', { state: { from: '/scan' } });
      return;
    }
    await saveMeasurements(result);
    setSaved(true);
  };

  const handleDeletePhoto = async () => {
    await clearUserPhoto();
    setPhotoDeleted(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink text-ivory overflow-y-auto">
      {/* Close */}
      <button
        onClick={() => {
          stopCamera();
          navigate(-1);
        }}
        className="absolute top-5 right-5 z-20 w-10 h-10 border border-ivory/30 rounded-full flex items-center justify-center hover:bg-ivory/10 transition-colors"
        aria-label="Close"
      >
        ✕
      </button>

      {/* ---------- INTRO ---------- */}
      {stage === 'intro' && (
        <div className="min-h-full flex items-center justify-center px-6 py-16">
          <div className="max-w-md w-full text-center">
            <p className="rise label-caps text-gold">Find my fit</p>
            <h1 className="rise rise-1 font-display text-4xl font-light leading-tight">
              Twenty seconds to your <em className="text-gold">true size</em>
            </h1>
            <ul className="rise rise-2 text-left text-sm text-ivory/70 mt-8 space-y-3">
              <li className="flex gap-3"><span className="text-gold">—</span> Stand 2–3 m back so your whole body is visible</li>
              <li className="flex gap-3"><span className="text-gold">—</span> Face the camera, arms slightly away from your body</li>
              <li className="flex gap-3"><span className="text-gold">—</span> Fitted clothing and good lighting help accuracy</li>
            </ul>

            <div className="rise rise-2 mt-8 text-left space-y-5">
              <div>
                <p className="label-caps text-ivory/60 mb-2">Shopping for</p>
                <div className="grid grid-cols-2 gap-2">
                  {SHOP_CATEGORIES.map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => {
                        setCategory(c.slug);
                        setError('');
                      }}
                      className={`px-4 py-3 text-[13px] tracking-[0.16em] uppercase border transition-colors ${
                        category === c.slug
                          ? 'border-gold bg-gold/15 text-gold'
                          : 'border-ivory/25 text-ivory/70 hover:border-ivory/50 hover:text-ivory'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <HeightInput
                valueCm={heightCm}
                unit={heightUnit}
                onChange={handleHeightChange}
                variant="dark"
              />
            </div>

            {error && <p className="mt-4 text-sm text-[#e8a87c]">{error}</p>}

            <button onClick={startCamera} className="rise rise-3 btn-accent w-full mt-6">
              Open camera & scan me
            </button>
            <button
              onClick={() => setStage('manual')}
              className="rise rise-3 mt-3 text-sm text-ivory/50 underline underline-offset-4 hover:text-ivory"
            >
              I'd rather type my measurements
            </button>

            <p className="rise rise-3 mt-8 text-[11px] leading-relaxed text-ivory/40 border-t border-ivory/10 pt-4">
              <strong className="text-ivory/60">Privacy:</strong> your video is analysed on this
              device. One frame is saved locally in your browser for virtual try-on — it is never
              uploaded unless you choose to preview a product. Only measurement numbers are sent to
              our servers, and only if you save them.
            </p>
          </div>
        </div>
      )}

      {/* ---------- CAMERA ---------- */}
      <div className={stage === 'camera' ? 'block' : 'hidden'}>
        <div className="relative h-screen w-full overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />
          {/* Silhouette guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg viewBox="0 0 300 400" className="h-[86%] opacity-70">
              <path
                d="M150 40a26 26 0 1 1 0 52 26 26 0 0 1 0-52Zm-38 70h76c18 0 30 14 30 32l-8 78h-18l-4 120h-24l-6-90h-4l-6 90h-24l-4-120H102l-8-78c0-18 12-32 30-32Z"
                fill="none"
                stroke={feedback.ok ? '#9db787' : '#faf6ef'}
                strokeWidth="2.5"
                strokeDasharray="6 8"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
          </div>
          {/* Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(33,29,25,0.75)_100%)] pointer-events-none" />

          {/* Feedback pill */}
          <div className="absolute top-8 inset-x-0 flex flex-col items-center gap-2 px-6">
            {category && (
              <p className="text-[11px] tracking-[0.2em] uppercase text-ivory/50">
                Shopping {category === 'women' ? 'Women' : 'Men'}
              </p>
            )}
            <div
              className={`px-6 py-3 rounded-full backdrop-blur-md text-sm tracking-wide transition-colors duration-300 ${
                feedback.ok ? 'bg-[#9db787]/90 text-ink' : 'bg-ink/70 text-ivory'
              }`}
            >
              {feedback.message}
            </div>
          </div>

          {/* Hold progress */}
          <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-3 px-6">
            <div className="w-64 h-1 bg-ivory/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold transition-[width] duration-100"
                style={{ width: `${holdProgress * 100}%` }}
              />
            </div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-ivory/50">
              {feedback.ok ? 'Capturing…' : 'Align with the outline'}
            </p>
          </div>
        </div>
      </div>

      {/* ---------- ANALYZING ---------- */}
      {stage === 'analyzing' && (
        <div className="min-h-full h-screen flex flex-col items-center justify-center gap-8">
          <div className="relative w-40 h-56 border border-ivory/20 overflow-hidden">
            <svg viewBox="0 0 300 400" className="absolute inset-0 w-full h-full text-ivory/15">
              <path
                d="M150 40a26 26 0 1 1 0 52 26 26 0 0 1 0-52Zm-38 70h76c18 0 30 14 30 32l-8 78h-18l-4 120h-24l-6-90h-4l-6 90h-24l-4-120H102l-8-78c0-18 12-32 30-32Z"
                fill="currentColor"
              />
            </svg>
            <div className="scanline absolute left-2 right-2 h-px bg-gold shadow-[0_0_16px_2px_rgba(201,168,106,0.7)]" />
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-light">Analyzing your measurements…</p>
            <p className="text-sm text-ivory/50 mt-2">Reading shoulders, chest, waist & hips</p>
          </div>
        </div>
      )}

      {/* ---------- MANUAL ENTRY ---------- */}
      {stage === 'manual' && (
        <div className="min-h-full flex items-center justify-center px-6 py-16">
          <div className="max-w-md w-full">
            <h1 className="font-display text-3xl font-light mb-2">Enter your measurements</h1>
            <p className="text-sm text-ivory/50 mb-8">Body measurements in inches — a soft tape measure works best.</p>
            <div className="mb-6">
              <p className="label-caps text-ivory/60 mb-2">Shopping for</p>
              <div className="grid grid-cols-2 gap-2">
                {SHOP_CATEGORIES.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => {
                      setCategory(c.slug);
                      setError('');
                    }}
                    className={`px-4 py-3 text-[13px] tracking-[0.16em] uppercase border transition-colors ${
                      category === c.slug
                        ? 'border-gold bg-gold/15 text-gold'
                        : 'border-ivory/25 text-ivory/70 hover:border-ivory/50 hover:text-ivory'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['shoulder', 'Shoulder width'],
                ['chest', 'Chest around'],
                ['waist', 'Waist around'],
                ['hip', 'Hip around'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="label-caps text-ivory/60">{label} (in)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={manual[key]}
                    onChange={(e) => setManual((m) => ({ ...m, [key]: e.target.value }))}
                    className="w-full bg-transparent border border-ivory/30 px-3 py-2.5 focus:outline-none focus:border-gold"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <HeightInput
                  valueCm={heightCm}
                  unit={heightUnit}
                  onChange={handleHeightChange}
                  variant="dark"
                  label="Height"
                />
              </div>
            </div>
            {error && <p className="mt-4 text-sm text-[#e8a87c]">{error}</p>}
            <button onClick={submitManual} className="btn-accent w-full mt-6">See my matches</button>
            <button
              onClick={() => setStage('intro')}
              className="mt-3 w-full text-sm text-ivory/50 underline underline-offset-4 hover:text-ivory"
            >
              Back to camera scan
            </button>
          </div>
        </div>
      )}

      {/* ---------- RESULTS ---------- */}
      {stage === 'results' && result && (
        <div className="min-h-full bg-ivory text-ink">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <p className="rise label-caps text-clay">Your fit profile</p>
            <h1 className="rise rise-1 font-display text-4xl font-light">
              Here's what we measured
            </h1>
            <p className="rise rise-1 text-sm text-ink-soft mt-2 max-w-lg">
              These are careful estimates — not tailor-grade. You can always adjust sizes manually.
            </p>

            <FitProfileDisplay profile={result} className="rise rise-2 mt-8" />

            <div className="flex flex-wrap gap-3 mt-8">
              <button onClick={handleSave} disabled={saved} className="btn-primary">
                {saved ? 'Saved to your profile ✓' : user ? 'Save my measurements' : 'Sign in to save'}
              </button>
              <button
                onClick={() => {
                  setResult(null);
                  setRecs([]);
                  setSaved(false);
                  setPhotoDeleted(false);
                  setStage('intro');
                }}
                className="btn-ghost"
              >
                Rescan
              </button>
              {!photoDeleted && (
                <button type="button" onClick={handleDeletePhoto} className="btn-ghost text-sm">
                  Delete my photo
                </button>
              )}
            </div>
            {photoDeleted ? (
              <p className="text-xs text-ink-soft mt-3">Scan photo removed from this device.</p>
            ) : (
              <p className="text-xs text-ink-soft mt-3 max-w-lg">
                Your scan photo is saved on this device for virtual try-on on product pages. It is
                never stored on our servers unless you request a preview.
              </p>
            )}

            {/* Recommendations */}
            <div className="mt-16">
              <div className="flex items-end justify-between mb-6">
                <h2 className="font-display text-3xl font-light">
                  {result.category === 'women'
                    ? 'Women matches for you'
                    : result.category === 'men'
                      ? 'Men matches for you'
                      : 'Made-for-you matches'}
                </h2>
                <Link
                  to={result.category ? `/shop?category=${result.category}` : '/shop'}
                  className="text-[12px] tracking-[0.16em] uppercase text-clay hover:text-clay-deep"
                >
                  Browse all →
                </Link>
              </div>
              {recs.length === 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="aspect-[4/5] bg-parchment shimmer" />
                  ))}
                </div>
              ) : (
                <div className="flex gap-5 overflow-x-auto pb-4 snap-x">
                  {recs.map((r) => (
                    <div key={r.product._id} className="min-w-[220px] w-56 snap-start shrink-0">
                      <ProductCard
                        product={r.product}
                        recommendedSize={r.recommendedSize}
                        badge={`${r.fitConfidence}% fit`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
