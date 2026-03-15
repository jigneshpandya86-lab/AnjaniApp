// ============================================================
// ANJANI WATER — Service Worker v2
// Fixed: removed non-existent files, proper offline caching
// ============================================================

const CACHE_NAME = 'anjani-v2';
const DB_CACHE_KEY = 'anjani_db_cache';

// Only cache files that actually exist in your repo
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/feather-icons/4.29.0/feather.min.js',
];

// ─── Install ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => console.log('[SW] Cache miss (ok):', url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: clean old caches ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch Strategy ───────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // GAS / Google API calls — always network, never cache
  // These are handled by JSONP in the app, SW just lets them through
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('maps.googleapis.com')) {
    event.respondWith(fetch(event.request).catch(() => {
      // Return a simple offline indicator for GAS calls
      return new Response(JSON.stringify({ offline: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }));
    return;
  }

  // Tailwind CDN — network first, fallback to cache
  if (url.hostname.includes('cdn.tailwindcss.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else — cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Navigation fallback — show offline page
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html') || caches.match('/index.html');
        }
      });
    })
  );
});

// ─── Background Sync ──────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'anjani-sync') {
    event.waitUntil(processQueue());
  }
});

async function processQueue() {
  const db = await openDB();
  const tx = db.transaction('queue', 'readwrite');
  const store = tx.objectStore('queue');

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = async () => {
      const items = req.result;
      console.log('[SW] Processing sync queue:', items.length, 'items');

      for (const item of items) {
        try {
          // Re-execute the JSONP call by notifying the client
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_ITEM',
              fn: item.fn,
              params: item.params,
              id: item.id
            });
          });

          // Remove from queue
          const delTx = db.transaction('queue', 'readwrite');
          delTx.objectStore('queue').delete(item.id);
        } catch (e) {
          console.log('[SW] Sync failed for item:', item.id, e);
        }
      }
      resolve();
    };
    req.onerror = reject;
  });
}

// ─── IndexedDB helper ─────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('anjani-sw', 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}

// ─── Push Notifications ───────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Anjani Water', {
      body: data.body || 'New update',
      icon: '/icon-192.png',
      data: data
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
