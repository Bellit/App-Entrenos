import { useEffect, useState } from 'react';
import { routeHref } from '../../app/useRoute';
import { getSession } from '../../data/db';
import * as S from '../../model/session';
import { IconPrev } from '../../ui/Icons';
import '../../ui/Page.css';

/**
 * Pantalla de una sesión. Por ahora solo la muestra (cabecera y bloques);
 * el editor (cabecera, añadir bloques desde la biblioteca, minutos…) llega en la tarea 2.4.
 */
export function SessionScreen({ id }: { id: string }) {
  const [s, setS] = useState<S.Session | null | undefined>(undefined);
  useEffect(() => {
    getSession(id)
      .then(setS)
      .catch(() => setS(null));
  }, [id]);

  if (s === undefined)
    return (
      <div className="page">
        <main className="page-main">
          <p className="muted">Abriendo la sesión…</p>
        </main>
      </div>
    );
  const d = s ? S.dateParts(s.date) : null;

  return (
    <div className="page">
      <header className="page-head">
        <a className="btn ghost" href={routeHref.sessions}>
          <IconPrev /> Sesiones
        </a>
      </header>
      <main className="page-main">
        {!s ? (
          <section className="empty" role="alert">
            <h2>No encuentro esta sesión</h2>
            <p className="muted">Puede que se haya eliminado o que se guardara en otro dispositivo.</p>
          </section>
        ) : (
          <>
            <div className="page-title">
              <h1>{s.title}</h1>
              {d && <p className="muted">{d.long}</p>}
            </div>
            <p className="notice">El editor de sesiones (fecha, hora, equipo, objetivo y añadir ejercicios) llega en la próxima tarea.</p>
          </>
        )}
      </main>
    </div>
  );
}
