import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { formatInstant, formatSpan } from '../format/dates';
import type { Store } from '../state/store';
import { ZOOM_STEP } from '../timeline/interaction';
import { activeTheme, periodAt, type StyleChoice } from '../themes/periods';
import { centerTime, visibleYears, type ScaleMode } from '../timeline/scale';

interface Props {
  store: Store;
  /** Buscador y botón de filtros (cuando ya hay datos). */
  children?: ComponentChildren;
}

function useView(store: Store) {
  const [state, setState] = useState({ view: store.view, style: store.style });
  useEffect(
    () => store.subscribe(() => setState({ view: store.view, style: store.style })),
    [store],
  );
  return state;
}

const STYLES: { value: StyleChoice; label: string }[] = [
  { value: 'period', label: 'Por periodo' },
  { value: 'neutral-light', label: 'Neutro claro' },
  { value: 'neutral-dark', label: 'Neutro oscuro' },
];

const MODES: { mode: ScaleMode; label: string; short: string }[] = [
  { mode: 'linear', label: 'Lineal', short: 'Lineal' },
  { mode: 'log', label: 'Logarítmica', short: 'Log.' },
];

export function Header({ store, children }: Props) {
  const { view, style } = useView(store);
  const years = visibleYears(view);
  const center = centerTime(view);
  const period = style === 'period' ? activeTheme(style, center) : periodAt(center);

  return (
    <header class="header">
      <h1 class="title">Cronología interactiva</h1>
      <div class="controls">
        <div class="group" role="group" aria-label="Escala">
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
        <label class="style-picker">
          <span class="style-label">Estilo</span>
          <select
            value={style}
            onChange={(e) => store.setStyle(e.currentTarget.value as StyleChoice)}
          >
            {STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <p class="status">
          <span class="status-center">
            Centro: <strong>{formatInstant(center, years)}</strong> ·{' '}
          </span>
          {period.name} · En pantalla: {formatSpan(years)}
        </p>
      </div>
    </header>
  );
}
