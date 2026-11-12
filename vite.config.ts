/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Cabeceras de seguridad (GUIA-WEB, sección 6). Se definen solo aquí:
 * - `npm run preview` las aplica, para probar la web compilada con ellas;
 * - al compilar se genera `dist/_headers`, que leen Netlify y Cloudflare Pages.
 * La app no carga nada de fuera: todo es 'self'. `blob:` hace falta para el vídeo y las imágenes exportadas.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    // sin 'unsafe-inline': los estilos que pone React van por el DOM (element.style), que la CSP no bloquea
    "style-src 'self'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    // Supabase: la nube donde se sincronizan ejercicios y sesiones (ver src/sync/supabase.ts)
    "connect-src 'self' https://ttvsdivqymgwvptfjjmy.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'X-Frame-Options': 'DENY',
};

function securityHeaders(): Plugin {
  return {
    name: 'security-headers',
    apply: 'build',
    generateBundle() {
      const lines = [
        '/*',
        ...Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`),
        // el service worker siempre se comprueba de nuevo (si no, las actualizaciones tardarían en llegar)
        '/sw.js',
        '  Cache-Control: no-cache',
        // los archivos de assets llevan un hash en el nombre: nunca cambian, se pueden guardar para siempre
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '',
      ];
      this.emitFile({ type: 'asset', fileName: '_headers', source: lines.join('\n') });
    },
  };
}

/**
 * Genera `sw.js` (el service worker, ver `pwa/service-worker.js`) con la lista de todos los
 * archivos de la app ya compilada y una versión calculada a partir de ellos: si cambia cualquier
 * archivo, cambia la versión y los móviles reciben la actualización.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicFiles = readdirSync('public').filter((f) => !f.startsWith('.') && f !== 'robots.txt');
      const files = ['index.html', ...Object.keys(bundle).filter((f) => f !== '_headers'), ...publicFiles];
      const unique = [...new Set(files)].sort();
      // la versión: un resumen (hash) de los nombres y del contenido de lo compilado
      const template = readFileSync('pwa/service-worker.js', 'utf8');
      const hash = createHash('sha256').update(template); // un cambio en el propio service worker también es versión nueva
      for (const f of unique) {
        const item = bundle[f];
        hash.update(f);
        if (item?.type === 'chunk') hash.update(item.code);
        else if (item?.type === 'asset') hash.update(typeof item.source === 'string' ? item.source : Buffer.from(item.source));
      }
      // la portada se guarda como './': Cloudflare Pages redirige 'index.html' a '/'
      const precache = unique.map((f) => (f === 'index.html' ? './' : f));
      const source = template
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

/**
 * La vista previa (`npm run preview`) se comporta como Cloudflare Pages: `/index.html` redirige a `/`
 * con un 308. Sin esto, la prueba local no habría detectado que el service worker guardaba una
 * respuesta redirigida y que la app publicada dejaba de abrir a la segunda visita.
 */
function pagesLikePreview(): Plugin {
  return {
    name: 'pages-like-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const [path, query] = (req.url ?? '').split('?');
        if (!path.endsWith('/index.html')) return next();
        res.statusCode = 308;
        res.setHeader('Location', path.slice(0, -'index.html'.length) + (query ? `?${query}` : ''));
        res.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), securityHeaders(), serviceWorker(), pagesLikePreview()],
  base: './',
  preview: { headers: SECURITY_HEADERS },
  // los tests leen las hojas de estilo (p. ej. para comprobar los puntos de corte)
  test: { css: true },
});
