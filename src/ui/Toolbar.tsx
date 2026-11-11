import { useEffect, useState } from 'preact/hooks';
import { formatInstant, formatSpan } from '../format/dates';
import type { Store } from '../state/store';
import { eraAt } from '../timeline/eras';
import { ZOOM_STEP } from '../timeline/interaction';
import { centerTime, visibleYears, type ScaleMode } from '../timeline/scale';
import { IconMinus, IconPlus } from './icons';

interface Props {
  store: Store;
}

function useView(store: Store) {
  const [view, setView] = useState(store.view);
  useEffect(() => store.subscribe(() => setView(store.view)), [store]);
  return view;
}

const MODES: { mode: ScaleMode; label: string; short: string }[] = [
  { mode: 'linear', label: 'Lineal', short: 'Lineal' },
  { mode: 'log', label: 'Logarítmica', short: 'Log.' },
];

/** Encima del eje: dónde estamos (centro, era, años en pantalla), escala y zoom. */
export function Toolbar({ store }: Props) {
  const view = useView(store);
  const years = visibleYears(view);
  const center = centerTime(view);

  return (
    <div class="toolbar">
      <p class="status">
        <span class="status-center">
          Centro: <strong>{formatInstant(center, years)}</strong>
          <span class="status-sep"> · </span>
        </span>
        <span class="status-era">{eraAt(center).name}</span>
        <span class="status-sep"> · </span>
        <span>En pantalla: {formatSpan(years)}</span>
      </p>
      <div class="toolbar-controls">
        <div class="segmented" role="group" aria-label="Escala">
          {MODES.map(({ mode, label, short }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view.mode === mode}
              onClick={() => store.setMode(mode)}
            >
              {/* En móvil se ve la forma corta; el lector de pantalla lee siempre la larga. */}
              <span class="label-full">{label}</span>
              <span class="label-short" aria-hidden="true">
                {short}
              </span>
            </button>
          ))}
        </div>
        <div class="zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            class="icon-button"
            aria-label="Alejar"
            title="Alejar (−)"
            onClick={() => store.zoom(1 / ZOOM_STEP, store.width / 2, true)}
          >
            <IconMinus />
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="Acercar"
            title="Acercar (+)"
            onClick={() => store.zoom(ZOOM_STEP, store.width / 2, true)}
          >
            <IconPlus />
          </button>
        </div>
      </div>
    </div>
  );
}
