import { GoogleGenAI } from '@google/genai';

const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

const TRY_ON_PROMPT = `You are a fashion try-on assistant. Image 1 is a person. Image 2 is a clothing product.
Generate a realistic photo of the same person wearing that garment. Keep the person's face,
body shape, pose, and background as close to Image 1 as possible. The clothing should match
Image 2 in style and color. Full-body or upper-body as appropriate for the garment.`;

let client = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('Virtual try-on is not configured. Set GEMINI_API_KEY in server/.env');
    err.status = 503;
    throw err;
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

function decodeBase64Image(base64, label) {
  if (!base64 || typeof base64 !== 'string') {
    const err = new Error(`${label} is required`);
    err.status = 400;
    throw err;
  }
  const buf = Buffer.from(base64, 'base64');
  if (!buf.length) {
    const err = new Error(`${label} is invalid`);
    err.status = 400;
    throw err;
  }
  if (buf.length > MAX_BYTES) {
    const err = new Error(`${label} exceeds 10 MB limit`);
    err.status = 400;
    throw err;
  }
  return buf;
}

function parseDataUri(url) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(url);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const buf = Buffer.from(match[2], 'base64');
  return { mimeType, bytes: buf };
}

function assertSupportedMime(mimeType) {
  if (!mimeType || !['image/jpeg', 'image/jpg', 'image/png'].includes(mimeType)) {
    const err = new Error(
      'Product image must be a JPEG or PNG photo of the garment. SVG placeholders are not supported.'
    );
    err.status = 400;
    throw err;
  }
}

async function fetchProductImage(url) {
  if (!url || typeof url !== 'string') {
    const err = new Error('productImageUrl is required');
    err.status = 400;
    throw err;
  }

  if (url.startsWith('data:')) {
    const parsed = parseDataUri(url);
    if (!parsed) {
      const err = new Error('Invalid product image data URI');
      err.status = 400;
      throw err;
    }
    if (parsed.mimeType.includes('svg')) {
      const err = new Error(
        'Product image must be a JPEG or PNG photo of the garment. SVG placeholders are not supported.'
      );
      err.status = 400;
      throw err;
    }
    assertSupportedMime(parsed.mimeType);
    if (parsed.bytes.length > MAX_BYTES) {
      const err = new Error('Product image exceeds 10 MB limit');
      err.status = 400;
      throw err;
    }
    return { mimeType: parsed.mimeType === 'image/jpg' ? 'image/jpeg' : parsed.mimeType, bytes: parsed.bytes };
  }

  if (!/^https?:\/\//i.test(url)) {
    const err = new Error('productImageUrl must be an https URL or data:image URI');
    err.status = 400;
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const err = new Error(`Could not fetch product image (${res.status})`);
      err.status = 400;
      throw err;
    }
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (contentType.includes('svg')) {
      const err = new Error(
        'Product image must be a JPEG or PNG photo of the garment. SVG placeholders are not supported.'
      );
      err.status = 400;
      throw err;
    }
    const mimeType = contentType && contentType !== 'application/octet-stream' ? contentType : 'image/jpeg';
    assertSupportedMime(mimeType);
    const arrayBuf = await res.arrayBuffer();
    const bytes = Buffer.from(arrayBuf);
    if (bytes.length > MAX_BYTES) {
      const err = new Error('Product image exceeds 10 MB limit');
      err.status = 400;
      throw err;
    }
    return { mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType, bytes };
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Timed out fetching product image');
      err.status = 400;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateTryOn({ personImageBase64, productImageUrl }) {
  decodeBase64Image(personImageBase64, 'personImageBase64');
  const product = await fetchProductImage(productImageUrl);

  const ai = getClient();
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: TRY_ON_PROMPT },
            { inlineData: { mimeType: 'image/jpeg', data: personImageBase64 } },
            {
              inlineData: {
                mimeType: product.mimeType,
                data: product.bytes.toString('base64'),
              },
            },
          ],
        },
      ],
      config: { responseModalities: ['IMAGE'] },
    });
  } catch (e) {
    const err = new Error(
      e?.message ||
        'Try-on generation failed. Use a clear front-facing photo and a product image on a plain background.'
    );
    err.status = e?.status === 503 ? 503 : 502;
    throw err;
  }

  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    const err = new Error(
      'Try-on generation returned no image. Try a clearer photo with good lighting and a plain garment image.'
    );
    err.status = 502;
    throw err;
  }

  return {
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/jpeg',
  };
}
