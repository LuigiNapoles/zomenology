import { useMemo } from 'preact/hooks';
import type { DataFile, TimelineEvent } from '../data/types';
import { formatOriginalDate, formatSpan } from '../format/dates';
import { findContemporaries } from '../features/contemporaries';
import { macroColor } from '../themes/macros';
import type { PreparedEvents } from '../timeline/prepare';

interface Props {
  file: DataFile;
  data: PreparedEvents;
  index: number;
  /** Filtros activos (null si no hay). */
  filter: ((i: number) => boolean) | null;
  onOpen: (index: number) => void;
}

/** F11: eventos de otras macrocategorías que coinciden en el tiempo con el abierto. */
export function Contemporaries({ file, data, index, filter, onOpen }: Props) {
  const result = useMemo(() => findContemporaries(data, index, filter), [data, index, filter]);
  const intro =
    result.margin > 0
      ? `De otras categorías, en una ventana de ±${formatSpan(result.margin)} alrededor de esta fecha.`
      : 'De otras categorías, que se solapan con este periodo.';

  return (
    <section class="contemporaries" aria-labelledby="with-title">
      <h3 id="with-title" class="with-title">
        ¿Qué pasaba a la vez?
      </h3>
      <p class="panel-note">
        {intro} Del más cercano al más lejano{filter ? '; se aplican los filtros activos' : ''}.
      </p>
      {result.groups.length === 0 && (
        <p class="panel-note">No hay eventos de otras categorías en estas fechas.</p>
      )}
      {result.groups.map((group) => (
        <div key={group.macro} class="with-group">
          <h4 class="with-macro">
            <span class="swatch" style={{ background: macroColor(group.macro) }} />
            <span>{file.macros[group.macro]}</span>
            <span class="with-count">
              {group.total > group.items.length
                ? `${group.items.length} de ${group.total}`
                : group.total}
            </span>
          </h4>
          <ul class="group-list">
            {group.items.map((i) => {
              const e = data.events[i] as TimelineEvent;
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onOpen(i)}>
                    <span class="group-date">{formatOriginalDate(e.f, e.e)}</span>
                    <span>{e.d}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
