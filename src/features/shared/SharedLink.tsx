import { useEffect, useState } from 'react';
import { navigate, routeHref } from '../../app/useRoute';
import type { Shared } from '../../model/share';
import { fetchLink, saveShared } from '../../sync/shares';
import { Brand } from '../../ui/Brand';
import '../../ui/Page.css';
import { SharedPreview } from './SharedPreview';

/**
 * Lo que se ve al abrir un enlace compartido (#/c/<código>): la vista previa y «Guardar».
 * No hace falta cuenta. Al guardar, se crean copias propias y se abre lo guardado.
 */
export function SharedLink({ id }: { id: string }) {
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [shared, setShared] = useState<(Shared & { title: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLink(id)
      .then((s) => {
        setShared(s);
        setState(s ? 'ready' : 'missing');
      })
      .catch(() => setState('error'));
  }, [id]);

  const save = async () => {
    if (!shared) return;
    setSaving(true);
    try {
      navigate(await saveShared(shared));
    } catch {
      setState('error');
      setSaving(false);
    }
  };

  const what = shared?.kind === 'session' ? 'sesión' : 'ejercicio';
  return (
    <div className="page">
      <header className="page-head">
        <Brand />
      </header>
      <main className="page-main shared-page">
        {state === 'loading' && <p className="muted">Abriendo lo compartido…</p>}
        {state === 'missing' && (
          <section className="empty">
            <h2>Este enlace ya no existe</h2>
            <p className="muted">Puede que quien lo compartió lo haya borrado.</p>
            <a className="btn primary big" href={routeHref.sessions}>
              Ir a Run it
            </a>
          </section>
        )}
        {state === 'error' && (
          <section className="empty" role="alert">
            <h2>No se ha podido abrir</h2>
            <p className="muted">Comprueba que tienes conexión a internet y vuelve a intentarlo.</p>
            <button className="btn primary big" onClick={() => location.reload()}>
              Reintentar
            </button>
          </section>
        )}
        {state === 'ready' && shared && (
          <>
            <p className="shared-from">Te han compartido {shared.kind === 'session' ? 'una sesión' : 'un ejercicio'} de Run it.</p>
            <div className="shared-actions">
              <button className="btn primary big" onClick={save} disabled={saving}>
                {saving ? 'Guardando…' : `Guardar en mis ${shared.kind === 'session' ? 'sesiones' : 'ejercicios'}`}
              </button>
              <a className="btn big" href={routeHref.sessions}>
                Ahora no
              </a>
            </div>
            <SharedPreview shared={shared} />
            <p className="muted small">Se guardará una copia en este dispositivo (y en tu cuenta, si tienes). Es tuya: puedes cambiar {what === 'sesión' ? 'la sesión' : 'el ejercicio'} sin afectar al original.</p>
          </>
        )}
      </main>
    </div>
  );
}
