import { Router } from 'express';
import { generateTryOn } from '../utils/geminiTryOn.js';
import { createTryOnLogger, newRequestId, tryOnErrorPayload } from '../utils/tryOnLogger.js';

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
// Body: { personImageBase64, productImageUrl, requestId? }
// Stateless proxy — images are not stored server-side.
router.post('/', rateLimit, async (req, res) => {
  const requestId = req.body?.requestId || newRequestId();
  const log = createTryOnLogger(requestId);
  log.step('request_received', {
    ip: req.ip || req.socket?.remoteAddress,
    productUrl: typeof req.body?.productImageUrl === 'string'
      ? req.body.productImageUrl.slice(0, 120)
      : undefined,
    personBase64Chars: req.body?.personImageBase64?.length || 0,
  });

  try {
    const { personImageBase64, productImageUrl } = req.body || {};
    const result = await generateTryOn({ personImageBase64, productImageUrl, log });
    log.success({ outputMime: result.mimeType });
    res.json({ ...result, requestId });
  } catch (err) {
    const stage =
      err.stage ||
      (err.message?.includes('product image')
        ? 'fetch_product_image'
        : err.message?.includes('personImage')
          ? 'validate_person_image'
          : err.geminiMeta || err.geminiMs
            ? 'gemini_generate'
            : 'unknown');
    log.fail(stage, err, {
      status: err.status,
      geminiMs: err.geminiMs,
      geminiError: err.geminiError,
      geminiMeta: err.geminiMeta,
    });
    res.status(err.status || 500).json(tryOnErrorPayload(log, stage, err, {
      geminiMs: err.geminiMs,
      geminiMeta: err.geminiMeta,
    }));
  }
});

export default router;
