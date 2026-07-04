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

export function rankProducts(userM, products, { bodyType, skinTone } = {}) {
  const ranked = [];
  for (const product of products) {
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
    });
  }
  ranked.sort((a, b) => b.matchScore - a.matchScore);
  return ranked;
}
