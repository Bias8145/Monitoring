// Service Worker untuk Water Monitoring System PWA
const CACHE_NAME = 'water-system-v1.0.0';
const OFFLINE_URL = '/offline.html';

// File yang akan di-cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  // CSS Frameworks
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Poppins:wght@500;700&display=swap',
  // JavaScript Libraries
  'https://cdn.jsdelivr.net/npm/chart.js',
  // Firebase (akan di-cache otomatis oleh browser)
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
];

// Install event - Cache essential resources
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[SW] Failed to cache resources:', error);
      })
  );
  // Skip waiting untuk update langsung
  self.skipWaiting();
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim control immediately
  self.clients.claim();
});

// Fetch event - Network first with cache fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Firebase API calls (always need network)
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('firebase')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Jika berhasil fetch dari network, simpan ke cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // Jika network gagal, coba dari cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Jika request untuk halaman HTML dan tidak ada di cache,
            // tampilkan offline page
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
            
            // Untuk request lainnya, kembalikan response kosong
            return new Response('', {
              status: 408,
              statusText: 'Request timeout'
            });
          });
      })
  );
});

// Background Sync untuk data offline
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync-data') {
    event.waitUntil(
      syncPendingData()
    );
  }
});

// Push notification handler
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: data.data,
      actions: [
        {
          action: 'open',
          title: 'Buka Aplikasi',
          icon: '/icons/icon-192x192.png'
        },
        {
          action: 'close',
          title: 'Tutup'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Function untuk sync data pending
async function syncPendingData() {
  try {
    const pendingData = await getPendingData();
    if (pendingData.length > 0) {
      // Kirim data ke Firebase
      for (const data of pendingData) {
        await sendDataToFirebase(data);
      }
      // Clear pending data setelah berhasil
      await clearPendingData();
    }
  } catch (error) {
    console.error('[SW] Failed to sync pending data:', error);
  }
}

// Helper functions untuk IndexedDB (simplified)
function getPendingData() {
  return new Promise((resolve) => {
    // Implementasi IndexedDB untuk get pending data
    // Untuk sementara return empty array
    resolve([]);
  });
}

function sendDataToFirebase(data) {
  return fetch('/api/sync-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}

function clearPendingData() {
  return new Promise((resolve) => {
    // Implementasi clear pending data
    resolve();
  });
}

// Periodic background sync (jika didukung browser)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'data-sync') {
    event.waitUntil(
      syncPendingData()
    );
  }
});

console.log('[SW] Service Worker registered successfully');
