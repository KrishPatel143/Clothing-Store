import { Router } from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  const { items, address } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must contain at least one item' });
  }

  const products = await Product.find({ _id: { $in: items.map((i) => i.product) } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const orderItems = [];
  let total = 0;
  for (const item of items) {
    const product = byId.get(String(item.product));
    if (!product) return res.status(400).json({ message: 'A product in your cart no longer exists' });
    const qty = Math.max(1, Number(item.quantity) || 1);
    if (product.stock < qty) {
      return res.status(409).json({ message: `Only ${product.stock} left of "${product.name}"` });
    }
    orderItems.push({
      product: product._id,
      name: product.name,
      price: product.price,
      size: item.size,
      color: item.color,
      quantity: qty,
    });
    total += product.price * qty;
  }

  const order = await Order.create({ user: req.user._id, items: orderItems, total, address });
  await Promise.all(
    orderItems.map((i) =>
      Product.updateOne({ _id: i.product }, { $inc: { stock: -i.quantity } })
    )
  );
  // Clear the user's cart after a successful order
  req.user.cart = [];
  await req.user.save();

  res.status(201).json(order);
});

router.get('/mine', async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ orders });
});

router.get('/', requireAdmin, async (req, res) => {
  const orders = await Order.find()
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ orders });
});

router.put('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
});

export default router;
