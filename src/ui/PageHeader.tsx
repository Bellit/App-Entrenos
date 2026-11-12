import type { ReactNode } from 'react';
import { routeHref } from '../app/useRoute';
import { InboxButton, SyncButton } from '../sync/SyncButton';
import { Brand } from './Brand';
import './Page.css';

/**
 * Cabecera de las páginas principales: la marca, las pestañas para cambiar entre Sesiones y
 * Ejercicios, y las acciones de la página (a la derecha). En móvil, las pestañas bajan a una fila propia.
 */
export function PageHeader({ current, actions }: { current: 'sessions' | 'library'; actions: ReactNode }) {
  return (
    <header className="page-head">
      <Brand />
      <nav className="tabs" aria-label="Secciones">
        <a href={routeHref.sessions} aria-current={current === 'sessions' ? 'page' : undefined}>
          Sesiones
        </a>
        <a href={routeHref.library} aria-current={current === 'library' ? 'page' : undefined}>
          Ejercicios
        </a>
      </nav>
      <InboxButton />
      <SyncButton />
      <div className="head-actions">{actions}</div>
    </header>
  );
}
