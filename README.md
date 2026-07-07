# MIRA — AI-Powered Smart Clothing Store

Full-stack clothing e-commerce platform with a camera-based **body scan** that measures the
shopper in-browser and recommends correctly-sized, well-matched clothing.

## Stack

- **Frontend** — React (Vite) + Tailwind CSS v4, React Router
- **Backend** — Node.js + Express 5, JWT auth
- **Database** — MongoDB (Mongoose)
- **Computer vision** — MediaPipe Tasks (Pose Landmarker + Selfie Segmenter), lazy-loaded,
  100% client-side

## Quick start

```bash
npm run install:all          # installs root + server + client deps
cp server/.env.example server/.env   # set MONGODB_URI + JWT_SECRET
npm run seed                 # categories, 12 products, admin user
npm run dev                  # API on :5000, client on :5173
```

**Admin login:** `admin@store.test` / `admin123` → visit `/admin`

## Features

### Customer
- Home, category navigation, featured/trending rows
- Product listing with filters (category, sub-category, size, price, search, sort) + pagination
- Product detail with gallery, size chart (in/cm toggle), "Fits me?" CTA, virtual try-on preview
- Cart (guest-friendly, persisted locally), checkout, order history
- Profile with saved body measurements — scan once, every product shows your size

### Body scan (`/scan`)
1. Intro screen: height input (scale calibration), guidance, privacy note, manual-entry fallback
2. Full-screen camera with silhouette overlay and live pose feedback
   ("step back", "stand straight", "hold still") — auto-captures after ~1.5 s of good framing
3. Measurement pipeline (all on-device):
   - MediaPipe Pose landmarks → pixel skeleton
   - User height → cm-per-pixel calibration
   - Selfie segmentation → torso silhouette widths at chest/waist/hip levels
   - Ellipse model → circumference estimates
   - Chest/waist/hip ratios → body type (Rectangle / Hourglass / Pear / Inverted Triangle / Apple / Athletic)
   - Skin patch below nose → ITA-based tone category (Fair / Wheatish / Medium / Deep)
4. Results: measurement cards, body type + tone notes, recommended products carousel with
   best-fit size pre-selected, save-to-profile

Only derived numbers are ever sent to the API (`POST /api/recommendations`) — never frames.
One scan frame is saved locally in IndexedDB for virtual try-on; it is only sent to
`POST /api/tryon` when the shopper requests a preview, and is never stored server-side.

### Virtual try-on (product page)
After a body scan, if a local photo exists the product page shows **See how it looks on you**.
The client sends the photo + product image URL to `POST /api/tryon`; the server calls Gemini
image generation and returns a JPEG preview. Shoppers can delete their photo from Profile.

**Setup:**
```bash
# In server/.env — get a key from https://aistudio.google.com/apikey
GEMINI_API_KEY=your-key-from-aistudio.google.com
```

Try-on uses prompt-based Gemini image generation (`gemini-2.5-flash-image` by default). Results
may vary compared to dedicated garment try-on models. Works best with real JPEG/PNG product
photos (not SVG placeholders). The seed script includes a few Unsplash garment URLs for testing.

### Admin (`/admin`)
- Dashboard: product/stock totals, most-viewed, most-recommended, low-stock alerts
- Product CRUD with dynamic size-chart editor (add/remove rows, cm⇄in entry toggle)
- Category CRUD (Men/Women/Kids → sub-categories), delete guarded against use
- Orders table with status updates

## Size matching

`server/src/utils/sizeMatcher.js` — weighted nearest-fit: per-dimension deviation
(tightness penalised 1.6×), missing dimensions skipped, deviation → fit-confidence
(exponential decay), plus bonuses for body-type and skin-tone suitability.
Mirrored client-side in `client/src/scan/fit.js` for instant product-page hints.

## Notes

- No MongoDB locally? `server/src/seed/dev-db.js` starts an in-memory instance
  (`node src/seed/dev-db.js`), or point `MONGODB_URI` at Atlas.
- Size recommendations are estimates, and the UI says so; shoppers can always pick manually.
