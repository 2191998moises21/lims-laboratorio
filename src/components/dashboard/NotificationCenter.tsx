'use client'

// =============================================================================
// NOTIFICATION CENTER - Centro de Notificaciones
// =============================================================================
// Sistema de notificaciones en tiempo real para alertas del laboratorio
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Bell,
  BellRing,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  Thermometer,
  FlaskConical,
  Package,
  X,
  Settings,
  Trash2,
} from 'lucide-react'

export type NotificationType =
  | 'critical_result'
  | 'sample_ready'
  | 'qc_failed'
  | 'reagent_low'
  | 'reagent_expired'
  | 'temperature_alert'
  | 'pending_validation'
  | 'system'
  | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
  entityId?: string
  priority: 'low' | 'normal' | 'high' | 'critical'
}

interface NotificationCenterProps {
  userId?: string
  onNotificationClick?: (notification: Notification) => void
}

const notificationConfig: Record<NotificationType, {
  icon: React.ElementType
  color: string
  bgColor: string
}> = {
  critical_result: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  sample_ready: {
    icon: FlaskConical,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  qc_failed: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  reagent_low: {
    icon: Package,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  reagent_expired: {
    icon: Package,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  temperature_alert: {
    icon: Thermometer,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  pending_validation: {
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  system: {
    icon: Settings,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
}

// Store para notificaciones (podría conectarse a IndexedDB/API)
let notificationStore: Notification[] = []
let listeners: Set<() => void> = new Set()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export function addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
  const newNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    read: false,
  }
  notificationStore = [newNotification, ...notificationStore].slice(0, 50) // Mantener últimas 50
  notifyListeners()
  return newNotification
}

export function markAsRead(id: string) {
  notificationStore = notificationStore.map((n) =>
    n.id === id ? { ...n, read: true } : n
  )
  notifyListeners()
}

export function markAllAsRead() {
  notificationStore = notificationStore.map((n) => ({ ...n, read: true }))
  notifyListeners()
}

export function removeNotification(id: string) {
  notificationStore = notificationStore.filter((n) => n.id !== id)
  notifyListeners()
}

export function clearAllNotifications() {
  notificationStore = []
  notifyListeners()
}

export function NotificationCenter({ userId, onNotificationClick }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>(notificationStore)
  const [isOpen, setIsOpen] = useState(false)

  // Suscribirse a cambios
  useEffect(() => {
    const listener = () => {
      setNotifications([...notificationStore])
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  // Simular notificaciones de prueba (quitar en producción)
  useEffect(() => {
    if (notificationStore.length === 0) {
      // Notificaciones de ejemplo
      addNotification({
        type: 'pending_validation',
        title: 'Resultados pendientes',
        message: '5 resultados esperan validación',
        priority: 'normal',
        actionUrl: '/results?filter=pending',
      })
      addNotification({
        type: 'reagent_low',
        title: 'Stock bajo',
        message: 'Agar MacConkey por debajo del mínimo',
        priority: 'high',
        actionUrl: '/reagents',
      })
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length
  const hasUnread = unreadCount > 0

  const handleNotificationClick = useCallback((notification: Notification) => {
    markAsRead(notification.id)
    if (onNotificationClick) {
      onNotificationClick(notification)
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl
    }
  }, [onNotificationClick])

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `Hace ${minutes}m`
    if (hours < 24) return `Hace ${hours}h`
    return `Hace ${days}d`
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificaciones"
        >
          {hasUnread ? (
            <BellRing className="h-5 w-5 text-slate-600" />
          ) : (
            <Bell className="h-5 w-5 text-slate-600" />
          )}
          {hasUnread && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-slate-900">Notificaciones</h3>
          <div className="flex items-center gap-1">
            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-700"
                onClick={() => markAllAsRead()}
              >
                Marcar como leídas
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => clearAllNotifications()}
              >
                <Trash2 className="h-4 w-4 text-slate-400" />
              </Button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No hay notificaciones</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y">
              {notifications.map((notification) => {
                const config = notificationConfig[notification.type]
                const Icon = config.icon

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-3 cursor-pointer transition-colors hover:bg-slate-50',
                      !notification.read && 'bg-blue-50/50'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      <div
                        className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                          config.bgColor
                        )}
                      >
                        <Icon className={cn('h-4 w-4', config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'text-sm font-medium truncate',
                              !notification.read ? 'text-slate-900' : 'text-slate-600'
                            )}
                          >
                            {notification.title}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeNotification(notification.id)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}

// =============================================================================
// ALERT BANNER - Banner de Alerta
// =============================================================================

interface AlertBannerProps {
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
  onDismiss?: () => void
}

export function AlertBanner({ type, title, message, action, onDismiss }: AlertBannerProps) {
  const styles = {
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: Info,
      iconColor: 'text-blue-600',
      title: 'text-blue-900',
      message: 'text-blue-700',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      title: 'text-amber-900',
      message: 'text-amber-700',
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      icon: AlertTriangle,
      iconColor: 'text-red-600',
      title: 'text-red-900',
      message: 'text-red-700',
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-200',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      title: 'text-emerald-900',
      message: 'text-emerald-700',
    },
  }

  const config = styles[type]
  const Icon = config.icon

  return (
    <div className={cn('rounded-lg border p-4', config.bg)}>
      <div className="flex gap-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0', config.iconColor)} />
        <div className="flex-1">
          <h4 className={cn('text-sm font-medium', config.title)}>{title}</h4>
          {message && (
            <p className={cn('text-sm mt-1', config.message)}>{message}</p>
          )}
          {action && (
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto mt-2 text-sm"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
