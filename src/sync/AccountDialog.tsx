import { useState } from 'react';
import { routeHref } from '../app/useRoute';
import { Dialog } from '../ui/Dialog';
import { sendCode, signOut, syncNow, useSync, verifyCode } from './sync';
import './Sync.css';

const STATUS_TEXT = {
  off: 'Sin cuenta',
  idle: 'Sincronizado',
  syncing: 'Sincronizando…',
  offline: 'Sin conexión: se sincronizará al volver',
  error: 'No se ha podido sincronizar',
} as const;

const when = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');

/**
 * Cuenta y sincronización. Para entrar: el correo → llega un correo con un enlace (y, si Supabase
 * tiene un SMTP propio, un código de 6 cifras). Sin contraseñas. En el iPhone, con la app instalada, el
 * enlace abriría Safari en vez de la app: el código lo evitaría. PENDIENTE: solución para iPhone (ver plan).
 */
export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sync = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = (fn: () => Promise<void>) => async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? traducir(err.message) : 'Algo ha fallado. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const send = run(async () => {
    await sendCode(email.trim());
    setStep('code');
  });
  const verify = run(async () => {
    await verifyCode(email.trim(), code.trim());
    setCode('');
    setStep('email');
  });

  return (
    <Dialog open={open} onClose={onClose} title="Sincronizar entre dispositivos">
      <div className="account">
        {sync.email ? (
          <>
            <p>
              Has entrado como <strong>{sync.email}</strong>. Tus ejercicios y sesiones se guardan también en la nube y aparecen en todos los dispositivos donde entres con este correo.
            </p>
            <p className={`sync-state ${sync.status}`}>
              <i aria-hidden="true" /> {STATUS_TEXT[sync.status]}
              {sync.status === 'idle' && sync.lastSync ? ` · ${when(sync.lastSync)}` : ''}
            </p>
            {sync.status === 'error' && sync.error && <p className="account-error">{traducir(sync.error)}</p>}
            <div className="account-actions">
              <button className="btn primary" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
                Sincronizar ahora
              </button>
              <button className="btn" onClick={run(signOut)} disabled={busy}>
                Salir de la cuenta
              </button>
            </div>
            <p className="muted small">Al salir, lo que hay en este dispositivo se queda aquí.</p>
          </>
        ) : step === 'email' ? (
          <form onSubmit={send}>
            <p>Entra con tu correo para tener los mismos ejercicios y sesiones en el ordenador y en el móvil. Sin contraseña: te llega un enlace por correo.</p>
            <label className="field">
              <span>Correo</span>
              <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
            </label>
            {error && <p className="account-error">{error}</p>}
            <div className="account-actions">
              <button className="btn primary" type="submit" disabled={busy || !email.trim()}>
                {busy ? 'Enviando…' : 'Enviarme el enlace'}
              </button>
            </div>
            <p className="muted small">
              La primera vez, lo que ya tienes en este dispositivo se sube a tu cuenta. <a href={routeHref.privacy} onClick={onClose}>Privacidad</a>
            </p>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p>
              Te hemos enviado un correo a <strong>{email}</strong>. Ábrelo <strong>en este mismo dispositivo</strong> y pulsa el enlace «Sign in»: volverás a la app con la cuenta
              abierta.
            </p>
            <p className="muted small">Tiene que ser en el mismo dispositivo y navegador donde lo has pedido. ¿No llega? Mira en spam o vuelve a pedirlo en un minuto.</p>
            {/* si algún día el correo trae un código (con un SMTP propio en Supabase), se puede escribir aquí */}
            <details className="account-code">
              <summary>¿Tu correo trae un código de 6 cifras?</summary>
              <label className="field">
                <span>Código</span>
                <input className="code-input" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
              </label>
              <button className="btn primary" type="submit" disabled={busy || code.length < 6}>
                {busy ? 'Comprobando…' : 'Entrar con el código'}
              </button>
            </details>
            {error && <p className="account-error">{error}</p>}
            <div className="account-actions">
              <button className="btn ghost" type="button" onClick={() => setStep('email')}>
                Cambiar de correo
              </button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}

/** Los mensajes de error de Supabase vienen en inglés: los más habituales, en español. */
function traducir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('expired') || m.includes('invalid')) return 'El código no es válido o ha caducado. Pide otro.';
  if (m.includes('rate') || m.includes('seconds')) return 'Has pedido varios códigos seguidos. Espera un minuto y vuelve a intentarlo.';
  if (m.includes('fetch') || m.includes('network')) return 'No hay conexión con el servidor. Comprueba internet.';
  if (m.includes('relation') || m.includes('does not exist') || m.includes('could not find the table')) return 'Faltan las tablas en Supabase (hay que ejecutar supabase/schema.sql).';
  return msg;
}
