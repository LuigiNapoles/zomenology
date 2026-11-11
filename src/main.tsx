import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { loadData } from './data/load';
import { Store } from './state/store';
import { attachKeyboard } from './timeline/interaction';
import type { DataFile } from './data/types';
import { prepareEvents, type PreparedEvents } from './timeline/prepare';
import type { TimelineRenderer } from './timeline/renderer';
import { fullView, viewAround, type ScaleMode, type View } from './timeline/scale';
import { EventPanel } from './ui/EventPanel';
import { Header } from './ui/Header';
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
const store = new Store(dev.view ?? fullView('log'));

function App() {
  const [dataset, setDataset] = useState<{ file: DataFile; events: PreparedEvents } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData('events.json')
      .then((file) => {
        setDataset({ file, events: prepareEvents(file) });
        if (import.meta.env.DEV) {
          const id = Number(new URLSearchParams(location.search).get('sel'));
          const index = file.events.findIndex((e) => e.id === id);
          if (index >= 0) store.select({ kind: 'event', index });
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    return attachKeyboard(window, store);
  }, []);

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

  return (
    <div class="app">
      <Header store={store} />
      {error && <p class="message">Error: {error}</p>}
      {!error && !dataset && <p class="message">Cargando eventos…</p>}
      {dataset && (
        <div class="main">
          <TimelineView
            store={store}
            events={dataset.events}
            macros={dataset.file.macros}
            onRenderer={onRenderer}
          />
          <EventPanel store={store} file={dataset.file} data={dataset.events} />
        </div>
      )}
    </div>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}
