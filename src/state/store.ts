import { activeTheme, type StyleChoice, type ThemeId } from '../themes/periods';
import { DEFAULT_FILTERS, type Filters } from './filters';
import {
  centerTime,
  clampView,
  fullView,
  lerpView,
  panBy,
  switchMode,
  zoomAt,
  type ScaleMode,
  type View,
} from '../timeline/scale';

/** Duración de las animaciones de botones y saltos. */
export const ANIMATION_MS = 250;

type Listener = () => void;

/**
 * Lo que muestra el panel: la ficha de un evento del eje (índice en events.json), la de un
 * evento sin fecha (índice en undated.json) o la lista de una burbuja.
 */
export type Selection =
  | { kind: 'event'; index: number }
  | { kind: 'undated'; index: number }
  | { kind: 'list'; members: number[] }
  | null;

function easeOutCubic(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Estado único de la aplicación: vista del eje, ancho, selección y filtros. */
export class Store {
  view: View;
  selection: Selection = null;
  filters: Filters = DEFAULT_FILTERS;
  /** Selector de estilo: por periodo, neutro claro u oscuro. */
  style: StyleChoice = 'period';
  /** Estilo activo, derivado del selector y de la fecha del centro. */
  theme: ThemeId = 'c20';
  /** Ancho del eje en píxeles CSS. */
  width = 1;
  private listeners = new Set<Listener>();
  private animation = 0;

  constructor(
    view: View = fullView('log'),
    filters: Filters = DEFAULT_FILTERS,
    style: StyleChoice = 'period',
  ) {
    this.view = view;
    this.filters = filters;
    this.style = style;
    this.theme = activeTheme(style, centerTime(view)).id;
  }

  setStyle(style: StyleChoice): void {
    this.style = style;
    this.emit();
  }

  setFilters(filters: Filters): void {
    this.filters = filters;
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.theme = activeTheme(this.style, centerTime(this.view)).id;
    for (const listener of this.listeners) listener();
  }

  setWidth(width: number): void {
    if (width > 0 && width !== this.width) {
      this.width = width;
      this.emit();
    }
  }

  /** Cambia la vista al instante (gestos) y cancela cualquier animación. */
  setView(view: View): void {
    this.cancelAnimation();
    this.view = clampView(view);
    this.emit();
  }

  /** Cambia la vista con animación ease-out (botones, teclado y saltos). */
  animateTo(target: View, ms = ANIMATION_MS): void {
    this.cancelAnimation();
    const to = clampView(target);
    if (ms <= 0 || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      this.view = to;
      this.emit();
      return;
    }
    const from = this.view;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      this.view = k >= 1 ? to : clampView(lerpView(from, to, easeOutCubic(k)));
      this.emit();
      this.animation = k < 1 ? requestAnimationFrame(step) : 0;
    };
    this.animation = requestAnimationFrame(step);
  }

  cancelAnimation(): void {
    if (this.animation) {
      cancelAnimationFrame(this.animation);
      this.animation = 0;
    }
  }

  zoom(factor: number, anchorX = this.width / 2, animate = false): void {
    const target = zoomAt(this.view, factor, anchorX, this.width);
    if (animate) this.animateTo(target);
    else this.setView(target);
  }

  pan(dx: number, animate = false): void {
    const target = panBy(this.view, dx, this.width);
    if (animate) this.animateTo(target);
    else this.setView(target);
  }

  select(selection: Selection): void {
    this.selection = selection;
    this.emit();
  }

  setMode(mode: ScaleMode): void {
    this.setView(switchMode(this.view, mode));
  }
}
