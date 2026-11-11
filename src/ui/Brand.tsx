/** Marca de la app: un balón y el nombre. El mismo dibujo que `public/favicon.svg`, sin el fondo. */
export function BallMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="ball-mark">
      <circle cx="16" cy="16" r="14" fill="var(--accent)" />
      <g fill="none" stroke="#7c2d12" strokeWidth="1.5" strokeLinecap="round">
        <path d="M16 2v28M2 16h28" />
        <path d="M6.2 6.6c4.3 4.6 4.3 14.2 0 18.8M25.8 6.6c-4.3 4.6-4.3 14.2 0 18.8" />
      </g>
    </svg>
  );
}

export function Brand() {
  return (
    <a className="brand" href="#/" aria-label="Entrenos, ir a la biblioteca">
      <BallMark />
      <span className="brand-name">Entrenos</span>
    </a>
  );
}
