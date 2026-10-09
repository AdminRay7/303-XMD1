// 303-XMD Service Worker
const CACHE_NAME = 'xmd303-v4';
const CORE_ASSETS = [
    '/manifest.json',
    '/theme.css',
    '/sidebar.js',
    '/icon-192.png',
    '/icon-512.png'
];

const PAGE_ASSETS = [
    '/',
    '/login',
    '/register',
    '/dashboard',
    '/pair',
    '/channel',
    '/live',
    '/settings',
    '/web'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CORE_ASSETS).catch(() => {});
        await Promise.all(
            PAGE_ASSETS.map(async (url) => {
                try {
                    const res = await fetch(url, { redirect: 'follow' });
                    if (res && res.ok) await cache.put(url, res.clone());
                } catch (_) {}
            })
        );
        self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (
        url.origin !== self.location.origin ||
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/live-media/') ||
        url.pathname.startsWith('/auth/')
    ) {
        return;
    }

    event.respondWith((async () => {
        try {
            const res = await fetch(req);
            if (res && res.ok && res.type === 'basic') {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
            }
            return res;
        } catch (_) {
            const cached = await caches.match(req);
            if (cached) return cached;

            if (req.mode === 'navigate') {
                const fallback = await caches.match('/dashboard');
                if (fallback) return fallback;
            }

            return new Response(
                '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title>' +
                '<style>body{background:#0b141a;color:#e9edef;font-family:sans-serif;' +
                'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
                'height:100vh;margin:0;text-align:center;padding:20px}' +
                'h1{color:#ff2a2a;font-size:22px;letter-spacing:2px}' +
                'p{color:#8696a0;font-size:14px;max-width:320px;line-height:1.6}</style></head>' +
                '<body><h1>OFFLINE</h1><p>303-XMD needs a connection. Check your network and try again.</p></body></html>',
                { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
        }
    })());
});