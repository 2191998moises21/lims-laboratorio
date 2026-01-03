// =============================================================================
// REACT QUERY CLIENT CON PERSISTENCIA OFFLINE
// =============================================================================
// Configuración optimizada para:
// - Persistencia en IndexedDB
// - Reintentos automáticos cuando vuelve la conexión
// - Cache agresivo para datos estables (catálogos)
// - Cache corto para datos dinámicos (muestras, resultados)
// =============================================================================

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { indexedDB, type SyncQueueItem } from './indexed-db'

// Tiempos de cache por tipo de datos
export const CACHE_TIMES = {
  // Datos que casi nunca cambian
  STATIC: {
    staleTime: 24 * 60 * 60 * 1000, // 24 horas
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 días
  },
  // Catálogos y configuración
  CATALOG: {
    staleTime: 60 * 60 * 1000, // 1 hora
    gcTime: 24 * 60 * 60 * 1000, // 24 horas
  },
  // Datos de referencia (médicos, pacientes)
  REFERENCE: {
    staleTime: 15 * 60 * 1000, // 15 minutos
    gcTime: 60 * 60 * 1000, // 1 hora
  },
  // Datos dinámicos (muestras, resultados)
  DYNAMIC: {
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  },
  // Dashboard y estadísticas
  REALTIME: {
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
  },
}

// Mapeo de query keys a tipos de cache
export function getCacheTimeForQuery(queryKey: unknown[]): typeof CACHE_TIMES.DYNAMIC {
  const key = Array.isArray(queryKey) ? queryKey[0] : queryKey

  if (typeof key !== 'string') return CACHE_TIMES.DYNAMIC

  // Datos estáticos
  if (key.includes('settings') || key.includes('config')) {
    return CACHE_TIMES.STATIC
  }

  // Catálogos
  if (
    key.includes('tests') ||
    key.includes('reagents') ||
    key.includes('sampleTypes') ||
    key.includes('antibiotics')
  ) {
    return CACHE_TIMES.CATALOG
  }

  // Referencias
  if (key.includes('doctors') || key.includes('patients')) {
    return CACHE_TIMES.REFERENCE
  }

  // Tiempo real
  if (key.includes('dashboard') || key.includes('stats')) {
    return CACHE_TIMES.REALTIME
  }

  // Por defecto, dinámico
  return CACHE_TIMES.DYNAMIC
}

// Determinar prioridad de sincronización
function getPriorityForMutation(
  url: string,
  method: string
): SyncQueueItem['priority'] {
  // Resultados de laboratorio = prioridad alta
  if (url.includes('/results') && method === 'POST') {
    return 'high'
  }

  // Muestras = prioridad alta
  if (url.includes('/samples') && (method === 'POST' || method === 'PUT')) {
    return 'high'
  }

  // Deletes = prioridad normal
  if (method === 'DELETE') {
    return 'normal'
  }

  return 'normal'
}

// Determinar tipo de entidad
function getEntityType(url: string): SyncQueueItem['entityType'] {
  if (url.includes('/samples')) return 'sample'
  if (url.includes('/results')) return 'result'
  if (url.includes('/patients')) return 'patient'
  if (url.includes('/doctors')) return 'doctor'
  return 'other'
}

// Crear cliente con configuración offline-first
export function createQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Configuración por defecto (se sobrescribe por query)
        staleTime: CACHE_TIMES.DYNAMIC.staleTime,
        gcTime: CACHE_TIMES.DYNAMIC.gcTime,

        // Reintentos inteligentes
        retry: (failureCount, error) => {
          // No reintentar errores de cliente (4xx)
          if (error instanceof Error && error.message.includes('4')) {
            return false
          }
          // Máximo 3 reintentos
          return failureCount < 3
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Refetch cuando vuelve la conexión
        refetchOnReconnect: 'always',
        refetchOnWindowFocus: false, // Evitar refetch excesivo

        // Mantener datos previos mientras carga
        placeholderData: (previousData: unknown) => previousData,

        // Network mode para soporte offline
        networkMode: 'offlineFirst',
      },
      mutations: {
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        networkMode: 'offlineFirst',
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        console.error('[QueryCache] Error in query:', query.queryKey, error)
      },
      onSuccess: async (data, query) => {
        // Persistir queries importantes en IndexedDB
        const key = JSON.stringify(query.queryKey)
        const cacheTime = getCacheTimeForQuery(query.queryKey as unknown[])

        // Solo persistir datos con cache largo
        if (cacheTime.staleTime >= CACHE_TIMES.REFERENCE.staleTime) {
          try {
            await indexedDB.set('queryCache', key, data)
          } catch (error) {
            console.warn('[QueryCache] Error persisting to IndexedDB:', error)
          }
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: async (error, variables, context, mutation) => {
        console.error('[MutationCache] Mutation error:', error)

        // Si es error de red, guardar en cola de sincronización
        if (
          error instanceof TypeError &&
          error.message.includes('fetch')
        ) {
          const mutationOptions = mutation.options as {
            mutationKey?: unknown[]
            variables?: { url?: string; method?: string; body?: unknown }
          }

          if (mutationOptions.variables?.url) {
            const { url, method = 'POST', body } = mutationOptions.variables

            await indexedDB.addToSyncQueue({
              url,
              method: method as SyncQueueItem['method'],
              body: JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' },
              priority: getPriorityForMutation(url, method),
              entityType: getEntityType(url),
            })

            console.log('[MutationCache] Added to sync queue:', url)
          }
        }
      },
    }),
  })

  return queryClient
}

// Restaurar cache desde IndexedDB al iniciar
export async function hydrateQueryClient(queryClient: QueryClient): Promise<void> {
  try {
    const cachedQueries = await indexedDB.getAll<{
      key: string
      data: unknown
      timestamp: number
    }>('queryCache')

    const now = Date.now()

    for (const cached of cachedQueries) {
      try {
        const queryKey = JSON.parse(cached.key)
        const cacheTime = getCacheTimeForQuery(queryKey)

        // Verificar si el cache sigue siendo válido
        if (now - cached.timestamp < cacheTime.gcTime) {
          queryClient.setQueryData(queryKey, cached.data)
        } else {
          // Limpiar cache expirado
          await indexedDB.delete('queryCache', cached.key)
        }
      } catch (parseError) {
        console.warn('[Hydration] Error parsing cached query:', parseError)
      }
    }

    console.log('[Hydration] Restored', cachedQueries.length, 'queries from cache')
  } catch (error) {
    console.warn('[Hydration] Error hydrating query client:', error)
  }
}

// Invalidar cache específico
export async function invalidateCache(
  queryClient: QueryClient,
  keyPrefix: string
): Promise<void> {
  // Invalidar en React Query
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0]
      return typeof key === 'string' && key.startsWith(keyPrefix)
    },
  })

  // Limpiar de IndexedDB
  const cachedQueries = await indexedDB.getAll<{ key: string }>('queryCache')
  for (const cached of cachedQueries) {
    if (cached.key.includes(keyPrefix)) {
      await indexedDB.delete('queryCache', cached.key)
    }
  }
}
