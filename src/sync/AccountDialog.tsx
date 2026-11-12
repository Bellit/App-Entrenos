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
 * Cuenta y sincronización. Para entrar: el correo → llega un correo con un código de 6 cifras
 * (y un enlace) → se escribe el código. Sin contraseñas. En el iPhone, con la app instalada, el
 * enlace abriría Safari en vez de la app: por eso se ofrece el código, que se escribe aquí mismo.
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
            <p>Entra con tu correo para tener los mismos ejercicios y sesiones en el ordenador y en el móvil. Sin contraseña: te llega un código por correo.</p>
            <label className="field">
              <span>Correo</span>
              <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
            </label>
            {error && <p className="account-error">{error}</p>}
            <div className="account-actions">
              <button className="btn primary" type="submit" disabled={busy || !email.trim()}>
                {busy ? 'Enviando…' : 'Enviarme el código'}
              </button>
            </div>
            <p className="muted small">
              La primera vez, lo que ya tienes en este dispositivo se sube a tu cuenta. <a href={routeHref.privacy} onClick={onClose}>Privacidad</a>
            </p>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p>
              Te hemos enviado un correo a <strong>{email}</strong>. Escribe aquí el código de 6 cifras que trae (o pulsa el enlace del correo en este mismo dispositivo).
            </p>
            <label className="field">
              <span>Código</span>
              <input className="code-input" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
            </label>
            {error && <p className="account-error">{error}</p>}
            <div className="account-actions">
              <button className="btn primary" type="submit" disabled={busy || code.length < 6}>
                {busy ? 'Comprobando…' : 'Entrar'}
              </button>
              <button className="btn ghost" type="button" onClick={() => setStep('email')}>
                Cambiar de correo
              </button>
            </div>
            <p className="muted small">¿No llega? Mira en spam o vuelve a pedirlo en un minuto.</p>
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
