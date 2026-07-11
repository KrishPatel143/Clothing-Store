import { BODY_TYPE_NOTES, TONE_NOTES } from '../scan/classify.js';
import { formatHeight, formatIn } from '../scan/units.js';

const BODY_MEASURES = [
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hip', label: 'Hip' },
];

/** Landmarks in the original 300×400 silhouette space (then scaled). */
const CALLOUTS = [
  { key: 'shoulder', label: 'Shoulder', x: 112, y: 118, side: 'left' },
  { key: 'chest', label: 'Chest', x: 188, y: 168, side: 'right' },
  { key: 'waist', label: 'Waist', x: 112, y: 228, side: 'left' },
  { key: 'hip', label: 'Hip', x: 188, y: 278, side: 'right' },
];

const SILHOUETTE_PATH =
  'M150 40a26 26 0 1 1 0 52 26 26 0 0 1 0-52Zm-38 70h76c18 0 30 14 30 32l-8 78h-18l-4 120h-24l-6-90h-4l-6 90h-24l-4-120H102l-8-78c0-18 12-32 30-32Z';

/** Larger figure, still padded so callouts stay inside the box. */
const SCALE = 0.78;
const OX = 95;
const OY = 8;

const mapX = (x) => OX + x * SCALE;
const mapY = (y) => OY + y * SCALE;

export default function FitProfileDisplay({ profile, className = '' }) {
  if (!profile) return null;

  const heightUnit = profile.heightUnit || 'cm';
  const skinCategory = profile.skinTone;

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        {/* Left — classic text + values */}
        <div className="space-y-3">
          {profile.height != null && (
            <div className="border border-ink/10 bg-parchment/50 px-6 py-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6 text-clay shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    d="M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm text-ink-soft">Height</span>
              </div>
              <div className="font-display text-4xl font-light">
                {formatHeight(profile.height, heightUnit)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {BODY_MEASURES.map(({ key, label }) => {
              const value = profile[key];
              if (value == null || value === '') return null;
              return (
                <div key={key} className="border border-ink/10 bg-ivory px-4 py-5">
                  <div className="text-sm text-ink-soft mb-2">{label}</div>
                  <div className="font-display text-3xl font-light">{formatIn(value)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — silhouette only (no height), fills the box */}
        <div className="border border-ink/10 bg-parchment/40 flex items-center justify-center overflow-hidden">
          <div className="relative w-full h-full px-2 py-3 sm:px-3 sm:py-4">
            <svg
              viewBox="0 0 420 360"
              className="w-full h-full max-h-[420px] object-contain text-ink/15"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Body measurements on silhouette"
            >
              <ellipse
                cx={mapX(150)}
                cy={mapY(388)}
                rx={70 * SCALE}
                ry={8 * SCALE}
                fill="currentColor"
                className="opacity-40"
              />

              <g transform={`translate(${OX} ${OY}) scale(${SCALE})`}>
                <path d={SILHOUETTE_PATH} fill="currentColor" className="text-ink/20" />
              </g>

              {CALLOUTS.map(({ key, label, x, y, side }) => {
                const value = profile[key];
                if (value == null || value === '') return null;

                const cx = mapX(x);
                const cy = mapY(y);
                const labelX = side === 'left' ? 78 : 342;
                const anchor = side === 'left' ? 'end' : 'start';
                const elbowX = side === 'left' ? cx - 12 : cx + 12;

                return (
                  <g key={key} className="text-ink">
                    <circle cx={cx} cy={cy} r="3.5" fill="currentColor" className="text-clay" />
                    <line
                      x1={cx}
                      y1={cy}
                      x2={elbowX}
                      y2={cy}
                      stroke="currentColor"
                      strokeWidth="1.2"
                      className="text-clay/50"
                      opacity="0.85"
                    />
                    <line
                      x1={elbowX}
                      y1={cy}
                      x2={labelX}
                      y2={cy}
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-ink/20"
                    />
                    <text
                      x={labelX}
                      y={cy - 8}
                      textAnchor={anchor}
                      fill="currentColor"
                      fontSize="10"
                      letterSpacing="0.12em"
                      opacity="0.6"
                      style={{ fontFamily: 'inherit' }}
                    >
                      {label.toUpperCase()}
                    </text>
                    <text
                      x={labelX}
                      y={cy + 13}
                      textAnchor={anchor}
                      fill="currentColor"
                      fontSize="18"
                      style={{ fontFamily: 'Georgia, serif' }}
                    >
                      {formatIn(value)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Body type + skin tone */}
      <div className="grid sm:grid-cols-2 gap-4">
        {profile.bodyType && (
          <div className="border border-ink/10 bg-parchment/60 p-5">
            <p className="text-sm text-ink-soft mb-1">Body type</p>
            <div className="font-display text-2xl">{profile.bodyType}</div>
            <p className="text-sm text-ink-soft mt-2 leading-relaxed">
              {BODY_TYPE_NOTES[profile.bodyType]}
            </p>
          </div>
        )}

        {skinCategory && (
          <div className="border border-ink/10 bg-parchment/60 p-5">
            <p className="text-sm text-ink-soft mb-3">Skin tone</p>
            <div className="flex items-center gap-4">
              {profile.skinColorHex && (
                <div
                  className="w-12 h-12 rounded-full border-2 border-ink/15 shadow-inner shrink-0"
                  style={{ backgroundColor: profile.skinColorHex }}
                  aria-hidden
                />
              )}
              <div>
                {profile.skinColorHex && (
                  <code className="text-sm font-mono text-ink tracking-wide">{profile.skinColorHex}</code>
                )}
                <div className="font-display text-xl mt-0.5">{skinCategory}</div>
              </div>
            </div>
            <p className="text-sm text-ink-soft mt-2 leading-relaxed">{TONE_NOTES[skinCategory]}</p>
          </div>
        )}
      </div>
    </div>
  );
}
