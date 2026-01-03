'use client'

// =============================================================================
// COMPONENTE INDICADOR OFFLINE
// =============================================================================
// Muestra el estado de conexión y sincronización en la UI
// Posición fija en la esquina inferior izquierda
// =============================================================================

import { useEffect, useState } from 'react'
import {
  useOnlineStatus,
  useConnectionQuality,
  usePendingSync,
  useServiceWorker,
  useAutoSync,
} from '@/lib/offline/hooks'
import { useOfflineStore } from '@/lib/offline/store'
import { cn } from '@/lib/utils'
import {
  Wifi,
  WifiOff,
  CloudOff,
  RefreshCw,
  Check,
  AlertTriangle,
  Download,
  X,
} from 'lucide-react'

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()
  const quality = useConnectionQuality()
  const { pendingCount, isSyncing, triggerSync } = usePendingSync()
  const { isUpdateAvailable, skipWaiting } = useServiceWorker()
  const notifications = useOfflineStore((s) => s.notifications)
  const removeNotification = useOfflineStore((s) => s.removeNotification)

  // Auto-sincronizar cuando vuelve la conexión
  useAutoSync(true)

  // Ocultar indicador después de un tiempo si todo está bien
  const [isVisible, setIsVisible] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Mostrar siempre si hay problemas
    if (!isOnline || pendingCount > 0 || isSyncing || isUpdateAvailable) {
      setIsVisible(true)
      return
    }

    // Ocultar después de 5 segundos si todo está bien
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, 5000)

    return () => clearTimeout(timer)
  }, [isOnline, pendingCount, isSyncing, isUpdateAvailable])

  // Auto-remover notificaciones después de 5 segundos
  useEffect(() => {
    if (notifications.length === 0) return

    const timers = notifications.map((notif) => {
      const age = Date.now() - notif.timestamp
      const remaining = Math.max(5000 - age, 0)

      return setTimeout(() => {
        removeNotification(notif.id)
      }, remaining)
    })

    return () => timers.forEach(clearTimeout)
  }, [notifications, removeNotification])

  // No renderizar si está oculto y no hay nada que mostrar
  if (!isVisible && notifications.length === 0) {
    return null
  }

  const getStatusIcon = () => {
    if (isSyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin" />
    }
    if (!isOnline) {
      return <WifiOff className="h-4 w-4" />
    }
    if (pendingCount > 0) {
      return <CloudOff className="h-4 w-4" />
    }
    if (quality === 'slow') {
      return <AlertTriangle className="h-4 w-4" />
    }
    return <Wifi className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (isSyncing) {
      return 'Sincronizando...'
    }
    if (!isOnline) {
      return 'Sin conexión'
    }
    if (pendingCount > 0) {
      return `${pendingCount} pendiente(s)`
    }
    if (quality === 'slow') {
      return 'Conexión lenta'
    }
    return 'Conectado'
  }

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500'
    if (pendingCount > 0) return 'bg-amber-500'
    if (quality === 'slow') return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
      {/* Notificaciones */}
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white shadow-lg animate-in slide-in-from-left',
            notif.type === 'success' && 'bg-green-600',
            notif.type === 'error' && 'bg-red-600',
            notif.type === 'pending' && 'bg-amber-600',
            notif.type === 'info' && 'bg-blue-600'
          )}
        >
          {notif.type === 'success' && <Check className="h-4 w-4" />}
          {notif.type === 'error' && <AlertTriangle className="h-4 w-4" />}
          {notif.type === 'pending' && <RefreshCw className="h-4 w-4" />}
          {notif.type === 'info' && <Wifi className="h-4 w-4" />}
          <span>{notif.message}</span>
          <button
            onClick={() => removeNotification(notif.id)}
            className="ml-2 hover:opacity-70"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Banner de actualización disponible */}
      {isUpdateAvailable && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white shadow-lg">
          <Download className="h-4 w-4" />
          <span>Nueva versión disponible</span>
          <button
            onClick={() => {
              skipWaiting()
              window.location.reload()
            }}
            className="ml-2 rounded bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30"
          >
            Actualizar
          </button>
        </div>
      )}

      {/* Indicador principal */}
      {isVisible && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-white shadow-lg transition-all cursor-pointer',
            getStatusColor(),
            isExpanded && 'rounded-b-none'
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      )}

      {/* Panel expandido */}
      {isExpanded && isVisible && (
        <div className="rounded-lg rounded-t-none bg-gray-800 p-3 text-white shadow-lg -mt-2">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Estado:</span>
              <span>{isOnline ? 'En línea' : 'Desconectado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Calidad:</span>
              <span>
                {quality === 'good' && 'Buena'}
                {quality === 'slow' && 'Lenta'}
                {quality === 'offline' && 'Sin conexión'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pendientes:</span>
              <span>{pendingCount}</span>
            </div>

            {pendingCount > 0 && isOnline && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  triggerSync()
                }}
                disabled={isSyncing}
                className="mt-2 w-full rounded bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Versión compacta para la barra de navegación
export function OfflineStatusBadge() {
  const isOnline = useOnlineStatus()
  const { pendingCount } = usePendingSync()

  if (isOnline && pendingCount === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        !isOnline ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </>
      ) : (
        <>
          <CloudOff className="h-3 w-3" />
          <span>{pendingCount}</span>
        </>
      )}
    </div>
  )
}
