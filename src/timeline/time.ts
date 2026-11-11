import type { TimelineEvent } from '../data/types';

/**
 * Tiempo continuo en años: el año Y ocupa [Y, Y + 1) y julio de 1851 empieza en 1851,5.
 * Los a.C. son negativos sin año 0, como en los datos: el año −1 ocupa [−1, 0).
 */

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Comienzo del año, mes o día indicado. */
export function startOf(year: number, month?: number, day?: number): number {
  if (month === undefined) return year;
  const monthStart = year + (month - 1) / 12;
  if (day === undefined) return monthStart;
  return monthStart + (day - 1) / (12 * daysInMonth(year, month));
}

/** Final (exclusivo) del año, mes o día indicado. */
export function endOf(year: number, month?: number, day?: number): number {
  if (month === undefined) return year + 1;
  if (day === undefined) return year + month / 12;
  return year + (month - 1) / 12 + day / (12 * daysInMonth(year, month));
}

export interface EventSpan {
  start: number;
  end: number;
  /** Un solo año, mes o día: se pinta como punto en el centro de `start`–`end`. */
  point: boolean;
}

/** Eventos del eje: siempre tienen `a`. */
export function eventSpan(e: TimelineEvent): EventSpan {
  const a = e.a ?? 0;
  const b = e.b ?? a;
  const point = b === a && e.ma === e.mb && e.da === e.db;
  return { start: startOf(a, e.ma, e.da), end: endOf(b, e.mb, e.db), point };
}
