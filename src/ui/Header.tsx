import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { formatInstant, formatSpan } from '../format/dates';
import type { Store } from '../state/store';
import { ZOOM_STEP } from '../timeline/interaction';
import { centerTime, visibleYears, type ScaleMode } from '../timeline/scale';

interface Props {
  store: Store;
  /** Buscador y botón de filtros (cuando ya hay datos). */
  children?: ComponentChildren;
}

function useView(store: Store) {
  const [view, setView] = useState(store.view);
  useEffect(() => store.subscribe(() => setView(store.view)), [store]);
  return view;
}

const MODES: { mode: ScaleMode; label: string }[] = [
  { mode: 'linear', label: 'Lineal' },
  { mode: 'log', label: 'Logarítmica' },
];

export function Header({ store, children }: Props) {
  const view = useView(store);
  const years = visibleYears(view);

  return (
    <header class="header">
      <h1 class="title">Cronología interactiva</h1>
      <div class="controls">
        <div class="group" role="group" aria-label="Escala">
          {MODES.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view.mode === mode}
              onClick={() => store.setMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <div class="group" role="group" aria-label="Zoom">
          <button
            type="button"
            aria-label="Alejar"
            onClick={() => store.zoom(1 / ZOOM_STEP, store.width / 2, true)}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Acercar"
            onClick={() => store.zoom(ZOOM_STEP, store.width / 2, true)}
          >
            +
          </button>
        </div>
        {children}
        <p class="status">
          Centro: <strong>{formatInstant(centerTime(view), years)}</strong> · En pantalla:{' '}
          {formatSpan(years)}
        </p>
      </div>
    </header>
  );
}
