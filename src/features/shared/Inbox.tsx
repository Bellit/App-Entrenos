import { useCallback, useEffect, useState } from 'react';
import { navigate, routeHref } from '../../app/useRoute';
import { AccountDialog } from '../../sync/AccountDialog';
import { deleteShare, dismissShare, type InboxItem, listInbox, listSent, saveShared, type SentItem, shareUrl } from '../../sync/shares';
import { currentUserId, refreshInbox, useSync } from '../../sync/sync';
import { IconPrev } from '../../ui/Icons';
import '../../ui/Page.css';
import { SharedPreview } from './SharedPreview';

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const tipo = (k: string) => (k === 'session' ? 'Sesión' : 'Ejercicio');

/**
 * «Compartido conmigo» (lo que otros entrenadores me han enviado a mi correo) y «Lo que he
 * compartido» (mis enlaces y envíos, para copiarlos de nuevo o borrarlos).
 */
export function Inbox() {
  const sync = useSync();
  const [inbox, setInbox] = useState<InboxItem[] | null>(null);
  const [sent, setSent] = useState<SentItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [account, setAccount] = useState(false);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const uid = currentUserId();
    if (!sync.email || !uid) return;
    try {
      const [a, b] = await Promise.all([listInbox(sync.email), listSent(uid)]);
      setInbox(a);
      setSent(b);
      setError('');
    } catch {
      setError('No se ha podido leer lo compartido. Comprueba la conexión (y que Supabase tiene la tabla de compartidos).');
    }
  }, [sync.email]);
  useEffect(() => {
    void load();
  }, [load]);

  const act = (id: string, fn: () => Promise<unknown>) => async () => {
    setBusy(id);
    try {
      await fn();
      await load();
      void refreshInbox();
    } catch {
      setError('No se ha podido hacer. Inténtalo de nuevo.');
    } finally {
      setBusy('');
    }
  };

  const save = (it: InboxItem) =>
    act(it.id, async () => {
      if (!it.shared) return;
      const to = await saveShared(it.shared);
      await dismissShare(it.id);
      navigate(to);
    });

  return (
    <div className="page">
      <header className="page-head">
        <a className="btn ghost" href={routeHref.sessions}>
          <IconPrev /> Volver
        </a>
      </header>
      <main className="page-main">
        <div className="page-title">
          <h1>Compartidos</h1>
        </div>

        {!sync.email ? (
          <section className="empty">
            <h2>Entra con tu cuenta</h2>
            <p className="muted">Lo que otros entrenadores comparten con tu correo aparece aquí cuando entras con tu cuenta.</p>
            <button className="btn primary big" onClick={() => setAccount(true)}>
              Entrar
            </button>
          </section>
        ) : (
          <>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}

            <section className="inbox-section" aria-label="Compartido conmigo">
              <h2>Compartido conmigo</h2>
              {inbox === null && <p className="muted">Cargando…</p>}
              {inbox?.length === 0 && <p className="muted">Nada nuevo. Cuando otro entrenador comparta algo con {sync.email}, aparecerá aquí.</p>}
              <ul className="inbox-list">
                {inbox?.map((it) => (
                  <li key={it.id} className="inbox-item">
                    <header>
                      <span className="inbox-kind">{tipo(it.kind)}</span>
                      <h3>{it.title || 'Sin título'}</h3>
                      <span className="inbox-meta">
                        de {it.from} · {fecha(it.createdAt)}
                      </span>
                    </header>
                    <div className="inbox-actions">
                      <button className="btn primary" onClick={save(it)} disabled={!!busy || !it.shared}>
                        {busy === it.id ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button className="btn" onClick={() => setOpen(open === it.id ? null : it.id)} aria-expanded={open === it.id}>
                        {open === it.id ? 'Ocultar' : 'Ver'}
                      </button>
                      <button className="btn ghost" onClick={act(it.id, () => dismissShare(it.id))} disabled={!!busy}>
                        Descartar
                      </button>
                    </div>
                    {!it.shared && <p className="account-error">No se puede leer (está dañado).</p>}
                    {open === it.id && it.shared && (
                      <div className="inbox-preview">
                        <SharedPreview shared={it.shared} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="inbox-section" aria-label="Lo que he compartido">
              <h2>Lo que he compartido</h2>
              {sent === null && <p className="muted">Cargando…</p>}
              {sent?.length === 0 && <p className="muted">Todavía no has compartido nada. Usa «Compartir» en el menú «⋯» de un ejercicio o una sesión.</p>}
              <ul className="inbox-list">
                {sent?.map((it) => (
                  <li key={it.id} className="inbox-item">
                    <header>
                      <span className="inbox-kind">{tipo(it.kind)}</span>
                      <h3>{it.title || 'Sin título'}</h3>
                      <span className="inbox-meta">
                        {it.to ? `con ${it.to}${it.seen ? ' · ya lo ha visto' : ''}` : 'por enlace'} · {fecha(it.createdAt)}
                      </span>
                    </header>
                    <div className="inbox-actions">
                      {!it.to && (
                        <button
                          className="btn"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(shareUrl(it.id))
                              .then(() => setCopied(it.id))
                              .catch(() => {})
                          }
                        >
                          {copied === it.id ? 'Copiado ✓' : 'Copiar enlace'}
                        </button>
                      )}
                      <button className="btn ghost" onClick={act(it.id, () => deleteShare(it.id))} disabled={!!busy}>
                        {it.to ? 'Retirar' : 'Borrar enlace'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
      <AccountDialog open={account} onClose={() => setAccount(false)} />
    </div>
  );
}
