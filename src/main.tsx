import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { loadData } from './data/load';
import { SearchIndex } from './data/search';
import type { DataFile } from './data/types';
import { formatNumber } from './format/dates';
import {
  DEFAULT_FILTERS,
  compileFilter,
  countVisible,
  isDefaultFilters,
  type Filters,
} from './state/filters';
import { eventHash, loadSaved, parseEventHash, save } from './state/persist';
import { Store } from './state/store';
import { viewForEvent } from './timeline/focus';
import { attachKeyboard } from './timeline/interaction';
import { prepareEvents, type PreparedEvents } from './timeline/prepare';
import type { TimelineRenderer } from './timeline/renderer';
import { fullView, viewAround, type ScaleMode, type View } from './timeline/scale';
import { EventPanel, focusEvent } from './ui/EventPanel';
import { FiltersPanel } from './ui/FiltersPanel';
import { Header } from './ui/Header';
import { SearchBox } from './ui/SearchBox';
import { TimelineView } from './ui/TimelineView';
import './ui/app.css';

/**
 * Solo en desarrollo: ?c=1851.5&y=0.5&m=lin fija la vista inicial, ?sel=42 abre la ficha
 * del evento 42 y ?bench=1 mide el pintado.
 */
function devParams(): { view: View | null; bench: boolean } {
  if (!import.meta.env.DEV) return { view: null, bench: false };
  const params = new URLSearchParams(location.search);
  const mode: ScaleMode = params.get('m') === 'lin' ? 'linear' : 'log';
  const c = params.get('c');
  const y = params.get('y');
  const view = c !== null && y !== null ? viewAround(Number(c), Number(y), mode) : null;
  return { view: view ?? (params.has('m') ? fullView(mode) : null), bench: params.has('bench') };
}

const dev = devParams();
const saved = loadSaved();
const store = new Store(
  dev.view ?? saved.view ?? fullView('log'),
  saved.filters ?? DEFAULT_FILTERS,
);

interface Dataset {
  file: DataFile;
  undated: DataFile;
  events: PreparedEvents;
  /** Dónde está cada id: en el eje (índice en events.json) o sin fecha (índice en undated.json). */
  byId: Map<number, { dated: boolean; index: number }>;
}

/** Abre el evento del enlace #e42, si lo hay. Al cargar, sin animación. */
function openFromHash(ds: Dataset, animate: boolean): boolean {
  const id = parseEventHash(location.hash);
  const place = id === null ? undefined : ds.byId.get(id);
  if (!place) return false;
  if (!place.dated) {
    store.select({ kind: 'undated', index: place.index });
  } else if (animate) {
    focusEvent(store, ds.events, place.index);
  } else {
    const i = place.index;
    store.select({ kind: 'event', index: i });
    store.setView(
      viewForEvent(
        ds.events.start[i] as number,
        ds.events.end[i] as number,
        ds.events.point[i] === 1,
        store.view,
      ),
    );
  }
  return true;
}

/** Mantiene #e<id> en la dirección mientras hay una ficha abierta. */
function syncHash(ds: Dataset): void {
  const sel = store.selection;
  const e =
    sel?.kind === 'event'
      ? ds.file.events[sel.index]
      : sel?.kind === 'undated'
        ? ds.undated.events[sel.index]
        : undefined;
  const hash = e ? eventHash(e.id) : '';
  if (location.hash !== hash && !(hash === '' && location.hash === '')) {
    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
  }
}

function useFilters(): Filters {
  const [filters, setFilters] = useState(store.filters);
  useEffect(() => store.subscribe(() => setFilters(store.filters)), []);
  return filters;
}

function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = useFilters();

  useEffect(() => {
    Promise.all([loadData('events.json'), loadData('undated.json')])
      .then(([file, undated]) => {
        const byId = new Map<number, { dated: boolean; index: number }>();
        file.events.forEach((e, i) => byId.set(e.id, { dated: true, index: i }));
        undated.events.forEach((e, i) => byId.set(e.id, { dated: false, index: i }));
        const ds: Dataset = { file, undated, events: prepareEvents(file), byId };
        setDataset(ds);
        if (!openFromHash(ds, false) && import.meta.env.DEV) {
          const place = ds.byId.get(Number(new URLSearchParams(location.search).get('sel')));
          if (place?.dated) store.select({ kind: 'event', index: place.index });
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    return attachKeyboard(window, store);
  }, []);

  useEffect(() => {
    if (!dataset) return;
    // El índice de búsqueda se construye cuando el navegador queda libre, tras la primera pintura.
    const build = () =>
      setIndex(new SearchIndex(dataset.file.events, dataset.undated.events, dataset.file.sections));
    const idle =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(build, { timeout: 2000 })
        : window.setTimeout(build, 200);

    let saveTimer = 0;
    let lastSelection = store.selection;
    const persist = () => save({ view: store.view, filters: store.filters });
    const unsubscribe = store.subscribe(() => {
      if (store.selection !== lastSelection) {
        lastSelection = store.selection;
        syncHash(dataset);
      }
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(persist, 300);
    });
    const onHash = () => {
      if (!openFromHash(dataset, true) && parseEventHash(location.hash) === null)
        store.select(null);
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('pagehide', persist);
    syncHash(dataset);
    return () => {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
      window.clearTimeout(idle);
      window.clearTimeout(saveTimer);
      unsubscribe();
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('pagehide', persist);
    };
  }, [dataset]);

  const visible = useMemo(
    () => (dataset ? countVisible(compileFilter(filters, dataset.events), dataset.events) : 0),
    [filters, dataset],
  );

  // Solo en desarrollo: acceso desde la consola (window.__app) y medición con ?bench=1.
  const onRenderer = useMemo(
    () =>
      import.meta.env.DEV
        ? (renderer: TimelineRenderer) => {
            (window as unknown as { __app: unknown }).__app = { store, renderer };
            if (dev.bench) {
              void import('./timeline/bench').then(({ runBench }) => runBench(store, renderer));
            }
          }
        : undefined,
    [],
  );

  const active = !isDefaultFilters(filters);

  return (
    <div class="app">
      <Header store={store}>
        {dataset && (
          <>
            <SearchBox
              store={store}
              index={index}
              file={dataset.file}
              undated={dataset.undated}
              data={dataset.events}
            />
            <button
              type="button"
              class={active ? 'filters-button active' : 'filters-button'}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              Filtros{active ? ` · ${formatNumber(visible, 0)}` : ''}
            </button>
          </>
        )}
      </Header>
      {error && <p class="message">Error: {error}</p>}
      {!error && !dataset && <p class="message">Cargando eventos…</p>}
      {dataset && (
        <div class="main">
          {filtersOpen && (
            <FiltersPanel
              store={store}
              file={dataset.file}
              visible={visible}
              total={dataset.events.count}
              onClose={() => setFiltersOpen(false)}
            />
          )}
          <TimelineView
            store={store}
            events={dataset.events}
            macros={dataset.file.macros}
            onRenderer={onRenderer}
          />
          <EventPanel
            store={store}
            file={dataset.file}
            undated={dataset.undated}
            data={dataset.events}
          />
        </div>
      )}
    </div>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}
