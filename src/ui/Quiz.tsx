import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { DataFile, TimelineEvent } from '../data/types';
import { formatNumber, formatOriginalDate } from '../format/dates';
import {
  EMPTY_SCORE,
  ORDER_SIZE,
  ROUND_SIZE,
  addAnswer,
  bucketLabel,
  isChronological,
  loadBest,
  makeRound,
  quizPool,
  recordScore,
  sortChronologically,
  type EraChoice,
  type Question,
  type QuizMode,
  type Score,
} from '../features/quiz';
import { compileFilter } from '../state/filters';
import type { Store } from '../state/store';
import { PERIODS, type PeriodId } from '../themes/periods';
import type { PreparedEvents } from '../timeline/prepare';

interface Props {
  store: Store;
  file: DataFile;
  data: PreparedEvents;
  onClose: () => void;
}

type Phase = 'setup' | 'play' | 'done';

const MODES: { mode: QuizMode; label: string; hint: string }[] = [
  { mode: 'order', label: 'Ordena', hint: 'Pon 4 eventos en orden cronológico.' },
  { mode: 'century', label: '¿Qué siglo?', hint: 'Elige el siglo (o milenio) de un evento.' },
];

const ERAS: { value: EraChoice; label: string }[] = [
  { value: 'all', label: 'Toda la historia' },
  // PERIODS solo contiene las 4 eras (los estilos neutros están aparte).
  ...PERIODS.map((p) => ({ value: p.id as PeriodId, label: p.name })),
];

const MODE_NAMES: Record<QuizMode, string> = { order: 'Ordena', century: '¿Qué siglo?' };

/** F13 Quiz cronológico, en una ventana superpuesta (pantalla completa en móvil). */
export function Quiz({ store, file, data, onClose }: Props) {
  const [mode, setMode] = useState<QuizMode>('order');
  const [era, setEra] = useState<EraChoice>('all');
  const [useFilters, setUseFilters] = useState(false);
  const [phase, setPhase] = useState<Phase>('setup');
  const [round, setRound] = useState<Question[]>([]);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState<Score>(EMPTY_SCORE);
  /** null mientras no se ha respondido; true / false según el acierto. */
  const [result, setResult] = useState<boolean | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [best, setBest] = useState(() => loadBest());
  const [record, setRecord] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const stopDrag = useRef<(() => void) | null>(null);

  const filter = useMemo(
    () => (useFilters ? compileFilter(store.filters, data) : null),
    [useFilters, store, data],
  );
  const pool = useMemo(() => quizPool(data, mode, era, filter), [data, mode, era, filter]);
  const question = round[step];

  // Foco: el título de cada pantalla o pregunta (se anuncia) y «Siguiente» tras responder.
  useEffect(() => titleRef.current?.focus(), [phase, step]);
  useEffect(() => {
    if (result !== null) nextRef.current?.focus();
  }, [result]);
  useEffect(() => () => stopDrag.current?.(), []);

  const show = (q: Question | undefined) => {
    setResult(null);
    setChoice(null);
    setOrder(q?.kind === 'order' ? q.items : []);
  };

  const start = () => {
    const r = makeRound(mode, pool, data);
    if (!r) {
      setError('No hay eventos suficientes para una ronda con estas opciones.');
      return;
    }
    setError(null);
    setRound(r);
    setStep(0);
    setScore(EMPTY_SCORE);
    setRecord(false);
    show(r[0]);
    setPhase('play');
  };

  const answer = (right: boolean) => {
    setResult(right);
    setScore(addAnswer(score, right));
  };

  const next = () => {
    if (step + 1 < round.length) {
      setStep(step + 1);
      show(round[step + 1]);
      return;
    }
    const saved = recordScore(mode, score.correct);
    setRecord(saved.record);
    setBest(loadBest());
    setPhase('done');
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const nextOrder = [...order];
    const [item] = nextOrder.splice(from, 1);
    if (item === undefined) return;
    nextOrder.splice(to, 0, item);
    setOrder(nextOrder);
  };

  /** Arrastrar una fila: su nuevo sitio es tras las demás filas cuyo centro queda por encima. */
  const startDrag = (ev: PointerEvent, item: number) => {
    if (result !== null || ev.button !== 0) return;
    if ((ev.target as HTMLElement).closest('button')) return;
    ev.preventDefault();
    setDragging(item);
    const onMove = (e: PointerEvent) => {
      const rows = Array.from(listRef.current?.children ?? []) as HTMLElement[];
      let target = 0;
      for (const row of rows) {
        if (row.dataset.item === String(item)) continue;
        const r = row.getBoundingClientRect();
        if (r.top + r.height / 2 < e.clientY) target++;
      }
      setOrder((current) => {
        const from = current.indexOf(item);
        if (from < 0 || from === target) return current;
        const nextOrder = current.filter((i) => i !== item);
        nextOrder.splice(target, 0, item);
        return nextOrder;
      });
    };
    const onUp = () => {
      setDragging(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      stopDrag.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    stopDrag.current = onUp;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // Las teclas no llegan al eje (flechas, + y −, «/») mientras el quiz está abierto.
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
  };

  const eventOf = (i: number) => data.events[i] as TimelineEvent;
  const date = (e: TimelineEvent) => formatOriginalDate(e.f, e.e);
  const enough = pool.length >= (mode === 'order' ? ROUND_SIZE * ORDER_SIZE : ROUND_SIZE);

  let body;
  if (phase === 'setup') {
    body = (
      <>
        <h2 id="quiz-title" class="quiz-title" tabIndex={-1} ref={titleRef}>
          Quiz cronológico
        </h2>
        <fieldset class="quiz-modes">
          <legend>Modo</legend>
          {MODES.map((m) => (
            <label key={m.mode} class="quiz-mode">
              <input
                type="radio"
                name="quiz-mode"
                checked={mode === m.mode}
                onChange={() => setMode(m.mode)}
              />
              <span>
                <strong>{m.label}</strong> · {m.hint}
                <span class="quiz-best">
                  Mejor puntuación: {best[m.mode]} de {ROUND_SIZE}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <label class="quiz-field">
          <span>Periodo</span>
          <select value={era} onChange={(e) => setEra(e.currentTarget.value as EraChoice)}>
            {ERAS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label class="check">
          <input type="checkbox" checked={useFilters} onChange={() => setUseFilters(!useFilters)} />
          Usar los filtros activos
        </label>
        <p class="panel-note">
          {formatNumber(pool.length, 0)} eventos con fecha exacta para este modo.
          {mode === 'century' &&
            ' Solo eventos desde el 10.000 a.C. que caben en un siglo o milenio.'}
        </p>
        {(error || !enough) && (
          <p class="filters-error">
            {error ?? 'No hay eventos suficientes para una ronda con estas opciones.'}
          </p>
        )}
        <div class="quiz-actions">
          <button type="button" class="quiz-primary" disabled={!enough} onClick={start}>
            Empezar
          </button>
        </div>
      </>
    );
  } else if (phase === 'done') {
    body = (
      <>
        <h2 id="quiz-title" class="quiz-title" tabIndex={-1} ref={titleRef}>
          Ronda terminada
        </h2>
        <p class="quiz-final">
          {score.correct} de {round.length}
        </p>
        <p>Mejor racha de la ronda: {score.bestStreak}</p>
        <p class={record ? 'quiz-record' : undefined}>
          {record
            ? `¡Nuevo récord en «${MODE_NAMES[mode]}»!`
            : `Tu mejor puntuación en «${MODE_NAMES[mode]}»: ${best[mode]} de ${ROUND_SIZE}.`}
        </p>
        <div class="quiz-actions">
          <button type="button" class="quiz-primary" onClick={start}>
            Otra ronda
          </button>
          <button type="button" onClick={() => setPhase('setup')}>
            Cambiar opciones
          </button>
          <button type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </>
    );
  } else if (question) {
    const status = (
      <p class="quiz-status">
        Pregunta {step + 1} de {round.length} · Aciertos: {score.correct} · Racha: {score.streak}
      </p>
    );
    const feedback =
      result === null ? null : (
        <p class={result ? 'quiz-feedback right' : 'quiz-feedback wrong'} role="status">
          {result ? '✓ ¡Correcto!' : '✗ No es correcto.'}
        </p>
      );
    const nextButton =
      result === null ? null : (
        <button type="button" class="quiz-primary" ref={nextRef} onClick={next}>
          {step + 1 < round.length ? 'Siguiente' : 'Ver resultado'}
        </button>
      );

    if (question.kind === 'order') {
      const sorted = sortChronologically(order, data);
      body = (
        <>
          {status}
          <h2 id="quiz-title" class="quiz-title" tabIndex={-1} ref={titleRef}>
            Ordena del más antiguo (arriba) al más reciente
          </h2>
          <p class="panel-note">
            Arrastra las filas o usa las flechas. Cuenta la fecha de comienzo.
          </p>
          <ol class="order-list" ref={listRef}>
            {order.map((i, k) => {
              const e = eventOf(i);
              const place = sorted.indexOf(i);
              const ok = place === k;
              return (
                <li
                  key={i}
                  data-item={i}
                  class={[
                    'order-item',
                    dragging === i ? 'dragging' : '',
                    result !== null ? (ok ? 'right' : 'wrong') : '',
                  ].join(' ')}
                  onPointerDown={(ev) => startDrag(ev, i)}
                >
                  <span class="order-handle" aria-hidden="true">
                    {result === null ? '⠿' : ok ? '✓' : '✗'}
                  </span>
                  <span class="order-text">
                    <span class="order-desc">{e.d}</span>
                    {result !== null && (
                      <span class="order-date">
                        {date(e)}
                        {!ok && ` · va en el puesto ${place + 1}`}
                      </span>
                    )}
                  </span>
                  {result === null && (
                    <span class="order-moves">
                      <button
                        type="button"
                        aria-label={`Subir: ${e.d}`}
                        disabled={k === 0}
                        onClick={() => move(k, k - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Bajar: ${e.d}`}
                        disabled={k === order.length - 1}
                        onClick={() => move(k, k + 1)}
                      >
                        ↓
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {feedback}
          <div class="quiz-actions">
            {result === null ? (
              <button
                type="button"
                class="quiz-primary"
                onClick={() => answer(isChronological(order, data))}
              >
                Comprobar
              </button>
            ) : (
              nextButton
            )}
          </div>
        </>
      );
    } else {
      const e = eventOf(question.event);
      const unit = question.options[0]?.unit === 'millennium' ? 'milenio' : 'siglo';
      body = (
        <>
          {status}
          <h2 id="quiz-title" class="quiz-title" tabIndex={-1} ref={titleRef}>
            ¿En qué {unit} {data.point[question.event] ? 'ocurrió' : 'fue'}?
          </h2>
          <p class="quiz-event">{e.d}</p>
          <div class="quiz-options">
            {question.options.map((b, k) => {
              const mark =
                result === null ? '' : k === question.answer ? ' ✓' : k === choice ? ' ✗' : '';
              const cls =
                result === null
                  ? ''
                  : k === question.answer
                    ? 'right'
                    : k === choice
                      ? 'wrong'
                      : '';
              return (
                <button
                  key={k}
                  type="button"
                  class={cls}
                  disabled={result !== null}
                  onClick={() => {
                    setChoice(k);
                    answer(k === question.answer);
                  }}
                >
                  {bucketLabel(b)}
                  {mark}
                </button>
              );
            })}
          </div>
          {feedback}
          {result !== null && (
            <p class="panel-note">
              Fecha: {date(e)} · {file.sections[e.s]?.label}
            </p>
          )}
          <div class="quiz-actions">{nextButton}</div>
        </>
      );
    }
  }

  return (
    <div
      class="quiz-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        class="quiz"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-title"
        onKeyDown={onKeyDown}
      >
        <div class="panel-bar">
          <span class="panel-spacer" />
          <button type="button" class="icon-button" aria-label="Cerrar el quiz" onClick={onClose}>
            ×
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
