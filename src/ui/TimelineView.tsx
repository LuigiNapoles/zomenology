import { useEffect, useRef, useState } from 'preact/hooks';
import type { TimelineEvent } from '../data/types';
import { formatOriginalDate } from '../format/dates';
import { compileFilter } from '../state/filters';
import type { Store } from '../state/store';
import { MACRO_SHORT, macroColor } from '../themes/macros';
import { clusterAction } from '../timeline/cluster';
import { attachPointerInteraction } from '../timeline/interaction';
import type { PreparedEvents } from '../timeline/prepare';
import {
  TimelineRenderer,
  type LaneBox,
  type Target,
  type VisibleTarget,
} from '../timeline/renderer';

interface Props {
  store: Store;
  events: PreparedEvents;
  macros: readonly string[];
  onRenderer?: (renderer: TimelineRenderer) => void;
}

/** Espera tras el último cambio antes de rehacer la lista accesible de eventos visibles. */
const TARGETS_DELAY_MS = 300;

function targetKey(t: Target): string {
  return t.kind === 'event' ? `e${t.index}` : `b${t.members[0] ?? 0}`;
}

/** Texto que lee el lector de pantalla (y que se muestra mientras el elemento tiene el foco). */
function targetLabel(t: Target, data: PreparedEvents, macros: readonly string[]): string {
  if (t.kind === 'event') {
    const e = data.events[t.index] as TimelineEvent;
    return `${e.d}. ${formatOriginalDate(e.f, e.e)}. ${macros[data.lane[t.index] as number] ?? ''}`;
  }
  // Los eventos están ordenados por fecha: el menor índice es el más antiguo.
  const first = data.events[Math.min(...t.members)] as TimelineEvent;
  const last = data.events[Math.max(...t.members)] as TimelineEvent;
  const macro = macros[data.lane[t.members[0] as number] as number] ?? '';
  return `${t.members.length} eventos agrupados de ${macro}, de ${formatOriginalDate(first.f, first.e)} a ${formatOriginalDate(last.f, last.e)}`;
}

export function TimelineView({ store, events, macros, onRenderer }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rendererRef = useRef<TimelineRenderer | null>(null);
  /** Último elemento de la lista con el foco: si desaparece al moverse el eje, se pasa al más cercano. */
  const lastFocus = useRef<{ key: string; x: number } | null>(null);
  const [lanes, setLanes] = useState<LaneBox[]>([]);
  const [targets, setTargets] = useState<VisibleTarget[]>([]);
  const [focused, setFocused] = useState<VisibleTarget | null>(null);

  /** Abre la ficha del evento, o acerca / lista los de una burbuja (igual que al pincharla). */
  const activate = (target: Target) => {
    if (target.kind === 'event') {
      store.select({ kind: 'event', index: target.index });
      return;
    }
    const members = target.members.map((i) => ({
      start: events.start[i] as number,
      end: events.end[i] as number,
    }));
    const action = clusterAction(members, store.view, store.width);
    if (action.kind === 'zoom') store.animateTo(action.view);
    else store.select({ kind: 'list', members: [...target.members].sort((a, b) => a - b) });
  };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const renderer = new TimelineRenderer(canvas, events);
    rendererRef.current = renderer;
    let targetTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshTargets = () => {
      clearTimeout(targetTimer);
      targetTimer = setTimeout(() => setTargets(renderer.visibleTargets()), TARGETS_DELAY_MS);
    };
    renderer.onLanes = setLanes;
    renderer.onLayout = refreshTargets;
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
        refreshTargets();
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
        if (hit) activate(hit);
      },
      onHover: (x, y) => {
        host.style.cursor = renderer.hitTest(x, y) ? 'pointer' : '';
      },
    });
    return () => {
      clearTimeout(targetTimer);
      observer.disconnect();
      unsubscribe();
      detach();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [store, events, onRenderer]);

  // Pinchar en cualquier sitio cuenta como salir de la lista a propósito.
  useEffect(() => {
    const forget = () => {
      lastFocus.current = null;
    };
    document.addEventListener('pointerdown', forget, true);
    return () => document.removeEventListener('pointerdown', forget, true);
  }, []);

  // Si el elemento con el foco ya no se ve (el eje se movió), el foco pasa al más cercano.
  useEffect(() => {
    const last = lastFocus.current;
    const list = listRef.current;
    if (!last || !list || list.contains(document.activeElement)) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>('.a11y-target'));
    let best: HTMLButtonElement | null = null;
    let bestDistance = Infinity;
    for (const b of buttons) {
      const d = Math.abs(Number(b.dataset.x) - last.x);
      if (d < bestDistance) {
        bestDistance = d;
        best = b;
      }
    }
    if (best) {
      best.focus();
    } else {
      lastFocus.current = null;
      setFocused(null);
      rendererRef.current?.setFocus(null);
    }
  }, [targets]);

  return (
    <div class="timeline">
      <div class="lane-names" aria-hidden="true">
        {lanes.map((lane) => (
          <div
            key={lane.lane}
            class="lane-name"
            style={{
              top: `${lane.top}px`,
              height: `${lane.height}px`,
              borderLeftColor: macroColor(lane.lane),
            }}
          >
            <span class="swatch" style={{ background: macroColor(lane.lane) }} />
            <span class="lane-text lane-full">{macros[lane.lane]}</span>
            <span class="lane-text lane-short">{MACRO_SHORT[lane.lane] ?? macros[lane.lane]}</span>
          </div>
        ))}
      </div>
      <div ref={hostRef} class="timeline-canvas">
        <canvas ref={canvasRef} aria-hidden="true" />
        {focused && (
          <p class="focus-caption" aria-hidden="true">
            {targetLabel(focused, events, macros)}
            <span class="focus-hint"> · Intro: abrir</span>
          </p>
        )}
      </div>
      <p id="timeline-help" class="sr-only">
        Flechas izquierda y derecha: desplazar el eje. Más y menos: zoom. Intro: abrir la ficha.
      </p>
      <ul
        ref={listRef}
        id="eventos"
        class="sr-only a11y-list"
        aria-label={`Eventos visibles en el eje (${targets.length})`}
        aria-describedby="timeline-help"
      >
        {targets.map((t) => {
          const key = targetKey(t);
          return (
            <li key={key}>
              <button
                type="button"
                class="a11y-target"
                data-key={key}
                data-x={t.x}
                onFocus={() => {
                  lastFocus.current = { key, x: t.x };
                  setFocused(t);
                  rendererRef.current?.setFocus(t);
                }}
                onBlur={(e) => {
                  // Si el foco va a otro sitio (Tab), se olvida. Si el botón desaparece o se
                  // mueve al desplazarse el eje, no hay destino y el efecto de arriba pasa el
                  // foco al elemento más cercano. Un clic fuera también lo olvida (ver arriba).
                  if (e.relatedTarget) lastFocus.current = null;
                  setFocused(null);
                  rendererRef.current?.setFocus(null);
                }}
                onClick={() => activate(t)}
              >
                {targetLabel(t, events, macros)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
