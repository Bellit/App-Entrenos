import { useEffect, useId, useRef } from 'react';
import './Dialog.css';

/** Diálogo modal nativo (<dialog>): Esc y el botón ✕ lo cierran. */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId(); // un id por diálogo: hay varios en la página
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`dialog${wide ? ' wide' : ''}`} onClose={onClose} aria-labelledby={titleId}>
      <header>
        <h2 id={titleId}>{title}</h2>
        <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </header>
      {children}
    </dialog>
  );
}
