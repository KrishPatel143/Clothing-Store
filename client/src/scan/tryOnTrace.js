export function newTryOnRequestId() {
  return `tryon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createTryOnTrace(requestId) {
  const started = performance.now();
  const steps = [];

  function step(stage, meta = {}) {
    const elapsedMs = Math.round(performance.now() - started);
    const entry = { stage, elapsedMs, ...meta };
    steps.push(entry);
    console.log(`[try-on:${requestId}] ${stage} (+${elapsedMs}ms)`, metaKeys(meta) ? meta : '');
    return entry;
  }

  function fail(stage, err, meta = {}) {
    const elapsedMs = Math.round(performance.now() - started);
    const record = {
      requestId,
      stage,
      elapsedMs,
      steps,
      error: err?.message || String(err),
      status: err?.status,
      serverStage: err?.stage,
      serverSteps: err?.steps,
      ...meta,
    };
    console.error(`[try-on:${requestId}] FAILED at ${stage} after ${elapsedMs}ms`, record);
    return record;
  }

  function success(meta = {}) {
    const elapsedMs = Math.round(performance.now() - started);
    const record = { requestId, elapsedMs, steps, ...meta };
    console.log(`[try-on:${requestId}] OK in ${elapsedMs}ms`, record);
    return record;
  }

  return { requestId, step, fail, success, steps };
}

function metaKeys(meta) {
  return meta && Object.keys(meta).length > 0;
}

export function formatTryOnError(err, trace) {
  const parts = [err?.message || 'Could not generate try-on preview.'];
  const id = err?.requestId || trace?.requestId;
  const stage = err?.stage || trace?.steps?.at(-1)?.stage;
  if (id) parts.push(`Ref: ${id}`);
  if (stage) parts.push(`Stage: ${stage}`);
  return parts.join(' · ');
}

export const TRY_ON_STAGE_LABELS = {
  load_photo: 'Loading your scan photo…',
  encode_person: 'Preparing your photo…',
  api_request: 'Generating preview with AI…',
};
