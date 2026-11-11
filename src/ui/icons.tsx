/** Iconos de trazo (20 px), decorativos: el texto o aria-label del botón dice lo que hacen. */

interface Props {
  size?: number;
}

function Svg({ size = 20, children }: Props & { children: preact.ComponentChildren }) {
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconSidebar = (p: Props) => (
  <Svg {...p}>
    <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
    <path d="M7.5 3.5v13" />
  </Svg>
);

export const IconMenu = (p: Props) => (
  <Svg {...p}>
    <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
  </Svg>
);

export const IconSearch = (p: Props) => (
  <Svg {...p}>
    <circle cx="8.75" cy="8.75" r="5.25" />
    <path d="m12.75 12.75 3.75 3.75" />
  </Svg>
);

export const IconFilter = (p: Props) => (
  <Svg {...p}>
    <path d="M3 5h14M5.5 10h9M8 15h4" />
  </Svg>
);

export const IconDice = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="3" width="14" height="14" rx="3" />
    <circle cx="7" cy="7" r="0.6" fill="currentColor" />
    <circle cx="13" cy="13" r="0.6" fill="currentColor" />
    <circle cx="10" cy="10" r="0.6" fill="currentColor" />
    <circle cx="13" cy="7" r="0.6" fill="currentColor" />
    <circle cx="7" cy="13" r="0.6" fill="currentColor" />
  </Svg>
);

export const IconQuiz = (p: Props) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M8 8a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5" />
    <circle cx="10" cy="14" r="0.5" fill="currentColor" />
  </Svg>
);

export const IconSun = (p: Props) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="3.25" />
    <path d="M10 2.5v1.75M10 15.75v1.75M2.5 10h1.75M15.75 10h1.75M4.7 4.7l1.25 1.25M14.05 14.05l1.25 1.25M4.7 15.3l1.25-1.25M14.05 5.95l1.25-1.25" />
  </Svg>
);

export const IconMoon = (p: Props) => (
  <Svg {...p}>
    <path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2Z" />
  </Svg>
);

export const IconMinus = (p: Props) => (
  <Svg {...p}>
    <path d="M5 10h10" />
  </Svg>
);

export const IconPlus = (p: Props) => (
  <Svg {...p}>
    <path d="M10 5v10M5 10h10" />
  </Svg>
);
