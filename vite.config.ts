/// <reference types="vitest/config" />
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
    "connect-src 'self'",
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
      const lines = ['/*', ...Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`), ''];
      this.emitFile({ type: 'asset', fileName: '_headers', source: lines.join('\n') });
    },
  };
}

export default defineConfig({
  plugins: [react(), securityHeaders()],
  base: './',
  preview: { headers: SECURITY_HEADERS },
  // los tests leen las hojas de estilo (p. ej. para comprobar los puntos de corte)
  test: { css: true },
});
