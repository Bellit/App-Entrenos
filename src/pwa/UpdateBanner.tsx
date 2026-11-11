import { applyUpdate, usePwa } from './pwa';
import './UpdateBanner.css';

/** Aviso arriba cuando hay una versión nueva instalada y esperando. No se aplica sola: lo decide la persona. */
export function UpdateBanner() {
  const { updateReady } = usePwa();
  if (!updateReady) return null;
  return (
    <div className="update-banner" role="status">
      <span>Hay una versión nueva de Entrenos.</span>
      <button className="btn primary" onClick={applyUpdate}>
        Actualizar
      </button>
    </div>
  );
}
