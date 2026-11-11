import type { Selection } from '../state/store';
import { parseColor, toCss, type RGB } from '../themes/color';
import { macroPalette, type ThemeMode } from '../themes/theme';
import { bubbleLabel, bubbleWidth } from './cluster';
import { INSIDE_PAD, LABEL_GAP, LANE_PADDING, ROW_HEIGHT, type PlacedItem } from './layout';
import type { PreparedEvents } from './prepare';
import { formatInstant } from '../format/dates';
import { centerTime, visibleYears, type ScaleMode, type View } from './scale';
import { CharWidths } from './textWidth';
import { computeTicks, type Tick } from './ticks';
import {
  BAR_HEIGHT,
  ICON_WIDTH,
  MARKER,
  TAIL,
  buildLayout,
  eventCoords,
  markerExtent,
  type EventCoords,
  type ViewLayout,
} from './viewLayout';

export const AXIS_HEIGHT = 36;
/** Espera tras el último cambio de vista antes de recolocar los eventos. */
const RELAYOUT_DELAY_MS = 100;
const FONT = '14px "Source Sans 3", system-ui, sans-serif';
const BOLD_FONT = '600 14px "Source Sans 3", system-ui, sans-serif';
/** Colores del modo activo, leídos de las variables CSS. */
interface CanvasTheme {
  /** Fondo del lienzo: el de la tarjeta que lo contiene. */
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  grid: string;
  laneAlt: string;
  line: string;
  /** Terracota: línea del centro. */
  accent: string;
  /** Contorno del evento con el foco del teclado. */
  focus: string;
  strokes: string[];
  fills: string[];
}

function readTheme(): CanvasTheme {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string): RGB =>
    parseColor(style.getPropertyValue(name)) ?? (parseColor(fallback) as RGB);
  const surface = get('--surface', '#ffffff');
  const bg = surface;
  const palette = macroPalette(bg, surface);
  return {
    bg: toCss(bg),
    surface: toCss(surface),
    ink: toCss(get('--ink', '#111418')),
    muted: toCss(get('--muted', '#555555')),
    grid: toCss(get('--grid', '#e6e6e6')),
    laneAlt: toCss(get('--lane-alt', '#f3f3f0')),
    line: toCss(get('--line', '#d0d0d0')),
    accent: toCss(get('--accent', '#b05730')),
    focus: toCss(get('--accent-text', '#111418')),
    strokes: palette.stroke.map((c) => toCss(c)),
    fills: palette.fill.map((c) => toCss(c)),
  };
}

/** Lo que hay bajo el puntero. */
export type Hit = { kind: 'event'; index: number } | { kind: 'bubble'; members: number[] } | null;

/** Elemento del eje que se puede recorrer con el teclado (evento o burbuja «+N»). */
export type Target = { kind: 'event'; index: number } | { kind: 'bubble'; members: number[] };

/** Elemento visible, con su posición en pantalla, para la lista accesible. */
export type VisibleTarget = Target & { x: number; lane: number };

/** Máximo de elementos en la lista accesible del eje. */
export const MAX_TARGETS = 200;

/** Los `limit` más cercanos al centro, en orden de izquierda a derecha (y de carril). */
export function pickTargets(
  targets: VisibleTarget[],
  width: number,
  limit = MAX_TARGETS,
): VisibleTarget[] {
  let list = targets;
  if (list.length > limit) {
    list = [...list].sort((a, b) => Math.abs(a.x - width / 2) - Math.abs(b.x - width / 2));
    list = list.slice(0, limit);
  }
  return [...list].sort((a, b) => a.x - b.x || a.lane - b.lane);
}

export interface LaneBox {
  lane: number;
  top: number;
  height: number;
}

interface DrawBubble {
  members: number[];
  /** Centro en coordenada de escala (para recolocarla al desplazar). */
  uCenter: number;
  single: boolean;
}

interface DrawLane extends LaneBox {
  rows: number;
  bubbleRow: number;
  /** Elementos por fila, ordenados de izquierda a derecha. */
  rowItems: PlacedItem[][];
  bubbles: DrawBubble[];
}

interface DrawLayout {
  base: ViewLayout;
  version: number;
  lanes: DrawLane[];
}

interface Label {
  text: string;
  x: number;
  y: number;
  type: string | undefined;
}

let sharedMeasurer: CanvasRenderingContext2D | null = null;
let sharedWidths: CharWidths | null = null;

/**
 * Anchos de letra de las etiquetas, compartidos por todos los ejes: así se pueden medir antes
 * de crear el eje (ver `warmUp`). Se miden en un canvas aparte con la tipografía fijada una
 * sola vez, porque cambiar ctx.font antes de cada medida costaba más que medir.
 */
export function labelCharWidths(): CharWidths {
  if (!sharedWidths) {
    const measurer = document.createElement('canvas').getContext('2d');
    if (measurer) measurer.font = FONT;
    sharedMeasurer = measurer;
    sharedWidths = new CharWidths((text) => measurer?.measureText(text).width ?? text.length * 7);
  }
  return sharedWidths;
}

/** Pinta los carriles en un canvas 2D. Solo repinta cuando algo cambia. */
export class TimelineRenderer {
  private ctx: CanvasRenderingContext2D;
  private view: View | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private frame = 0;
  private coords: Partial<Record<ScaleMode, EventCoords>> = {};
  private layout: DrawLayout | null = null;
  private viewVersion = 0;
  private settled = true;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private labelWidths: Float32Array;
  private charWidths: CharWidths;
  private laneSignature = '';
  private selection: Selection = null;
  private themeId: ThemeMode | null = null;
  private theme: CanvasTheme | null = null;
  private filter: ((i: number) => boolean) | null = null;
  private focus: Target | null = null;

  /** Duración del último pintado, en ms. */
  lastDrawMs = 0;
  onDraw: ((ms: number) => void) | null = null;
  /** Se llama cuando cambian los carriles visibles (para la columna de nombres). */
  onLanes: ((lanes: LaneBox[]) => void) | null = null;
  /** Se llama cada vez que se recoloca (para la lista accesible de eventos visibles). */
  onLayout: (() => void) | null = null;
  /** Solo para medir (bench): tiempo acumulado por fase del pintado. */
  profile: Record<string, number> | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private data: PreparedEvents,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('El navegador no permite dibujar en canvas 2D');
    this.ctx = ctx;
    this.labelWidths = new Float32Array(data.count).fill(Number.NaN);
    this.charWidths = labelCharWidths();
  }

  private mark(name: string, since: number): number {
    const now = performance.now();
    if (this.profile) this.profile[name] = (this.profile[name] ?? 0) + now - since;
    return now;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    this.requestDraw();
  }

  setView(view: View): void {
    this.view = view;
    this.viewVersion++;
    this.settled = false;
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settled = true;
      this.requestDraw();
    }, RELAYOUT_DELAY_MS);
    this.requestDraw();
  }

  /** Solo se pintan los eventos que pasan el filtro (null = todos). */
  setFilter(filter: ((i: number) => boolean) | null): void {
    this.filter = filter;
    this.layout = null;
    this.requestDraw();
  }

  /** Cambia entre modo claro y oscuro: se vuelven a leer los colores. */
  setTheme(mode: ThemeMode): void {
    if (mode === this.themeId) return;
    this.themeId = mode;
    this.theme = null;
    this.requestDraw();
  }

  /** Las tipografías han cargado: hay que volver a medir las etiquetas y recolocar. */
  fontsChanged(): void {
    this.labelWidths.fill(Number.NaN);
    if (sharedMeasurer) sharedMeasurer.font = FONT;
    this.charWidths.reset();
    this.layout = null;
    this.requestDraw();
  }

  /** Separador fino entre carriles. */
  private drawSeparator(y: number, w: number): void {
    const theme = this.theme as CanvasTheme;
    this.ctx.fillStyle = theme.line;
    this.ctx.fillRect(0, y - 1, w, 1);
  }

  setSelection(selection: Selection): void {
    this.selection = selection;
    this.requestDraw();
  }

  /** Elemento con el foco del teclado (se rodea con un contorno), o null. */
  setFocus(target: Target | null): void {
    this.focus = target;
    this.requestDraw();
  }

  /**
   * Eventos y burbujas que se ven ahora en pantalla, como mucho MAX_TARGETS (los más cercanos
   * al centro), de izquierda a derecha. Alimenta la lista accesible que recorre Tab.
   */
  visibleTargets(limit = MAX_TARGETS): VisibleTarget[] {
    const layout = this.layout;
    const view = this.view;
    if (!layout || !view) return [];
    const w = this.cssWidth;
    const left = view.center - view.span / 2;
    const k = w / view.span;
    const coords = this.coordsFor(view.mode);
    const out: VisibleTarget[] = [];
    const addEvent = (index: number, lane: number) => {
      const ext = markerExtent(this.data, coords, index, left, k);
      if (ext.x1 < 0 || ext.x0 > w) return;
      const x = ext.bar ? (Math.max(ext.x0, 0) + Math.min(ext.x1, w)) / 2 : ext.center;
      out.push({ kind: 'event', index, x, lane });
    };
    for (const lane of layout.lanes) {
      for (const row of lane.rowItems) for (const item of row) addEvent(item.index, lane.lane);
      for (const b of lane.bubbles) {
        if (b.single) {
          addEvent(b.members[0] as number, lane.lane);
          continue;
        }
        const x = (b.uCenter - left) * k;
        if (x < 0 || x > w) continue;
        out.push({ kind: 'bubble', members: b.members, x, lane: lane.lane });
      }
    }
    return pickTargets(out, w, limit);
  }

  requestDraw(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  destroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    clearTimeout(this.settleTimer);
  }

  private coordsFor(mode: ScaleMode): EventCoords {
    const cached = this.coords[mode];
    if (cached) return cached;
    const coords = eventCoords(this.data, mode);
    this.coords[mode] = coords;
    return coords;
  }

  /** Ancho de la etiqueta (icono incluido), medido una sola vez por evento. */
  private labelWidth = (i: number): number => {
    const cached = this.labelWidths[i] as number;
    if (!Number.isNaN(cached)) return cached;
    const type = this.data.events[i]?.t;
    const icon = type && type !== 'e' ? ICON_WIDTH : 0;
    const width = this.charWidths.width(this.data.labels[i] ?? '') + icon;
    this.labelWidths[i] = width;
    return width;
  };

  /**
   * Recoloca si no hay colocación, si cambió el modo o el tamaño, si la vista se salió de la
   * ventana calculada o cambió mucho de zoom, o si la vista lleva 100 ms quieta.
   * Mientras dura un gesto se reutiliza la colocación anterior, reescalada.
   */
  private ensureLayout(view: View, w: number, laneHeight: number): DrawLayout {
    const current = this.layout;
    const left = view.center - view.span / 2;
    const k = w / view.span;
    const stale =
      !current ||
      current.base.mode !== view.mode ||
      current.base.width !== w ||
      current.base.height !== laneHeight ||
      left < current.base.winLeft ||
      left + view.span > current.base.winRight ||
      k / current.base.k > 2 ||
      k / current.base.k < 0.5 ||
      (this.settled && current.version !== this.viewVersion);
    if (!stale && current) return current;

    const base = buildLayout(
      this.data,
      this.coordsFor(view.mode),
      view,
      w,
      laneHeight,
      this.labelWidth,
      this.filter ?? undefined,
    );
    const lanes: DrawLane[] = base.lanes.map((lane) => {
      const rowItems: PlacedItem[][] = Array.from({ length: lane.eventRows }, () => []);
      for (const item of lane.items) rowItems[item.row]?.push(item);
      for (const list of rowItems) list.sort((a, b) => a.x0 - b.x0);
      return {
        lane: lane.lane,
        top: lane.top,
        height: lane.height,
        rows: lane.eventRows + (lane.bubbleRow >= 0 ? 1 : 0),
        bubbleRow: lane.bubbleRow,
        rowItems,
        bubbles: lane.bubbles.map((b) => ({
          members: b.members,
          uCenter: base.left + b.center / base.k,
          single: b.single,
        })),
      };
    });
    const layout: DrawLayout = { base, version: this.viewVersion, lanes };
    this.layout = layout;
    this.onLayout?.();
    const signature = lanes.map((l) => `${l.lane}:${l.top}:${l.height}`).join('|');
    if (signature !== this.laneSignature) {
      this.laneSignature = signature;
      this.onLanes?.(lanes.map(({ lane, top, height }) => ({ lane, top, height })));
    }
    return layout;
  }

  draw(): void {
    const view = this.view;
    if (!view || this.cssWidth <= 0) return;
    const t0 = performance.now();
    const { ctx, cssWidth: w, cssHeight: h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.theme) this.theme = readTheme();
    const theme = this.theme;
    const laneBottom = h - AXIS_HEIGHT;
    const left = view.center - view.span / 2;
    const k = w / view.span;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    let m = this.mark('clear', t0);
    const layout = this.ensureLayout(view, w, laneBottom);
    m = this.mark('layout', m);
    const ticks = computeTicks(view, w);

    // Fondos de carril alternos y separadores
    layout.lanes.forEach((lane, i) => {
      if (i % 2 === 1) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = theme.laneAlt;
        ctx.fillRect(0, lane.top, w, lane.height);
        ctx.globalAlpha = 1;
      }
      this.drawSeparator(lane.top + lane.height, w);
    });

    // Rejilla
    ctx.lineWidth = 1;
    for (const tick of ticks) {
      ctx.strokeStyle = tick.milestone ? theme.muted : theme.grid;
      const x = Math.round(tick.x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, laneBottom);
      ctx.stroke();
    }
    m = this.mark('grid', m);

    const coords = this.coordsFor(view.mode);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, laneBottom);
    ctx.clip();
    for (const lane of layout.lanes) this.drawLane(lane, coords, left, k, w);
    ctx.restore();
    m = this.mark('events', m);

    this.drawCenter(view, ticks, w, laneBottom);
    this.mark('axis', m);
    this.lastDrawMs = performance.now() - t0;
    this.onDraw?.(this.lastDrawMs);
  }

  /**
   * Línea punteada en el centro con la fecha que marca, en una etiqueta sobre el eje
   * (no tapa eventos; las marcas del eje que quedarían debajo no se escriben).
   */
  private drawCenter(view: View, ticks: Tick[], w: number, laneBottom: number): void {
    const { ctx } = this;
    const theme = this.theme as CanvasTheme;
    const x = Math.round(w / 2) + 0.5;
    ctx.save();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, laneBottom);
    ctx.stroke();
    ctx.restore();

    const label = formatInstant(centerTime(view), visibleYears(view));
    ctx.font = BOLD_FONT;
    const width = ctx.measureText(label).width + 16;
    this.drawAxis(ticks, w, laneBottom, [x - width / 2 - 6, x + width / 2 + 6]);
    const top = laneBottom + 5;
    ctx.font = BOLD_FONT;
    const pill = new Path2D();
    pill.roundRect(x - width / 2, top, width, 22, 11);
    ctx.fillStyle = theme.surface;
    ctx.fill(pill);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = theme.accent;
    ctx.stroke(pill);
    ctx.fillStyle = theme.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, top + 12);
  }

  private drawAxis(ticks: Tick[], w: number, laneBottom: number, skip: [number, number]): void {
    const { ctx } = this;
    const theme = this.theme as CanvasTheme;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, laneBottom, w, AXIS_HEIGHT);
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.ink;
    ctx.beginPath();
    ctx.moveTo(0, laneBottom + 0.5);
    ctx.lineTo(w, laneBottom + 0.5);
    ctx.stroke();
    ctx.fillStyle = theme.ink;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    for (const tick of ticks) {
      ctx.font = tick.milestone ? BOLD_FONT : FONT;
      const x = Math.round(tick.x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, laneBottom);
      ctx.lineTo(x, laneBottom + 6);
      ctx.stroke();
      const half = ctx.measureText(tick.label).width / 2;
      const lx = Math.min(Math.max(tick.x, half + 2), w - half - 2);
      // La etiqueta del centro tiene prioridad sobre las marcas que caerían debajo.
      if (lx + half > skip[0] && lx - half < skip[1]) continue;
      ctx.fillText(tick.label, lx, laneBottom + 10);
    }
  }

  private drawLane(lane: DrawLane, coords: EventCoords, left: number, k: number, w: number): void {
    const { ctx, data } = this;
    const theme = this.theme as CanvasTheme;
    const color = theme.strokes[lane.lane] ?? theme.ink;
    const fill = theme.fills[lane.lane] ?? theme.surface;
    const rowCenter = (r: number) => lane.top + LANE_PADDING + r * ROW_HEIGHT + ROW_HEIGHT / 2;
    const selected = this.selection?.kind === 'event' ? this.selection.index : -1;
    const focusEvent = this.focus?.kind === 'event' ? this.focus.index : -1;
    const focusBubble = this.focus?.kind === 'bubble' ? this.focus.members[0] : undefined;
    let focusBox: { x0: number; x1: number; cy: number; h: number } | null = null;

    const bars = new Path2D();
    const approxBars = new Path2D();
    const dots = new Path2D();
    const approxDots = new Path2D();
    const labels: Label[] = [];
    const tails: { x: number; y: number; dir: number }[] = [];
    let ring: Path2D | null = null;

    const addMarker = (i: number, cy: number) => {
      const ext = markerExtent(data, coords, i, left, k);
      const approx = data.approx[i] === 1;
      if (ext.bar) {
        // Recorte a la pantalla con margen para que los extremos redondeados queden fuera.
        const x0 = Math.max(ext.x0, -BAR_HEIGHT);
        const x1 = Math.min(ext.x1, w + BAR_HEIGHT);
        const width = Math.max(x1 - x0, MARKER);
        const radius = Math.min(BAR_HEIGHT / 2, width / 2);
        (approx ? approxBars : bars).roundRect(x0, cy - BAR_HEIGHT / 2, width, BAR_HEIGHT, radius);
        if (i === selected) {
          ring = new Path2D();
          ring.roundRect(x0 - 3, cy - BAR_HEIGHT / 2 - 3, width + 6, BAR_HEIGHT + 6, radius + 3);
        }
      } else {
        const path = approx ? approxDots : dots;
        path.moveTo(ext.center + MARKER / 2, cy);
        path.arc(ext.center, cy, MARKER / 2, 0, Math.PI * 2);
        const open = data.open[i] as number;
        if (open) tails.push({ x: ext.center, y: cy, dir: open === 1 ? 1 : -1 });
        if (i === selected) {
          ring = new Path2D();
          ring.arc(ext.center, cy, MARKER / 2 + 4, 0, Math.PI * 2);
        }
      }
      return ext;
    };

    for (let r = 0; r < lane.rowItems.length; r++) {
      const cy = rowCenter(r);
      for (const item of lane.rowItems[r] ?? []) {
        const ext = addMarker(item.index, cy);
        if (item.index === focusEvent) {
          const end =
            item.label === 'right' ? ext.x1 + LABEL_GAP + this.labelWidth(item.index) : ext.x1;
          focusBox = { x0: Math.max(ext.x0, 0), x1: Math.min(end, w), cy, h: BAR_HEIGHT };
        }
        if (item.label === 'none') continue;
        const type = data.events[item.index]?.t;
        const text = data.labels[item.index] ?? '';
        const labelW = this.labelWidth(item.index);
        if (item.label === 'inside') {
          // Pegada al borde izquierdo de la pantalla mientras la barra sigue visible.
          const x = Math.max(ext.x0, 0) + INSIDE_PAD;
          if (x + labelW <= Math.min(ext.x1, w) - INSIDE_PAD) labels.push({ text, x, y: cy, type });
        } else if (ext.x1 >= 0) {
          // Si el marcador ya salió por la izquierda, no se deja un trozo de texto suelto.
          labels.push({ text, x: ext.x1 + LABEL_GAP, y: cy, type });
        }
      }
    }

    // Fila de burbujas
    const bubbleCy = rowCenter(lane.bubbleRow);
    const bubbles: { x: number; width: number; count: number; selected: boolean }[] = [];
    const listFirst = this.selection?.kind === 'list' ? this.selection.members[0] : undefined;
    for (const b of lane.bubbles) {
      if (b.single) {
        const ext = addMarker(b.members[0] as number, bubbleCy);
        if (b.members[0] === focusEvent) {
          focusBox = {
            x0: Math.max(ext.x0, 0),
            x1: Math.min(ext.x1, w),
            cy: bubbleCy,
            h: BAR_HEIGHT,
          };
        }
        continue;
      }
      const x = (b.uCenter - left) * k;
      const width = bubbleWidth(b.members.length);
      if (focusBubble !== undefined && b.members[0] === focusBubble) {
        focusBox = { x0: x - width / 2, x1: x + width / 2, cy: bubbleCy, h: 18 };
      }
      if (x + width < 0 || x - width > w) continue;
      bubbles.push({ x, width, count: b.members.length, selected: listFirst === b.members[0] });
    }

    ctx.lineWidth = 1;
    ctx.fillStyle = fill;
    ctx.strokeStyle = color;
    ctx.fill(bars);
    ctx.stroke(bars);
    ctx.fill(approxBars);
    ctx.fill(approxDots);
    ctx.setLineDash([3, 2]);
    ctx.stroke(approxBars);
    ctx.lineWidth = 1.5;
    ctx.stroke(approxDots);
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.fill(dots);

    // Rangos abiertos: cola que se desvanece hacia donde no hay fecha.
    for (const t of tails) {
      const gradient = ctx.createLinearGradient(t.x, 0, t.x + t.dir * TAIL, 0);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(t.dir === 1 ? t.x : t.x - TAIL, t.y - 2, TAIL, 4);
    }

    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (const label of labels) {
      let x = label.x;
      if (label.type && label.type !== 'e') {
        drawTypeIcon(ctx, label.type, x, label.y, theme.ink);
        x += ICON_WIDTH;
      }
      ctx.fillStyle = theme.ink;
      ctx.fillText(label.text, x, label.y + 1);
    }

    ctx.font = BOLD_FONT;
    ctx.textAlign = 'center';
    for (const b of bubbles) {
      const path = new Path2D();
      path.roundRect(b.x - b.width / 2, bubbleCy - 9, b.width, 18, 9);
      ctx.fillStyle = theme.surface;
      ctx.fill(path);
      ctx.lineWidth = b.selected ? 3 : 1.5;
      ctx.strokeStyle = b.selected ? theme.ink : color;
      ctx.stroke(path);
      ctx.fillStyle = theme.ink;
      ctx.fillText(bubbleLabel(b.count), b.x, bubbleCy + 1);
    }

    if (ring) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.ink;
      ctx.stroke(ring);
    }

    // Foco del teclado: contorno doble (claro y oscuro) que se ve sobre cualquier fondo.
    const box = focusBox as { x0: number; x1: number; cy: number; h: number } | null;
    if (box) {
      const pad = 5;
      const path = new Path2D();
      path.roundRect(
        box.x0 - pad,
        box.cy - box.h / 2 - pad,
        box.x1 - box.x0 + 2 * pad,
        box.h + 2 * pad,
        8,
      );
      ctx.lineWidth = 5;
      ctx.strokeStyle = theme.surface;
      ctx.stroke(path);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = theme.focus;
      ctx.stroke(path);
    }
  }

  /** Elemento bajo el punto (x, y) del canvas, con la colocación actual. */
  hitTest(x: number, y: number): Hit {
    const layout = this.layout;
    const view = this.view;
    if (!layout || !view || y >= this.cssHeight - AXIS_HEIGHT) return null;
    const lane = layout.lanes.find((l) => y >= l.top && y < l.top + l.height);
    if (!lane) return null;
    const row = Math.floor((y - lane.top - LANE_PADDING) / ROW_HEIGHT);
    if (row < 0 || row >= lane.rows) return null;
    const left = view.center - view.span / 2;
    const k = this.cssWidth / view.span;
    const coords = this.coordsFor(view.mode);
    const slack = 3;

    if (row === lane.bubbleRow) {
      for (const b of lane.bubbles) {
        if (b.single) {
          const i = b.members[0] as number;
          const ext = markerExtent(this.data, coords, i, left, k);
          if (x >= ext.x0 - slack && x <= ext.x1 + slack) return { kind: 'event', index: i };
        } else {
          const cx = (b.uCenter - left) * k;
          const half = bubbleWidth(b.members.length) / 2;
          if (Math.abs(x - cx) <= half + slack) return { kind: 'bubble', members: b.members };
        }
      }
      return null;
    }

    // Búsqueda binaria en x: último elemento de la fila que empieza antes del puntero.
    const items = lane.rowItems[row] ?? [];
    const extentOf = (item: PlacedItem) => {
      const ext = markerExtent(this.data, coords, item.index, left, k);
      const end =
        item.label === 'right' ? ext.x1 + LABEL_GAP + this.labelWidth(item.index) : ext.x1;
      return { x0: ext.x0, x1: end };
    };
    let lo = 0;
    let hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (extentOf(items[mid] as PlacedItem).x0 - slack <= x) lo = mid + 1;
      else hi = mid;
    }
    for (let j = lo - 1; j >= Math.max(0, lo - 2); j--) {
      const item = items[j] as PlacedItem;
      const ext = extentOf(item);
      if (x >= ext.x0 - slack && x <= ext.x1 + slack) return { kind: 'event', index: item.index };
    }
    return null;
  }
}

/** Icono por tipo de fecha: vida (silueta), muerte (cruz), floruit (estrella), nacimiento (asterisco). */
export function drawTypeIcon(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  cy: number,
  color: string,
): void {
  const cx = x + 6;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  switch (type) {
    case 'v':
      ctx.arc(cx, cy - 3, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy + 6, 5, Math.PI, 0);
      ctx.fill();
      break;
    case 'm':
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx, cy + 6);
      ctx.moveTo(cx - 4, cy - 2);
      ctx.lineTo(cx + 4, cy - 2);
      ctx.stroke();
      break;
    case 'f':
      for (let p = 0; p < 10; p++) {
        const r = p % 2 === 0 ? 6 : 2.6;
        const a = -Math.PI / 2 + (p * Math.PI) / 5;
        const px = cx + r * Math.cos(a);
        const py = cy + r * Math.sin(a);
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'n':
      for (let p = 0; p < 3; p++) {
        const a = (p * Math.PI) / 3;
        ctx.moveTo(cx - 5 * Math.cos(a), cy - 5 * Math.sin(a));
        ctx.lineTo(cx + 5 * Math.cos(a), cy + 5 * Math.sin(a));
      }
      ctx.stroke();
      break;
  }
  ctx.restore();
}
