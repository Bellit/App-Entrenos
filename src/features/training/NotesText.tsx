import { parseNotes } from '../../model/trainer';

/** La explicación del ejercicio, grande y legible: etiquetas en negrita y listas con viñetas. */
export function NotesText({ text }: { text: string }) {
  const parts = parseNotes(text);
  if (!parts.length) return null;
  return (
    <div className="notes-text">
      {parts.map((p, i) =>
        p.kind === 'ul' ? (
          <ul key={i}>
            {p.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {p.label && <strong>{p.label}</strong>}
            {p.label && p.text ? ' ' : ''}
            {p.text}
          </p>
        ),
      )}
    </div>
  );
}
