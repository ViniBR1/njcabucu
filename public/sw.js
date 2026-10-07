// ============================================
// sw.js - Service Worker PWA NJ Cabuçu
// ============================================
const CACHE_NAME = 'nj-cabucu-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/login.html',
  '/admin.html',
  '/departamento.html',
  '/secretaria.html',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Instala e faz cache
self.addEventListener('install', event => {
  console.log('📦 Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache aberto');
        // Não falha se algum asset não existir
        return Promise.all(
          ASSETS.map(url => 
            cache.add(url).catch(err => console.warn('⚠️ Falha ao cachear:', url, err))
          )
        );
      })
      .then(() => {
        console.log('✅ SW instalado');
        return self.skipWaiting();
      })
  );
});

// Ativa e limpa cache antigo
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ SW ativado');
      return self.clients.claim();
    })
  );
});

// Intercepta requisições
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Não intercepta APIs nem POST/PUT/DELETE
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Retorna cache e atualiza em background
          fetch(request).then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, response.clone());
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // Não está no cache — busca da rede
        return fetch(request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          return response;
        }).catch(() => {
          // Se offline e é navegação, retorna index.html
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
