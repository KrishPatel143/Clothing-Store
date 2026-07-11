import { GoogleGenAI } from '@google/genai';

const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

// Output background: 'original' keeps the person's photo background,
// 'studio' renders on a clean neutral backdrop (usually looks better for
// webcam scan photos with cluttered rooms). Controlled via TRYON_BACKGROUND.
const BACKGROUND_RULES = {
  original:
    'Keep the original background, lighting, camera angle, and framing from the person photo.',
  studio:
    'Place the person against a clean, softly lit, neutral light-gray studio background, ' +
    'like a professional e-commerce fashion photo. Keep the camera angle, framing, and ' +
    'lighting direction on the person consistent with the person photo.',
};

function buildTryOnPrompt(backgroundMode) {
  const backgroundRule = BACKGROUND_RULES[backgroundMode] || BACKGROUND_RULES.original;
  return `Create a photorealistic virtual try-on image.
The first image above is the person. The second image is the garment product photo.

Show the exact same person wearing the garment from the product photo.

Strict rules:
- Preserve the person's identity exactly: face, skin tone, hairstyle, body shape, and pose must be identical to the person photo.
- ${backgroundRule}
- Replace only the corresponding clothing item; leave all other clothing and accessories unchanged.
- Extract only the garment from the product photo — ignore its background, mannequin, model, or any text/watermarks in it.
- Reproduce the garment faithfully: exact color, fabric texture, pattern, prints, logos, neckline, sleeve length, and fit.
- The garment must drape naturally on the body with realistic wrinkles, shadows, and fit.
- Output one photorealistic photo only. No text, watermarks, borders, or collage.`;
}

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

function sniffImageMime(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'image/jpeg';
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

async function fetchProductImage(url, log) {
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
    log?.step('fetch_product_image', {
      source: 'data_uri',
      mimeType: parsed.mimeType,
      bytes: parsed.bytes.length,
    });
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
    log?.step('fetch_product_image_start', { url: url.slice(0, 120) });
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
    log?.step('fetch_product_image', {
      source: 'url',
      mimeType,
      bytes: bytes.length,
      status: res.status,
    });
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

function geminiFailureMeta(response) {
  const candidate = response?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  return {
    finishReason: candidate?.finishReason,
    safetyRatings: candidate?.safetyRatings,
    partCount: parts.length,
    partTypes: parts.map((p) => (p.inlineData ? 'image' : p.text ? 'text' : 'other')),
    textSnippet: parts
      .filter((p) => p.text)
      .map((p) => p.text.slice(0, 200))
      .join(' | ') || undefined,
  };
}

export async function generateTryOn({ personImageBase64, productImageUrl, log }) {
  const personBytes = decodeBase64Image(personImageBase64, 'personImageBase64');
  const personMime = sniffImageMime(personBytes);
  log?.step('validate_person_image', { bytes: personBytes.length, mimeType: personMime });

  const product = await fetchProductImage(productImageUrl, log);

  const ai = getClient();
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const backgroundMode = process.env.TRYON_BACKGROUND || 'original';
  log?.step('gemini_request_start', {
    model,
    backgroundMode,
    personBytes: personBytes.length,
    personMime,
    productBytes: product.bytes.length,
    productMime: product.mimeType,
  });

  let response;
  const geminiStarted = Date.now();
  try {
    response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Person photo:' },
            { inlineData: { mimeType: personMime, data: personImageBase64 } },
            { text: 'Garment product photo:' },
            {
              inlineData: {
                mimeType: product.mimeType,
                data: product.bytes.toString('base64'),
              },
            },
            { text: buildTryOnPrompt(backgroundMode) },
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
    err.geminiMs = Date.now() - geminiStarted;
    err.geminiError = {
      name: e?.name,
      status: e?.status,
      code: e?.code,
    };
    throw err;
  }

  const geminiMs = Date.now() - geminiStarted;
  log?.step('gemini_request_done', { geminiMs });

  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    const err = new Error(
      'Try-on generation returned no image. Try a clearer photo with good lighting and a plain garment image.'
    );
    err.status = 502;
    err.geminiMs = geminiMs;
    err.geminiMeta = geminiFailureMeta(response);
    throw err;
  }

  log?.step('parse_response', {
    geminiMs,
    outputMime: imagePart.inlineData.mimeType || 'image/jpeg',
    outputBytes: Math.round((imagePart.inlineData.data.length * 3) / 4),
  });

  return {
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/jpeg',
  };
}
