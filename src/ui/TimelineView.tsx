import { useEffect, useRef, useState } from 'preact/hooks';
import { compileFilter } from '../state/filters';
import type { Store } from '../state/store';
import { macroColor } from '../themes/macros';
import { clusterAction } from '../timeline/cluster';
import { attachPointerInteraction } from '../timeline/interaction';
import type { PreparedEvents } from '../timeline/prepare';
import { TimelineRenderer, type LaneBox } from '../timeline/renderer';

interface Props {
  store: Store;
  events: PreparedEvents;
  macros: readonly string[];
  onRenderer?: (renderer: TimelineRenderer) => void;
}

export function TimelineView({ store, events, macros, onRenderer }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lanes, setLanes] = useState<LaneBox[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const renderer = new TimelineRenderer(canvas, events);
    renderer.onLanes = setLanes;
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
    renderer.setSelection(store.selection);
    renderer.setFilter(compileFilter(store.filters, events));
    renderer.setTheme(store.theme);

    let lastView = store.view;
    let lastSelection = store.selection;
    let lastFilters = store.filters;
    const unsubscribe = store.subscribe(() => {
      if (store.view !== lastView) {
        lastView = store.view;
        renderer.setView(store.view);
      }
      if (store.selection !== lastSelection) {
        lastSelection = store.selection;
        renderer.setSelection(store.selection);
      }
      renderer.setTheme(store.theme);
      if (store.filters !== lastFilters) {
        lastFilters = store.filters;
        renderer.setFilter(compileFilter(store.filters, events));
      }
    });

    const detach = attachPointerInteraction(host, store, {
      onTap: (x, y) => {
        const hit = renderer.hitTest(x, y);
        if (!hit) return;
        if (hit.kind === 'event') {
          store.select({ kind: 'event', index: hit.index });
          return;
        }
        const members = hit.members.map((i) => ({
          start: events.start[i] as number,
          end: events.end[i] as number,
        }));
        const action = clusterAction(members, store.view, store.width);
        if (action.kind === 'zoom') store.animateTo(action.view);
        else store.select({ kind: 'list', members: [...hit.members].sort((a, b) => a - b) });
      },
      onHover: (x, y) => {
        host.style.cursor = renderer.hitTest(x, y) ? 'pointer' : '';
      },
    });
    return () => {
      observer.disconnect();
      unsubscribe();
      detach();
      renderer.destroy();
    };
  }, [store, events, onRenderer]);

  return (
    <div class="timeline">
      <div class="lane-names" aria-hidden="true">
        {lanes.map((lane) => (
          <div
            key={lane.lane}
            class="lane-name"
            style={{ top: `${lane.top}px`, height: `${lane.height}px` }}
          >
            <span class="swatch" style={{ background: macroColor(lane.lane) }} />
            <span class="lane-text">{macros[lane.lane]}</span>
          </div>
        ))}
      </div>
      <div ref={hostRef} class="timeline-canvas">
        <canvas ref={canvasRef} aria-label="Línea temporal" role="img" />
      </div>
    </div>
  );
}
