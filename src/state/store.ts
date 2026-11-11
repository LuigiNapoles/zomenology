import {
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

function easeOutCubic(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Estado único de la aplicación. De momento, solo la vista del eje y su ancho. */
export class Store {
  view: View;
  /** Ancho del eje en píxeles CSS. */
  width = 1;
  private listeners = new Set<Listener>();
  private animation = 0;

  constructor(view: View = fullView('log')) {
    this.view = view;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
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

  setMode(mode: ScaleMode): void {
    this.setView(switchMode(this.view, mode));
  }
}
