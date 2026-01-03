// =============================================================================
// HOOKS PARA ESTADO OFFLINE
// =============================================================================
// Hooks React para:
// - Detectar estado de conexión
// - Medir calidad de conexión
// - Sincronización automática
// =============================================================================

'use client'

import { useEffect, useCallback, useRef } from 'react'
import {
  useOfflineStore,
  selectIsOnline,
  selectConnectionQuality,
  selectPendingCount,
  selectIsSyncing,
  type ConnectionQuality,
} from './store'

// =========================================================================
// useOnlineStatus - Estado de conexión simple
// =========================================================================

export function useOnlineStatus(): boolean {
  return useOfflineStore(selectIsOnline)
}

// =========================================================================
// useConnectionQuality - Calidad de conexión con prueba activa
// =========================================================================

export function useConnectionQuality(): ConnectionQuality {
  const isOnline = useOfflineStore(selectIsOnline)
  const quality = useOfflineStore(selectConnectionQuality)
  const setConnectionQuality = useOfflineStore((s) => s.setConnectionQuality)
  const lastCheckRef = useRef<number>(0)

  // Medir latencia periódicamente
  useEffect(() => {
    if (!isOnline) return

    const measureLatency = async () => {
      const now = Date.now()
      // No medir más de una vez cada 30 segundos
      if (now - lastCheckRef.current < 30000) return
      lastCheckRef.current = now

      try {
        const start = performance.now()
        // Usar endpoint pequeño para medir latencia
        const response = await fetch('/api/health', {
          method: 'HEAD',
          cache: 'no-store',
        })
        const latency = performance.now() - start

        if (!response.ok) {
          setConnectionQuality('slow')
          return
        }

        // Clasificar calidad basada en latencia
        if (latency < 300) {
          setConnectionQuality('good')
        } else if (latency < 1000) {
          setConnectionQuality('slow')
        } else {
          setConnectionQuality('slow')
        }
      } catch {
        // Error de red = offline o muy lento
        setConnectionQuality('slow')
      }
    }

    // Medir al montar y cada 60 segundos
    measureLatency()
    const interval = setInterval(measureLatency, 60000)

    return () => clearInterval(interval)
  }, [isOnline, setConnectionQuality])

  return quality
}

// =========================================================================
// usePendingSync - Estado de sincronización pendiente
// =========================================================================

export interface PendingSyncState {
  pendingCount: number
  isSyncing: boolean
  triggerSync: () => Promise<void>
}

export function usePendingSync(): PendingSyncState {
  const pendingCount = useOfflineStore(selectPendingCount)
  const isSyncing = useOfflineStore(selectIsSyncing)
  const triggerSync = useOfflineStore((s) => s.triggerSync)

  return {
    pendingCount,
    isSyncing,
    triggerSync,
  }
}

// =========================================================================
// useAutoSync - Sincronización automática cuando vuelve conexión
// =========================================================================

export function useAutoSync(enabled: boolean = true): void {
  const isOnline = useOfflineStore(selectIsOnline)
  const pendingCount = useOfflineStore(selectPendingCount)
  const triggerSync = useOfflineStore((s) => s.triggerSync)
  const wasOfflineRef = useRef<boolean>(!isOnline)

  useEffect(() => {
    if (!enabled) return

    // Detectar transición de offline a online
    if (isOnline && wasOfflineRef.current && pendingCount > 0) {
      // Esperar un momento para que la conexión se estabilice
      const timer = setTimeout(() => {
        triggerSync()
      }, 3000)

      return () => clearTimeout(timer)
    }

    wasOfflineRef.current = !isOnline
  }, [isOnline, pendingCount, triggerSync, enabled])
}

// =========================================================================
// useOfflineData - Wrapper para datos con soporte offline
// =========================================================================

export interface OfflineDataOptions<T> {
  /** Clave única para almacenamiento */
  key: string
  /** Función para obtener datos frescos */
  fetcher: () => Promise<T>
  /** Tiempo de vida del cache en ms */
  maxAge?: number
  /** Callback cuando se usa cache */
  onCacheHit?: (data: T) => void
  /** Callback cuando hay error */
  onError?: (error: Error) => void
}

export interface OfflineDataResult<T> {
  data: T | null
  isLoading: boolean
  isStale: boolean
  isFromCache: boolean
  error: Error | null
  refresh: () => Promise<void>
}

// Este hook es un wrapper simplificado - para uso avanzado usar React Query directamente
export function useOfflineAwareFetch() {
  const isOnline = useOnlineStatus()
  const { pendingCount, isSyncing, triggerSync } = usePendingSync()

  const offlineFetch = useCallback(
    async (url: string, options?: RequestInit): Promise<Response> => {
      if (!isOnline) {
        // Simular respuesta para lectura desde cache del SW
        const cachedResponse = await caches.match(url)
        if (cachedResponse) {
          return cachedResponse
        }
        throw new Error('Sin conexión y sin datos en cache')
      }

      return fetch(url, options)
    },
    [isOnline]
  )

  return {
    isOnline,
    pendingCount,
    isSyncing,
    triggerSync,
    offlineFetch,
  }
}

// =========================================================================
// useServiceWorker - Control del Service Worker
// =========================================================================

export interface ServiceWorkerState {
  isSupported: boolean
  isRegistered: boolean
  isUpdateAvailable: boolean
  state: 'installing' | 'installed' | 'activating' | 'activated' | 'redundant' | null
  update: () => Promise<void>
  skipWaiting: () => Promise<void>
}

export function useServiceWorker(): ServiceWorkerState {
  const swRegistration = useOfflineStore((s) => s.swRegistration)
  const swState = useOfflineStore((s) => s.swState)
  const swUpdateAvailable = useOfflineStore((s) => s.swUpdateAvailable)
  const skipSwWaiting = useOfflineStore((s) => s.skipSwWaiting)

  const update = useCallback(async () => {
    if (swRegistration) {
      await swRegistration.update()
    }
  }, [swRegistration])

  return {
    isSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    isRegistered: !!swRegistration,
    isUpdateAvailable: swUpdateAvailable,
    state: swState,
    update,
    skipWaiting: skipSwWaiting,
  }
}

// =========================================================================
// useNetworkState - Estado completo de red (combina varios hooks)
// =========================================================================

export interface NetworkState {
  isOnline: boolean
  quality: ConnectionQuality
  pendingCount: number
  isSyncing: boolean
  swUpdateAvailable: boolean
}

export function useNetworkState(): NetworkState {
  const isOnline = useOnlineStatus()
  const quality = useConnectionQuality()
  const pendingCount = useOfflineStore(selectPendingCount)
  const isSyncing = useOfflineStore(selectIsSyncing)
  const swUpdateAvailable = useOfflineStore((s) => s.swUpdateAvailable)

  return {
    isOnline,
    quality,
    pendingCount,
    isSyncing,
    swUpdateAvailable,
  }
}
