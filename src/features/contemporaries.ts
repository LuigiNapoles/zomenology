import type { PreparedEvents } from '../timeline/prepare';
import { T_MAX_LOG } from '../timeline/scale';

/** F11 «¿Qué pasaba a la vez?»: eventos de otras macrocategorías que se solapan con uno dado. */

/** Ventana alrededor de un evento puntual: ±10 años… */
export const POINT_WINDOW_YEARS = 10;
/** …salvo antes de −10.000, donde es ±10 % de su antigüedad. */
export const DEEP_TIME_BEFORE = -10_000;
export const DEEP_TIME_FRACTION = 0.1;
export const MAX_PER_GROUP = 5;

export interface ContemporaryGroup {
  macro: number;
  /** Los más cercanos (como mucho MAX_PER_GROUP), del más cercano al más lejano. */
  items: number[];
  /** Cuántos se solapan en total en esta macrocategoría. */
  total: number;
}

export interface Contemporaries {
  /** Intervalo que se compara, en tiempo continuo. */
  from: number;
  to: number;
  /** Margen añadido a cada lado (0 para periodos). */
  margin: number;
  /** Por macrocategoría, en el orden de los carriles. */
  groups: ContemporaryGroup[];
}

/** Margen de la ventana de un evento puntual que empieza en `start`. */
export function pointMargin(start: number): number {
  if (start < DEEP_TIME_BEFORE) return (T_MAX_LOG - start) * DEEP_TIME_FRACTION;
  return POINT_WINDOW_YEARS;
}

/**
 * Cercanía entre dos intervalos: media de la diferencia de inicios y de finales.
 * Así un periodo enorme que contiene al evento no sale «a distancia 0».
 */
export function intervalDistance(s0: number, e0: number, s1: number, e1: number): number {
  return (Math.abs(s1 - s0) + Math.abs(e1 - e0)) / 2;
}

export function findContemporaries(
  data: PreparedEvents,
  index: number,
  filter: ((i: number) => boolean) | null = null,
  maxPerGroup = MAX_PER_GROUP,
): Contemporaries {
  const start = data.start[index] as number;
  const end = data.end[index] as number;
  const margin = data.point[index] === 1 ? pointMargin(start) : 0;
  const from = start - margin;
  const to = end + margin;
  const lane = data.lane[index] as number;

  const byMacro = new Map<number, { i: number; d: number }[]>();
  for (let j = 0; j < data.count; j++) {
    if (j === index || data.lane[j] === lane) continue;
    const s = data.start[j] as number;
    const e = data.end[j] as number;
    if (s >= to || e <= from) continue;
    if (filter && !filter(j)) continue;
    const macro = data.lane[j] as number;
    let list = byMacro.get(macro);
    if (!list) byMacro.set(macro, (list = []));
    list.push({ i: j, d: intervalDistance(start, end, s, e) });
  }

  const groups = [...byMacro.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([macro, list]) => {
      list.sort((a, b) => a.d - b.d || a.i - b.i);
      return { macro, items: list.slice(0, maxPerGroup).map((x) => x.i), total: list.length };
    });
  return { from, to, margin, groups };
}
