/* Service Worker — Direciona App
   Estratégia: cache-first para shell, network-first para API */

const VERSION = 'direciona-v1';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Nunca cacheia chamadas de API (precisam ser sempre frescas)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('anthropic') || url.hostname.includes('workers.dev')) {
    return; // deixa passar direto para a rede
  }

  // Não cacheia OCR (Tesseract baixa modelos pesados sob demanda)
  if (url.hostname.includes('tesseract') || url.hostname.includes('jsdelivr') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) {
    return;
  }

  // Cache-first para o shell
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(resp => {
        // Atualiza cache em background pra próximas visitas
        if (resp.ok && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
