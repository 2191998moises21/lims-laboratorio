'use client'

// =============================================================================
// PROVIDERS PRINCIPALES DE LA APLICACIÓN
// =============================================================================
// Incluye:
// - NextAuth SessionProvider
// - React Query con persistencia offline
// - Inicialización del store offline
// =============================================================================

import { SessionProvider } from 'next-auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useEffect, useState } from 'react'
import {
  createQueryClient,
  hydrateQueryClient,
  initializeOfflineStore,
} from '@/lib/offline'
import { OfflineIndicator } from '@/components/offline/OfflineIndicator'

// Crear cliente una sola vez
const queryClient = createQueryClient()

function OfflineInitializer({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        // Inicializar store offline (IndexedDB, Service Worker, listeners)
        await initializeOfflineStore()

        // Hidratar React Query desde cache de IndexedDB
        await hydrateQueryClient(queryClient)

        setIsInitialized(true)
        console.log('[App] Offline support initialized')
      } catch (error) {
        console.error('[App] Error initializing offline support:', error)
        // Continuar sin soporte offline
        setIsInitialized(true)
      }
    }

    init()
  }, [])

  // Renderizar children inmediatamente, el soporte offline se carga en background
  return (
    <>
      {children}
      {isInitialized && <OfflineIndicator />}
    </>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <OfflineInitializer>{children}</OfflineInitializer>
      </QueryClientProvider>
    </SessionProvider>
  )
}
