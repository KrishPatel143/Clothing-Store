// =============================================================================
// R&D ONLY — dual-view body measurement (front + side + height)
// Not used by the production /scan flow. See ScanRndPage.jsx.
//
// Idea: production measure.js estimates circumference from front width alone
// using fixed DEPTH_RATIO guesses. Here we capture a real side-view depth and
// build the ellipse from measured width × measured depth.
// =============================================================================

import { LM } from './vision.js';
import { computeMeasurements } from './measure.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

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
  return widths[Math.floor(widths.length / 2)];
}

function circumferenceFromAxes(widthCm, depthCm) {
  const a = widthCm / 2;
  const b = depthCm / 2;
  if (a <= 0 || b <= 0) return null;
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

const round1 = (v) => Math.round(v * 10) / 10;

/** Front-facing framing (same idea as production). */
export function framingFeedbackFront(landmarks) {
  if (!landmarks?.length) return { ok: false, message: 'Step into the frame — face the camera' };
  const lm = landmarks;
  const required = [
    LM.NOSE,
    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,
    LM.LEFT_HIP,
    LM.RIGHT_HIP,
    LM.LEFT_ANKLE,
    LM.RIGHT_ANKLE,
  ];
  if (!required.every((i) => (lm[i]?.visibility ?? 1) > 0.5)) {
    return { ok: false, message: 'Step back so your whole body is visible' };
  }

  const headY = lm[LM.NOSE].y;
  const ankleY = (lm[LM.LEFT_ANKLE].y + lm[LM.RIGHT_ANKLE].y) / 2;
  const bodyFrac = ankleY - headY;
  if (bodyFrac < 0.55) return { ok: false, message: 'Come a little closer' };
  if (bodyFrac > 0.92 || headY < 0.03 || ankleY > 0.99) {
    return { ok: false, message: 'Move back — keep head to feet in frame' };
  }

  const shoulderTilt = Math.abs(lm[LM.LEFT_SHOULDER].y - lm[LM.RIGHT_SHOULDER].y);
  if (shoulderTilt > 0.035) return { ok: false, message: 'Stand up straight, shoulders level' };

  // Both shoulders should be roughly equally visible → facing camera
  const shoulderSep = Math.abs(lm[LM.LEFT_SHOULDER].x - lm[LM.RIGHT_SHOULDER].x);
  if (shoulderSep < 0.12) {
    return { ok: false, message: 'Turn to face the camera (front view)' };
  }

  const shoulderW = shoulderSep;
  const leftArmOut = Math.abs(lm[LM.LEFT_WRIST].x - lm[LM.LEFT_HIP].x) > shoulderW * 0.18;
  const rightArmOut = Math.abs(lm[LM.RIGHT_WRIST].x - lm[LM.RIGHT_HIP].x) > shoulderW * 0.18;
  if (!leftArmOut || !rightArmOut) {
    return { ok: false, message: 'Hold your arms slightly away from your body' };
  }

  return { ok: true, message: 'Front view — hold still' };
}

/**
 * Side / profile framing.
 * Expects a clear left or right profile: one shoulder much closer in x,
 * nose offset from mid-shoulder, whole body in frame.
 */
export function framingFeedbackSide(landmarks) {
  if (!landmarks?.length) return { ok: false, message: 'Step into the frame — stand sideways' };
  const lm = landmarks;
  const required = [LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP];
  if (!required.every((i) => (lm[i]?.visibility ?? 1) > 0.35)) {
    return { ok: false, message: 'Step back so head to hips are visible' };
  }

  const headY = lm[LM.NOSE].y;
  const ankleY =
    (lm[LM.LEFT_ANKLE]?.visibility ?? 0) > 0.3 && (lm[LM.RIGHT_ANKLE]?.visibility ?? 0) > 0.3
      ? (lm[LM.LEFT_ANKLE].y + lm[LM.RIGHT_ANKLE].y) / 2
      : Math.max(lm[LM.LEFT_HIP].y, lm[LM.RIGHT_HIP].y) + 0.35;

  const bodyFrac = ankleY - headY;
  if (bodyFrac < 0.45) return { ok: false, message: 'Come a little closer' };
  if (headY < 0.02) return { ok: false, message: 'Move back — keep head in frame' };

  const shoulderSep = Math.abs(lm[LM.LEFT_SHOULDER].x - lm[LM.RIGHT_SHOULDER].x);
  // In true profile, shoulders nearly overlap in x
  if (shoulderSep > 0.1) {
    return { ok: false, message: 'Turn 90° — stand in profile (side view)' };
  }

  const midShoulder = mid(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
  const noseOffset = Math.abs(lm[LM.NOSE].x - midShoulder.x);
  if (noseOffset < 0.04) {
    return { ok: false, message: 'Turn more — nose should point left or right' };
  }

  return { ok: true, message: 'Side view — hold still' };
}

function torsoLevels(landmarks) {
  const midShoulder = mid(landmarks[LM.LEFT_SHOULDER], landmarks[LM.RIGHT_SHOULDER]);
  const midHip = mid(landmarks[LM.LEFT_HIP], landmarks[LM.RIGHT_HIP]);
  return {
    midShoulder,
    midHip,
    chestY: midShoulder.y + (midHip.y - midShoulder.y) * 0.22,
    waistY: midShoulder.y + (midHip.y - midShoulder.y) * 0.62,
    hipY: midHip.y + (midHip.y - midShoulder.y) * 0.12,
  };
}

function scaleFromFront(landmarks, heightCm, aspect) {
  const nose = landmarks[LM.NOSE];
  const midShoulder = mid(landmarks[LM.LEFT_SHOULDER], landmarks[LM.RIGHT_SHOULDER]);
  const midHeel = mid(
    landmarks[LM.LEFT_HEEL] || landmarks[LM.LEFT_ANKLE],
    landmarks[LM.RIGHT_HEEL] || landmarks[LM.RIGHT_ANKLE]
  );
  const headTopY = nose.y - (midShoulder.y - nose.y) * 0.55;
  const bodyHeightNorm = midHeel.y - headTopY;
  if (bodyHeightNorm <= 0.1) return null;
  const cmPerY = heightCm / bodyHeightNorm;
  return { cmPerY, aspect, bodyHeightNorm };
}

function sampleWidthsCm({ landmarks, mask, maskW, maskH, cmPerY, aspect }) {
  const { chestY, waistY, hipY, midShoulder } = torsoLevels(landmarks);
  const toCm = (wNorm) => (wNorm != null ? wNorm * aspect * cmPerY : null);

  let chestW = null;
  let waistW = null;
  let hipW = null;
  if (mask && maskW && maskH) {
    chestW = toCm(maskWidthAt(mask, maskW, maskH, chestY));
    waistW = toCm(maskWidthAt(mask, maskW, maskH, waistY));
    hipW = toCm(maskWidthAt(mask, maskW, maskH, hipY));
  }

  const shoulder =
    Math.hypot(
      (landmarks[LM.LEFT_SHOULDER].x - landmarks[LM.RIGHT_SHOULDER].x) * aspect,
      landmarks[LM.LEFT_SHOULDER].y - landmarks[LM.RIGHT_SHOULDER].y
    ) *
    cmPerY *
    1.12;

  if (chestW && chestW > shoulder * 1.25) chestW = null;

  const hipJointW =
    Math.hypot(
      (landmarks[LM.LEFT_HIP].x - landmarks[LM.RIGHT_HIP].x) * aspect,
      landmarks[LM.LEFT_HIP].y - landmarks[LM.RIGHT_HIP].y
    ) * cmPerY;

  return {
    shoulder: round1(shoulder),
    chestW: chestW || round1(shoulder * 0.86),
    waistW: waistW || round1(hipJointW * 1.35),
    hipW: hipW || round1(hipJointW * 1.65),
    levels: { chestY, waistY, hipY, shoulderY: midShoulder.y },
  };
}

/**
 * Side-view depth = silhouette thickness (front→back) at torso levels.
 * Scale uses the SAME heightCm + body height from the front capture so both
 * views share one cm-per-pixel. We re-detect pose on the side frame only to
 * find vertical sample rows; horizontal scale comes from front calibration.
 */
function sampleDepthsCm({ landmarks, mask, maskW, maskH, cmPerY, aspect }) {
  const { chestY, waistY, hipY } = torsoLevels(landmarks);
  const toCm = (wNorm) => (wNorm != null ? wNorm * aspect * cmPerY : null);

  if (!mask || !maskW || !maskH) {
    return { chestD: null, waistD: null, hipD: null, usedFallback: true };
  }

  return {
    chestD: toCm(maskWidthAt(mask, maskW, maskH, chestY)),
    waistD: toCm(maskWidthAt(mask, maskW, maskH, waistY)),
    hipD: toCm(maskWidthAt(mask, maskW, maskH, hipY)),
    usedFallback: false,
  };
}

/**
 * Combine front widths + side depths + height into circumference estimates.
 * Also returns the production single-front estimate for A/B comparison.
 *
 * @param {object} front  { landmarks, mask, maskW, maskH, aspect }
 * @param {object} side   { landmarks, mask, maskW, maskH, aspect }
 * @param {number} heightCm
 */
export function computeDualMeasurements({ front, side, heightCm }) {
  const scale = scaleFromFront(front.landmarks, heightCm, front.aspect);
  if (!scale) return null;

  const widths = sampleWidthsCm({
    landmarks: front.landmarks,
    mask: front.mask,
    maskW: front.maskW,
    maskH: front.maskH,
    cmPerY: scale.cmPerY,
    aspect: front.aspect,
  });

  // Side frame: use front cmPerY but side aspect for pixel→cm on that image.
  // Depth is mostly horizontal on the side view → aspect matters.
  const depths = sampleDepthsCm({
    landmarks: side.landmarks,
    mask: side.mask,
    maskW: side.maskW,
    maskH: side.maskH,
    cmPerY: scale.cmPerY,
    aspect: side.aspect,
  });

  // If side mask failed, fall back to typical depth ratios (same as production)
  const FALLBACK_RATIO = { chest: 0.72, waist: 0.75, hip: 0.78 };
  const depthOrFallback = (d, w, ratio) => d || w * ratio;

  const chestD = depthOrFallback(depths.chestD, widths.chestW, FALLBACK_RATIO.chest);
  const waistD = depthOrFallback(depths.waistD, widths.waistW, FALLBACK_RATIO.waist);
  const hipD = depthOrFallback(depths.hipD, widths.hipW, FALLBACK_RATIO.hip);

  const dual = {
    height: Math.round(heightCm),
    shoulder: widths.shoulder,
    chest: round1(circumferenceFromAxes(widths.chestW, chestD)),
    waist: round1(circumferenceFromAxes(widths.waistW, waistD)),
    hip: round1(circumferenceFromAxes(widths.hipW, hipD)),
  };

  const singleFront = computeMeasurements({
    landmarks: front.landmarks,
    mask: front.mask,
    maskW: front.maskW,
    maskH: front.maskH,
    heightCm,
    aspect: front.aspect,
  });

  return {
    dual,
    singleFront,
    debug: {
      frontWidthsCm: {
        chest: round1(widths.chestW),
        waist: round1(widths.waistW),
        hip: round1(widths.hipW),
      },
      sideDepthsCm: {
        chest: depths.chestD != null ? round1(depths.chestD) : null,
        waist: depths.waistD != null ? round1(depths.waistD) : null,
        hip: depths.hipD != null ? round1(depths.hipD) : null,
      },
      depthSource: depths.usedFallback || (!depths.chestD && !depths.waistD && !depths.hipD)
        ? 'fallback-ratios'
        : 'side-mask',
      cmPerY: round1(scale.cmPerY),
      noseToShoulder: round1(dist(front.landmarks[LM.NOSE], mid(front.landmarks[LM.LEFT_SHOULDER], front.landmarks[LM.RIGHT_SHOULDER])) * scale.cmPerY),
    },
  };
}
