import type { Store } from '../state/store';
import type { TimelineRenderer } from './renderer';
import { fullView, visibleYears, xOf, zoomAt, type ScaleMode } from './scale';

/**
 * Solo en desarrollo: hace zoom desde la vista completa hasta 2 meses en ambos modos,
 * fotograma a fotograma, y escribe en la consola el tiempo de pintado y los fps.
 */
export function runBench(store: Store, renderer: TimelineRenderer): void {
  const results: Record<string, unknown> = {};
  const modes: ScaleMode[] = ['log', 'linear'];

  const runMode = (index: number) => {
    const mode = modes[index];
    if (!mode) {
      console.log('BENCH ' + JSON.stringify(results));
      const pre = document.createElement('pre');
      pre.id = 'bench';
      pre.textContent = JSON.stringify(results, null, 2);
      pre.style.cssText =
        'position:fixed;right:8px;bottom:48px;background:#fff;border:1px solid #888;padding:8px;font-size:12px;z-index:9';
      document.body.append(pre);
      document.title = 'BENCH DONE';
      return;
    }
    const draws: number[] = [];
    const frames: number[] = [];
    renderer.onDraw = (ms) => draws.push(ms);
    renderer.profile = {};
    store.setView(fullView(mode));
    // Zoom hacia el centro de julio de 1851.
    let last = performance.now();
    const tick = (now: number) => {
      frames.push(now - last);
      last = now;
      const v = store.view;
      const anchorX = xOf(1851.55, v, store.width);
      store.setView(zoomAt(v, 1.06, anchorX, store.width));
      if (visibleYears(store.view) > 0.17 && draws.length < 2000) {
        requestAnimationFrame(tick);
      } else {
        const sorted = [...draws].sort((a, b) => a - b);
        const avg = draws.reduce((s, d) => s + d, 0) / Math.max(1, draws.length);
        const frameAvg =
          frames.slice(1).reduce((s, d) => s + d, 0) / Math.max(1, frames.length - 1);
        results[mode] = {
          frames: draws.length,
          drawAvgMs: +avg.toFixed(2),
          drawP95Ms: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(2),
          drawMaxMs: +(sorted[sorted.length - 1] ?? 0).toFixed(2),
          fps: +(1000 / frameAvg).toFixed(1),
          avgMsPorFase: Object.fromEntries(
            Object.entries(renderer.profile ?? {}).map(([k, v]) => [
              k,
              +(v / draws.length).toFixed(2),
            ]),
          ),
        };
        renderer.profile = null;
        renderer.onDraw = null;
        runMode(index + 1);
      }
    };
    requestAnimationFrame(tick);
  };
  runMode(0);
}
