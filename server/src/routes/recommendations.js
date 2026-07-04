import { Router } from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { rankProducts } from '../utils/sizeMatcher.js';

const router = Router();

// POST /api/recommendations
// Body: { measurements: { shoulder, chest, waist, hip, height }, bodyType,
//         skinTone, category (slug, optional), limit }
// Public so guests can use the scan without an account; only numeric
// measurements arrive here — never images.
router.post('/', async (req, res) => {
  const { measurements, bodyType, skinTone, category, limit = 12 } = req.body || {};
  if (
    !measurements ||
    !['shoulder', 'chest', 'waist', 'hip'].some((k) => Number(measurements[k]) > 0)
  ) {
    return res.status(400).json({ message: 'At least one body measurement is required' });
  }

  const filter = { stock: { $gt: 0 }, 'sizeChart.0': { $exists: true } };
  if (category) {
    const cat = await Category.findOne({ slug: category });
    if (cat) filter.$or = [{ category: cat._id }, { subCategory: cat._id }];
  }

  const products = await Product.find(filter)
    .populate('category subCategory', 'name slug')
    .limit(300)
    .lean();

  const ranked = rankProducts(measurements, products, { bodyType, skinTone }).slice(
    0,
    Math.min(48, Number(limit))
  );

  // Analytics: count how often each product gets recommended
  const ids = ranked.map((r) => r.product._id);
  if (ids.length) {
    Product.updateMany({ _id: { $in: ids } }, { $inc: { recommendedCount: 1 } }).catch(() => {});
  }

  res.json({ recommendations: ranked });
});

export default router;
