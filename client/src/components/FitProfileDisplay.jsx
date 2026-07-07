import { BODY_TYPE_NOTES, TONE_NOTES } from '../scan/classify.js';
import { formatHeight, formatIn } from '../scan/units.js';

const MEASURE_ICONS = {
  shoulder: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-clay/70" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" strokeLinecap="round" />
    </svg>
  ),
  chest: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-clay/70" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="12" rx="8" ry="5" />
    </svg>
  ),
  waist: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-clay/70" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 12c0-3 2.5-5 6-5s6 2 6 5" strokeLinecap="round" />
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  hip: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-clay/70" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 14c0 2.5 2.2 4 5 4s5-1.5 5-4" strokeLinecap="round" />
      <path d="M6 14h12" strokeLinecap="round" />
    </svg>
  ),
};

const BODY_MEASURES = [
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hip', label: 'Hip' },
];

export default function FitProfileDisplay({ profile, className = '' }) {
  if (!profile) return null;

  const heightUnit = profile.heightUnit || 'cm';
  const skinCategory = profile.skinTone;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Height hero */}
      {profile.height != null && (
        <div className="border border-ink/10 bg-parchment/50 px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-clay shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm text-ink-soft">Height</span>
          </div>
          <div className="font-display text-4xl font-light">{formatHeight(profile.height, heightUnit)}</div>
        </div>
      )}

      {/* Body measurements in inches */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BODY_MEASURES.map(({ key, label }) => (
          <div key={key} className="border border-ink/10 bg-ivory px-4 py-5">
            <div className="flex items-center gap-2 mb-2">
              {MEASURE_ICONS[key]}
              <span className="text-sm text-ink-soft">{label}</span>
            </div>
            <div className="font-display text-3xl font-light">{formatIn(profile[key])}</div>
          </div>
        ))}
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
