import './SaveState.css';

export type SaveState = 'saved' | 'saving' | 'error';

const SAVE_TEXT: Record<SaveState, string> = { saved: 'Guardado', saving: 'Guardando…', error: 'No se pudo guardar' };

/** «Guardado» / «Guardando…» con un punto de color; si falla, también el botón «Reintentar». */
export function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => unknown }) {
  return (
    <>
      <span className={`save-state ${state}`} role="status" aria-live="polite">
        <i aria-hidden="true" /> {SAVE_TEXT[state]}
      </span>
      {state === 'error' && (
        <button className="btn retry" onClick={() => void onRetry()}>
          Reintentar
        </button>
      )}
    </>
  );
}
