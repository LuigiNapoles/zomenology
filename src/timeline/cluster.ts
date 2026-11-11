import { MIN_TIME_SPAN, viewAround, visibleYears, xOf, type View } from './scale';

/** Hueco en píxeles dentro del cual los eventos que no caben se agrupan en una burbuja. */
export const CLUSTER_PX = 24;
/** Separación mínima entre dos elementos de una fila. */
export const MIN_SEPARATION = 2;

export interface OverflowItem {
  index: number;
  /** Centro del marcador, en píxeles. */
  center: number;
  /** Extensión del marcador, en píxeles. */
  x0: number;
  x1: number;
  /** Marcador más estrecho que el hueco de agrupación (punto o barra corta). */
  short: boolean;
}

export interface Bubble {
  members: number[];
  center: number;
  x0: number;
  x1: number;
  /** Un solo evento corto: se pinta como su marcador, sin número. */
  single: boolean;
}

/** Texto de la burbuja: «+42». */
export function bubbleLabel(count: number): string {
  return `+${count}`;
}

/** Ancho de la burbuja según las cifras del número (texto de 14 px). */
export function bubbleWidth(count: number): number {
  const digits = String(count).length;
  return 18 + 9 * digits;
}

function makeBubble(members: OverflowItem[]): Bubble {
  if (members.length === 1) {
    const only = members[0] as OverflowItem;
    if (only.short) {
      return { members: [only.index], center: only.center, x0: only.x0, x1: only.x1, single: true };
    }
  }
  const center = members.reduce((sum, m) => sum + m.center, 0) / members.length;
  const half = bubbleWidth(members.length) / 2;
  return {
    members: members.map((m) => m.index),
    center,
    x0: center - half,
    x1: center + half,
    single: false,
  };
}

/**
 * Agrupa en burbujas los eventos que no caben en las filas de un carril.
 * Los eventos se reparten en huecos de `binPx` según su centro (alineados con `originPx`
 * para que no bailen al desplazar) y las burbujas que se tocarían se funden en una.
 * Resultado: burbujas ordenadas por x y sin solapes entre sí.
 */
export function clusterOverflow(
  items: readonly OverflowItem[],
  binPx = CLUSTER_PX,
  originPx = 0,
): Bubble[] {
  const sorted = [...items].sort((a, b) => a.center - b.center || a.index - b.index);
  const groups: { bubble: Bubble; members: OverflowItem[] }[] = [];
  let i = 0;
  while (i < sorted.length) {
    const bin = Math.floor(((sorted[i] as OverflowItem).center + originPx) / binPx);
    const members: OverflowItem[] = [];
    while (
      i < sorted.length &&
      Math.floor(((sorted[i] as OverflowItem).center + originPx) / binPx) === bin
    ) {
      members.push(sorted[i] as OverflowItem);
      i++;
    }
    let candidate = { bubble: makeBubble(members), members };
    // Fusiona hacia atrás mientras se solape con la burbuja anterior.
    for (;;) {
      const last = groups[groups.length - 1];
      if (!last || last.bubble.x1 + MIN_SEPARATION <= candidate.bubble.x0) break;
      groups.pop();
      const merged = [...last.members, ...candidate.members];
      candidate = { bubble: makeBubble(merged), members: merged };
    }
    groups.push(candidate);
  }
  return groups.map((g) => g.bubble);
}

export type ClusterAction = { kind: 'zoom'; view: View } | { kind: 'list' };

/**
 * Qué hacer al pinchar una burbuja: acercar hasta que sus eventos se separen
 * o, si ni con el zoom máximo se separarían, abrir la lista de eventos agrupados.
 */
export function clusterAction(
  members: readonly { start: number; end: number }[],
  view: View,
  width: number,
): ClusterAction {
  if (members.length === 0) return { kind: 'list' };
  const current = visibleYears(view);
  if (current <= MIN_TIME_SPAN * 1.05) return { kind: 'list' };
  let tMin = Infinity;
  let tMax = -Infinity;
  let cMin = Infinity;
  let cMax = -Infinity;
  for (const m of members) {
    tMin = Math.min(tMin, m.start);
    tMax = Math.max(tMax, m.end);
    const c = (m.start + m.end) / 2;
    cMin = Math.min(cMin, c);
    cMax = Math.max(cMax, c);
  }
  // Ni con el zoom máximo (2 meses en pantalla) sus centros quedarían a 24 px: lista.
  if (cMax - cMin < (MIN_TIME_SPAN * CLUSTER_PX) / width) return { kind: 'list' };
  // Que el grupo ocupe más o menos la mitad de la pantalla, acercando al menos ×2.
  const years = Math.max(MIN_TIME_SPAN, Math.min((tMax - tMin) * 2, current / 2));
  const target = viewAround((tMin + tMax) / 2, years, view.mode);
  const xs = members.map((m) => xOf((m.start + m.end) / 2, target, width)).sort((a, b) => a - b);
  const spread = (xs[xs.length - 1] as number) - (xs[0] as number);
  if (visibleYears(target) <= MIN_TIME_SPAN * 1.05 && spread < CLUSTER_PX) {
    return { kind: 'list' };
  }
  return { kind: 'zoom', view: target };
}
