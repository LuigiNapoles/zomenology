import { MIN_TIME_SPAN, REF_YEAR, viewAround, visibleYears, type View } from './scale';

/**
 * Vista centrada en un evento.
 * - Periodo: que ocupe más o menos el 60 % de la pantalla.
 * - Punto: se mantiene el zoom, salvo que sea tan amplio que no se vea nada alrededor
 *   (como máximo, la mitad de su antigüedad o 10 años).
 */
export function viewForEvent(start: number, end: number, point: boolean, view: View): View {
  const t = (start + end) / 2;
  const years = point
    ? Math.min(visibleYears(view), Math.max(10, (REF_YEAR - t) * 0.5))
    : (end - start) / 0.6;
  return viewAround(t, Math.max(years, MIN_TIME_SPAN), view.mode);
}
