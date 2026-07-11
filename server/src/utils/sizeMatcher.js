// Nearest-fit size matching. All measurements in cm.
//
// For each size row we compute a weighted distance between the user's
// measurements and the garment's. Chest is weighted highest for tops,
// waist/hip for bottoms — but since the chart is universal we use a single
// balanced weighting and skip dimensions missing on either side.

const WEIGHTS = { chest: 0.35, waist: 0.3, hip: 0.2, shoulder: 0.15 };

// A garment dimension smaller than the body reads as "tight" and is penalised
// more than the same amount of looseness.
const TIGHT_PENALTY = 1.6;

/** Max sarees mixed into a women's scan recommendation set. */
export const MAX_SAREE_RECS = 2;

/** Colour-name cues that tend to flatter each skin-tone band. */
const TONE_COLOR_AFFINITY = {
  Fair: ['blush', 'pastel', 'pink', 'lavender', 'mint', 'cream', 'ivory', 'peach', 'champagne', 'soft', 'light', 'lilac', 'powder', 'rose'],
  Wheatish: ['coral', 'terracotta', 'gold', 'mustard', 'emerald', 'teal', 'maroon', 'rust', 'orange', 'beige', 'sand', 'olive', 'copper'],
  Medium: ['royal', 'burgundy', 'navy', 'purple', 'magenta', 'red', 'green', 'sapphire', 'wine', 'plum', 'turquoise', 'cobalt'],
  Deep: ['gold', 'yellow', 'bright', 'white', 'cream', 'fuchsia', 'emerald', 'jewel', 'orange', 'crimson', 'canary', 'ivory', 'silver'],
};

export function scoreSizeRow(userM, row) {
  let weightedSum = 0;
  let usedWeight = 0;
  for (const dim of Object.keys(WEIGHTS)) {
    const u = userM[dim];
    const g = row[dim];
    if (u == null || g == null || !u || !g) continue;
    let diff = g - u; // positive = garment roomier
    if (diff < 0) diff *= TIGHT_PENALTY;
    weightedSum += WEIGHTS[dim] * Math.abs(diff);
    usedWeight += WEIGHTS[dim];
  }
  if (usedWeight === 0) return null;
  return weightedSum / usedWeight; // avg weighted deviation in cm
}

// Map a deviation (cm) to a 0–100 fit confidence. ~0cm dev → 100, 10cm → ~20.
export function deviationToConfidence(dev) {
  return Math.max(0, Math.round(100 * Math.exp(-dev / 6)));
}

export function bestSizeForProduct(userM, product) {
  let best = null;
  for (const row of product.sizeChart || []) {
    const dev = scoreSizeRow(userM, row);
    if (dev == null) continue;
    if (!best || dev < best.deviation) {
      best = { size: row.size, deviation: dev, confidence: deviationToConfidence(dev) };
    }
  }
  return best;
}

export function isSareeProduct(product) {
  if (!product) return false;
  const text = [
    product.name,
    product.description,
    product.subCategory?.name,
    product.subCategory?.slug,
    product.category?.name,
    product.category?.slug,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\b(saree|sari)\b/.test(text);
}

function productColorBlob(product) {
  return [...(product.colors || []), product.name || '', product.description || '']
    .join(' ')
    .toLowerCase();
}

/** Score how well a saree's colours suit the shopper's skin tone (0–100). */
export function scoreSareeForTone(product, { skinTone, skinColorHex } = {}) {
  let score = 42; // baseline — sarees are one-size, always wearable

  const suitsTone =
    !product.suitedSkinTones?.length ||
    (skinTone && product.suitedSkinTones.includes(skinTone));
  if (skinTone && suitsTone) score += 28;
  else if (product.suitedSkinTones?.length && skinTone && !suitsTone) score -= 18;

  const blob = productColorBlob(product);
  const affinity = (TONE_COLOR_AFFINITY[skinTone] || []).filter((cue) => blob.includes(cue));
  score += Math.min(22, affinity.length * 8);

  // Soft nudge from scanned hex: warmer skins prefer warmer garment cues
  if (skinColorHex && /^#[0-9a-f]{6}$/i.test(skinColorHex)) {
    const r = parseInt(skinColorHex.slice(1, 3), 16);
    const b = parseInt(skinColorHex.slice(5, 7), 16);
    const g = parseInt(skinColorHex.slice(3, 5), 16);
    const warm = r > b + 15;
    const cool = b > r + 10;
    if (warm && /gold|maroon|terracotta|rust|orange|mustard|coral|red|copper/.test(blob)) score += 8;
    if (cool && /blue|teal|lavender|lilac|mint|silver|sapphire|turquoise|navy/.test(blob)) score += 8;
    if (g > r && g > b && /green|emerald|olive|mint/.test(blob)) score += 6;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    suitsSkinTone: suitsTone,
  };
}

export function rankSarees(products, { skinTone, skinColorHex } = {}) {
  const ranked = [];
  for (const product of products) {
    if (!isSareeProduct(product)) continue;
    const { score, suitsSkinTone } = scoreSareeForTone(product, { skinTone, skinColorHex });
    ranked.push({
      product,
      // Sarees are draped — one piece suits every body size
      recommendedSize: 'One Size',
      fitConfidence: score,
      matchScore: score,
      suitsBodyType: true,
      suitsSkinTone,
      isSaree: true,
    });
  }
  ranked.sort((a, b) => b.matchScore - a.matchScore);
  return ranked;
}

export function rankProducts(userM, products, { bodyType, skinTone } = {}) {
  const ranked = [];
  for (const product of products) {
    if (isSareeProduct(product)) continue; // handled separately for women scans
    const fit = bestSizeForProduct(userM, product);
    if (!fit) continue;

    let score = fit.confidence;
    const suitsBody =
      !product.suitedBodyTypes?.length ||
      (bodyType && product.suitedBodyTypes.includes(bodyType));
    const suitsTone =
      !product.suitedSkinTones?.length ||
      (skinTone && product.suitedSkinTones.includes(skinTone));
    if (bodyType && suitsBody) score += 12;
    if (skinTone && suitsTone) score += 8;

    ranked.push({
      product,
      recommendedSize: fit.size,
      fitConfidence: fit.confidence,
      matchScore: score,
      suitsBodyType: suitsBody,
      suitsSkinTone: suitsTone,
      isSaree: false,
    });
  }
  ranked.sort((a, b) => b.matchScore - a.matchScore);
  return ranked;
}

/**
 * Women scans: up to MAX_SAREE_RECS colour-matched sarees + sized garments.
 * Other categories: sized garments only.
 */
export function buildScanRecommendations({
  measurements,
  garments,
  sarees = [],
  bodyType,
  skinTone,
  skinColorHex,
  category,
  limit = 12,
}) {
  const cap = Math.min(48, Math.max(1, Number(limit) || 12));
  const garmentsRanked = rankProducts(measurements, garments, { bodyType, skinTone });

  if (category !== 'women') {
    return garmentsRanked.slice(0, cap);
  }

  const sareePicks = rankSarees(sarees.length ? sarees : garments, {
    skinTone,
    skinColorHex,
  }).slice(0, MAX_SAREE_RECS);

  const used = new Set(sareePicks.map((r) => String(r.product._id)));
  const other = garmentsRanked.filter((r) => !used.has(String(r.product._id)));
  const remaining = Math.max(0, cap - sareePicks.length);

  // Lead with 1–2 sarees, then fill with other women garments
  return [...sareePicks, ...other.slice(0, remaining)];
}
