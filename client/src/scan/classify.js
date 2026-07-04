import { LM } from './vision.js';

// ---------- body type from chest/waist/hip ratios ----------
// Standard ratio thresholds used by styling guides.
export function classifyBodyType({ chest, waist, hip }) {
  if (!chest || !waist || !hip) return null;
  const whr = waist / hip;
  const chr = chest / hip;

  if (chest / waist > 1.25 && chr > 1.05) return 'Inverted Triangle';
  if (hip / chest > 1.08 && whr < 0.85) return 'Pear';
  if (whr < 0.78 && Math.abs(chr - 1) < 0.06) return 'Hourglass';
  if (whr > 0.92 && waist >= Math.min(chest, hip) * 0.95) return 'Apple';
  if (chest / waist > 1.15 && whr < 0.9) return 'Athletic';
  return 'Rectangle';
}

export const BODY_TYPE_NOTES = {
  Rectangle: 'Balanced shoulders, waist and hips — structured layers and belts add definition.',
  Hourglass: 'Defined waist with balanced chest and hips — fitted and wrap silhouettes shine.',
  Pear: 'Hips lead the line — A-line cuts and detailed necklines balance beautifully.',
  'Inverted Triangle': 'Strong shoulders — straight cuts and fuller bottoms even things out.',
  Apple: 'Comfort through the middle — empire lines and open necklines flatter most.',
  Athletic: 'Toned and angular — most cuts work; soft drapes add contrast.',
};

// ---------- skin tone from the captured frame ----------
// Samples a patch just below the nose landmark (chin/upper-lip area), averages
// it, then classifies by ITA (Individual Typology Angle) — a standard
// dermatology metric that's more lighting-robust than raw RGB.
export function sampleSkinTone(ctx, frameW, frameH, landmarks) {
  const nose = landmarks[LM.NOSE];
  const leftEye = landmarks[LM.LEFT_EYE];
  const cx = nose.x * frameW;
  const cy = (nose.y + Math.abs(nose.y - leftEye.y) * 1.2) * frameH; // just below nose
  const r = Math.max(4, frameW * 0.01);

  const img = ctx.getImageData(
    Math.max(0, Math.round(cx - r)),
    Math.max(0, Math.round(cy - r)),
    Math.min(frameW, r * 2),
    Math.min(frameH, r * 2)
  );

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    rSum += img.data[i];
    gSum += img.data[i + 1];
    bSum += img.data[i + 2];
    n++;
  }
  if (!n) return null;
  return classifyToneITA(rSum / n, gSum / n, bSum / n);
}

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function classifyToneITA(r, g, b) {
  // sRGB → XYZ (D65) → Lab, then ITA° = atan((L−50)/b*) · 180/π
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const X = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const Y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const Z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const L = 116 * f(Y) - 16;
  const bLab = 200 * (f(Y) - f(Z));
  const ita = (Math.atan2(L - 50, bLab) * 180) / Math.PI;

  if (ita > 41) return 'Fair';
  if (ita > 19) return 'Wheatish';
  if (ita > -10) return 'Medium';
  return 'Deep';
}

export const TONE_NOTES = {
  Fair: 'Cool pastels, dusty blues and berry tones light you up.',
  Wheatish: 'Earthy neutrals, olive, rust and warm cream are your allies.',
  Medium: 'Jewel tones — emerald, sapphire, deep maroon — sing on you.',
  Deep: 'Rich saturated colour and crisp contrast (ivory, cobalt, gold) look stunning.',
};
