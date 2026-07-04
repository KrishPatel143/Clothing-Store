import { Router } from 'express';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Public: full category tree
router.get('/', async (req, res) => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  const roots = categories.filter((c) => !c.parentCategory);
  const tree = roots.map((root) => ({
    ...root,
    children: categories.filter((c) => String(c.parentCategory) === String(root._id)),
  }));
  res.json({ categories, tree });
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, parentCategory } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const parent = parentCategory ? await Category.findById(parentCategory) : null;
  const slug = slugify(parent ? `${parent.name}-${name}` : name);
  try {
    const category = await Category.create({ name, parentCategory: parent?._id || null, slug });
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Category already exists' });
    throw err;
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.body;
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found' });
  if (name) {
    category.name = name;
    const parent = category.parentCategory ? await Category.findById(category.parentCategory) : null;
    category.slug = slugify(parent ? `${parent.name}-${name}` : name);
  }
  await category.save();
  res.json(category);
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const inUse = await Product.countDocuments({
    $or: [{ category: req.params.id }, { subCategory: req.params.id }],
  });
  if (inUse > 0) {
    return res.status(409).json({ message: `${inUse} product(s) still use this category` });
  }
  const hasChildren = await Category.countDocuments({ parentCategory: req.params.id });
  if (hasChildren > 0) {
    return res.status(409).json({ message: 'Delete sub-categories first' });
  }
  await Category.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;
