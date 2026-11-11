import { useEffect, useRef } from 'preact/hooks';
import type { Store } from '../state/store';
import { attachPointerInteraction } from '../timeline/interaction';
import type { PreparedEvents, TimelineRenderer } from '../timeline/renderer';
import { TimelineRenderer as Renderer } from '../timeline/renderer';

interface Props {
  store: Store;
  events: PreparedEvents;
  onRenderer?: (renderer: TimelineRenderer) => void;
}

export function TimelineView({ store, events, onRenderer }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const renderer = new Renderer(canvas, events);
    onRenderer?.(renderer);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.resize(width, height, window.devicePixelRatio || 1);
      store.setWidth(width);
      renderer.setView(store.view);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const unsubscribe = store.subscribe(() => renderer.setView(store.view));
    const detach = attachPointerInteraction(host, store);
    return () => {
      observer.disconnect();
      unsubscribe();
      detach();
      renderer.destroy();
    };
  }, [store, events, onRenderer]);

  return (
    <div ref={hostRef} class="timeline">
      <canvas ref={canvasRef} aria-label="Línea temporal" role="img" />
    </div>
  );
}
