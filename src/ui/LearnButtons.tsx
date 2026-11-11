import { useRef, useState } from 'preact/hooks';
import type { DataFile } from '../data/types';
import { randomEvent } from '../features/random';
import { compileFilter } from '../state/filters';
import type { Store } from '../state/store';
import { viewForEvent } from '../timeline/focus';
import type { PreparedEvents } from '../timeline/prepare';
import { fullView } from '../timeline/scale';
import { Quiz } from './Quiz';

interface Props {
  store: Store;
  file: DataFile;
  data: PreparedEvents;
}

/** Botones de «Aprender jugando» en la cabecera: Sorpréndeme (F12) y Quiz (F13). */
export function LearnButtons({ store, file, data }: Props) {
  const [quizOpen, setQuizOpen] = useState(false);
  const quizButton = useRef<HTMLButtonElement>(null);

  const surprise = () => {
    const filter = compileFilter(store.filters, data);
    const current = store.selection?.kind === 'event' ? store.selection.index : -1;
    const i = randomEvent(data.count, filter, Math.random, current);
    if (i < 0) return;
    store.select({ kind: 'event', index: i });
    // Zoom con contexto alrededor del evento (no el zoom actual, que puede ser de meses o de Ma).
    store.travelTo(
      viewForEvent(
        data.start[i] as number,
        data.end[i] as number,
        data.point[i] === 1,
        fullView(store.view.mode),
      ),
    );
  };

  const closeQuiz = () => {
    setQuizOpen(false);
    quizButton.current?.focus();
  };

  return (
    <>
      <button type="button" class="filters-button learn-button" onClick={surprise}>
        Sorpréndeme
      </button>
      <button
        type="button"
        class="filters-button learn-button"
        ref={quizButton}
        aria-haspopup="dialog"
        onClick={() => setQuizOpen(true)}
      >
        Quiz
      </button>
      {quizOpen && <Quiz store={store} file={file} data={data} onClose={closeQuiz} />}
    </>
  );
}
