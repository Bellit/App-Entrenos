import { toggleFullscreen } from '../hooks/fullscreen';
import { IconCompress, IconExpand } from './Icons';

/** Botón de pantalla completa sobre la pista. */
export function PresentButton({ on }: { on: boolean }) {
  return (
    <button className="btn ghost icon present" onClick={toggleFullscreen} aria-label={on ? 'Salir de pantalla completa' : 'Pantalla completa'} title={on ? 'Salir de pantalla completa (F o Esc)' : 'Pantalla completa para enseñar el ejercicio (F)'}>
      {on ? <IconCompress /> : <IconExpand />}
    </button>
  );
}
