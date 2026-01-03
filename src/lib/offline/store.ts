// =============================================================================
// ZUSTAND STORE PARA ESTADO OFFLINE
// =============================================================================
// Gestiona:
// - Estado de conexión (online/offline)
// - Cola de sincronización pendiente
// - Estado del Service Worker
// - Notificaciones de sincronización
// =============================================================================

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { indexedDB, type SyncQueueItem } from './indexed-db'

export type ConnectionQuality = 'good' | 'slow' | 'offline'

export interface SyncNotification {
  id: string
  type: 'success' | 'error' | 'pending' | 'info'
  message: string
  timestamp: number
  entityType?: SyncQueueItem['entityType']
  entityId?: string
}

interface OfflineState {
  // Estado de conexión
  isOnline: boolean
  connectionQuality: ConnectionQuality
  lastOnlineAt: number | null
  lastOfflineAt: number | null

  // Service Worker
  swRegistration: ServiceWorkerRegistration | null
  swState: 'installing' | 'installed' | 'activating' | 'activated' | 'redundant' | null
  swUpdateAvailable: boolean

  // Cola de sincronización
  pendingCount: number
  isSyncing: boolean
  lastSyncAt: number | null
  syncErrors: string[]

  // Notificaciones
  notifications: SyncNotification[]

  // Acciones
  setOnline: (isOnline: boolean) => void
  setConnectionQuality: (quality: ConnectionQuality) => void
  setSwRegistration: (registration: ServiceWorkerRegistration | null) => void
  setSwState: (state: OfflineState['swState']) => void
  setSwUpdateAvailable: (available: boolean) => void
  setPendingCount: (count: number) => void
  setIsSyncing: (syncing: boolean) => void
  setLastSyncAt: (timestamp: number) => void
  addSyncError: (error: string) => void
  clearSyncErrors: () => void
  addNotification: (notification: Omit<SyncNotification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void

  // Acciones complejas
  refreshPendingCount: () => Promise<void>
  triggerSync: () => Promise<void>
  skipSwWaiting: () => Promise<void>
}

export const useOfflineStore = create<OfflineState>()(
  subscribeWithSelector((set, get) => ({
    // Estado inicial
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionQuality: 'good',
    lastOnlineAt: null,
    lastOfflineAt: null,

    swRegistration: null,
    swState: null,
    swUpdateAvailable: false,

    pendingCount: 0,
    isSyncing: false,
    lastSyncAt: null,
    syncErrors: [],

    notifications: [],

    // Acciones simples
    setOnline: (isOnline) =>
      set((state) => ({
        isOnline,
        lastOnlineAt: isOnline ? Date.now() : state.lastOnlineAt,
        lastOfflineAt: !isOnline ? Date.now() : state.lastOfflineAt,
        connectionQuality: isOnline ? state.connectionQuality : 'offline',
      })),

    setConnectionQuality: (connectionQuality) => set({ connectionQuality }),

    setSwRegistration: (swRegistration) => set({ swRegistration }),

    setSwState: (swState) => set({ swState }),

    setSwUpdateAvailable: (swUpdateAvailable) => set({ swUpdateAvailable }),

    setPendingCount: (pendingCount) => set({ pendingCount }),

    setIsSyncing: (isSyncing) => set({ isSyncing }),

    setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),

    addSyncError: (error) =>
      set((state) => ({
        syncErrors: [...state.syncErrors.slice(-9), error], // Mantener últimos 10 errores
      })),

    clearSyncErrors: () => set({ syncErrors: [] }),

    addNotification: (notification) =>
      set((state) => ({
        notifications: [
          ...state.notifications.slice(-4), // Mantener últimas 5 notificaciones
          {
            ...notification,
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          },
        ],
      })),

    removeNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),

    clearNotifications: () => set({ notifications: [] }),

    // Acciones complejas
    refreshPendingCount: async () => {
      try {
        const count = await indexedDB.getSyncQueueCount()
        set({ pendingCount: count })
      } catch (error) {
        console.error('[OfflineStore] Error refreshing pending count:', error)
      }
    },

    triggerSync: async () => {
      const state = get()

      if (state.isSyncing || !state.isOnline) {
        return
      }

      set({ isSyncing: true })

      try {
        // Intentar usar Background Sync si está disponible
        if (state.swRegistration && 'sync' in state.swRegistration) {
          await (state.swRegistration as ServiceWorkerRegistration & {
            sync: { register: (tag: string) => Promise<void> }
          }).sync.register('sync-pending-requests')

          set((s) => ({
            lastSyncAt: Date.now(),
            isSyncing: false,
          }))

          get().addNotification({
            type: 'info',
            message: 'Sincronización en segundo plano iniciada',
          })

          return
        }

        // Fallback: sincronización manual
        const queue = await indexedDB.getSyncQueue()

        if (queue.length === 0) {
          set({ isSyncing: false })
          return
        }

        let successCount = 0
        let errorCount = 0

        for (const item of queue) {
          try {
            const response = await fetch(item.url, {
              method: item.method,
              headers: item.headers,
              body: item.body,
            })

            if (response.ok) {
              await indexedDB.removeFromSyncQueue(item.id)
              successCount++
            } else {
              // Incrementar reintentos
              const newRetries = item.retries + 1
              if (newRetries >= 5) {
                // Máximo 5 reintentos, eliminar
                await indexedDB.removeFromSyncQueue(item.id)
                get().addSyncError(`Error sincronizando ${item.entityType}: máximo de reintentos alcanzado`)
                errorCount++
              } else {
                await indexedDB.updateSyncQueueItem(item.id, { retries: newRetries })
              }
            }
          } catch (error) {
            console.error('[OfflineStore] Error syncing item:', item.id, error)
            errorCount++
          }
        }

        // Actualizar estado
        await get().refreshPendingCount()

        set({
          isSyncing: false,
          lastSyncAt: Date.now(),
        })

        // Notificación de resultado
        if (successCount > 0) {
          get().addNotification({
            type: 'success',
            message: `${successCount} cambio(s) sincronizado(s)`,
          })
        }
        if (errorCount > 0) {
          get().addNotification({
            type: 'error',
            message: `${errorCount} error(es) de sincronización`,
          })
        }
      } catch (error) {
        console.error('[OfflineStore] Error in triggerSync:', error)
        set({ isSyncing: false })
        get().addSyncError(String(error))
      }
    },

    skipSwWaiting: async () => {
      const { swRegistration } = get()

      if (swRegistration?.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
        set({ swUpdateAvailable: false })
      }
    },
  }))
)

// =========================================================================
// SELECTORES OPTIMIZADOS
// =========================================================================

export const selectIsOnline = (state: OfflineState) => state.isOnline
export const selectConnectionQuality = (state: OfflineState) => state.connectionQuality
export const selectPendingCount = (state: OfflineState) => state.pendingCount
export const selectIsSyncing = (state: OfflineState) => state.isSyncing
export const selectSwUpdateAvailable = (state: OfflineState) => state.swUpdateAvailable
export const selectNotifications = (state: OfflineState) => state.notifications

// =========================================================================
// INICIALIZACIÓN
// =========================================================================

export async function initializeOfflineStore(): Promise<void> {
  const store = useOfflineStore.getState()

  // Inicializar IndexedDB
  await indexedDB.init()

  // Cargar contador de pendientes
  await store.refreshPendingCount()

  // Listeners de conexión
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      store.setOnline(true)
      store.addNotification({
        type: 'success',
        message: 'Conexión restaurada',
      })

      // Intentar sincronizar automáticamente
      setTimeout(() => {
        store.triggerSync()
      }, 2000)
    })

    window.addEventListener('offline', () => {
      store.setOnline(false)
      store.addNotification({
        type: 'info',
        message: 'Sin conexión - Los cambios se guardarán localmente',
      })
    })
  }

  // Registrar Service Worker
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })

      store.setSwRegistration(registration)
      store.setSwState(
        registration.active
          ? 'activated'
          : registration.waiting
            ? 'installed'
            : registration.installing
              ? 'installing'
              : null
      )

      // Detectar actualizaciones
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              store.setSwUpdateAvailable(true)
              store.addNotification({
                type: 'info',
                message: 'Nueva versión disponible',
              })
            }
          })
        }
      })

      // Escuchar mensajes del SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, pendingCount } = event.data || {}

        switch (type) {
          case 'SYNC_COMPLETE':
            store.refreshPendingCount()
            store.setIsSyncing(false)
            store.setLastSyncAt(Date.now())
            break
          case 'PENDING_COUNT':
            store.setPendingCount(pendingCount)
            break
          case 'CACHE_CLEARED':
            store.addNotification({
              type: 'success',
              message: 'Caché limpiado',
            })
            break
        }
      })

      console.log('[OfflineStore] Service Worker registered')
    } catch (error) {
      console.error('[OfflineStore] Service Worker registration failed:', error)
    }
  }

  console.log('[OfflineStore] Initialized')
}
