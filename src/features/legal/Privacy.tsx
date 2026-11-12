import { routeHref } from '../../app/useRoute';
import { IconPrev } from '../../ui/Icons';
import '../../ui/Page.css';
import './Privacy.css';

/**
 * Política de privacidad (RGPD). Hace falta desde que los datos pueden guardarse en un servidor
 * (la sincronización con Supabase). Texto corto y en lenguaje claro: qué se guarda, dónde, para
 * qué, cuánto tiempo y cómo borrarlo.
 */
export function Privacy() {
  return (
    <div className="page">
      <header className="page-head">
        <a className="btn ghost" href={routeHref.sessions}>
          <IconPrev /> Volver
        </a>
      </header>
      <main className="page-main legal">
        <h1>Privacidad</h1>
        <p className="muted">Última actualización: noviembre de 2026</p>

        <h2>Sin cuenta: todo se queda en tu dispositivo</h2>
        <p>
          Si no entras con una cuenta, Run it no envía nada a ningún servidor. Tus ejercicios y sesiones se guardan solo en el navegador de este dispositivo. No hay cookies de seguimiento, ni
          publicidad, ni analítica.
        </p>

        <h2>Con cuenta: sincronización entre dispositivos</h2>
        <p>Si entras con tu correo para sincronizar, se guarda en la nube:</p>
        <ul>
          <li>tu dirección de correo, para identificarte y enviarte el código de entrada;</li>
          <li>tus ejercicios y sesiones (dibujos, textos, fechas, equipos y notas que escribas).</li>
        </ul>
        <p>
          Solo se usan para que tengas lo mismo en todos tus dispositivos. No se comparten con nadie ni se usan para nada más. Cada cuenta solo puede leer sus propios datos.
        </p>

        <h2>Dónde se guardan</h2>
        <p>
          En <strong>Supabase</strong> (Supabase Inc.), que actúa como encargado del tratamiento, en servidores de la Unión Europea (Fráncfort, Alemania). La app se sirve desde Cloudflare
          Pages.
        </p>

        <h2>Base legal y tiempo de conservación</h2>
        <p>
          Se tratan porque tú lo pides al crear la cuenta (tu consentimiento). Se conservan mientras mantengas la cuenta. Puedes dejar de sincronizar cuando quieras con «Salir de la
          cuenta»: lo que hay en el dispositivo se queda en él.
        </p>

        <h2>Tus derechos</h2>
        <p>
          Puedes pedir acceder a tus datos, corregirlos o borrarlos (también la cuenta entera), y oponerte a su tratamiento, escribiendo a la persona responsable de esta app. Si crees que
          no se respetan tus derechos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).
        </p>
        {/* Si la app se comparte con otras personas, añadir aquí el nombre y un correo de contacto del responsable. */}
      </main>
    </div>
  );
}
