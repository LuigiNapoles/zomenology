import { useEffect, useRef, useState } from 'preact/hooks';
import type { DataFile, TimelineEvent } from '../data/types';
import { DATE_TYPE_NAMES, formatDuration, formatOriginalDate } from '../format/dates';
import type { Selection, Store } from '../state/store';
import { macroColor } from '../themes/macros';
import { viewForEvent } from '../timeline/focus';
import type { PreparedEvents } from '../timeline/prepare';

interface Props {
  store: Store;
  file: DataFile;
  data: PreparedEvents;
}

function useSelection(store: Store): Selection {
  const [selection, setSelection] = useState(store.selection);
  useEffect(() => store.subscribe(() => setSelection(store.selection)), [store]);
  return selection;
}

/** Enlace directo al evento: #e42. */
export function eventLink(id: number): string {
  return `${location.origin}${location.pathname}#e${id}`;
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

export function EventPanel({ store, file, data }: Props) {
  const selection = useSelection(store);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
    titleRef.current?.focus();
  }, [selection]);

  if (!selection) return null;

  const close = () => store.select(null);
  const open = (index: number, center: boolean) => {
    store.select({ kind: 'event', index });
    if (center) {
      store.animateTo(
        viewForEvent(
          data.start[index] as number,
          data.end[index] as number,
          data.point[index] === 1,
          store.view,
        ),
      );
    }
  };

  if (selection.kind === 'list') {
    const members = [...selection.members].sort(
      (a, b) => (data.start[a] as number) - (data.start[b] as number) || a - b,
    );
    return (
      <div class="panel" role="dialog" aria-labelledby="panel-title">
        <div class="panel-bar">
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
                <button type="button" onClick={() => open(i, false)}>
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

  const index = selection.index;
  const e = data.events[index] as TimelineEvent;
  const section = file.sections[e.s];
  const macro = section?.macro ?? 0;
  const duration = durationText(e, data, index);
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
        <button
          type="button"
          class="icon-button"
          aria-label="Evento anterior"
          disabled={index === 0}
          onClick={() => open(index - 1, true)}
        >
          ←
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="Evento siguiente"
          disabled={index === data.count - 1}
          onClick={() => open(index + 1, true)}
        >
          →
        </button>
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
      {e.ap === 1 && <p class="panel-warning">Fecha aproximada</p>}

      <dl class="panel-fields">
        <dt>Fecha</dt>
        <dd>{formatOriginalDate(e.f, e.e)}</dd>
        {duration && (
          <>
            <dt>Duración</dt>
            <dd>{duration}</dd>
          </>
        )}
        <dt>Tipo de fecha</dt>
        <dd>{DATE_TYPE_NAMES[e.t ?? 'e']}</dd>
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

      <div class="panel-actions">
        <button type="button" onClick={() => void copy()}>
          {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
        <button type="button" onClick={() => open(index, true)}>
          Centrar en el eje
        </button>
        <button type="button" disabled title="Disponible en una próxima versión">
          ¿Qué pasaba a la vez?
        </button>
      </div>
    </div>
  );
}
