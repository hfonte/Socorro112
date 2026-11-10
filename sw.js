const CACHE_NAME = 'cuidar-emergencia-v49';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/audio.js',
  './js/geo.js',
  './js/knowledge_base.js',
  './js/rag.js',
  './js/ai.js',
  'https://cdn.tailwindcss.com/3.4.17',
  './assets/docs/Ficha_Medica_Individual_ERPI.docx',
  './assets/docs/Plano_Individual_Saude_Creche.docx',
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
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
  // Para scripts JS e navegação principal: Network-First com fallback para cache
  if (event.request.url.includes('.js') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Para imagens e restantes ficheiros estáticos: Cache-First
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        return caches.match('./index.html');
      });
    })
  );
});
