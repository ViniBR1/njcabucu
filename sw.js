// ============================================
// sw.js — Service Worker NJ Cabuçu (CORRIGIDO)
// ============================================
const CACHE_VERSION = 'nj-cabucu-v6';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// ⚠️ NÃO incluir /sw.js e /manifest.json aqui — o navegador os busca direto
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/icons/icon-72x72.png',
    '/icons/icon-96x96.png',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// ===== INSTALL =====
self.addEventListener('install', event => {
    console.log('📦 SW v6: instalando...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                return Promise.allSettled(
                    PRECACHE_URLS.map(url =>
                        fetch(url, { method: 'GET' })  // ⚠️ FORÇA GET
                            .then(res => {
                                if (res.ok) return cache.put(url, res);
                            })
                            .catch(err => console.warn('⚠️ falha cache:', url, err))
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
    console.log('✅ SW v6: ativando...');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
                    .map(k => {
                        console.log('🗑️ removendo cache antigo:', k);
                        return caches.delete(k);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    // ⚠️ SÓ cacheia GET — ignora HEAD, POST, PUT, DELETE
    if (req.method !== 'GET') return;

    // Ignora API (sempre rede)
    if (url.pathname.startsWith('/api/')) return;

    // Ignora domínios externos
    if (url.origin !== self.location.origin) return;

    // Navegação (HTML): network-first com fallback
    if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
                    return res;
                })
                .catch(() =>
                    caches.match(req).then(r => r || caches.match('/index.html'))
                )
        );
        return;
    }

    // Outros assets: cache-first
    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req).then(res => {
                if (!res || res.status !== 200 || res.type === 'opaque') return res;
                const copy = res.clone();
                caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
                return res;
            }).catch(() => cached);
        })
    );
});

// ===== MENSAGEM =====
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
