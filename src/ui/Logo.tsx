/**
 * Logo de Zomenology: una «Z» cuya diagonal es una línea del tiempo, con el punto del centro
 * (el mismo dibujo que public/favicon.svg). Decorativo: el nombre va en el título al lado.
 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg
      class="logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="#B05730" />
      <path
        d="M9.5 9.5h13L9.5 22.5h13"
        fill="none"
        stroke="#FAF9F5"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="16" cy="16" r="3.2" fill="#B05730" stroke="#FAF9F5" stroke-width="2" />
    </svg>
  );
}
