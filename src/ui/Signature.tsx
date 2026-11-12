import './Signature.css';

/**
 * Firma del autor: el monograma «DB» en píxeles y «Crafted by DBellido», igual que en su web.
 * Lleva sus propios colores (los de la marca DBellido), no los de la app.
 */
export function Signature({ small = false }: { small?: boolean }) {
  return (
    <p className={`signature${small ? ' small' : ''}`}>
      <svg viewBox="-1 -3 13 13" shape-rendering="crispEdges" aria-hidden="true">
        <path className="px-d" d="M0 0h4v1h-4z M0 1h1v5h-1z M4 1h1v5h-1z M0 6h4v1h-4z" />
        <path className="px-b" d="M6 0h4v1h-4z M6 1h1v5h-1z M10 1h1v2h-1z M7 3h3v1h-3z M10 4h1v2h-1z M7 6h3v1h-3z" />
      </svg>
      <span>
        Crafted by <b>DBellido</b>
      </span>
    </p>
  );
}
