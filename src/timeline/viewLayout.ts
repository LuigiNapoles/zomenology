import { layoutLanes, type LaneLayout, type LayoutItemInput } from './layout';
import type { PreparedEvents } from './prepare';
import { toCoord, type ScaleMode, type View } from './scale';

/** Diámetro del punto y ancho mínimo de las barras. */
export const MARKER = 8;
/** Alto de las barras (llevan la etiqueta dentro cuando cabe). */
export const BAR_HEIGHT = 14;
/** Largo de la cola de los rangos abiertos. */
export const TAIL = 40;
/** Ancho reservado para el icono de tipo de fecha delante de la etiqueta. */
export const ICON_WIDTH = 14;
export const LANE_COUNT = 12;

/** Coordenadas de los eventos en un modo de escala. */
export interface EventCoords {
  mode: ScaleMode;
  u0: Float64Array;
  u1: Float64Array;
  /** Centro (para los puntos). */
  um: Float64Array;
}

export function eventCoords(data: PreparedEvents, mode: ScaleMode): EventCoords {
  const { count, start, end } = data;
  const coords: EventCoords = {
    mode,
    u0: new Float64Array(count),
    u1: new Float64Array(count),
    um: new Float64Array(count),
  };
  for (let i = 0; i < count; i++) {
    const s = start[i] as number;
    const e = end[i] as number;
    coords.u0[i] = toCoord(s, mode);
    coords.u1[i] = toCoord(e, mode);
    coords.um[i] = toCoord((s + e) / 2, mode);
  }
  return coords;
}

/** Extensión en píxeles del marcador de un evento para una vista (left, k). */
export function markerExtent(
  data: PreparedEvents,
  coords: EventCoords,
  i: number,
  left: number,
  k: number,
): { x0: number; x1: number; center: number; bar: boolean } {
  if (data.point[i]) {
    const center = ((coords.um[i] as number) - left) * k;
    let x0 = center - MARKER / 2;
    let x1 = center + MARKER / 2;
    if (data.open[i] === 1) x1 += TAIL;
    if (data.open[i] === 2) x0 -= TAIL;
    return { x0, x1, center, bar: false };
  }
  const x0 = ((coords.u0[i] as number) - left) * k;
  const x1 = Math.max(((coords.u1[i] as number) - left) * k, x0 + MARKER);
  return { x0, x1, center: (x0 + x1) / 2, bar: true };
}

export interface ViewLayout {
  mode: ScaleMode;
  /** Vista para la que se calculó (coordenada del borde izquierdo y píxeles por unidad). */
  left: number;
  k: number;
  width: number;
  height: number;
  /** Ventana cubierta, en coordenadas: media pantalla a cada lado. */
  winLeft: number;
  winRight: number;
  lanes: LaneLayout[];
}

/**
 * Calcula la colocación de los eventos para una vista: ventana de media pantalla a cada lado,
 * carriles por macrocategoría, filas, etiquetas y burbujas.
 * `labelWidth(i)` da el ancho de la etiqueta del evento i (icono incluido).
 */
export function buildLayout(
  data: PreparedEvents,
  coords: EventCoords,
  view: View,
  width: number,
  height: number,
  labelWidth: (i: number) => number,
  include: (i: number) => boolean = () => true,
): ViewLayout {
  const left = view.center - view.span / 2;
  const k = width / view.span;
  const winLeft = left - view.span / 2;
  const winRight = left + 1.5 * view.span;
  const pxLeft = -width / 2;
  const pxRight = 1.5 * width;
  const items: LayoutItemInput[] = [];
  for (const i of data.order) {
    if (!include(i)) continue;
    const u0 = data.point[i] ? (coords.um[i] as number) : (coords.u0[i] as number);
    const u1 = data.point[i] ? (coords.um[i] as number) : (coords.u1[i] as number);
    if (u1 < winLeft || u0 > winRight) continue;
    const m = markerExtent(data, coords, i, left, k);
    // Las barras muy largas se recortan a la ventana para no manejar números enormes.
    const x0 = Math.max(m.x0, pxLeft - MARKER);
    const x1 = Math.min(m.x1, pxRight + MARKER);
    if (x1 < pxLeft || x0 > pxRight) continue;
    const center = m.bar ? (Math.max(x0, pxLeft) + Math.min(x1, pxRight)) / 2 : m.center;
    items.push({
      index: i,
      lane: data.lane[i] as number,
      x0,
      x1,
      center,
      bar: m.bar,
      labelWidth: labelWidth(i),
      onScreen: x1 >= 0 && x0 <= width,
    });
  }
  const lanes = layoutLanes(items, LANE_COUNT, {
    height,
    screenWidth: width,
    winLeft: pxLeft,
    winRight: pxRight,
    originPx: left * k,
  });
  return { mode: view.mode, left, k, width, height, winLeft, winRight, lanes };
}
