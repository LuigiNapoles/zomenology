import { formatNumber } from '../format/dates';
import { T_MAX_LOG, T_MIN } from '../timeline/scale';

/**
 * F14 Escala humana.
 * - Antes de la historia (antes del 3300 a.C.): «calendario cósmico», toda la historia del
 *   universo comprimida en un año.
 * - Desde entonces: «hace X generaciones», a 25 años por generación.
 */

export const HISTORY_FROM = -3300;
export const GENERATION_YEARS = 25;
/** Año actual de los datos. */
export const PRESENT = T_MAX_LOG;

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const YEAR_SECONDS = 365 * 86_400;

export interface CosmicTime {
  /** 0 = enero. */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Momento del «año cósmico» (del Big Bang, 1 de enero 00:00:00, a hoy) que corresponde a `t`. */
export function cosmicTime(t: number): CosmicTime {
  const k = Math.min(Math.max((t - T_MIN) / (PRESENT - T_MIN), 0), 1);
  let rest = Math.min(Math.floor(k * YEAR_SECONDS), YEAR_SECONDS - 1);
  let dayOfYear = Math.floor(rest / 86_400);
  rest -= dayOfYear * 86_400;
  let month = 0;
  while (dayOfYear >= (MONTH_DAYS[month] as number)) {
    dayOfYear -= MONTH_DAYS[month] as number;
    month++;
  }
  const hours = Math.floor(rest / 3600);
  const minutes = Math.floor((rest % 3600) / 60);
  return { month, day: dayOfYear + 1, hours, minutes, seconds: rest % 60 };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** «31 de diciembre a las 23:59:58». */
export function formatCosmicTime(c: CosmicTime): string {
  return `${c.day} de ${MONTHS[c.month] ?? ''} a las ${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`;
}

/** Años transcurridos desde el año `year` de los datos (sin año 0) hasta hoy. */
export function yearsAgo(year: number): number {
  return Math.max(0, PRESENT - year - (year < 0 ? 1 : 0));
}

export function generationsText(year: number, point: boolean): string {
  const ago = yearsAgo(year);
  const verb = point ? 'Ocurrió' : 'Empezó';
  const generations = Math.round(ago / GENERATION_YEARS);
  if (generations < 1) return `${verb} hace menos de una generación.`;
  const years = ago === 1 ? '1 año' : `${formatNumber(ago, 0)} años`;
  const count =
    generations === 1 ? 'una generación' : `unas ${formatNumber(generations, 0)} generaciones`;
  return `${verb} hace ${count} (${years}, a ${GENERATION_YEARS} años por generación).`;
}

/** Línea de la ficha para un evento que empieza en el año `year` (tiempo continuo `start`). */
export function humanScaleText(year: number, start: number, point: boolean): string {
  if (year >= HISTORY_FROM) return generationsText(year, point);
  const verb = point ? 'esto ocurrió' : 'esto empezó';
  return `Si toda la historia del universo cupiera en un año, ${verb} el ${formatCosmicTime(cosmicTime(start))}.`;
}
