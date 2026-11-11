import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Store } from '../state/store';
import { THEMES, type ThemeMode } from '../themes/theme';
import { IconMenu, IconMoon, IconSearch, IconSidebar, IconSun } from './icons';

interface Props {
  store: Store;
  /** Buscador. */
  search: ComponentChildren;
  /** Botones de acción: Filtros, Sorpréndeme, Quiz. */
  actions: ComponentChildren;
}

function useSidebarState(store: Store) {
  const [state, setState] = useState({ theme: store.theme, collapsed: store.sidebarCollapsed });
  useEffect(
    () =>
      store.subscribe(() => setState({ theme: store.theme, collapsed: store.sidebarCollapsed })),
    [store],
  );
  return state;
}

const MODES: { mode: ThemeMode; Icon: typeof IconSun }[] = [
  { mode: 'light', Icon: IconSun },
  { mode: 'dark', Icon: IconMoon },
];

/**
 * Barra lateral (como la de Claude): título, buscador, acciones y modo claro/oscuro.
 * En escritorio se pliega a una columna de iconos; en móvil es una barra superior con menú.
 */
export function Sidebar({ store, search, actions }: Props) {
  const { theme, collapsed } = useSidebarState(store);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // En móvil, el menú se cierra al elegir una acción, al pulsar Esc o al tocar fuera.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMenuOpen(false);
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !(target as Element).closest?.('.menu-toggle'))
        setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [menuOpen]);

  /** Con la barra plegada, el icono de búsqueda la despliega y lleva al buscador. */
  const openSearch = () => {
    store.setSidebarCollapsed(false);
    setTimeout(() => document.querySelector<HTMLInputElement>('.search-input')?.focus(), 0);
  };

  return (
    <aside class="sidebar" aria-label="Herramientas">
      <div class="sidebar-top">
        <button
          type="button"
          class="icon-button menu-toggle"
          aria-label="Menú"
          aria-expanded={menuOpen}
          aria-controls="sidebar-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <IconMenu />
        </button>
        <div class="brand">
          <div class="brand-text">
            <h1 class="title">Zomenology</h1>
            <p class="subtitle">la cronología interactiva</p>
          </div>
        </div>
        <button
          type="button"
          class="icon-button sidebar-toggle"
          aria-label={collapsed ? 'Desplegar la barra lateral' : 'Plegar la barra lateral'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Desplegar la barra lateral' : 'Plegar la barra lateral'}
          onClick={() => store.setSidebarCollapsed(!collapsed)}
        >
          <IconSidebar />
        </button>
      </div>

      <div class="sidebar-search">{search}</div>
      <button
        type="button"
        class="nav-item search-shortcut"
        title="Buscar (/)"
        onClick={openSearch}
      >
        <IconSearch />
        <span class="nav-label">Buscar</span>
      </button>

      <div
        id="sidebar-menu"
        ref={menuRef}
        class={menuOpen ? 'sidebar-menu open' : 'sidebar-menu'}
        onClick={(e) => {
          if ((e.target as Element).closest('.nav-item')) setMenuOpen(false);
        }}
      >
        <nav class="sidebar-nav" aria-label="Acciones">
          {actions}
        </nav>
        <div class="theme-toggle" role="group" aria-label="Modo">
          {MODES.map(({ mode, Icon }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={theme === mode}
              title={`Modo ${THEMES[mode].name.toLowerCase()}`}
              onClick={() => store.setTheme(mode)}
            >
              <Icon size={18} />
              <span class="nav-label">{THEMES[mode].name}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
