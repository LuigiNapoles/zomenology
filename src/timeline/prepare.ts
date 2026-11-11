import type { DataFile, TimelineEvent } from '../data/types';
import { eventSpan } from './time';

/** Longitud máxima de la etiqueta en el eje; el texto completo está en la ficha. */
export const LABEL_MAX_CHARS = 60;

/** Eventos del eje preparados para pintar rápido: arrays planos en el orden de events.json. */
export interface PreparedEvents {
  count: number;
  events: readonly TimelineEvent[];
  start: Float64Array;
  end: Float64Array;
  point: Uint8Array;
  approx: Uint8Array;
  /** 0 = cerrado, 1 = rango abierto (sin final), 2 = sin comienzo. */
  open: Uint8Array;
  /** Carril = macrocategoría. */
  lane: Uint8Array;
  /** Índices ordenados por prioridad de etiqueta: periodos más largos y descripciones más largas primero. */
  order: Int32Array;
  labels: string[];
}

export function labelText(description: string): string {
  if (description.length <= LABEL_MAX_CHARS) return description;
  return description.slice(0, LABEL_MAX_CHARS - 1).trimEnd() + '…';
}

export function prepareEvents(data: Pick<DataFile, 'events' | 'sections'>): PreparedEvents {
  const events = data.events;
  const count = events.length;
  const prepared: PreparedEvents = {
    count,
    events,
    start: new Float64Array(count),
    end: new Float64Array(count),
    point: new Uint8Array(count),
    approx: new Uint8Array(count),
    open: new Uint8Array(count),
    lane: new Uint8Array(count),
    order: new Int32Array(count),
    labels: new Array<string>(count),
  };
  const duration = new Float64Array(count);
  events.forEach((e, i) => {
    const span = eventSpan(e);
    prepared.start[i] = span.start;
    prepared.end[i] = span.end;
    prepared.point[i] = span.point ? 1 : 0;
    prepared.approx[i] = e.ap ?? 0;
    prepared.open[i] = e.x ?? 0;
    prepared.lane[i] = data.sections[e.s]?.macro ?? 0;
    prepared.labels[i] = labelText(e.d);
    duration[i] = span.point ? 0 : span.end - span.start;
  });
  const order = Array.from({ length: count }, (_, i) => i);
  order.sort((a, b) => {
    const ea = events[a] as TimelineEvent;
    const eb = events[b] as TimelineEvent;
    return (
      (duration[b] as number) - (duration[a] as number) ||
      eb.d.length - ea.d.length ||
      ea.id - eb.id
    );
  });
  prepared.order.set(order);
  return prepared;
}
