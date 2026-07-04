import { Router } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public listing with filters: ?category=slug&subCategory=slug&size=M&color=Blue
// &minPrice=&maxPrice=&search=&sort=price|-price|newest&featured=true&page=&limit=
router.get('/', async (req, res) => {
  const {
    category, subCategory, size, color, minPrice, maxPrice,
    search, sort, featured, page = 1, limit = 24,
  } = req.query;

  const filter = {};
  if (category) {
    const cat = mongoose.isValidObjectId(category)
      ? await Category.findById(category)
      : await Category.findOne({ slug: category });
    if (cat) filter.category = cat._id;
  }
  if (subCategory) {
    const sub = mongoose.isValidObjectId(subCategory)
      ? await Category.findById(subCategory)
      : await Category.findOne({ slug: subCategory });
    if (sub) filter.subCategory = sub._id;
  }
  if (size) filter['sizeChart.size'] = size.toUpperCase();
  if (color) filter.colors = new RegExp(`^${color}$`, 'i');
  if (featured === 'true') filter.featured = true;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (search) filter.$text = { $search: search };

  const sortMap = { price: { price: 1 }, '-price': { price: -1 }, newest: { createdAt: -1 } };
  const sortBy = sortMap[sort] || { createdAt: -1 };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(60, Math.max(1, Number(limit)));
  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category subCategory', 'name slug')
      .sort(sortBy)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Product not found' });
  }
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
  ).populate('category subCategory', 'name slug');
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

function pickProductFields(body) {
  const {
    name, description, category, subCategory, price, stock,
    images, colors, suitedSkinTones, suitedBodyTypes, sizeChart, featured,
  } = body;
  return {
    name, description, category, subCategory: subCategory || null, price, stock,
    images, colors, suitedSkinTones, suitedBodyTypes, sizeChart, featured,
  };
}

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const data = pickProductFields(req.body);
  if (!data.name || !data.category || data.price == null) {
    return res.status(400).json({ message: 'Name, category and price are required' });
  }
  const product = await Product.create(data);
  res.status(201).json(product);
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    pickProductFields(req.body),
    { new: true, runValidators: true }
  );
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({ ok: true });
});

// Admin analytics: most viewed, most recommended, low stock
router.get('/admin/analytics', requireAuth, requireAdmin, async (req, res) => {
  const [mostViewed, mostRecommended, lowStock, totals] = await Promise.all([
    Product.find().sort({ views: -1 }).limit(5).select('name views').lean(),
    Product.find().sort({ recommendedCount: -1 }).limit(5).select('name recommendedCount').lean(),
    Product.find({ stock: { $lte: 5 } }).sort({ stock: 1 }).select('name stock').lean(),
    Product.aggregate([
      { $group: { _id: null, products: { $sum: 1 }, stock: { $sum: '$stock' } } },
    ]),
  ]);
  res.json({
    mostViewed,
    mostRecommended,
    lowStock,
    totalProducts: totals[0]?.products || 0,
    totalStock: totals[0]?.stock || 0,
  });
});

export default router;
