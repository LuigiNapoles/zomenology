import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { loadData } from './data/load';
import { Store } from './state/store';
import { attachKeyboard } from './timeline/interaction';
import { prepareEvents, type PreparedEvents, type TimelineRenderer } from './timeline/renderer';
import { fullView, viewAround, type ScaleMode, type View } from './timeline/scale';
import { Header } from './ui/Header';
import { TimelineView } from './ui/TimelineView';
import './ui/app.css';

/** Solo en desarrollo: ?c=1851.5&y=0.5&m=lin fija la vista inicial y ?bench=1 mide el pintado. */
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
  const [events, setEvents] = useState<PreparedEvents | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData('events.json')
      .then((data) => setEvents(prepareEvents(data.events)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    return attachKeyboard(window, store);
  }, []);

  const onRenderer = useMemo(
    () =>
      import.meta.env.DEV && dev.bench
        ? (renderer: TimelineRenderer) => {
            void import('./timeline/bench').then(({ runBench }) => runBench(store, renderer));
          }
        : undefined,
    [],
  );

  return (
    <div class="app">
      <Header store={store} />
      {error && <p class="message">Error: {error}</p>}
      {!error && !events && <p class="message">Cargando eventos…</p>}
      {events && <TimelineView store={store} events={events} onRenderer={onRenderer} />}
    </div>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}
