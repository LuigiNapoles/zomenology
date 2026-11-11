/**
 * Conversión año ↔ píxel.
 *
 * La vista vive en un espacio de «coordenada»:
 * - lineal: la coordenada es el año continuo (ver time.ts);
 * - logarítmica: −log10(ya), con ya = 2027 − año (mínimo 1). El signo menos deja el pasado a la izquierda.
 */

export type ScaleMode = 'linear' | 'log';

export interface View {
  mode: ScaleMode;
  /** Centro, en coordenada. */
  center: number;
  /** Amplitud visible, en coordenada. */
  span: number;
}

export const REF_YEAR = 2027;
export const MIN_YA = 1;
export const T_MIN = -13_800_000_000;
/** Final del eje: fin de 2026 en lineal; en logarítmico, ya = 1 (año 2026). */
export const T_MAX_LINEAR = REF_YEAR;
export const T_MAX_LOG = REF_YEAR - MIN_YA;
/** Zoom máximo: unos 2 meses en pantalla. */
export const MIN_TIME_SPAN = 2 / 12;
/** Margen a cada lado de la vista completa, en fracción del dominio. */
const FULL_PADDING = 0.02;

const LN10 = Math.LN10;

export function toCoord(t: number, mode: ScaleMode): number {
  if (mode === 'linear') return t;
  return -Math.log10(Math.max(REF_YEAR - t, MIN_YA));
}

export function fromCoord(u: number, mode: ScaleMode): number {
  if (mode === 'linear') return u;
  return REF_YEAR - Math.pow(10, -u);
}

/** Años por unidad de coordenada en el punto `u`. */
export function yearsPerCoord(u: number, mode: ScaleMode): number {
  return mode === 'linear' ? 1 : Math.pow(10, -u) * LN10;
}

export function domain(mode: ScaleMode): [number, number] {
  const hi = mode === 'linear' ? T_MAX_LINEAR : T_MAX_LOG;
  return [toCoord(T_MIN, mode), toCoord(hi, mode)];
}

export function fullView(mode: ScaleMode): View {
  const [lo, hi] = domain(mode);
  return { mode, center: (lo + hi) / 2, span: (hi - lo) * (1 + 2 * FULL_PADDING) };
}

/** Amplitud mínima (2 meses) para una vista centrada en `center`. */
export function minSpan(center: number, mode: ScaleMode): number {
  if (mode === 'linear') return MIN_TIME_SPAN;
  // Ancho en años de [c − s/2, c + s/2] = 2·ya(c)·sinh(s·ln10/2); se despeja s.
  const ya = Math.pow(10, -center);
  return (2 * Math.asinh(MIN_TIME_SPAN / (2 * ya))) / LN10;
}

export function clampView(view: View): View {
  const [lo, hi] = domain(view.mode);
  const maxSpan = (hi - lo) * (1 + 2 * FULL_PADDING);
  let span = Math.min(Math.max(view.span, 0), maxSpan);
  let center = Number.isFinite(view.center) ? view.center : (lo + hi) / 2;
  center = Math.min(Math.max(center, lo), hi);
  span = Math.max(span, minSpan(center, view.mode));
  if (span >= hi - lo) {
    // Si cabe todo el dominio, se mantiene centrado.
    center = (lo + hi) / 2;
  }
  return { mode: view.mode, center, span };
}

export function leftEdge(view: View): number {
  return view.center - view.span / 2;
}

export function coordToX(u: number, view: View, width: number): number {
  return ((u - leftEdge(view)) / view.span) * width;
}

export function xOf(t: number, view: View, width: number): number {
  return coordToX(toCoord(t, view.mode), view, width);
}

export function coordAtX(x: number, view: View, width: number): number {
  return leftEdge(view) + (x / width) * view.span;
}

export function timeAtX(x: number, view: View, width: number): number {
  return fromCoord(coordAtX(x, view, width), view.mode);
}

export function centerTime(view: View): number {
  return fromCoord(view.center, view.mode);
}

/** Años visibles entre los bordes izquierdo y derecho, sin contar el margen fuera del rango. */
export function visibleYears(view: View): number {
  const half = view.span / 2;
  const tMax = view.mode === 'linear' ? T_MAX_LINEAR : T_MAX_LOG;
  const t0 = Math.max(fromCoord(view.center - half, view.mode), T_MIN);
  const t1 = Math.min(fromCoord(view.center + half, view.mode), tMax);
  return Math.max(0, t1 - t0);
}

/** Zoom de factor `factor` (>1 acerca) manteniendo fijo lo que hay bajo el píxel `anchorX`. */
export function zoomAt(view: View, factor: number, anchorX: number, width: number): View {
  const frac = width > 0 ? anchorX / width : 0.5;
  const anchor = leftEdge(view) + frac * view.span;
  const span = view.span / factor;
  const clamped = clampView({ ...view, center: anchor + (0.5 - frac) * span, span });
  // Si el zoom choca con el límite de 2 meses, se reajusta el centro para conservar el ancla.
  return clampView({ ...clamped, center: anchor + (0.5 - frac) * clamped.span });
}

/** Desplaza la vista `dx` píxeles (positivo = el contenido va a la derecha). */
export function panBy(view: View, dx: number, width: number): View {
  return clampView({ ...view, center: view.center - (dx / width) * view.span });
}

/** Cambia de modo conservando la fecha del centro y la escala local (años por píxel). */
export function switchMode(view: View, mode: ScaleMode): View {
  if (mode === view.mode) return view;
  const t = centerTime(view);
  const years = view.span * yearsPerCoord(view.center, view.mode);
  const center = toCoord(t, mode);
  return clampView({ mode, center, span: years / yearsPerCoord(center, mode) });
}

/** Centra la vista en `t` con `years` años visibles (aprox. en modo logarítmico). */
export function viewAround(t: number, years: number, mode: ScaleMode): View {
  const center = toCoord(t, mode);
  return clampView({ mode, center, span: years / yearsPerCoord(center, mode) });
}

/** Interpolación para animaciones: centro lineal y amplitud geométrica. */
export function lerpView(from: View, to: View, k: number): View {
  return {
    mode: to.mode,
    center: from.center + (to.center - from.center) * k,
    span: from.span * Math.pow(to.span / from.span, k),
  };
}
