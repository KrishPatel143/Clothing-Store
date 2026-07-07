import { useState } from 'react';
import { cmToFeetIn, feetInToCm, isValidHeightCm } from '../scan/units.js';

const inputClass =
  'w-full bg-transparent border border-ivory/30 px-4 py-3 text-lg focus:outline-none focus:border-gold';
const inputClassLight =
  'w-full bg-transparent border border-ivory/30 px-3 py-2.5 focus:outline-none focus:border-gold';

/**
 * Height input with cm or ft/in toggle.
 * onChange({ heightCm, heightUnit })
 */
export default function HeightInput({
  valueCm = 170,
  unit = 'cm',
  onChange,
  variant = 'dark',
  label = 'Your height — our measuring tape',
}) {
  const [heightUnit, setHeightUnit] = useState(unit);
  const [cmValue, setCmValue] = useState(String(valueCm || ''));
  const [feet, setFeet] = useState(() => {
    if (unit === 'ft' && valueCm) {
      return String(cmToFeetIn(valueCm).feet);
    }
    return '';
  });
  const [inches, setInches] = useState(() => {
    if (unit === 'ft' && valueCm) {
      return String(cmToFeetIn(valueCm).inches);
    }
    return '';
  });

  const emit = (cm, u) => {
    onChange?.({ heightCm: cm, heightUnit: u });
  };

  const switchUnit = (u) => {
    setHeightUnit(u);
    if (u === 'ft' && cmValue) {
      const { feet: f, inches: i } = cmToFeetIn(Number(cmValue));
      setFeet(String(f));
      setInches(String(i));
      emit(Number(cmValue), u);
    } else if (u === 'cm' && feet) {
      const cm = feetInToCm(feet, inches || 0);
      if (cm) {
        setCmValue(String(cm));
        emit(cm, u);
      }
    } else {
      emit(Number(cmValue) || null, u);
    }
  };

  const handleCm = (v) => {
    setCmValue(v);
    emit(Number(v) || null, 'cm');
  };

  const handleFeet = (v) => {
    setFeet(v);
    const cm = feetInToCm(v, inches || 0);
    emit(cm, 'ft');
  };

  const handleInches = (v) => {
    setInches(v);
    const cm = feetInToCm(feet || 0, v);
    emit(cm, 'ft');
  };

  const fieldClass = variant === 'dark' ? inputClass : inputClassLight;
  const labelClass = variant === 'dark' ? 'label-caps text-ivory/60' : 'label-caps text-ivory/60';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <label className={labelClass}>{label}</label>
        <div className="flex border border-ivory/25 text-[10px] tracking-[0.12em] uppercase shrink-0">
          {['cm', 'ft'].map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => switchUnit(u)}
              className={`px-2.5 py-1 transition-colors ${
                heightUnit === u ? 'bg-gold text-ink' : 'text-ivory/50 hover:text-ivory'
              }`}
            >
              {u === 'cm' ? 'cm' : 'ft/in'}
            </button>
          ))}
        </div>
      </div>

      {heightUnit === 'cm' ? (
        <input
          type="number"
          value={cmValue}
          onChange={(e) => handleCm(e.target.value)}
          className={fieldClass}
          min="90"
          max="230"
          placeholder="170"
        />
      ) : (
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="number"
              value={feet}
              onChange={(e) => handleFeet(e.target.value)}
              className={fieldClass}
              min="3"
              max="7"
              placeholder="5"
              aria-label="Feet"
            />
            <span className="text-xs text-ivory/40 mt-1 block">feet</span>
          </div>
          <div className="flex-1">
            <input
              type="number"
              value={inches}
              onChange={(e) => handleInches(e.target.value)}
              className={fieldClass}
              min="0"
              max="11"
              placeholder="7"
              aria-label="Inches"
            />
            <span className="text-xs text-ivory/40 mt-1 block">inches</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function validateHeightInput(heightCm) {
  if (!isValidHeightCm(heightCm)) {
    return 'Enter your height (90–230 cm or 3–7 ft) — it makes measurements accurate.';
  }
  return null;
}
