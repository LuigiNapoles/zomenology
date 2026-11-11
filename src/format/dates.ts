/** Formato de fechas en español: «4.600 Ma», «45 ka», «3000 a.C.», «s. XIII», «1851», «jul 1851». */

export const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/** Referencia de las fechas BP (antes del presente). */
export const BP_REF = 1950;

/** Número con punto de millares y coma decimal (hasta `decimals` decimales, sin ceros finales). */
export function formatNumber(n: number, decimals = 2): string {
  const sign = n < 0 ? '-' : '';
  const fixed = Math.abs(n).toFixed(decimals);
  const [int = '0', frac = ''] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const trimmed = frac.replace(/0+$/, '');
  return sign + grouped + (trimmed ? ',' + trimmed : '');
}

const ROMAN: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(n: number): string {
  let rest = Math.floor(n);
  let out = '';
  for (const [value, letters] of ROMAN) {
    while (rest >= value) {
      out += letters;
      rest -= value;
    }
  }
  return out;
}

/** «3000 a.C.», «1851», «año 1». Los años de 5 cifras o más llevan punto de millares. */
export function formatYear(year: number): string {
  const y = Math.round(year);
  const abs = Math.abs(y);
  const digits = abs >= 10_000 ? formatNumber(abs, 0) : String(abs);
  if (y < 0) return `${digits} a.C.`;
  if (y === 1) return 'año 1';
  return digits;
}

/** Millones de años antes de 0, sin referencia: −4.600.000.000 → «4.600 Ma». */
export function formatMa(t: number): string {
  return `${formatNumber(Math.max(0, -t) / 1e6)} Ma`;
}

/** Miles de años antes de 1950: −43.050 → «45 ka». */
export function formatKa(t: number): string {
  return `${formatNumber(Math.max(0, BP_REF - t) / 1000)} ka`;
}

/** Siglo que empieza en `t` (múltiplo de 100): 1200 → «s. XIII», −300 → «s. III a.C.». */
export function formatCentury(t: number): string {
  if (t < 0) return `s. ${toRoman(Math.ceil(-t / 100))} a.C.`;
  return `s. ${toRoman(Math.floor(t / 100) + 1)}`;
}

/** Mes `month` (1–12) del año `year`: «jul 1851». */
export function formatMonth(year: number, month: number): string {
  const y = year === 1 ? '1' : formatYear(year);
  return `${MONTHS_SHORT[month - 1] ?? '?'} ${y}`;
}

/** Antes de esta fecha (10 ka BP) las fechas se expresan en ka. */
export const KA_BEFORE = BP_REF - 10_000;

/** Fecha aproximada de un instante, con la precisión que permite el zoom. */
export function formatInstant(t: number, visibleYears: number): string {
  if (t < -1e6) return `${formatNumber(-t / 1e6, 2)} Ma`;
  if (t < KA_BEFORE) return `${formatNumber((BP_REF - t) / 1000, 1)} ka`;
  let year = Math.floor(t);
  if (year === 0) year = 1; // el año 0 no existe
  if (visibleYears < 3) {
    const month = Math.min(12, Math.floor((t - Math.floor(t)) * 12) + 1);
    return formatMonth(year, month);
  }
  return formatYear(year);
}

/** Duración legible: «13.800 millones de años», «45.000 años», «2 meses». */
export function formatSpan(years: number): string {
  if (years >= 1e6) return `${formatNumber(years / 1e6, 1)} millones de años`;
  if (years >= 2) return `${formatNumber(Math.round(years), 0)} años`;
  const months = Math.max(1, Math.round(years * 12));
  return months === 1 ? '1 mes' : `${months} meses`;
}

/** Nombre del tipo de fecha para la ficha. */
export const DATE_TYPE_NAMES: Record<string, string> = {
  e: 'Evento',
  v: 'Vida',
  m: 'Muerte',
  f: 'Floruit (época de actividad)',
  n: 'Nacimiento',
};

/** ¿El texto de la fecha ya indica su era? */
function mentionsEra(text: string, era: string): boolean {
  const t = text.toLowerCase();
  switch (era) {
    case 'Ma':
      return /\bma\b/.test(t);
    case 'ka BP':
      return /\bka\b/.test(t);
    case 'a.C.':
      return /a\.?\s?c/.test(t);
    case 'd.C.':
      return /d\.?\s?c|a\.?\s?d/.test(t);
    default:
      return t.includes(era.toLowerCase());
  }
}

/** Fecha tal como aparece en el PDF, con la era entre paréntesis si el texto no la dice. */
export function formatOriginalDate(text: string | undefined, era: string | undefined): string {
  const base = text ?? '';
  if (!era || mentionsEra(base, era)) return base;
  return base ? `${base} (${era})` : era;
}

/** Duración en años (sin año 0) o en meses y días si hay fechas precisas. */
export function formatDuration(
  a: number,
  b: number,
  start: number,
  end: number,
  precise: boolean,
): string {
  if (precise && end - start < 3) {
    const days = Math.round((end - start) * 365.25);
    if (end - start < 2 / 12) return days === 1 ? '1 día' : `${days} días`;
    const months = Math.round((end - start) * 12);
    return months === 1 ? '1 mes' : `${months} meses`;
  }
  const years = b - a - (a < 0 && b > 0 ? 1 : 0);
  if (years >= 1e6) return `${formatNumber(years / 1e6, 2)} millones de años`;
  if (years === 1) return '1 año';
  return `${formatNumber(years, 0)} años`;
}

/**
 * Lee una fecha escrita por el usuario: «1500», «-500», «500 a.C.», «45 ka», «2,5 Ma», «4.600 Ma».
 * Devuelve el comienzo y el final (exclusivo) en tiempo continuo, o null si no se entiende.
 * Para años, el final es el final de ese año; para ka y Ma, el propio instante.
 */
export function parseYearInput(input: string): { start: number; end: number } | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, ' ');
  const m = /^(-?)\s*([\d.,']+)\s*(ma|ka|ka bp|a\.? ?c\.?|d\.? ?c\.?)?$/.exec(text);
  if (!m) return null;
  const [, minus, digits = '', unit = ''] = m;
  let normalized = digits.replace(/'/g, ',');
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '');
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || normalized === '' || /,.*,/.test(digits)) return null;
  const sign = minus ? -1 : 1;
  if (unit === 'ma') return { start: -sign * n * 1e6, end: -sign * n * 1e6 };
  if (unit.startsWith('ka')) {
    const t = BP_REF - sign * n * 1000;
    return { start: t, end: t };
  }
  if (!Number.isInteger(n) || n === 0) return null;
  const year = unit.startsWith('a') ? -n : sign * n;
  if (unit.startsWith('a') && minus) return null;
  return { start: year, end: year + 1 };
}
