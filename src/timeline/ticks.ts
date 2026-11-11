import {
  BP_REF,
  KA_BEFORE,
  formatCentury,
  formatKa,
  formatMa,
  formatMonth,
  formatYear,
} from '../format/dates';
import { REF_YEAR, T_MAX_LINEAR, T_MIN, timeAtX, type View, xOf } from './scale';

/** Los 7 niveles de escala del eje. */
export type TickLevel = 'Ma' | 'ka' | 'millennium' | 'century' | 'decade' | 'year' | 'month';

export interface Tick {
  t: number;
  x: number;
  label: string;
  level: TickLevel;
  /** Hito de referencia del modo logarítmico. */
  milestone: boolean;
}

interface StepDef {
  /** Paso en años. */
  step: number;
  level: TickLevel;
}

/** Pasos en orden creciente; entre dos seguidos nunca hay más de un factor 2. */
export const STEPS: readonly StepDef[] = [
  ...[1, 2, 3, 6].map((m) => ({ step: m / 12, level: 'month' as const })),
  ...[1, 2, 4, 5].map((step) => ({ step, level: 'year' as const })),
  ...[10, 20, 25, 50].map((step) => ({ step, level: 'decade' as const })),
  ...[100, 200, 400].map((step) => ({ step, level: 'century' as const })),
  ...[500, 1000, 2000, 2500, 5000].map((step) => ({ step, level: 'millennium' as const })),
  ...[1e4, 2e4, 2.5e4, 5e4, 1e5, 2e5, 2.5e5, 5e5].map((step) => ({ step, level: 'ka' as const })),
  ...[1e6, 1e7, 1e8, 1e9].flatMap((p) =>
    [1, 2, 2.5, 5].map((m) => ({ step: m * p, level: 'Ma' as const })),
  ),
];

/** Hitos de referencia del modo logarítmico, en orden de prioridad. */
export const LOG_MILESTONES: readonly { t: number; label: string; level: TickLevel }[] = [
  { t: -1e6, label: '1 Ma', level: 'Ma' },
  { t: BP_REF - 1e5, label: '100 ka', level: 'ka' },
  { t: BP_REF - 1e4, label: '10 ka', level: 'ka' },
  { t: -1000, label: '1000 a.C.', level: 'millennium' },
  { t: 1, label: 'año 1', level: 'millennium' },
  { t: 1500, label: '1500', level: 'century' },
  { t: 1900, label: '1900', level: 'century' },
];

/**
 * Candidatas del modo logarítmico a escala de potencias de diez: 1, 2 y 5 × 10^k
 * años antes del presente (en Ma o ka). Van por prioridad: primero los 1, luego los 2 y los 5.
 */
export const LOG_DECADES: readonly { t: number; label: string; level: TickLevel }[] = [1, 2, 5]
  .flatMap((m) => [
    ...[10, 9, 8, 7, 6].map((k) => ({ t: -m * 10 ** k, level: 'Ma' as const })),
    ...[5, 4].map((k) => ({ t: BP_REF - m * 10 ** k, level: 'ka' as const })),
  ])
  .filter(({ t }) => t >= -13_800_000_000)
  .map(({ t, level }) => ({ t, level, label: level === 'Ma' ? formatMa(t) : formatKa(t) }));

/** Ancho mínimo reservado para cada etiqueta. */
const MIN_LABEL_PX = 96;
const MAX_TICKS = 12;
/** Tope de seguridad de marcas generadas por paso. */
const MAX_GENERATED = 2000;

export function maxTicksFor(width: number): number {
  return Math.min(MAX_TICKS, Math.max(2, Math.floor(width / MIN_LABEL_PX)));
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Marcas de un paso dentro de [t0, t1], con su etiqueta. */
export function ticksForStep(def: StepDef, t0: number, t1: number): { t: number; label: string }[] {
  const { step, level } = def;
  const out: { t: number; label: string }[] = [];
  if (level === 'month') {
    const k = Math.round(step * 12);
    const first = Math.ceil(t0 * 12);
    const last = Math.floor(t1 * 12);
    if (last - first > MAX_GENERATED * k) return out;
    for (let m = first + mod(-first, k); m <= last; m += k) {
      if (m >= 0 && m < 12) continue; // el año 0 no existe
      const year = Math.floor(m / 12);
      out.push({ t: m / 12, label: formatMonth(year, m - year * 12 + 1) });
    }
    return out;
  }
  if (level === 'ka') {
    // Múltiplos en «años antes de 1950».
    const nFirst = Math.max(0, Math.ceil((BP_REF - t1) / step));
    const nLast = Math.floor((BP_REF - t0) / step);
    if (nLast - nFirst > MAX_GENERATED) return out;
    for (let n = nLast; n >= nFirst; n--) {
      const t = BP_REF - n * step;
      out.push({ t, label: formatKa(t) });
    }
    return out;
  }
  const nFirst = Math.ceil(t0 / step);
  const nLast = Math.floor(t1 / step);
  if (nLast - nFirst > MAX_GENERATED) return out;
  for (let n = nFirst; n <= nLast; n++) {
    const value = n * step;
    if (level === 'Ma') {
      out.push({ t: value, label: formatMa(value) });
      continue;
    }
    // El año 0 no existe: la marca del 0 se pone en el año 1.
    const t = value === 0 ? 1 : value;
    if (t > t1) continue;
    // Siglos en romanos solo desde el 1000 a.C.; antes, «8000 a.C.» se lee mejor que «s. LXXX a.C.».
    const label = level === 'century' && value >= -1000 ? formatCentury(value) : formatYear(t);
    out.push({ t, label });
  }
  return out;
}

/**
 * Paso más fino con el que caben como mucho `maxTicks` marcas en `years` años.
 * Antes de 10 ka BP, los pasos de milenios se etiquetan en ka («45 ka») y no en años a.C.
 */
export function chooseStep(years: number, maxTicks: number, centerT = 0): StepDef {
  const def = STEPS.find((d) => years / d.step < maxTicks) ?? (STEPS[STEPS.length - 1] as StepDef);
  if (def.level === 'millennium' && def.step >= 1000 && centerT < KA_BEFORE) {
    return { step: def.step, level: 'ka' };
  }
  return def;
}

function linearTicks(view: View, width: number, t0: number, t1: number): Tick[] {
  const def = chooseStep(t1 - t0, maxTicksFor(width), (t0 + t1) / 2);
  return ticksForStep(def, t0, t1).map(({ t, label }) => ({
    t,
    label,
    x: xOf(t, view, width),
    level: def.level,
    milestone: false,
  }));
}

/** Inserta `tick` si queda a `gap` píxeles o más de las ya aceptadas (ordenadas por x). */
function tryInsert(accepted: Tick[], tick: Tick, gap: number): boolean {
  let lo = 0;
  let hi = accepted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((accepted[mid] as Tick).x < tick.x) lo = mid + 1;
    else hi = mid;
  }
  const prev = accepted[lo - 1];
  const next = accepted[lo];
  if (prev && tick.x - prev.x < gap) return false;
  if (next && next.x - tick.x < gap) return false;
  accepted.splice(lo, 0, tick);
  return true;
}

function logTicks(view: View, width: number, t0: number, t1: number): Tick[] {
  const gap = width / maxTicksFor(width);
  const accepted: Tick[] = [];
  const inside = (x: number) => x >= 0 && x <= width;

  for (const m of LOG_MILESTONES) {
    const x = xOf(m.t, view, width);
    if (inside(x) && m.t >= t0 && m.t <= t1) {
      tryInsert(accepted, { ...m, x, milestone: true }, gap);
    }
  }
  for (const d of LOG_DECADES) {
    const x = xOf(d.t, view, width);
    if (inside(x) && d.t >= t0 && d.t <= t1) {
      tryInsert(accepted, { ...d, x, milestone: false }, gap);
    }
  }

  // Píxeles por año en t: (ancho / amplitud) / (ya · ln 10).
  const pxPerCoord = width / view.span;
  for (let i = STEPS.length - 1; i >= 0; i--) {
    const def = STEPS[i] as StepDef;
    // Solo donde dos marcas seguidas de este paso quedan separadas al menos `gap`.
    const yaMax = (def.step * pxPerCoord) / (gap * Math.LN10);
    const from = Math.max(t0, REF_YEAR - yaMax);
    if (from > t1) continue;
    for (const { t, label } of ticksForStep(def, from, t1)) {
      const x = xOf(t, view, width);
      if (inside(x)) tryInsert(accepted, { t, label, x, level: def.level, milestone: false }, gap);
    }
  }
  return accepted;
}

/** Marcas visibles del eje para una vista y un ancho en píxeles. */
export function computeTicks(view: View, width: number): Tick[] {
  if (width <= 0) return [];
  // Sin marcas antes del Big Bang ni en el futuro.
  const t0 = Math.max(timeAtX(0, view, width), T_MIN);
  const t1 = Math.min(timeAtX(width, view, width), T_MAX_LINEAR);
  if (t0 >= t1) return [];
  if (view.mode === 'linear') return linearTicks(view, width, t0, t1);
  // Con poca variación de escala a lo ancho de la pantalla, el eje logarítmico es casi lineal.
  const ratio = (REF_YEAR - t0) / Math.max(REF_YEAR - t1, 1e-9);
  if (ratio < 4) return linearTicks(view, width, t0, t1);
  return logTicks(view, width, t0, t1);
}
