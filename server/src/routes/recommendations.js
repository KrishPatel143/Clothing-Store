import { Router } from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { buildScanRecommendations, isSareeProduct } from '../utils/sizeMatcher.js';

const router = Router();

const SAREE_TEXT = /\b(saree|sari)\b/i;

// POST /api/recommendations
// Body: { measurements: { shoulder, chest, waist, hip, height }, bodyType,
//         skinTone, skinColorHex, category (slug, optional), limit }
// Public so guests can use the scan without an account; only numeric
// measurements arrive here — never images.
//
// Women scans: up to 2 colour-matched sarees (one-size, any body) + other
// sized garments. Men / unscoped: sized garments only.
router.post('/', async (req, res) => {
  const {
    measurements,
    bodyType,
    skinTone,
    skinColorHex,
    category,
    limit = 12,
  } = req.body || {};
  if (
    !measurements ||
    !['shoulder', 'chest', 'waist', 'hip'].some((k) => Number(measurements[k]) > 0)
  ) {
    return res.status(400).json({ message: 'At least one body measurement is required' });
  }

  let rootCat = null;
  if (category) {
    rootCat = await Category.findOne({ slug: category });
  }

  const categoryClause = rootCat
    ? { $or: [{ category: rootCat._id }, { subCategory: rootCat._id }] }
    : null;

  // Sized garments (fit-matched). Exclude bare one-size catalogues from this pass.
  const garmentFilter = {
    stock: { $gt: 0 },
    'sizeChart.0': { $exists: true },
    ...(categoryClause || {}),
  };

  const garments = await Product.find(garmentFilter)
    .populate('category subCategory', 'name slug')
    .limit(300)
    .lean();

  // Women: also pull sarees even when they have no size chart — matched by colour/tone.
  let sarees = [];
  if (category === 'women' && rootCat) {
    const sareeSubs = await Category.find({
      parentCategory: rootCat._id,
      $or: [{ name: SAREE_TEXT }, { slug: SAREE_TEXT }],
    }).select('_id');

    const sareeFilter = {
      stock: { $gt: 0 },
      $and: [
        {
          $or: [
            { category: rootCat._id },
            { subCategory: rootCat._id },
            ...(sareeSubs.length ? [{ subCategory: { $in: sareeSubs.map((c) => c._id) } }] : []),
          ],
        },
        {
          $or: [
            { name: SAREE_TEXT },
            { description: SAREE_TEXT },
            ...(sareeSubs.length ? [{ subCategory: { $in: sareeSubs.map((c) => c._id) } }] : []),
          ],
        },
      ],
    };

    sarees = await Product.find(sareeFilter)
      .populate('category subCategory', 'name slug')
      .limit(80)
      .lean();

    // Also catch sarees that slipped into the sized women catalogue under ethnic names
    for (const p of garments) {
      if (isSareeProduct(p) && !sarees.some((s) => String(s._id) === String(p._id))) {
        sarees.push(p);
      }
    }
  }

  const ranked = buildScanRecommendations({
    measurements,
    garments,
    sarees,
    bodyType,
    skinTone,
    skinColorHex,
    category,
    limit,
  });

  // Analytics: count how often each product gets recommended
  const ids = ranked.map((r) => r.product._id);
  if (ids.length) {
    Product.updateMany({ _id: { $in: ids } }, { $inc: { recommendedCount: 1 } }).catch(() => {});
  }

  res.json({ recommendations: ranked });
});

export default router;
