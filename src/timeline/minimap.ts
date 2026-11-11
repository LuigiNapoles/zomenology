import {
  T_MAX_LOG,
  T_MIN,
  clampView,
  domain,
  fromCoord,
  timeAtX,
  toCoord,
  viewAround,
  type ScaleMode,
  type View,
} from './scale';

/**
 * Minimapa: toda la historia en una barra, siempre en escala logarítmica para que se vean
 * todas las eras (en lineal, los últimos 10.000 años ocuparían menos de un píxel).
 */

/** Ancho mínimo del recuadro de la ventana visible, para que no desaparezca con mucho zoom. */
export const MIN_WINDOW_PX = 8;

const [LO, HI] = domain('log');

export function minimapX(t: number, width: number): number {
  return ((toCoord(t, 'log') - LO) / (HI - LO)) * width;
}

export function minimapTime(x: number, width: number): number {
  const u = LO + (Math.min(Math.max(x, 0), width) / width) * (HI - LO);
  return fromCoord(u, 'log');
}

/** Recuadro de la ventana visible del eje principal, en píxeles del minimapa. */
export function windowRect(
  view: View,
  axisWidth: number,
  width: number,
): { x0: number; x1: number } {
  const t0 = Math.max(timeAtX(0, view, axisWidth), T_MIN);
  const t1 = Math.min(timeAtX(axisWidth, view, axisWidth), T_MAX_LOG);
  let x0 = minimapX(t0, width);
  let x1 = minimapX(t1, width);
  if (x1 - x0 < MIN_WINDOW_PX) {
    const c = (x0 + x1) / 2;
    x0 = c - MIN_WINDOW_PX / 2;
    x1 = c + MIN_WINDOW_PX / 2;
  }
  return { x0, x1 };
}

/** La misma vista (mismo zoom) centrada en t. */
export function viewCenteredAt(view: View, t: number): View {
  return clampView({ ...view, center: toCoord(t, view.mode) });
}

export interface Jump {
  label: string;
  /** Centro del salto y años visibles. */
  t: number;
  years: number;
}

/** Botones de salto rápido de docs/PROYECTO.md (F3). */
export const JUMPS: readonly Jump[] = [
  { label: 'Big Bang', t: -13_800_000_000, years: 400_000_000 },
  { label: 'Tierra', t: -4_540_000_000, years: 1_000_000_000 },
  { label: 'Paleolítico', t: -1_290_000, years: 3_000_000 },
  { label: 'Neolítico', t: -6500, years: 7000 },
  { label: 'Antigüedad', t: -2000, years: 3000 },
  { label: 'Clásica', t: -150, years: 1300 },
  { label: 'Edad Media', t: 984, years: 1100 },
  { label: 'Moderna', t: 1640, years: 320 },
  { label: 'Contemporánea', t: 1907, years: 240 },
  { label: 'Hoy', t: 2010, years: 40 },
];

export function jumpView(jump: Jump, mode: ScaleMode): View {
  return viewAround(jump.t, jump.years, mode);
}
