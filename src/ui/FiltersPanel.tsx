import { useEffect, useRef, useState } from 'preact/hooks';
import type { DataFile, DateType } from '../data/types';
import { DATE_TYPE_NAMES, formatNumber } from '../format/dates';
import { DEFAULT_FILTERS, rangeBounds, type Filters } from '../state/filters';
import type { Store } from '../state/store';
import { macroColor } from '../themes/macros';
import { DATE_TYPES } from '../timeline/prepare';

interface Props {
  store: Store;
  file: DataFile;
  visible: number;
  total: number;
  onClose: () => void;
}

function useFilters(store: Store): Filters {
  const [filters, setFilters] = useState(store.filters);
  useEffect(() => store.subscribe(() => setFilters(store.filters)), [store]);
  return filters;
}

/** Casilla que admite el estado «algunas sí, otras no». */
function TriCheckbox(props: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = props.indeterminate;
  }, [props.indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={props.checked}
      aria-label={props.label}
      onChange={props.onChange}
    />
  );
}

export function FiltersPanel({ store, file, visible, total, onClose }: Props) {
  const filters = useFilters(store);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const hidden = new Set(filters.hiddenSections);
  const { fromError, toError } = rangeBounds(filters);
  const update = (patch: Partial<Filters>) => store.setFilters({ ...store.filters, ...patch });

  const sectionsOf = (macro: number) =>
    file.sections.flatMap((s, i) => (s.macro === macro ? [i] : []));
  const setSections = (indices: number[], show: boolean) => {
    const next = new Set(store.filters.hiddenSections);
    for (const i of indices) {
      if (show) next.delete(i);
      else next.add(i);
    }
    update({ hiddenSections: [...next].sort((a, b) => a - b) });
  };
  const toggleType = (t: DateType) => {
    const set = new Set(store.filters.hiddenTypes);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    update({ hiddenTypes: DATE_TYPES.filter((x) => set.has(x)) });
  };
  const toggleOpen = (macro: number) => {
    const next = new Set(open);
    if (next.has(macro)) next.delete(macro);
    else next.add(macro);
    setOpen(next);
  };

  return (
    <section class="filters" aria-labelledby="filters-title">
      <div class="filters-head">
        <h2 id="filters-title" class="filters-title">
          Filtros
        </h2>
        <button type="button" class="icon-button" aria-label="Cerrar filtros" onClick={onClose}>
          ×
        </button>
      </div>
      <p class="filters-count" aria-live="polite">
        <strong>{formatNumber(visible, 0)}</strong> de {formatNumber(total, 0)} eventos visibles
      </p>
      <button type="button" class="filters-reset" onClick={() => store.setFilters(DEFAULT_FILTERS)}>
        Restablecer
      </button>

      <fieldset>
        <legend>Rango temporal</legend>
        <div class="range">
          <label>
            Desde
            <input
              type="text"
              value={filters.from}
              placeholder="p. ej. 500 a.C."
              aria-invalid={fromError}
              onInput={(e) => update({ from: e.currentTarget.value })}
            />
          </label>
          <label>
            Hasta
            <input
              type="text"
              value={filters.to}
              placeholder="p. ej. 1500"
              aria-invalid={toError}
              onInput={(e) => update({ to: e.currentTarget.value })}
            />
          </label>
        </div>
        {(fromError || toError) && (
          <p class="filters-error">No se entiende la fecha; se ignora mientras tanto.</p>
        )}
        <p class="filters-hint">Años («1492», «500 a.C.»), ka («45 ka») o Ma («2,5 Ma»).</p>
      </fieldset>

      <fieldset>
        <legend>Fechas</legend>
        <label class="check">
          <input
            type="checkbox"
            checked={filters.exactOnly}
            onChange={() => update({ exactOnly: !filters.exactOnly })}
          />
          Solo fechas exactas (oculta las aproximadas)
        </label>
        {DATE_TYPES.map((t) => (
          <label key={t} class="check">
            <input
              type="checkbox"
              checked={!filters.hiddenTypes.includes(t)}
              onChange={() => toggleType(t)}
            />
            {DATE_TYPE_NAMES[t]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Macrocategorías y secciones</legend>
        <div class="all-none">
          <button type="button" onClick={() => update({ hiddenSections: [] })}>
            Todas
          </button>
          <button
            type="button"
            onClick={() => update({ hiddenSections: file.sections.map((_, i) => i) })}
          >
            Ninguna
          </button>
        </div>
        <ul class="macro-list">
          {file.macros.map((name, macro) => {
            const sections = sectionsOf(macro);
            const shown = sections.filter((i) => !hidden.has(i)).length;
            const expanded = open.has(macro);
            return (
              <li key={name}>
                <div class="macro-row">
                  <label class="check">
                    <TriCheckbox
                      checked={shown === sections.length}
                      indeterminate={shown > 0 && shown < sections.length}
                      label={name}
                      onChange={() => setSections(sections, shown < sections.length)}
                    />
                    <span class="swatch" style={{ background: macroColor(macro) }} />
                    {name}
                  </label>
                  {sections.length > 1 && (
                    <button
                      type="button"
                      class="expand"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Ocultar' : 'Ver'} secciones de ${name}`}
                      onClick={() => toggleOpen(macro)}
                    >
                      {expanded ? '▾' : '▸'} {sections.length}
                    </button>
                  )}
                </div>
                {expanded && (
                  <ul class="section-list">
                    {sections.map((i) => (
                      <li key={i}>
                        <label class="check">
                          <input
                            type="checkbox"
                            checked={!hidden.has(i)}
                            onChange={() => setSections([i], hidden.has(i))}
                          />
                          {file.sections[i]?.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>
    </section>
  );
}
