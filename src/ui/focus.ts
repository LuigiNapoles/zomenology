const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Foco atrapado: con Tab y Mayús+Tab el foco da la vuelta dentro de `container`
 * en lugar de salir de él (ficha del evento y quiz).
 */
export function trapTab(e: KeyboardEvent, container: HTMLElement | null): void {
  if (e.key !== 'Tab' || !container) return;
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  const inside = items.includes(active as HTMLElement);
  if (e.shiftKey && (active === first || !inside)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !inside)) {
    e.preventDefault();
    first.focus();
  }
}

/** Lleva el foco al primer evento de la lista accesible del eje (enlace «Saltar a los eventos»). */
export function focusTimeline(): void {
  document.querySelector<HTMLElement>('.a11y-target')?.focus();
}
