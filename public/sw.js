// ============================================
// sw.js — Service Worker NJ Cabuçu (v7 - CORRIGIDO)
// ============================================
const CACHE_VERSION = 'nj-cabucu-v7';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// URLs para pré-cache. Mantenha leve — ícones críticos apenas.
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/login.html',
    '/icons/icon-72x72.png',
    '/icons/icon-96x96.png',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// ===== INSTALL: pré-cacheia recursos essenciais =====
self.addEventListener('install', event => {
    console.log('📦 SW v7: instalando...');
    self.skipWaiting(); // ativa imediatamente
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache =>
                Promise.allSettled(
                    PRECACHE_URLS.map(url =>
                        fetch(url, { cache: 'no-store' })
                            .then(res => {
                                if (res && res.ok) {
                                    return cache.put(url, res);
                                }
                            })
                            .catch(err => console.warn('⚠️ falha pré-cache:', url, err.message))
                    )
                )
            )
    );
});

// ===== ACTIVATE: limpa caches antigos =====
self.addEventListener('activate', event => {
    console.log('✅ SW v7: ativado');
    event.waitUntil(
        caches.keys()
            .then(keys =>
                Promise.all(
                    keys
                        .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
                        .map(k => {
                            console.log('🗑️ removendo cache antigo:', k);
                            return caches.delete(k);
                        })
                )
            )
            .then(() => self.clients.claim())
    );
});

// ===== FETCH: estratégias de cache =====
self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    // SÓ cacheia GET
    if (req.method !== 'GET') return;

    // Ignora chamadas de API (sempre rede fresca)
    if (url.pathname.startsWith('/api/')) return;

    // Ignora domínios externos (CDNs, etc)
    if (url.origin !== self.location.origin) return;

    // Ignora requests do próprio service worker e manifest
    if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') return;

    // Navegação (HTML): network-first com fallback para cache
    if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(RUNTIME_CACHE)
                        .then(c => c.put(req, copy))
                        .catch(() => {});
                    return res;
                })
                .catch(() =>
                    caches.match(req).then(r => r || caches.match('/index.html'))
                )
        );
        return;
    }

    // Outros assets (imagens, css, js, fontes): cache-first com fallback
    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req)
                .then(res => {
                    if (!res || res.status !== 200 || res.type === 'opaque') return res;
                    const copy = res.clone();
                    caches.open(RUNTIME_CACHE)
                        .then(c => c.put(req, copy))
                        .catch(() => {});
                    return res;
                })
                .catch(() => cached);
        })
    );
});

// ===== MESSAGE: permite pular a espera =====
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
