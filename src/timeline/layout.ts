import { MIN_SEPARATION, clusterOverflow, type Bubble, type OverflowItem } from './cluster';

/** Alto de cada fila de un carril. */
export const ROW_HEIGHT = 20;
/** Margen arriba y abajo de cada carril. */
export const LANE_PADDING = 3;
/** Filas máximas por carril (contando la de burbujas). */
export const MAX_ROWS = 8;
/** Separación entre el marcador y su etiqueta a la derecha. */
export const LABEL_GAP = 4;
/** Margen interior de la etiqueta dentro de una barra. */
export const INSIDE_PAD = 6;

export interface LayoutItemInput {
  index: number;
  lane: number;
  /** Extensión del marcador en píxeles (incluida la cola de los rangos abiertos). */
  x0: number;
  x1: number;
  /** Centro del marcador. */
  center: number;
  bar: boolean;
  /** Ancho de la etiqueta (icono + texto); 0 si no tiene. */
  labelWidth: number;
  /** El marcador se ve en pantalla (si no, está en el margen de la ventana). */
  onScreen?: boolean;
}

/** none = sin etiqueta; inside = dentro de la barra; right = a la derecha del marcador. */
export type LabelMode = 'none' | 'inside' | 'right';

export interface PlacedItem {
  index: number;
  row: number;
  label: LabelMode;
  /** Extensión ocupada en la fila (marcador + etiqueta), en píxeles. */
  x0: number;
  x1: number;
}

export interface LaneLayout {
  lane: number;
  top: number;
  height: number;
  /** Filas con eventos (la de burbujas va debajo, si existe). */
  eventRows: number;
  /** Índice de la fila de burbujas o −1. */
  bubbleRow: number;
  items: PlacedItem[];
  bubbles: Bubble[];
}

export interface LayoutOptions {
  /** Alto disponible para los carriles. */
  height: number;
  /** Ancho de la pantalla: las barras más anchas que ella solo usan la mitad de las filas. */
  screenWidth?: number;
  /** Ventana horizontal considerada, en píxeles (puede salirse de la pantalla). */
  winLeft: number;
  winRight: number;
  /** Desplazamiento para alinear los huecos de agrupación entre recálculos. */
  originPx?: number;
}

/** Intervalos ocupados de una fila, ordenados y sin solapes. */
class Row {
  private starts: number[] = [];
  private ends: number[] = [];

  isFree(a: number, b: number): boolean {
    // Primer intervalo cuyo final supera a − separación.
    let lo = 0;
    let hi = this.ends.length;
    const limit = a - MIN_SEPARATION;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.ends[mid] as number) > limit) hi = mid;
      else lo = mid + 1;
    }
    return lo === this.starts.length || (this.starts[lo] as number) >= b + MIN_SEPARATION;
  }

  insert(a: number, b: number): void {
    let lo = 0;
    let hi = this.starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.starts[mid] as number) < a) lo = mid + 1;
      else hi = mid;
    }
    this.starts.splice(lo, 0, a);
    this.ends.splice(lo, 0, b);
  }
}

interface LanePlacement {
  placed: PlacedItem[];
  overflow: LayoutItemInput[];
  rowsUsed: number;
}

/**
 * Coloca los eventos de un carril en `rows` filas, en orden de prioridad.
 * Cada evento entra con etiqueta si cabe; si no, solo el marcador; si tampoco, va a burbuja.
 * Las barras más anchas que la pantalla (`wideFrom` px) solo pueden usar la mitad de las filas,
 * para que los periodos muy largos no tapen los eventos de la época que se está viendo.
 */
export function placeLane(
  items: readonly LayoutItemInput[],
  rows: number,
  winLeft: number,
  winRight: number,
  wideFrom = Infinity,
): LanePlacement {
  // Con un eje muy bajo puede no haber ninguna fila: entonces todo va a las burbujas.
  const wideRows = Math.min(rows, Math.max(1, Math.floor(rows / 2)));
  const rowList = Array.from({ length: rows }, () => new Row());
  const placed: PlacedItem[] = [];
  const overflow: LayoutItemInput[] = [];
  let rowsUsed = 0;

  const tryPlace = (a: number, b: number, maxRows: number): number => {
    for (let r = 0; r < maxRows; r++) {
      const row = rowList[r] as Row;
      if (row.isFree(a, b)) {
        row.insert(a, b);
        return r;
      }
    }
    return -1;
  };

  const place = (item: LayoutItemInput, limit: number): boolean => {
    let row = -1;
    let label: LabelMode = 'none';
    let x1 = item.x1;
    if (item.labelWidth > 0) {
      const visible = Math.min(item.x1, winRight) - Math.max(item.x0, winLeft);
      if (item.bar && visible >= item.labelWidth + 2 * INSIDE_PAD) {
        label = 'inside';
      } else {
        label = 'right';
        x1 = item.x1 + LABEL_GAP + item.labelWidth;
      }
      row = tryPlace(item.x0, x1, limit);
    }
    if (row < 0) {
      label = 'none';
      x1 = item.x1;
      row = tryPlace(item.x0, x1, limit);
    }
    if (row < 0) return false;
    rowsUsed = Math.max(rowsUsed, row + 1);
    placed.push({ index: item.index, row, label, x0: item.x0, x1 });
    return true;
  };

  // 1) Los periodos más anchos que la pantalla, en la mitad de las filas; 2) el resto;
  // 3) los periodos anchos que no cupieron, en las filas que hayan quedado libres.
  const deferred: LayoutItemInput[] = [];
  for (const item of items) {
    const wide = item.bar && item.x1 - item.x0 >= wideFrom;
    if (wide && !place(item, wideRows)) deferred.push(item);
  }
  for (const item of items) {
    const wide = item.bar && item.x1 - item.x0 >= wideFrom;
    if (!wide && !place(item, rows)) overflow.push(item);
  }
  for (const item of deferred) {
    if (!place(item, rows)) overflow.push(item);
  }
  return { placed, overflow, rowsUsed };
}

interface LaneResult {
  placement: LanePlacement;
  eventRows: number;
  /** Filas totales, incluida la de burbujas. */
  rows: number;
}

/** Coloca un carril con un máximo de `cap` filas, reservando la última para burbujas si hace falta. */
function layoutLane(
  items: readonly LayoutItemInput[],
  cap: number,
  winLeft: number,
  winRight: number,
  wideFrom: number,
): LaneResult {
  const full = placeLane(items, cap, winLeft, winRight, wideFrom);
  if (full.overflow.length === 0) {
    return { placement: full, eventRows: full.rowsUsed, rows: full.rowsUsed };
  }
  const eventRows = cap - 1;
  const reduced = placeLane(items, eventRows, winLeft, winRight, wideFrom);
  return { placement: reduced, eventRows: reduced.rowsUsed, rows: reduced.rowsUsed + 1 };
}

function toOverflow(item: LayoutItemInput): OverflowItem {
  return {
    index: item.index,
    center: item.center,
    x0: item.x0,
    x1: item.x1,
    short: !item.bar || item.x1 - item.x0 < 24,
  };
}

/**
 * Reparte los eventos visibles en los 12 carriles: apila en filas, decide etiquetas,
 * agrupa en burbujas lo que no cabe y ajusta el número de filas al alto disponible.
 * `items` debe venir en orden de prioridad. Los carriles sin eventos no aparecen (plegados).
 */
export function layoutLanes(
  items: readonly LayoutItemInput[],
  laneCount: number,
  options: LayoutOptions,
): LaneLayout[] {
  const { height, winLeft, winRight, originPx = 0 } = options;
  const wideFrom = options.screenWidth ?? Infinity;
  // Primero lo que se ve en pantalla y después el margen, cada grupo en orden de prioridad.
  const byLane: LayoutItemInput[][] = Array.from({ length: laneCount }, () => []);
  for (const item of items) if (item.onScreen !== false) byLane[item.lane]?.push(item);
  for (const item of items) if (item.onScreen === false) byLane[item.lane]?.push(item);
  // Un carril sin nada en pantalla se pliega.
  const lanes = byLane
    .map((list, lane) => ({ lane, list }))
    .filter((l) => l.list.some((item) => item.onScreen !== false));
  if (lanes.length === 0) return [];

  let results = lanes.map((l) => layoutLane(l.list, MAX_ROWS, winLeft, winRight, wideFrom));
  const budget = Math.max(
    lanes.length,
    Math.floor((height - lanes.length * 2 * LANE_PADDING) / ROW_HEIGHT),
  );
  const total = (caps: number[]) =>
    results.reduce((sum, r, i) => sum + Math.min(r.rows, caps[i] as number), 0);

  if (results.reduce((sum, r) => sum + r.rows, 0) > budget) {
    // Mayor tope común que cabe; las filas sobrantes van a los primeros carriles que las pidan.
    let cap = 1;
    for (let c = MAX_ROWS; c >= 1; c--) {
      if (total(lanes.map(() => c)) <= budget) {
        cap = c;
        break;
      }
    }
    const caps = lanes.map(() => cap);
    let left = budget - total(caps);
    results.forEach((r, i) => {
      if (left > 0 && r.rows > cap) {
        caps[i] = cap + 1;
        left--;
      }
    });
    results = results.map((r, i) => {
      const c = caps[i] as number;
      return r.rows > c ? layoutLane(lanes[i]?.list ?? [], c, winLeft, winRight, wideFrom) : r;
    });
  }

  let top = 0;
  return results.map((r, i) => {
    const lane = lanes[i]?.lane ?? 0;
    const overflow = r.placement.overflow;
    const bubbles =
      overflow.length > 0 ? clusterOverflow(overflow.map(toOverflow), 24, originPx) : [];
    const height = r.rows * ROW_HEIGHT + 2 * LANE_PADDING;
    const laneLayout: LaneLayout = {
      lane,
      top,
      height,
      eventRows: r.eventRows,
      bubbleRow: overflow.length > 0 ? r.rows - 1 : -1,
      items: r.placement.placed,
      bubbles,
    };
    top += height;
    return laneLayout;
  });
}
