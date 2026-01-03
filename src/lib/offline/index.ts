// =============================================================================
// MÓDULO OFFLINE - EXPORTS
// =============================================================================
// Punto de entrada principal para toda la funcionalidad offline
// =============================================================================

// IndexedDB
export {
  indexedDB,
  type SyncQueueItem,
} from './indexed-db'

// React Query Client
export {
  createQueryClient,
  hydrateQueryClient,
  invalidateCache,
  CACHE_TIMES,
  getCacheTimeForQuery,
} from './query-client'

// Zustand Store
export {
  useOfflineStore,
  initializeOfflineStore,
  selectIsOnline,
  selectConnectionQuality,
  selectPendingCount,
  selectIsSyncing,
  selectSwUpdateAvailable,
  selectNotifications,
  type ConnectionQuality,
  type SyncNotification,
} from './store'

// Hooks
export {
  useOnlineStatus,
  useConnectionQuality,
  usePendingSync,
  useAutoSync,
  useOfflineAwareFetch,
  useServiceWorker,
  useNetworkState,
  type PendingSyncState,
  type ServiceWorkerState,
  type NetworkState,
} from './hooks'
