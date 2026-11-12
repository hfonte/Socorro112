const CACHE_NAME = 'cuidar-emergencia-v57';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json?v=57',
  './css/styles.css?v=57',
  './js/i18n_dict.js?v=57',
  './js/i18n.js?v=57',
  './js/app.js?v=57',
  './js/audio.js?v=57',
  './js/geo.js?v=57',
  './js/knowledge_base.js?v=57',
  './js/rag.js?v=57',
  './js/ai.js?v=57',
  './assets/docs/Ficha_Medica_Individual_ERPI.docx',
  './assets/docs/Plano_Individual_Saude_Creche.docx',
  './assets/images/icon-192.png?v=57',
  './assets/images/icon-512.png?v=57',
  './assets/images/icon-192-maskable.png?v=57',
  './assets/images/icon-512-maskable.png?v=57',
  './assets/images/estrela_da_vida.jpg',
  './assets/images/cadeia_sobrevivencia.png',
  './assets/images/sbv_consciencia.png',
  './assets/images/sbv_abertura_via_aerea.png',
  './assets/images/sbv_vos.png',
  './assets/images/sbv_pls.png',
  './assets/images/sbv_compressoes.png',
  './assets/images/sbv_insuflacoes.png',
  './assets/images/ova_pancadas.png',
  './assets/images/ova_heimlich.png',
  './assets/images/hemorragia_pressao_direta.jpg',
  './assets/images/hemorragia_garrote.jpg',
  './assets/images/hemorragia_elevacao.jpg',
  './assets/images/queimadura_1grau.jpg',
  './assets/images/queimadura_2grau.jpg',
  './assets/images/queimadura_3grau.jpg',
  './assets/images/avc_isquemico.png',
  './assets/images/avc_hemorragico.png'
];

const EXTERNAL_ASSETS_TO_CACHE = [
  'https://cdn.tailwindcss.com/3.4.17'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(ASSETS_TO_CACHE);
      // Cache externo no-cors separado para não bloquear instalação do SW em caso de CORS/rede
      await Promise.allSettled(
        EXTERNAL_ASSETS_TO_CACHE.map(async (url) => {
          try {
            const resp = await fetch(new Request(url, { mode: 'no-cors' }));
            if (resp) await cache.put(url, resp);
          } catch (_) {}
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin && reqUrl.hostname !== 'cdn.tailwindcss.com') return;

  // Para scripts JS locais, CSS, manifest.json e navegação principal: Network-First com fallback para cache
  const isNetworkFirst =
    (reqUrl.origin === self.location.origin &&
      (reqUrl.pathname.endsWith('.js') || reqUrl.pathname.endsWith('.css') || reqUrl.pathname.endsWith('/manifest.json'))) ||
    event.request.mode === 'navigate';

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request)
            .then((exact) => exact || caches.match(event.request, { ignoreSearch: true }))
            .then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Para imagens, Tailwind CDN e restantes ficheiros estáticos: Cache-First (correspondência exata com ?v= primeiro)
  event.respondWith(
    caches.match(event.request)
      .then((exact) => exact || caches.match(event.request, { ignoreSearch: true }))
      .then((cachedResponse) => {
        return cachedResponse || fetch(event.request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => caches.match('./index.html'));
      })
  );
});
