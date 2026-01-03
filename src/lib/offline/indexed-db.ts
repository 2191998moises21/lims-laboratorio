// =============================================================================
// INDEXEDDB WRAPPER PARA OFFLINE SUPPORT
// =============================================================================
// Almacenamiento persistente para:
// - Cache de React Query
// - Cola de sincronización de mutaciones
// - Datos críticos del laboratorio
// =============================================================================

const DB_NAME = 'lims-offline-db'
const DB_VERSION = 1

interface DBStores {
  queryCache: { key: string; data: unknown; timestamp: number }
  syncQueue: SyncQueueItem
  criticalData: { key: string; data: unknown; timestamp: number }
}

export interface SyncQueueItem {
  id: string
  url: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body: string
  headers: Record<string, string>
  timestamp: number
  retries: number
  priority: 'high' | 'normal' | 'low'
  entityType: 'sample' | 'result' | 'patient' | 'doctor' | 'other'
  entityId?: string
}

class IndexedDBManager {
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not available'))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('[IndexedDB] Error opening database:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('[IndexedDB] Database opened successfully')
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Store para cache de React Query
        if (!db.objectStoreNames.contains('queryCache')) {
          const queryStore = db.createObjectStore('queryCache', { keyPath: 'key' })
          queryStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Store para cola de sincronización
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
          syncStore.createIndex('timestamp', 'timestamp', { unique: false })
          syncStore.createIndex('priority', 'priority', { unique: false })
          syncStore.createIndex('entityType', 'entityType', { unique: false })
        }

        // Store para datos críticos (catálogos, configuración)
        if (!db.objectStoreNames.contains('criticalData')) {
          const criticalStore = db.createObjectStore('criticalData', { keyPath: 'key' })
          criticalStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        console.log('[IndexedDB] Database upgraded to version', DB_VERSION)
      }
    })

    return this.initPromise
  }

  // =========================================================================
  // OPERACIONES GENÉRICAS
  // =========================================================================

  private async getStore(
    storeName: keyof DBStores,
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    const db = await this.init()
    const transaction = db.transaction(storeName, mode)
    return transaction.objectStore(storeName)
  }

  async get<T>(storeName: keyof DBStores, key: string): Promise<T | null> {
    try {
      const store = await this.getStore(storeName, 'readonly')
      return new Promise((resolve, reject) => {
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result?.data ?? null)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`[IndexedDB] Error getting ${key} from ${storeName}:`, error)
      return null
    }
  }

  async set(
    storeName: keyof DBStores,
    key: string,
    data: unknown
  ): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite')
      return new Promise((resolve, reject) => {
        const request = store.put({ key, data, timestamp: Date.now() })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`[IndexedDB] Error setting ${key} in ${storeName}:`, error)
    }
  }

  async delete(storeName: keyof DBStores, key: string): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite')
      return new Promise((resolve, reject) => {
        const request = store.delete(key)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`[IndexedDB] Error deleting ${key} from ${storeName}:`, error)
    }
  }

  async getAll<T>(storeName: keyof DBStores): Promise<T[]> {
    try {
      const store = await this.getStore(storeName, 'readonly')
      return new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`[IndexedDB] Error getting all from ${storeName}:`, error)
      return []
    }
  }

  async clear(storeName: keyof DBStores): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite')
      return new Promise((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`[IndexedDB] Error clearing ${storeName}:`, error)
    }
  }

  // =========================================================================
  // OPERACIONES ESPECÍFICAS PARA SYNC QUEUE
  // =========================================================================

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fullItem: SyncQueueItem = {
      ...item,
      id,
      timestamp: Date.now(),
      retries: 0,
    }

    try {
      const store = await this.getStore('syncQueue', 'readwrite')
      return new Promise((resolve, reject) => {
        const request = store.add(fullItem)
        request.onsuccess = () => {
          console.log('[IndexedDB] Added to sync queue:', id)
          resolve(id)
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('[IndexedDB] Error adding to sync queue:', error)
      throw error
    }
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const store = await this.getStore('syncQueue', 'readonly')
      const index = store.index('priority')

      return new Promise((resolve, reject) => {
        const request = index.getAll()
        request.onsuccess = () => {
          // Ordenar por prioridad y timestamp
          const items = request.result || []
          items.sort((a, b) => {
            const priorityOrder = { high: 0, normal: 1, low: 2 }
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
              return priorityOrder[a.priority] - priorityOrder[b.priority]
            }
            return a.timestamp - b.timestamp
          })
          resolve(items)
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('[IndexedDB] Error getting sync queue:', error)
      return []
    }
  }

  async updateSyncQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
    try {
      const store = await this.getStore('syncQueue', 'readwrite')

      return new Promise((resolve, reject) => {
        const getRequest = store.get(id)
        getRequest.onsuccess = () => {
          if (!getRequest.result) {
            resolve()
            return
          }
          const updated = { ...getRequest.result, ...updates }
          const putRequest = store.put(updated)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        }
        getRequest.onerror = () => reject(getRequest.error)
      })
    } catch (error) {
      console.error('[IndexedDB] Error updating sync queue item:', error)
    }
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    try {
      const store = await this.getStore('syncQueue', 'readwrite')
      return new Promise((resolve, reject) => {
        const request = store.delete(id)
        request.onsuccess = () => {
          console.log('[IndexedDB] Removed from sync queue:', id)
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('[IndexedDB] Error removing from sync queue:', error)
    }
  }

  async getSyncQueueCount(): Promise<number> {
    try {
      const store = await this.getStore('syncQueue', 'readonly')
      return new Promise((resolve, reject) => {
        const request = store.count()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('[IndexedDB] Error counting sync queue:', error)
      return 0
    }
  }

  // =========================================================================
  // LIMPIEZA DE DATOS ANTIGUOS
  // =========================================================================

  async cleanOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge

    for (const storeName of ['queryCache', 'criticalData'] as const) {
      try {
        const store = await this.getStore(storeName, 'readwrite')
        const index = store.index('timestamp')
        const range = IDBKeyRange.upperBound(cutoff)

        await new Promise<void>((resolve, reject) => {
          const request = index.openCursor(range)
          request.onsuccess = () => {
            const cursor = request.result
            if (cursor) {
              cursor.delete()
              cursor.continue()
            } else {
              resolve()
            }
          }
          request.onerror = () => reject(request.error)
        })
      } catch (error) {
        console.error(`[IndexedDB] Error cleaning ${storeName}:`, error)
      }
    }

    console.log('[IndexedDB] Cleaned old data older than', new Date(cutoff).toISOString())
  }
}

// Singleton
export const indexedDB = new IndexedDBManager()
