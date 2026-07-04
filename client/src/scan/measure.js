import { LM } from './vision.js';

// ---------- geometry helpers ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// ---------- live framing feedback ----------
// Landmarks are normalized [0..1]. Returns { ok, message } used by the
// guided overlay ("move back", "stand straight", …).
export function framingFeedback(landmarks) {
  if (!landmarks?.length) return { ok: false, message: 'Step into the frame' };
  const lm = landmarks;
  const required = [LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];
  const visible = required.every((i) => (lm[i]?.visibility ?? 1) > 0.5);
  if (!visible) return { ok: false, message: 'Step back so your whole body is visible' };

  const headY = lm[LM.NOSE].y;
  const ankleY = (lm[LM.LEFT_ANKLE].y + lm[LM.RIGHT_ANKLE].y) / 2;
  const bodyFrac = ankleY - headY;
  if (bodyFrac < 0.55) return { ok: false, message: 'Come a little closer' };
  if (bodyFrac > 0.92 || headY < 0.03 || ankleY > 0.99)
    return { ok: false, message: 'Move back — keep head to feet in frame' };

  const shoulderTilt = Math.abs(lm[LM.LEFT_SHOULDER].y - lm[LM.RIGHT_SHOULDER].y);
  if (shoulderTilt > 0.035) return { ok: false, message: 'Stand up straight, shoulders level' };

  const shoulderW = Math.abs(lm[LM.LEFT_SHOULDER].x - lm[LM.RIGHT_SHOULDER].x);
  const leftArmOut = Math.abs(lm[LM.LEFT_WRIST].x - lm[LM.LEFT_HIP].x) > shoulderW * 0.18;
  const rightArmOut = Math.abs(lm[LM.RIGHT_WRIST].x - lm[LM.RIGHT_HIP].x) > shoulderW * 0.18;
  if (!leftArmOut || !rightArmOut)
    return { ok: false, message: 'Hold your arms slightly away from your body' };

  return { ok: true, message: 'Perfect — hold still' };
}

// ---------- silhouette width sampling ----------
// Scan a confidence-mask row around `yNorm` and return the widest run of
// body pixels, in normalized width. Averages 5 rows to reduce noise.
function maskWidthAt(mask, width, height, yNorm) {
  const widths = [];
  for (let dy = -2; dy <= 2; dy++) {
    const y = Math.min(height - 1, Math.max(0, Math.round(yNorm * height) + dy));
    let left = -1;
    let right = -1;
    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[rowStart + x] > 0.5) {
        if (left === -1) left = x;
        right = x;
      }
    }
    if (left !== -1) widths.push((right - left + 1) / width);
  }
  if (!widths.length) return null;
  widths.sort((a, b) => a - b);
  return widths[Math.floor(widths.length / 2)]; // median
}

// Ellipse circumference (Ramanujan) from front-view width, assuming a
// per-region depth-to-width ratio. This is the honest approximation a single
// camera allows — the UI labels results as estimates.
function circumferenceFromWidth(widthCm, depthRatio) {
  const a = widthCm / 2;
  const b = (widthCm * depthRatio) / 2;
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

const DEPTH_RATIO = { chest: 0.72, waist: 0.75, hip: 0.78 };

// ---------- main measurement pipeline ----------
// landmarks: normalized pose landmarks of the captured frame
// mask/maskW/maskH: selfie-segmentation confidence mask (optional but better)
// heightCm: user-entered height — our scale reference
// aspect: frame width/height, to convert normalized x-distances correctly
export function computeMeasurements({ landmarks, mask, maskW, maskH, heightCm, aspect }) {
  const lm = landmarks;
  const nose = lm[LM.NOSE];
  const midShoulder = mid(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
  const midHip = mid(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
  const midHeel = mid(lm[LM.LEFT_HEEL] || lm[LM.LEFT_ANKLE], lm[LM.RIGHT_HEEL] || lm[LM.RIGHT_ANKLE]);

  // Top of head ≈ nose raised by 55% of the nose→shoulder distance.
  const headTopY = nose.y - (midShoulder.y - nose.y) * 0.55;
  const bodyHeightNorm = midHeel.y - headTopY;
  if (bodyHeightNorm <= 0.1) return null;

  // cm per normalized-y unit; x distances additionally scaled by frame aspect.
  const cmPerY = heightCm / bodyHeightNorm;
  const cmX = (a, b) => Math.hypot((a.x - b.x) * aspect, a.y - b.y) * cmPerY;

  // Shoulder: landmark joints sit inside the deltoids — widen slightly.
  const shoulder = cmX(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]) * 1.12;

  // Vertical sampling levels along the torso
  const chestY = midShoulder.y + (midHip.y - midShoulder.y) * 0.22;
  const waistY = midShoulder.y + (midHip.y - midShoulder.y) * 0.62;
  const hipY = midHip.y + (midHip.y - midShoulder.y) * 0.12;

  let chestW;
  let waistW;
  let hipW;
  if (mask && maskW && maskH) {
    const norm = (w) => (w != null ? w * aspect * cmPerY : null);
    chestW = norm(maskWidthAt(mask, maskW, maskH, chestY));
    waistW = norm(maskWidthAt(mask, maskW, maskH, waistY));
    hipW = norm(maskWidthAt(mask, maskW, maskH, hipY));
    // Arms held out can still merge with the torso at chest level; clamp
    // implausible widths back to landmark-derived estimates.
    if (chestW && chestW > shoulder * 1.25) chestW = null;
    if (waistW && chestW && waistW > chestW * 1.15) waistW = null;
  }
  // Landmark-only fallbacks (anthropometric ratios)
  const hipJointW = cmX(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
  chestW = chestW || shoulder * 0.86;
  waistW = waistW || hipJointW * 1.35;
  hipW = hipW || hipJointW * 1.65;

  const round1 = (v) => Math.round(v * 10) / 10;
  return {
    height: Math.round(heightCm),
    shoulder: round1(shoulder),
    chest: round1(circumferenceFromWidth(chestW, DEPTH_RATIO.chest)),
    waist: round1(circumferenceFromWidth(waistW, DEPTH_RATIO.waist)),
    hip: round1(circumferenceFromWidth(hipW, DEPTH_RATIO.hip)),
  };
}
