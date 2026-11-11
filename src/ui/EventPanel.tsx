import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { DataFile, TimelineEvent } from '../data/types';
import { DATE_TYPE_NAMES, formatDuration, formatOriginalDate } from '../format/dates';
import { LEARN } from '../features/flags';
import { humanScaleText } from '../features/humanScale';
import { compileFilter } from '../state/filters';
import { eventHash } from '../state/persist';
import type { Store } from '../state/store';
import { macroColor } from '../themes/macros';
import { viewForEvent } from '../timeline/focus';
import type { PreparedEvents } from '../timeline/prepare';
import { Contemporaries } from './Contemporaries';

interface Props {
  store: Store;
  file: DataFile;
  undated: DataFile;
  data: PreparedEvents;
}

function useStoreState(store: Store) {
  const [state, setState] = useState({ selection: store.selection, filters: store.filters });
  useEffect(
    () => store.subscribe(() => setState({ selection: store.selection, filters: store.filters })),
    [store],
  );
  return state;
}

/** Enlace directo al evento: …/#e42. */
export function eventLink(id: number): string {
  return `${location.origin}${location.pathname}${location.search}${eventHash(id)}`;
}

function durationText(e: TimelineEvent, data: PreparedEvents, index: number): string | null {
  if (e.x === 1) return 'Sin final conocido (sigue abierto)';
  if (e.x === 2) return 'Sin comienzo conocido';
  if (data.point[index]) return null;
  const a = e.a ?? 0;
  const precise = [e.ma, e.da, e.mb, e.db].some((v) => v !== undefined);
  return formatDuration(
    a,
    e.b ?? a,
    data.start[index] as number,
    data.end[index] as number,
    precise,
  );
}

/** Centra el eje en el evento i del eje (con animación). */
export function focusEvent(store: Store, data: PreparedEvents, index: number): void {
  store.select({ kind: 'event', index });
  store.animateTo(
    viewForEvent(
      data.start[index] as number,
      data.end[index] as number,
      data.point[index] === 1,
      store.view,
    ),
  );
}

export function EventPanel({ store, file, undated, data }: Props) {
  const { selection, filters } = useStoreState(store);
  const filter = useMemo(() => compileFilter(filters, data), [filters, data]);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);
  /** «¿Qué pasaba a la vez?» sigue abierto al saltar de un evento a otro, hasta cerrar la ficha. */
  const [showWith, setShowWith] = useState(false);

  useEffect(() => {
    setCopied(false);
    if (!selection) setShowWith(false);
    titleRef.current?.focus();
  }, [selection]);

  if (!selection) return null;
  const close = () => store.select(null);

  if (selection.kind === 'list') {
    const members = [...selection.members].sort(
      (a, b) => (data.start[a] as number) - (data.start[b] as number) || a - b,
    );
    return (
      <div class="panel" role="dialog" aria-labelledby="panel-title">
        <div class="panel-bar">
          <span class="panel-spacer" />
          <button type="button" class="icon-button" aria-label="Cerrar" onClick={close}>
            ×
          </button>
        </div>
        <h2 id="panel-title" class="panel-title" tabIndex={-1} ref={titleRef}>
          {members.length} eventos agrupados
        </h2>
        <p class="panel-note">
          No caben por separado en el carril con este zoom. Elige uno para ver su ficha.
        </p>
        <ul class="group-list">
          {members.map((i) => {
            const e = data.events[i] as TimelineEvent;
            return (
              <li key={e.id}>
                <button type="button" onClick={() => store.select({ kind: 'event', index: i })}>
                  <span class="group-date">{formatOriginalDate(e.f, e.e)}</span>
                  <span>{e.d}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const isDated = selection.kind === 'event';
  const index = selection.index;
  const e = (isDated ? data.events[index] : undated.events[index]) as TimelineEvent | undefined;
  if (!e) return null;
  const section = file.sections[e.s];
  const macro = section?.macro ?? 0;
  const duration = isDated ? durationText(e, data, index) : null;
  const hidden = isDated && filter !== null && !filter(index);

  // Anterior y siguiente en orden cronológico, saltando los que ocultan los filtros.
  const neighbour = (dir: 1 | -1): number => {
    for (let i = index + dir; i >= 0 && i < data.count; i += dir) {
      if (!filter || filter(i)) return i;
    }
    return -1;
  };
  const prev = isDated ? neighbour(-1) : -1;
  const next = isDated ? neighbour(1) : -1;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(eventLink(e.id));
      setCopied(true);
    } catch {
      window.prompt('Copia el enlace:', eventLink(e.id));
    }
  };

  return (
    <div class="panel" role="dialog" aria-labelledby="panel-title">
      <div class="panel-bar">
        {isDated && (
          <>
            <button
              type="button"
              class="icon-button"
              aria-label="Evento anterior"
              disabled={prev < 0}
              onClick={() => focusEvent(store, data, prev)}
            >
              ←
            </button>
            <button
              type="button"
              class="icon-button"
              aria-label="Evento siguiente"
              disabled={next < 0}
              onClick={() => focusEvent(store, data, next)}
            >
              →
            </button>
          </>
        )}
        <span class="panel-spacer" />
        <button type="button" class="icon-button" aria-label="Cerrar" onClick={close}>
          ×
        </button>
      </div>

      <p class="panel-kicker">
        <span class="swatch" style={{ background: macroColor(macro) }} />
        {file.macros[macro]}
      </p>
      <h2 id="panel-title" class="panel-title" tabIndex={-1} ref={titleRef}>
        {e.d}
      </h2>
      {!isDated && <p class="panel-warning">Sin fecha: no aparece en el eje</p>}
      {e.ap === 1 && <p class="panel-warning">Fecha aproximada</p>}
      {hidden && <p class="panel-note">Este evento está oculto por los filtros activos.</p>}

      <dl class="panel-fields">
        {isDated && (
          <>
            <dt>Fecha</dt>
            <dd>{formatOriginalDate(e.f, e.e)}</dd>
          </>
        )}
        {duration && (
          <>
            <dt>Duración</dt>
            <dd>{duration}</dd>
          </>
        )}
        {e.t && (
          <>
            <dt>Tipo de fecha</dt>
            <dd>{DATE_TYPE_NAMES[e.t]}</dd>
          </>
        )}
        {e.o && (
          <>
            <dt>Otras fechas</dt>
            <dd>{e.o}</dd>
          </>
        )}
        <dt>Sección</dt>
        <dd>{section?.label}</dd>
        <dt>Página del PDF</dt>
        <dd>{e.p}</dd>
      </dl>

      {LEARN && isDated && e.a !== undefined && (
        <p class="human-scale">
          <span class="human-scale-label">Escala humana</span>
          {humanScaleText(e.a, data.start[index] as number, data.point[index] === 1)}
        </p>
      )}

      <div class="panel-actions">
        <button type="button" onClick={() => void copy()}>
          {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
        {isDated && (
          <>
            <button type="button" onClick={() => focusEvent(store, data, index)}>
              Centrar en el eje
            </button>
            {LEARN && (
              <button type="button" aria-expanded={showWith} onClick={() => setShowWith(!showWith)}>
                ¿Qué pasaba a la vez?
              </button>
            )}
          </>
        )}
      </div>

      {LEARN && isDated && showWith && (
        <Contemporaries
          file={file}
          data={data}
          index={index}
          filter={filter}
          onOpen={(i) => focusEvent(store, data, i)}
        />
      )}
    </div>
  );
}
