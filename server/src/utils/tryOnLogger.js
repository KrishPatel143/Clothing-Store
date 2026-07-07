import { randomBytes } from 'crypto';

export function newRequestId() {
  return `tryon-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

export function createTryOnLogger(requestId) {
  const started = Date.now();
  const steps = [];

  function step(stage, meta = {}) {
    const elapsedMs = Date.now() - started;
    const entry = { stage, elapsedMs, ...meta };
    steps.push(entry);
    const metaKeys = Object.keys(meta);
    if (metaKeys.length) {
      console.log(`[try-on:${requestId}] ${stage} (+${elapsedMs}ms)`, meta);
    } else {
      console.log(`[try-on:${requestId}] ${stage} (+${elapsedMs}ms)`);
    }
    return entry;
  }

  function fail(stage, err, meta = {}) {
    const elapsedMs = Date.now() - started;
    const record = {
      requestId,
      stage,
      elapsedMs,
      steps,
      error: err?.message || String(err),
      ...meta,
    };
    console.error(`[try-on:${requestId}] FAILED at ${stage} after ${elapsedMs}ms`, record);
    return record;
  }

  function success(meta = {}) {
    const elapsedMs = Date.now() - started;
    const record = { requestId, elapsedMs, steps, ...meta };
    console.log(`[try-on:${requestId}] OK in ${elapsedMs}ms`, record);
    return record;
  }

  return { requestId, step, fail, success, steps, elapsedMs: () => Date.now() - started };
}

export function tryOnErrorPayload(logger, stage, err, extra = {}) {
  return {
    message: err?.message || 'Try-on failed',
    requestId: logger.requestId,
    stage,
    elapsedMs: logger.elapsedMs(),
    steps: logger.steps,
    ...extra,
  };
}
