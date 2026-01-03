// =============================================================================
// SERVICE WORKER - LIMS LABORATORIO (OFFLINE-FIRST)
// =============================================================================
// Estrategias de cache:
// - Static assets: Cache First
// - API calls: Network First con fallback a cache
// - Pages: Stale While Revalidate
// =============================================================================

const CACHE_NAME = 'lims-cache-v1';
const OFFLINE_URL = '/offline.html';

// Assets estáticos que se cachean inmediatamente
const STATIC_ASSETS = [
  '/',
  '/login',
  '/offline.html',
  '/manifest.json',
  '/logo.svg',
];

// Rutas de API que se cachean para offline
const API_CACHE_ROUTES = [
  '/api/tests',
  '/api/doctors/search',
  '/api/patients/search',
  '/api/settings',
];

// =============================================================================
// INSTALACIÓN DEL SERVICE WORKER
// =============================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// =============================================================================
// ACTIVACIÓN DEL SERVICE WORKER
// =============================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// =============================================================================
// INTERCEPTAR REQUESTS
// =============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar requests del mismo origen
  if (url.origin !== location.origin) {
    return;
  }

  // Estrategia para API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Estrategia para assets estáticos
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // Estrategia para páginas HTML
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default: Network first
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// =============================================================================
// ESTRATEGIAS DE CACHE
// =============================================================================

/**
 * Network First para API calls
 * Intenta red primero, si falla usa cache
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);

  // Solo cachear GETs de rutas específicas
  if (request.method !== 'GET') {
    return handleMutationRequest(request);
  }

  const shouldCache = API_CACHE_ROUTES.some(route =>
    url.pathname.startsWith(route)
  );

  try {
    const response = await fetch(request);

    if (shouldCache && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed for API, trying cache:', url.pathname);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Retornar respuesta offline para APIs
    return new Response(
      JSON.stringify({
        error: 'Sin conexión',
        offline: true,
        cachedAt: null
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Manejar mutaciones (POST, PUT, DELETE) cuando está offline
 * Guarda en IndexedDB para sincronizar después
 */
async function handleMutationRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // Guardar en queue para sincronizar después
    const clonedRequest = request.clone();
    const body = await clonedRequest.text();

    await savePendingRequest({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now()
    });

    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        message: 'Guardado localmente. Se sincronizará cuando haya conexión.',
        pendingSync: true
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Cache First para assets estáticos
 */
async function handleStaticAsset(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Actualizar cache en background
    fetch(request)
      .then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, response));
        }
      })
      .catch(() => {});

    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    return new Response('Asset not available offline', { status: 404 });
  }
}

/**
 * Stale While Revalidate para navegación
 */
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation failed, trying cache');

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Mostrar página offline
    return caches.match(OFFLINE_URL);
  }
}

// =============================================================================
// UTILIDADES
// =============================================================================

function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.ico', '.woff', '.woff2', '.ttf', '.eot'
  ];
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

// =============================================================================
// INDEXEDDB PARA REQUESTS PENDIENTES
// =============================================================================

const DB_NAME = 'lims-offline';
const STORE_NAME = 'pending-requests';

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function savePendingRequest(requestData) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.add(requestData);
  return tx.complete;
}

async function getPendingRequests() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deletePendingRequest(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  return tx.complete;
}

// =============================================================================
// SINCRONIZACIÓN EN BACKGROUND
// =============================================================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-requests') {
    event.waitUntil(syncPendingRequests());
  }
});

async function syncPendingRequests() {
  console.log('[SW] Syncing pending requests...');

  const pendingRequests = await getPendingRequests();

  for (const pendingRequest of pendingRequests) {
    try {
      const response = await fetch(pendingRequest.url, {
        method: pendingRequest.method,
        headers: pendingRequest.headers,
        body: pendingRequest.body
      });

      if (response.ok) {
        await deletePendingRequest(pendingRequest.id);
        console.log('[SW] Synced request:', pendingRequest.url);
      }
    } catch (error) {
      console.error('[SW] Failed to sync request:', pendingRequest.url, error);
    }
  }

  // Notificar a los clientes
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      pendingCount: (await getPendingRequests()).length
    });
  });
}

// =============================================================================
// MENSAJES DESDE LA APLICACIÓN
// =============================================================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_PENDING_COUNT':
      getPendingRequests().then(requests => {
        event.source.postMessage({
          type: 'PENDING_COUNT',
          count: requests.length
        });
      });
      break;

    case 'FORCE_SYNC':
      syncPendingRequests();
      break;

    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        event.source.postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
  }
});

console.log('[SW] Service Worker loaded');
