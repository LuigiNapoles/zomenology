import { useEffect, useRef, useState } from 'preact/hooks';
import { formatInstant } from '../format/dates';
import type { Store } from '../state/store';
import { parseColor, toCss } from '../themes/color';
import { ERAS } from '../timeline/eras';
import {
  JUMPS,
  jumpView,
  minimapTime,
  minimapX,
  viewCenteredAt,
  windowRect,
} from '../timeline/minimap';
import { T_MIN, centerTime, visibleYears } from '../timeline/scale';

interface Props {
  store: Store;
}

/** Alto por defecto; en pantallas táctiles el CSS lo sube a 44 px. */
const HEIGHT = 30;
const FONT = '600 14px "Source Sans 3", system-ui, sans-serif';

/** F3: barra con toda la historia, recuadro arrastrable y botones de salto rápido. */
export function Minimap({ store }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState('');
  /** Posición del centro en la barra, de 0 a 100 (para el lector de pantalla). */
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;
    let width = 0;

    const draw = () => {
      frame = 0;
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      const height = canvas.clientHeight || HEIGHT;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const style = getComputedStyle(document.documentElement);
      const css = (name: string, fallback: string) =>
        toCss(parseColor(style.getPropertyValue(name)) ?? parseColor(fallback) ?? [0, 0, 0]);
      const ink = css('--ink', '#1f1e1b');
      const accent = css('--accent', '#b05730');
      const tones = [css('--soft', '#f5f4ef'), css('--lane-alt', '#f8f8f7')];
      ctx.fillStyle = css('--surface', '#ffffff');
      ctx.fillRect(0, 0, width, height);

      // Eras en dos tonos alternos y separadas por una línea fina.
      ctx.font = FONT;
      ctx.textBaseline = 'middle';
      ERAS.forEach((era, i) => {
        const next = ERAS[i + 1];
        const x0 = minimapX(Math.max(era.from, T_MIN), width);
        const x1 = next ? minimapX(next.from, width) : width;
        ctx.fillStyle = tones[i % 2] ?? ink;
        ctx.fillRect(x0, 0, x1 - x0, height);
        if (i > 0) {
          ctx.fillStyle = css('--line', '#dddddd');
          ctx.fillRect(Math.round(x0), 0, 1, height);
        }
        const text = era.name;
        const tw = ctx.measureText(text).width;
        if (tw + 12 < x1 - x0) {
          ctx.fillStyle = ink;
          ctx.fillText(text, x0 + 6, height / 2 - 1);
        }
      });

      // Ventana visible del eje principal, en terracota.
      const { x0, x1 } = windowRect(store.view, store.width, width);
      const box = new Path2D();
      box.roundRect(x0, 2, x1 - x0, height - 4, 4);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.16;
      ctx.fill(box);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.stroke(box);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    // Cada cambio (vista o modo claro/oscuro) repinta en el siguiente fotograma, cuando
    // data-theme ya está aplicado.
    const update = () => {
      schedule();
      setLabel(formatInstant(centerTime(store.view), visibleYears(store.view)));
      setPercent(Math.round(minimapX(centerTime(store.view), 100)));
    };
    update();

    // Arrastrar el recuadro o pinchar para saltar (manteniendo el zoom).
    let dragOffset: number | null = null;
    const localX = (e: PointerEvent) => e.clientX - canvas.getBoundingClientRect().left;
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const x = localX(e);
      const { x0, x1 } = windowRect(store.view, store.width, width);
      const middle = (x0 + x1) / 2;
      if (x >= x0 - 4 && x <= x1 + 4) {
        dragOffset = x - middle;
      } else {
        dragOffset = 0;
        store.animateTo(viewCenteredAt(store.view, minimapTime(x, width)));
      }
    };
    const onMove = (e: PointerEvent) => {
      if (dragOffset === null || e.buttons === 0) return;
      store.setView(viewCenteredAt(store.view, minimapTime(localX(e) - dragOffset, width)));
    };
    const onUp = () => {
      dragOffset = null;
    };
    const onKey = (e: KeyboardEvent) => {
      const step = width * 0.02;
      const middle = (() => {
        const { x0, x1 } = windowRect(store.view, store.width, width);
        return (x0 + x1) / 2;
      })();
      let target: number | null = null;
      if (e.key === 'ArrowLeft') target = middle - step;
      else if (e.key === 'ArrowRight') target = middle + step;
      else if (e.key === 'Home') target = 0;
      else if (e.key === 'End') target = width;
      if (target === null) return;
      e.preventDefault();
      e.stopPropagation();
      store.animateTo(viewCenteredAt(store.view, minimapTime(target, width)));
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);
    const unsubscribe = store.subscribe(update);
    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('keydown', onKey);
    };
  }, [store]);

  return (
    <nav class="minimap" aria-label="Minimapa y saltos rápidos">
      <canvas
        ref={canvasRef}
        class="minimap-bar"
        role="slider"
        tabIndex={0}
        aria-label="Posición en toda la historia"
        aria-valuetext={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      />
      <div class="jumps" role="group" aria-label="Saltos rápidos">
        {JUMPS.map((jump) => (
          <button
            key={jump.label}
            type="button"
            onClick={() => store.animateTo(jumpView(jump, store.view.mode))}
          >
            {jump.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
