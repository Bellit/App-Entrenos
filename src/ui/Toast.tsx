import { useStore } from '../store';
import './Toast.css';

/** Aviso breve abajo de la pantalla (`notify` del almacén). */
export function Toast() {
  const toast = useStore((s) => s.toast);
  return (
    <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
      {toast}
    </div>
  );
}
