import type { Store } from '../state/store';

/** Factor de zoom de los botones y las teclas + y −. */
export const ZOOM_STEP = 1.6;
/** Fracción del ancho que desplazan las flechas. */
export const PAN_STEP = 0.15;

interface PointerPos {
  x: number;
  y: number;
}

function wheelPixels(e: WheelEvent, delta: number): number {
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * 400;
  return delta;
}

/** Rueda, arrastre y pellizco sobre el elemento del eje. Devuelve la función para soltarlos. */
export function attachPointerInteraction(el: HTMLElement, store: Store): () => void {
  const pointers = new Map<number, PointerPos>();
  let pinchDistance = 0;
  let pinchMidX = 0;

  const localX = (clientX: number) => clientX - el.getBoundingClientRect().left;

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const dx = wheelPixels(e, e.deltaX);
    const dy = wheelPixels(e, e.deltaY);
    if (Math.abs(dx) > Math.abs(dy) && !e.ctrlKey) {
      store.pan(-dx);
      return;
    }
    // Ctrl + rueda es el pellizco del panel táctil: más sensible.
    const factor = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002));
    store.zoom(factor, localX(e.clientX));
  };

  const pinchState = () => {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return null;
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), midX: localX((a.x + b.x) / 2) };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    store.cancelAnimation();
    const pinch = pinchState();
    if (pinch) {
      pinchDistance = pinch.distance;
      pinchMidX = pinch.midX;
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      if (dx !== 0) store.pan(dx);
      return;
    }
    const pinch = pinchState();
    if (!pinch || pinchDistance <= 0) return;
    // Zoom anclado al centro del pellizco y desplazamiento si el centro se mueve.
    store.pan(pinch.midX - pinchMidX);
    store.zoom(pinch.distance / pinchDistance, pinch.midX);
    pinchDistance = pinch.distance;
    pinchMidX = pinch.midX;
  };

  const onPointerUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    const pinch = pinchState();
    if (pinch) {
      pinchDistance = pinch.distance;
      pinchMidX = pinch.midX;
    }
  };

  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  return () => {
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
  };
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Flechas desplazan; + y − hacen zoom. Ignora las teclas mientras se escribe. */
export function attachKeyboard(target: Window, store: Store): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    const width = store.width;
    switch (e.key) {
      case 'ArrowLeft':
        store.pan(width * PAN_STEP, true);
        break;
      case 'ArrowRight':
        store.pan(-width * PAN_STEP, true);
        break;
      case '+':
      case '=':
        store.zoom(ZOOM_STEP, width / 2, true);
        break;
      case '-':
      case '_':
        store.zoom(1 / ZOOM_STEP, width / 2, true);
        break;
      default:
        return;
    }
    e.preventDefault();
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
