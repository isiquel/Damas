// Tabuleiro Arena Profissional 73 - Service Worker leve, sem cache agressivo.
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => { /* Sem cache forçado para evitar carregar versões antigas. */ });
