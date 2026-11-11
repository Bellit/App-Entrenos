/*
 * Service worker de Entrenos: hace que la app funcione sin conexión.
 *
 * Es un programa aparte que el navegador ejecuta en segundo plano y que se pone en medio de cada
 * petición de la web. Al instalarse guarda en una caché todos los archivos de la app (la lista la
 * escribe el build: `vite.config.ts` → plugin `serviceWorker`), y luego los sirve desde ahí, con o
 * sin internet. Los datos (ejercicios y sesiones) no pasan por aquí: viven en IndexedDB.
 *
 * Actualizaciones: cuando se publica una versión nueva, el navegador instala el service worker nuevo
 * pero lo deja esperando. La app avisa («Hay una versión nueva») y, al pulsar «Actualizar», le manda
 * SKIP_WAITING para que tome el relevo; entonces la página se recarga con la versión nueva.
 * Así nunca cambia la app a mitad de un entreno sin que la persona lo decida.
 */

const VERSION = '__VERSION__';
const CACHE = `entrenos-${VERSION}`;
/** Archivos de la app (rutas relativas a este archivo). */
const PRECACHE = __PRECACHE__;
/**
 * Cómo buscar en la caché. `ignoreVary`: algunos servidores responden con `Vary: Origin`, y como
 * index.html pide el código con `crossorigin` (la petición lleva cabecera Origin y la guardada no),
 * sin esto la caché no lo reconocería como el mismo archivo y, sin conexión, la app no abriría.
 */
const MATCH = { cacheName: CACHE, ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// al activarse, borra las cachés de versiones anteriores y empieza a atender las páginas abiertas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('entrenos-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // abrir la app (cualquier dirección: las pantallas van en el #) → la página guardada.
  // Primero la caché: en un pabellón con mala cobertura la app abre al instante.
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('index.html', MATCH).then((hit) => hit || fetch(req)));
    return;
  }

  // el resto (código, estilos, letras, iconos): de la caché y, si no está, de la red
  event.respondWith(caches.match(req, MATCH).then((hit) => hit || fetch(req)));
});
