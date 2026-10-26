// Small line icons for the admin. All decorative: the controls that use them carry their own text.

const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  'aria-hidden': true,
  focusable: false,
} as const;

/** The X emblem from the site's top bar. */
export function XMark({ className = 'adm-xmark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 5 L19 19 M19 5 L5 19 M12 2.5 V21.5" />
    </svg>
  );
}

export function ChevronUp() {
  return (
    <svg {...common}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

export function ChevronDown() {
  return (
    <svg {...common}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ChevronLeft() {
  return (
    <svg {...common}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronRight() {
  return (
    <svg {...common}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function Warning() {
  return (
    <svg {...common} className="adm-error-icon">
      <path d="M12 3.5 22 20.5H2z" strokeLinejoin="round" />
      <path d="M12 10v4.5M12 17v.5" strokeLinecap="round" />
    </svg>
  );
}

export function Upload() {
  return (
    <svg {...common} className="adm-drop-icon">
      <path d="M12 16V4M7 9l5-5 5 5M4 15v5h16v-5" />
    </svg>
  );
}
