import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Saved measurements (only derived numbers are ever stored — no images)
router.put('/measurements', async (req, res) => {
  const { height, shoulder, chest, waist, hip, bodyType, skinTone } = req.body || {};
  req.user.savedMeasurements = {
    height, shoulder, chest, waist, hip, bodyType, skinTone,
    measuredAt: new Date(),
  };
  await req.user.save();
  res.json({ savedMeasurements: req.user.savedMeasurements });
});

router.delete('/measurements', async (req, res) => {
  req.user.savedMeasurements = undefined;
  await req.user.save();
  res.json({ ok: true });
});

// Cart
router.get('/cart', async (req, res) => {
  await req.user.populate('cart.product');
  res.json({ cart: req.user.cart });
});

router.put('/cart', async (req, res) => {
  const { cart } = req.body || {};
  if (!Array.isArray(cart)) return res.status(400).json({ message: 'cart must be an array' });
  req.user.cart = cart.map(({ product, size, color, quantity }) => ({
    product: typeof product === 'object' ? product._id : product,
    size,
    color,
    quantity: Math.max(1, Number(quantity) || 1),
  }));
  await req.user.save();
  await req.user.populate('cart.product');
  res.json({ cart: req.user.cart });
});

// Wishlist
router.get('/wishlist', async (req, res) => {
  await req.user.populate('wishlist');
  res.json({ wishlist: req.user.wishlist });
});

router.post('/wishlist/:productId', async (req, res) => {
  const id = req.params.productId;
  const has = req.user.wishlist.some((p) => String(p) === id);
  if (has) {
    req.user.wishlist = req.user.wishlist.filter((p) => String(p) !== id);
  } else {
    req.user.wishlist.push(id);
  }
  await req.user.save();
  res.json({ wishlist: req.user.wishlist, added: !has });
});

export default router;
