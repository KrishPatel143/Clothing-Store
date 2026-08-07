/**
 * R&D ONLY — dual-camera body measurement test page.
 * Route: /scan-rnd
 * Does NOT save to profile, recommendations, or IndexedDB.
 *
 * Modes:
 *  - 2 cameras: pick front + side devices, both live, capture together
 *  - 1 camera: sequential front then side (turn 90°)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPoseLandmarker, getSegmenter } from '../scan/vision.js';
import {
  framingFeedbackFront,
  framingFeedbackSide,
  computeDualMeasurements,
} from '../scan/measureDual.js';

const HOLD_FRAMES = 45; // ~1.5s both views good

async function listVideoDevices() {
  // Labels need a prior permission grant on most browsers
  const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  temp.getTracks().forEach((t) => t.stop());
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput');
}

async function openCamera(deviceId) {
  return navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
}

async function segmentCanvas(canvas) {
  try {
    const segmenter = await getSegmenter();
    const seg = segmenter.segment(canvas);
    const conf = seg.confidenceMasks?.[0];
    let mask = null;
    let maskW = 0;
    let maskH = 0;
    if (conf) {
      mask = conf.getAsFloat32Array();
      maskW = conf.width;
      maskH = conf.height;
    }
    seg.close?.();
    return { mask, maskW, maskH };
  } catch {
    return { mask: null, maskW: 0, maskH: 0 };
  }
}

async function snapFromVideo(video, landmarks) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0);
  const { mask, maskW, maskH } = await segmentCanvas(canvas);
  return {
    landmarks: landmarks.map((p) => ({ ...p })),
    mask,
    maskW,
    maskH,
    aspect: canvas.width / canvas.height,
    previewUrl: canvas.toDataURL('image/jpeg', 0.7),
  };
}

export default function ScanRndPage() {
  // intro | dual | sequential-front | sequential-side | analyzing | results
  const [stage, setStage] = useState('intro');
  const [heightCm, setHeightCm] = useState('170');
  const [devices, setDevices] = useState([]);
  const [frontDeviceId, setFrontDeviceId] = useState('');
  const [sideDeviceId, setSideDeviceId] = useState('');
  const [feedbackFront, setFeedbackFront] = useState({ ok: false, message: '…' });
  const [feedbackSide, setFeedbackSide] = useState({ ok: false, message: '…' });
  const [holdProgress, setHoldProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [frontDone, setFrontDone] = useState(false);

  const frontVideoRef = useRef(null);
  const sideVideoRef = useRef(null);
  const seqVideoRef = useRef(null);
  const frontStreamRef = useRef(null);
  const sideStreamRef = useRef(null);
  const seqStreamRef = useRef(null);
  const frontLmRef = useRef(null);
  const sideLmRef = useRef(null);
  const rafRef = useRef(null);
  const holdRef = useRef(0);
  const capturingRef = useRef(false);
  const frontSnapRef = useRef(null);
  const seqViewRef = useRef('front');

  const stopAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    frontStreamRef.current?.getTracks().forEach((t) => t.stop());
    sideStreamRef.current?.getTracks().forEach((t) => t.stop());
    seqStreamRef.current?.getTracks().forEach((t) => t.stop());
    frontStreamRef.current = null;
    sideStreamRef.current = null;
    seqStreamRef.current = null;
    try {
      frontLmRef.current?.close?.();
    } catch {
      /* ignore */
    }
    try {
      sideLmRef.current?.close?.();
    } catch {
      /* ignore */
    }
    frontLmRef.current = null;
    sideLmRef.current = null;
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  const refreshDevices = async () => {
    setError('');
    try {
      const list = await listVideoDevices();
      setDevices(list);
      if (list.length >= 1 && !frontDeviceId) setFrontDeviceId(list[0].deviceId);
      if (list.length >= 2 && !sideDeviceId) {
        setSideDeviceId(list[1].deviceId);
      } else if (list.length === 1) {
        setSideDeviceId('');
      }
      if (list.length < 2) {
        setError('Only 1 camera found. Dual mode needs 2 webcams — or use sequential (1 cam) below.');
      }
    } catch (err) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission declined.'
          : 'Could not list cameras.'
      );
    }
  };

  useEffect(() => {
    refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishDual = useCallback(
    async (front, side) => {
      setStage('analyzing');
      await new Promise((r) => setTimeout(r, 300));
      const out = computeDualMeasurements({
        front,
        side,
        heightCm: Number(heightCm),
      });
      if (!out) {
        setError('Could not compute measurements — check lighting and framing.');
        setStage('intro');
        return;
      }
      setResult(out);
      setStage('results');
    },
    [heightCm]
  );

  const startDualCameras = async () => {
    setError('');
    if (!Number(heightCm) || Number(heightCm) < 90 || Number(heightCm) > 230) {
      setError('Enter height (90–230 cm).');
      return;
    }
    if (!frontDeviceId || !sideDeviceId || frontDeviceId === sideDeviceId) {
      setError('Pick two different cameras for Front and Side.');
      return;
    }

    stopAll();
    capturingRef.current = false;
    holdRef.current = 0;
    setHoldProgress(0);
    setStage('dual');
    setFeedbackFront({ ok: false, message: 'Starting front camera…' });
    setFeedbackSide({ ok: false, message: 'Starting side camera…' });

    try {
      const [frontStream, sideStream, frontLm, sideLm] = await Promise.all([
        openCamera(frontDeviceId),
        openCamera(sideDeviceId),
        createPoseLandmarker(),
        createPoseLandmarker(),
      ]);

      frontStreamRef.current = frontStream;
      sideStreamRef.current = sideStream;
      frontLmRef.current = frontLm;
      sideLmRef.current = sideLm;

      const fv = frontVideoRef.current;
      const sv = sideVideoRef.current;
      fv.srcObject = frontStream;
      sv.srcObject = sideStream;
      await Promise.all([fv.play(), sv.play()]);

      const loop = async () => {
        if (!frontStreamRef.current || !sideStreamRef.current || capturingRef.current) return;

        let frontOk = false;
        let sideOk = false;
        let frontLms = null;
        let sideLms = null;
        const now = performance.now();

        if (fv.readyState >= 2) {
          const res = frontLm.detectForVideo(fv, now);
          frontLms = res.landmarks?.[0] || null;
          const fb = framingFeedbackFront(frontLms);
          setFeedbackFront(fb);
          frontOk = fb.ok;
        }
        if (sv.readyState >= 2) {
          const res = sideLm.detectForVideo(sv, now + 1);
          sideLms = res.landmarks?.[0] || null;
          const fb = framingFeedbackSide(sideLms);
          setFeedbackSide(fb);
          sideOk = fb.ok;
        }

        if (frontOk && sideOk) {
          holdRef.current += 1;
        } else {
          holdRef.current = 0;
        }
        setHoldProgress(Math.min(1, holdRef.current / HOLD_FRAMES));

        if (holdRef.current >= HOLD_FRAMES && frontLms && sideLms) {
          capturingRef.current = true;
          const [frontSnap, sideSnap] = await Promise.all([
            snapFromVideo(fv, frontLms),
            snapFromVideo(sv, sideLms),
          ]);
          stopAll();
          capturingRef.current = false;
          await finishDual(frontSnap, sideSnap);
          return;
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      stopAll();
      setStage('intro');
      setError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission declined.'
          : err?.name === 'OverconstrainedError' || err?.name === 'NotFoundError'
            ? 'Could not open one of the cameras — check device selection.'
            : 'Could not start dual cameras. Some devices only allow one camera at a time — use sequential mode.'
      );
    }
  };

  const startSequential = async (view) => {
    setError('');
    if (!Number(heightCm) || Number(heightCm) < 90 || Number(heightCm) > 230) {
      setError('Enter height (90–230 cm).');
      return;
    }
    stopAll();
    seqViewRef.current = view;
    capturingRef.current = false;
    holdRef.current = 0;
    setHoldProgress(0);
    setStage(view === 'front' ? 'sequential-front' : 'sequential-side');
    setFeedbackFront({
      ok: false,
      message: view === 'front' ? 'Loading camera…' : 'Turn 90° for side…',
    });

    try {
      const deviceId = view === 'front' ? frontDeviceId || undefined : frontDeviceId || undefined;
      const [stream, lm] = await Promise.all([openCamera(deviceId), createPoseLandmarker()]);
      seqStreamRef.current = stream;
      frontLmRef.current = lm;
      const video = seqVideoRef.current;
      video.srcObject = stream;
      await video.play();

      const loop = async () => {
        if (!seqStreamRef.current || capturingRef.current) return;
        if (video.readyState >= 2) {
          const res = lm.detectForVideo(video, performance.now());
          const lms = res.landmarks?.[0];
          const fb =
            seqViewRef.current === 'front' ? framingFeedbackFront(lms) : framingFeedbackSide(lms);
          setFeedbackFront(fb);
          holdRef.current = fb.ok ? holdRef.current + 1 : 0;
          setHoldProgress(Math.min(1, holdRef.current / HOLD_FRAMES));

          if (holdRef.current >= HOLD_FRAMES && lms) {
            capturingRef.current = true;
            const snap = await snapFromVideo(video, lms);
            stopAll();
            capturingRef.current = false;
            if (seqViewRef.current === 'front') {
              frontSnapRef.current = snap;
              setFrontDone(true);
              setStage('intro');
              setFeedbackFront({ ok: true, message: 'Front captured — next: side (turn 90°)' });
              return;
            }
            await finishDual(frontSnapRef.current, snap);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      stopAll();
      setStage('intro');
      setError(
        err?.name === 'NotAllowedError' ? 'Camera permission declined.' : 'Could not start camera.'
      );
    }
  };

  const reset = () => {
    stopAll();
    setStage('intro');
    frontSnapRef.current = null;
    setFrontDone(false);
    setResult(null);
    setError('');
    setHoldProgress(0);
  };

  const isDual = stage === 'dual';
  const isSeq = stage === 'sequential-front' || stage === 'sequential-side';
  const canDual = devices.length >= 2 && frontDeviceId && sideDeviceId && frontDeviceId !== sideDeviceId;

  return (
    <div className="min-h-screen bg-ink text-ivory">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="text-xs uppercase tracking-widest text-ivory/40 hover:text-gold">
            ← Exit R&D
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-gold/80 border border-gold/30 px-2 py-1">
            R&D · not product
          </span>
        </div>

        <h1 className="font-display text-3xl font-light mb-2">Dual-camera scan lab</h1>
        <p className="text-sm text-ivory/50 mb-8">
          Two webcams at once (front + side) + height. Or one camera sequential if you only have
          one. Nothing is saved.
        </p>

        {error && (
          <p className="mb-4 text-sm text-red-300/90 border border-red-400/30 px-3 py-2">{error}</p>
        )}

        {stage === 'intro' && (
          <div className="space-y-6">
            <div>
              <label className="label-caps text-ivory/60">Height (cm)</label>
              <input
                type="number"
                className="input mt-2 w-full max-w-xs"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                min={90}
                max={230}
              />
            </div>

            <div className="border border-ivory/10 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm uppercase tracking-widest text-gold">Cameras</h2>
                <button
                  type="button"
                  onClick={refreshDevices}
                  className="text-xs text-ivory/50 hover:text-ivory"
                >
                  Refresh list
                </button>
              </div>

              <p className="text-xs text-ivory/40">
                Found {devices.length} video device{devices.length === 1 ? '' : 's'}. Plug in 2
                USB webcams for true dual capture (place one in front, one at 90°).
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-caps text-ivory/60">Front camera</label>
                  <select
                    className="input mt-2 w-full"
                    value={frontDeviceId}
                    onChange={(e) => setFrontDeviceId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {devices.map((d, i) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-caps text-ivory/60">Side camera</label>
                  <select
                    className="input mt-2 w-full"
                    value={sideDeviceId}
                    onChange={(e) => setSideDeviceId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {devices.map((d, i) => (
                      <option key={d.deviceId} value={d.deviceId} disabled={d.deviceId === frontDeviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={startDualCameras}
              disabled={!canDual}
              className="btn-accent w-full disabled:opacity-40"
            >
              Start 2 cameras together
            </button>

            <div className="border-t border-ivory/10 pt-6 space-y-3">
              <p className="text-xs uppercase tracking-widest text-ivory/40">Fallback · 1 camera</p>
              {!frontDone ? (
                <button
                  type="button"
                  onClick={() => startSequential('front')}
                  className="w-full border border-ivory/20 py-3 text-sm hover:border-gold hover:text-gold"
                >
                  Sequential: capture front, then turn for side
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startSequential('side')}
                  className="w-full border border-gold/40 py-3 text-sm text-gold"
                >
                  Front done ✓ — capture side (turn 90°)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Dual live previews — keep mounted while dual so refs stay valid */}
        <div className={isDual ? 'block' : 'hidden'}>
          <div className="grid sm:grid-cols-2 gap-4">
            <CamPanel
              label="Front"
              videoRef={frontVideoRef}
              feedback={feedbackFront}
            />
            <CamPanel
              label="Side"
              videoRef={sideVideoRef}
              feedback={feedbackSide}
            />
          </div>
          <div className="mt-4">
            <p className="text-center text-xs text-ivory/50 mb-2">
              Hold still when both say ready
            </p>
            <div className="h-1 bg-ivory/20 rounded overflow-hidden">
              <div
                className="h-full bg-gold transition-all duration-100"
                style={{ width: `${holdProgress * 100}%` }}
              />
            </div>
          </div>
          <button type="button" onClick={reset} className="mt-4 w-full text-sm text-ivory/40 hover:text-ivory">
            Cancel
          </button>
        </div>

        {/* Sequential single preview */}
        <div className={isSeq ? 'block' : 'hidden'}>
          <div className="relative aspect-[3/4] max-w-md mx-auto bg-black overflow-hidden border border-ivory/10">
            <video
              ref={seqVideoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className={`text-center text-sm ${feedbackFront.ok ? 'text-gold' : 'text-ivory/80'}`}>
                {feedbackFront.message}
              </p>
              <div className="mt-2 h-1 bg-ivory/20 rounded overflow-hidden">
                <div
                  className="h-full bg-gold transition-all duration-100"
                  style={{ width: `${holdProgress * 100}%` }}
                />
              </div>
            </div>
          </div>
          <button type="button" onClick={reset} className="mt-4 w-full text-sm text-ivory/40 hover:text-ivory">
            Cancel
          </button>
        </div>

        {stage === 'analyzing' && (
          <div className="py-20 text-center">
            <p className="font-display text-2xl font-light">Merging front + side…</p>
          </div>
        )}

        {stage === 'results' && result && (
          <div className="space-y-8">
            <p className="text-xs uppercase tracking-widest text-gold/80">
              Depth source: {result.debug.depthSource}
            </p>
            <section>
              <h2 className="font-display text-xl font-light mb-3">Dual (front + side + height)</h2>
              <MeasureTable m={result.dual} />
            </section>
            <section>
              <h2 className="font-display text-xl font-light mb-3">
                Production (front only — depth ratios)
              </h2>
              {result.singleFront ? (
                <MeasureTable m={result.singleFront} />
              ) : (
                <p className="text-sm text-ivory/40">No front-only baseline.</p>
              )}
            </section>
            {result.singleFront && (
              <section>
                <h2 className="font-display text-xl font-light mb-3">Delta (dual − front-only)</h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {['shoulder', 'chest', 'waist', 'hip'].map((k) => {
                    const d = round1(result.dual[k] - result.singleFront[k]);
                    return (
                      <div key={k} className="border border-ivory/10 px-3 py-2">
                        <div className="text-ivory/40 text-xs uppercase">{k}</div>
                        <div className={d === 0 ? '' : d > 0 ? 'text-emerald-300' : 'text-amber-300'}>
                          {d > 0 ? '+' : ''}
                          {d} cm
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            <section>
              <h2 className="font-display text-xl font-light mb-3">Debug</h2>
              <pre className="text-xs text-ivory/50 overflow-auto border border-ivory/10 p-3 whitespace-pre-wrap">
                {JSON.stringify(result.debug, null, 2)}
              </pre>
            </section>
            <button type="button" onClick={reset} className="btn-accent w-full">
              Run another test
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CamPanel({ label, videoRef, feedback }) {
  return (
    <div className="relative aspect-[3/4] bg-black overflow-hidden border border-ivory/10">
      <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute top-2 left-2 text-[10px] uppercase tracking-widest bg-black/60 px-2 py-1">
        {label}
      </div>
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        <p className={`text-center text-xs ${feedback.ok ? 'text-gold' : 'text-ivory/80'}`}>
          {feedback.message}
        </p>
      </div>
    </div>
  );
}

function MeasureTable({ m }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {[
        ['Height', m.height, 'cm'],
        ['Shoulder', m.shoulder, 'cm'],
        ['Chest', m.chest, 'cm'],
        ['Waist', m.waist, 'cm'],
        ['Hip', m.hip, 'cm'],
      ].map(([label, val, unit]) => (
        <div key={label} className="border border-ivory/10 px-3 py-2">
          <div className="text-ivory/40 text-xs uppercase">{label}</div>
          <div className="font-display text-2xl font-light">
            {val ?? '—'}
            <span className="text-sm text-ivory/40 ml-1">{unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
