// ============================================================
// ANJANI WATER — Service Worker
// Handles offline caching, background sync, and install
// ============================================================

const CACHE_NAME = 'anjani-v1';
const DB_CACHE_KEY = 'anjani-db-cache';
const SYNC_QUEUE_KEY = 'anjani-sync-queue';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/api.js',
  '/offline.html',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/feather-icons/4.29.0/feather.min.js',
];

// ─── Install ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can, don't fail on CDN errors
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => console.log('Cache miss:', url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch Strategy ───────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // GAS API calls — network first, queue on offline
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(networkWithOfflineQueue(event.request));
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      });
    })
  );
});

// ─── Network with offline queue for mutations ──────────────
async function networkWithOfflineQueue(request) {
  try {
    return await fetch(request.clone());
  } catch (err) {
    // Offline — queue the mutation
    if (request.method === 'POST') {
      const body = await request.text();
      await queueSync({ url: request.url, body, timestamp: Date.now() });
    }
    // Return cached data or offline indicator
    return new Response(JSON.stringify({ offline: true, queued: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── Sync Queue ────────────────────────────────────────────
async function queueSync(item) {
  const db = await openDB();
  const tx = db.transaction('queue', 'readwrite');
  tx.objectStore('queue').add(item);
}

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
  const items = await store.getAll();

  for (const item of items) {
    try {
      await fetch(item.url, {
        method: 'POST',
        body: item.body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      store.delete(item.id);
    } catch (e) {
      console.log('Sync failed, will retry:', e);
    }
  }
}

// ─── Simple IndexedDB helper ──────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('anjani-sw', 1);
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

// ─── Push Notifications (ready for Phase 2) ───────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Anjani Water', {
      body: data.body || 'New update',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: data
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
