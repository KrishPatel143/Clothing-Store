// Client-side mirror of the server's nearest-fit matcher so the product page
// can highlight a size instantly. All values in cm.

const WEIGHTS = { chest: 0.35, waist: 0.3, hip: 0.2, shoulder: 0.15 };
const TIGHT_PENALTY = 1.6;
const LOCAL_KEY = 'mira_measurements';

export function bestSizeFromChart(userM, sizeChart) {
  let best = null;
  for (const row of sizeChart || []) {
    let weightedSum = 0;
    let usedWeight = 0;
    for (const dim of Object.keys(WEIGHTS)) {
      const u = Number(userM[dim]);
      const g = Number(row[dim]);
      if (!u || !g) continue;
      let diff = g - u;
      if (diff < 0) diff *= TIGHT_PENALTY;
      weightedSum += WEIGHTS[dim] * Math.abs(diff);
      usedWeight += WEIGHTS[dim];
    }
    if (usedWeight === 0) continue;
    const dev = weightedSum / usedWeight;
    if (!best || dev < best.deviation) {
      best = {
        size: row.size,
        deviation: dev,
        confidence: Math.max(0, Math.round(100 * Math.exp(-dev / 6))),
      };
    }
  }
  return best;
}

export function saveLocalMeasurements(m) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...m, measuredAt: new Date().toISOString() }));
}

export function loadLocalMeasurements() {
  try {
    const m = JSON.parse(localStorage.getItem(LOCAL_KEY));
    return m && (m.chest || m.waist || m.shoulder || m.hip) ? m : null;
  } catch {
    return null;
  }
}

export function clearLocalMeasurements() {
  localStorage.removeItem(LOCAL_KEY);
}
