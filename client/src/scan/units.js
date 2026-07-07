// Display + input helpers. All measurements are stored in cm internally.

export const cmToIn = (cm) => {
  if (cm == null || cm === '') return null;
  return Math.round((Number(cm) / 2.54) * 10) / 10;
};

export const inToCm = (inch) => {
  if (inch == null || inch === '') return null;
  return Math.round(Number(inch) * 2.54 * 10) / 10;
};

export const formatIn = (cm) => {
  const v = cmToIn(cm);
  return v == null ? '—' : `${v}″`;
};

export const cmToFeetIn = (cm) => {
  const totalIn = Number(cm) / 2.54;
  const feet = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn - feet * 12);
  if (inches === 12) return { feet: feet + 1, inches: 0 };
  return { feet, inches };
};

export const feetInToCm = (feet, inches) => {
  const totalIn = Number(feet) * 12 + Number(inches);
  if (!totalIn || totalIn <= 0) return null;
  return Math.round(totalIn * 2.54);
};

/** Accept flexible height text: 170, 5-11, 5'11", 6 feet 2 */
export const parseHeightText = (str) => {
  if (str == null || str === '') return null;
  const s = String(str).trim().toLowerCase();

  const cmOnly = s.match(/^(\d+(?:\.\d+)?)\s*cm?$/);
  if (cmOnly) return Math.round(Number(cmOnly[1]));

  const plainCm = s.match(/^(\d{2,3})$/);
  if (plainCm) {
    const n = Number(plainCm[1]);
    if (n >= 90 && n <= 230) return n;
  }

  const ftInDash = s.match(/^(\d+)\s*[-']\s*(\d{1,2})\s*"?$/);
  if (ftInDash) return feetInToCm(ftInDash[1], ftInDash[2]);

  const ftInQuote = s.match(/^(\d+)\s*['′]\s*(\d{1,2})\s*["″]?$/);
  if (ftInQuote) return feetInToCm(ftInQuote[1], ftInQuote[2]);

  const feetOnly = s.match(/^(\d+)\s*(?:feet|foot|ft)\s*(\d{1,2})?\s*(?:in(?:ch(?:es)?)?)?$/);
  if (feetOnly) return feetInToCm(feetOnly[1], feetOnly[2] || 0);

  return null;
};

export const formatHeight = (cm, unit = 'cm') => {
  if (cm == null || cm === '') return '—';
  if (unit === 'ft') {
    const { feet, inches } = cmToFeetIn(cm);
    return `${feet}′${inches}″`;
  }
  return `${Math.round(Number(cm))} cm`;
};

export const isValidHeightCm = (cm) => {
  const n = Number(cm);
  return n >= 90 && n <= 230;
};
