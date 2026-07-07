import { Router } from 'express';
import { generateTryOn } from '../utils/geminiTryOn.js';

const router = Router();

// Simple in-memory rate limit: 10 requests per minute per IP
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_HITS = 10;

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }
  entry.count += 1;
  hits.set(ip, entry);
  if (entry.count > MAX_HITS) {
    return res.status(429).json({ message: 'Too many try-on requests. Please wait a minute and try again.' });
  }
  next();
}

// POST /api/tryon
// Body: { personImageBase64, productImageUrl }
// Stateless proxy — images are not stored server-side.
router.post('/', rateLimit, async (req, res) => {
  try {
    const { personImageBase64, productImageUrl } = req.body || {};
    const result = await generateTryOn({ personImageBase64, productImageUrl });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Try-on failed' });
  }
});

export default router;
