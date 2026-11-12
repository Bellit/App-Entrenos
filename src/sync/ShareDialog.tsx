import { useEffect, useState } from 'react';
import { routeHref } from '../app/useRoute';
import { isEmail, type SharePayload } from '../model/share';
import { Dialog } from '../ui/Dialog';
import { AccountDialog } from './AccountDialog';
import { createLink, shareUrl, shareWith } from './shares';
import { useSync } from './sync';
import './Sync.css';

/**
 * Compartir un ejercicio o una sesión: por enlace (para WhatsApp) o con la cuenta de otro
 * entrenador (por su correo). `build` prepara la copia que se comparte justo al pulsar.
 */
export function ShareDialog({ open, onClose, what, build }: { open: boolean; onClose: () => void; what: string; build: () => Promise<SharePayload> }) {
  const sync = useSync();
  const [account, setAccount] = useState(false);
  const [link, setLink] = useState('');
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState<'' | 'link' | 'send'>('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // al abrir de nuevo, se empieza de cero
  useEffect(() => {
    if (!open) return;
    setLink('');
    setSentTo('');
    setError('');
    setCopied(false);
  }, [open]);

  const makeLink = async () => {
    setBusy('link');
    setError('');
    try {
      setLink(shareUrl(await createLink(await build())));
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setBusy('');
    }
  };
  const send = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const to = email.trim().toLowerCase();
    if (to === sync.email) return setError('Ese es tu propio correo.');
    setBusy('send');
    setError('');
    try {
      await shareWith(to, await build());
      setSentTo(to);
      setEmail('');
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setBusy('');
    }
  };
  const text = `${what} en Run it: ${link}`;
  const nativeShare = typeof navigator.share === 'function';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError('No se ha podido copiar. Mantén pulsado el enlace para copiarlo.');
    }
  };

  return (
    <>
      <Dialog open={open && !account} onClose={onClose} title={`Compartir ${what.toLowerCase()}`}>
        <div className="account share">
          {!sync.email ? (
            <>
              <p>Para compartir necesitas entrar con tu cuenta (la misma con la que sincronizas). Quien lo reciba por enlace no necesita cuenta.</p>
              <div className="account-actions">
                <button className="btn primary" onClick={() => setAccount(true)}>
                  Entrar con mi cuenta
                </button>
              </div>
            </>
          ) : (
            <>
              <section className="share-part">
                <h3>Por enlace</h3>
                <p className="muted small">Cualquiera que tenga el enlace podrá verlo y guardarse una copia, sin cuenta. Es una copia de cómo está ahora: tus cambios posteriores no le llegan.</p>
                {!link ? (
                  <button className="btn primary" onClick={makeLink} disabled={!!busy}>
                    {busy === 'link' ? 'Creando…' : 'Crear enlace'}
                  </button>
                ) : (
                  <>
                    <input className="share-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace para compartir" />
                    <div className="account-actions">
                      {nativeShare ? (
                        <button className="btn primary" onClick={() => void navigator.share({ title: `Run it · ${what}`, text: `${what} en Run it:`, url: link }).catch(() => {})}>
                          Compartir…
                        </button>
                      ) : null}
                      <a className={`btn${nativeShare ? '' : ' primary'}`} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                      <button className="btn" onClick={copy}>
                        {copied ? 'Copiado ✓' : 'Copiar'}
                      </button>
                    </div>
                  </>
                )}
              </section>

              <section className="share-part">
                <h3>Con un entrenador</h3>
                <p className="muted small">Lo verá en «Compartido conmigo» cuando entre en Run it con ese correo.</p>
                <form className="share-send" onSubmit={send}>
                  <input type="email" required inputMode="email" autoComplete="email" placeholder="correo@del-entrenador.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Correo del entrenador" />
                  <button className="btn primary" type="submit" disabled={!!busy || !isEmail(email)}>
                    {busy === 'send' ? 'Enviando…' : 'Enviar'}
                  </button>
                </form>
                {sentTo && <p className="share-ok">Enviado a {sentTo}.</p>}
              </section>

              {error && <p className="account-error">{error}</p>}
              <p className="muted small">
                <a href={routeHref.inbox} onClick={onClose}>
                  Ver lo que he compartido
                </a>{' '}
                (y borrar enlaces).
              </p>
            </>
          )}
        </div>
      </Dialog>
      <AccountDialog open={account} onClose={() => setAccount(false)} />
    </>
  );
}

function mensaje(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/could not find the table|does not exist|relation/i.test(m)) return 'Falta preparar Supabase para compartir (hay que ejecutar supabase/shares.sql).';
  if (/fetch|network/i.test(m)) return 'No hay conexión. Inténtalo cuando tengas internet.';
  if (/size|too large|check constraint/i.test(m)) return 'Es demasiado grande para compartirlo.';
  return 'No se ha podido compartir. Inténtalo de nuevo.';
}
