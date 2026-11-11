import type { TimelineEvent } from '../data/types';
import { toCoord, type ScaleMode, type View } from './scale';
import { computeTicks } from './ticks';
import { eventSpan } from './time';

/** Eventos preparados para pintar rápido: arrays planos ordenados por inicio. */
export interface PreparedEvents {
  count: number;
  start: Float64Array;
  end: Float64Array;
  point: Uint8Array;
  approx: Uint8Array;
  /** 0 = cerrado, 1 = rango abierto (sin final), 2 = sin comienzo. */
  open: Uint8Array;
}

export function prepareEvents(events: readonly TimelineEvent[]): PreparedEvents {
  const count = events.length;
  const prepared: PreparedEvents = {
    count,
    start: new Float64Array(count),
    end: new Float64Array(count),
    point: new Uint8Array(count),
    approx: new Uint8Array(count),
    open: new Uint8Array(count),
  };
  events.forEach((e, i) => {
    const span = eventSpan(e);
    prepared.start[i] = span.start;
    prepared.end[i] = span.end;
    prepared.point[i] = span.point ? 1 : 0;
    prepared.approx[i] = e.ap ?? 0;
    prepared.open[i] = e.x ?? 0;
  });
  return prepared;
}

interface Coords {
  mode: ScaleMode;
  u0: Float64Array;
  u1: Float64Array;
  /** Centro de los eventos puntuales. */
  um: Float64Array;
}

const AXIS_HEIGHT = 36;
const ROW_HEIGHT = 12;
const MARKER = 8;
const COLORS = {
  background: '#ffffff',
  grid: '#e6e6e6',
  milestone: '#b0b0b0',
  axis: '#222222',
  label: '#222222',
  fill: '#8fb0d3',
  approx: 'rgba(42, 98, 160, 0.9)',
};

/** Pinta el eje en un canvas 2D. Solo repinta cuando algo cambia. */
export class TimelineRenderer {
  private ctx: CanvasRenderingContext2D;
  private view: View | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private frame = 0;
  private coords: Coords | null = null;
  private sprites: (HTMLCanvasElement | undefined)[] = [];
  /** Duración del último pintado, en ms. */
  lastDrawMs = 0;
  onDraw: ((ms: number) => void) | null = null;
  /** Solo para medir (bench): tiempo acumulado por fase del pintado. */
  profile: Record<string, number> | null = null;

  private mark(name: string, since: number): number {
    const now = performance.now();
    if (this.profile) this.profile[name] = (this.profile[name] ?? 0) + now - since;
    return now;
  }

  constructor(
    private canvas: HTMLCanvasElement,
    private data: PreparedEvents,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('El navegador no permite dibujar en canvas 2D');
    this.ctx = ctx;
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
    this.requestDraw();
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
  }

  private coordsFor(mode: ScaleMode): Coords {
    if (this.coords?.mode === mode) return this.coords;
    const { count, start, end } = this.data;
    const coords: Coords = {
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
    this.coords = coords;
    return coords;
  }

  draw(): void {
    const view = this.view;
    if (!view || this.cssWidth <= 0) return;
    const t0 = performance.now();
    const { ctx, cssWidth: w, cssHeight: h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    let m = this.mark('clear', t0);
    const ticks = computeTicks(view, w);
    m = this.mark('ticks', m);
    const laneBottom = h - AXIS_HEIGHT;

    // Rejilla
    ctx.lineWidth = 1;
    for (const tick of ticks) {
      ctx.strokeStyle = tick.milestone ? COLORS.milestone : COLORS.grid;
      const x = Math.round(tick.x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, laneBottom);
      ctx.stroke();
    }

    m = this.mark('grid', m);
    this.drawEvents(view, w, laneBottom);
    m = this.mark('events', m);

    // Eje y etiquetas
    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath();
    ctx.moveTo(0, laneBottom + 0.5);
    ctx.lineTo(w, laneBottom + 0.5);
    ctx.stroke();
    ctx.fillStyle = COLORS.label;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    for (const tick of ticks) {
      ctx.font = tick.milestone ? 'bold 14px sans-serif' : '14px sans-serif';
      const x = Math.round(tick.x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, laneBottom);
      ctx.lineTo(x, laneBottom + 6);
      ctx.stroke();
      const half = ctx.measureText(tick.label).width / 2;
      ctx.fillText(tick.label, Math.min(Math.max(tick.x, half + 2), w - half - 2), laneBottom + 10);
    }

    this.mark('labels', m);
    this.lastDrawMs = performance.now() - t0;
    this.onDraw?.(this.lastDrawMs);
  }

  /** Círculo de 8 px pre-pintado (normal o aproximado) para estampar con drawImage. */
  private sprite(approx: boolean): HTMLCanvasElement {
    const key = approx ? 1 : 0;
    const cached = this.sprites[key];
    if (cached && cached.width === Math.ceil((MARKER + 2) * this.dpr)) return cached;
    const size = MARKER + 2;
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * this.dpr);
    const g = c.getContext('2d');
    if (g) {
      g.scale(this.dpr, this.dpr);
      g.beginPath();
      g.arc(size / 2, size / 2, MARKER / 2, 0, Math.PI * 2);
      g.fillStyle = COLORS.fill;
      g.fill();
      if (approx) {
        g.setLineDash([2, 2]);
        g.strokeStyle = COLORS.approx;
        g.stroke();
      }
    }
    this.sprites[key] = c;
    return c;
  }

  private drawEvents(view: View, w: number, laneBottom: number): void {
    const { ctx, data } = this;
    const { u0, u1, um } = this.coordsFor(view.mode);
    const left = view.center - view.span / 2;
    const k = w / view.span;
    // Provisional (Fase 2): un solo carril, filas repartidas en orden de inicio.
    const rows = Math.max(1, Math.floor((laneBottom - 8) / ROW_HEIGHT));
    const r = MARKER / 2;
    const size = MARKER + 2;
    const dot = this.sprite(false);
    const dotApprox = this.sprite(true);

    const bars = new Path2D();
    const approxBars = new Path2D();
    const fades: [number, number, number][] = [];
    // Por fila, el tramo pendiente de pintar: las barras solapadas del mismo tipo se unen
    // en un solo rectángulo (mismo color opaco, el resultado es idéntico y mucho más rápido).
    const runStart = [new Float64Array(rows), new Float64Array(rows)];
    const runEnd = [new Float64Array(rows).fill(-Infinity), new Float64Array(rows).fill(-Infinity)];
    const lastDot = [
      new Float64Array(rows).fill(-Infinity),
      new Float64Array(rows).fill(-Infinity),
    ];
    const paths = [bars, approxBars];

    let m = performance.now();
    for (let i = 0; i < data.count; i++) {
      const x0 = ((u0[i] as number) - left) * k;
      const x1 = ((u1[i] as number) - left) * k;
      if (x1 < -MARKER || x0 > w + MARKER) continue;
      const row = i % rows;
      const y = 6 + row * ROW_HEIGHT;
      const kind = data.approx[i] === 1 ? 1 : 0;
      if (data.point[i]) {
        const xm = ((um[i] as number) - left) * k;
        const dots = lastDot[kind] as Float64Array;
        // Un punto encima de otro igual en el mismo píxel no cambia nada.
        if (Math.abs(xm - (dots[row] as number)) >= 1) {
          dots[row] = xm;
          ctx.drawImage(kind ? dotApprox : dot, xm - size / 2, y + r - size / 2, size, size);
        }
      } else {
        // Ancho mínimo de 8 px; se recorta a la pantalla para no dibujar de más.
        const xs = Math.max(x0, -MARKER);
        const xe = Math.min(Math.max(x1, x0 + MARKER), w + MARKER);
        const starts = runStart[kind] as Float64Array;
        const ends = runEnd[kind] as Float64Array;
        const end = ends[row] as number;
        if (xs <= end) {
          if (xe > end) ends[row] = xe;
        } else {
          if (end > -Infinity) {
            const x = starts[row] as number;
            (paths[kind] as Path2D).rect(x, y, end - x, MARKER);
          }
          starts[row] = xs;
          ends[row] = xe;
        }
      }
      const open = data.open[i] as number;
      if (open) fades.push([((um[i] as number) - left) * k, y + r, open]);
    }
    for (let kind = 0; kind < 2; kind++) {
      const starts = runStart[kind] as Float64Array;
      const ends = runEnd[kind] as Float64Array;
      for (let row = 0; row < rows; row++) {
        const end = ends[row] as number;
        if (end > -Infinity) {
          const x = starts[row] as number;
          (paths[kind] as Path2D).rect(x, 6 + row * ROW_HEIGHT, end - x, MARKER);
        }
      }
    }
    m = this.mark('ev:loop', m);

    ctx.fillStyle = COLORS.fill;
    ctx.fill(bars);
    ctx.fill(approxBars);
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = COLORS.approx;
    ctx.stroke(approxBars);
    ctx.setLineDash([]);
    this.mark('ev:fill', m);

    // Continuidad: hacia la derecha (sin final) o hacia la izquierda (sin comienzo).
    for (const [x, y, open] of fades) {
      const dir = open === 1 ? 1 : -1;
      const gradient = ctx.createLinearGradient(x, 0, x + dir * 40, 0);
      gradient.addColorStop(0, COLORS.approx);
      gradient.addColorStop(1, 'rgba(42, 98, 160, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(dir === 1 ? x : x - 40, y - 1.5, 40, 3);
    }
  }
}
