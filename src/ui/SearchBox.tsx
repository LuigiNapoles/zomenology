import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SearchHit, SearchIndex } from '../data/search';
import type { DataFile, TimelineEvent } from '../data/types';
import { formatOriginalDate } from '../format/dates';
import type { Store } from '../state/store';
import type { PreparedEvents } from '../timeline/prepare';
import { focusEvent } from './EventPanel';

interface Props {
  store: Store;
  /** null mientras se construye el índice (después de la primera pintura). */
  index: SearchIndex | null;
  file: DataFile;
  undated: DataFile;
  data: PreparedEvents;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Campo de búsqueda siempre visible; «/» lo enfoca. */
export function SearchBox({ store, index, file, undated, data }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hits: SearchHit[] = useMemo(() => (index ? index.search(query) : []), [index, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        const focus = () => {
          inputRef.current?.focus();
          inputRef.current?.select();
        };
        // Con la barra lateral plegada, el buscador está oculto: primero se despliega.
        if (store.sidebarCollapsed && window.matchMedia('(min-width: 768px)').matches) {
          store.setSidebarCollapsed(false);
          setTimeout(focus, 0);
        } else {
          focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setActive(0), [query]);

  const choose = (hit: SearchHit) => {
    if (hit.dated) focusEvent(store, data, hit.index);
    else store.select({ kind: 'undated', index: hit.index });
    // Sin blur: la ficha se lleva el foco a su título y, al cerrarla, vuelve al buscador.
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      const hit = hits[active];
      if (hit) {
        e.preventDefault();
        choose(hit);
      }
    } else if (e.key === 'Escape') {
      if (open && query) {
        e.stopPropagation();
        setOpen(false);
      } else {
        inputRef.current?.blur();
      }
    }
  };

  const showList = open && query.trim() !== '';
  const listId = 'search-results';

  return (
    <div class="search">
      <input
        ref={inputRef}
        type="search"
        class="search-input"
        placeholder="Buscar eventos ( / )"
        aria-label="Buscar eventos"
        role="combobox"
        list={undefined}
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && hits[active] ? `search-hit-${active}` : undefined}
        autocomplete="off"
        value={query}
        onInput={(e) => {
          setQuery(e.currentTarget.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} class="search-results" role="listbox">
          {!index && <li class="search-empty">Preparando el buscador…</li>}
          {index && hits.length === 0 && <li class="search-empty">Sin resultados</li>}
          {hits.map((hit, i) => {
            const e = (hit.dated ? data.events[hit.index] : undated.events[hit.index]) as
              TimelineEvent | undefined;
            if (!e) return null;
            return (
              <li
                key={hit.id}
                id={`search-hit-${i}`}
                role="option"
                aria-selected={i === active}
                class={i === active ? 'search-hit active' : 'search-hit'}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  choose(hit);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span class="search-desc">{e.d}</span>
                <span class="search-meta">
                  {hit.dated ? formatOriginalDate(e.f, e.e) : 'Sin fecha'} ·{' '}
                  {file.sections[e.s]?.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
