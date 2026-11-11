// Service worker: guarda la app en el dispositivo para que funcione sin conexión.
// VERSION la reescribe tools/build-web.js con un hash del contenido; al cambiar, se descarga la versión nueva.
const VERSION = 'fc46600372';
const CACHE = 'hanzi-' + VERSION;
const FUENTES = 'hanzi-fuentes';

const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/data/datos.js',
  'js/data/pinyin.js',
  'js/data/trazos.js',
  'vendor/hanzi-writer.min.js',
  'vendor/qrcode.js',
  'vendor/ts-fsrs.js',
  'js/iconos.js',
  'js/items.js',
  'js/progreso.js',
  'js/audio.js',
  'js/vistas.js',
  'js/quiz.js',
  'js/sesion.js',
  'js/pronunciar.js',
  'js/sincronizar.js',
  'js/tutor.js',
  'js/app.js',
  // vendor/anthropic-sdk.js (tutor) no se precarga: pesa 785 KB y el tutor necesita conexión de todas formas
  'icons/apple-touch-icon.png',
  'icons/icono-192.png',
  'icons/icono-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE && k !== FUENTES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Fuentes de Google: se guardan la primera vez que se descargan
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FUENTES).then(async c => {
      const guardada = await c.match(e.request);
      const red = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => guardada);
      return guardada || red;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // En desarrollo (sin pasar por build-web): siempre la versión más reciente, con la copia como respaldo
  if (VERSION === 'dev') {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }

  // Archivos de la app: primero la copia guardada (rápido y sin conexión)
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() => caches.match('index.html')))
  );
});
