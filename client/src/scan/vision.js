// Lazy loader for MediaPipe vision tasks. Nothing here is imported until the
// user opens the scan flow, keeping the initial bundle light. All inference
// runs on-device; frames never leave the browser.

let poseLandmarkerPromise = null;
let segmenterPromise = null;

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const SEG_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

async function filesetResolver() {
  const { FilesetResolver } = await import('@mediapipe/tasks-vision');
  return FilesetResolver.forVisionTasks(WASM_BASE);
}

/** Fresh PoseLandmarker instance (needed for simultaneous dual-camera R&D). */
export async function createPoseLandmarker() {
  const [{ PoseLandmarker }, vision] = await Promise.all([
    import('@mediapipe/tasks-vision'),
    filesetResolver(),
  ]);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
}

export function getPoseLandmarker() {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = createPoseLandmarker().catch((err) => {
      poseLandmarkerPromise = null;
      throw err;
    });
  }
  return poseLandmarkerPromise;
}

export function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const [{ ImageSegmenter }, vision] = await Promise.all([
        import('@mediapipe/tasks-vision'),
        filesetResolver(),
      ]);
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: SEG_MODEL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
      });
    })().catch((err) => {
      segmenterPromise = null;
      throw err;
    });
  }
  return segmenterPromise;
}

// MediaPipe pose landmark indices we care about
export const LM = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
};
