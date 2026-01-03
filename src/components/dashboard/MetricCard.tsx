'use client'

// =============================================================================
// METRIC CARD - Tarjeta de Métrica Profesional
// =============================================================================
// Componente reutilizable para mostrar métricas con tendencias y alertas
// =============================================================================

import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'

export interface MetricCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon?: ReactNode
  trend?: {
    value: number
    label: string
  }
  alert?: {
    type: 'warning' | 'critical' | 'info'
    message: string
  }
  color?: 'default' | 'blue' | 'green' | 'red' | 'amber' | 'purple'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

const colorStyles = {
  default: {
    bg: 'bg-white',
    border: 'border-slate-200',
    icon: 'bg-slate-100 text-slate-600',
    title: 'text-slate-600',
    value: 'text-slate-900',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'bg-blue-100 text-blue-600',
    title: 'text-blue-700',
    value: 'text-blue-900',
  },
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-600',
    title: 'text-emerald-700',
    value: 'text-emerald-900',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'bg-red-100 text-red-600',
    title: 'text-red-700',
    value: 'text-red-900',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'bg-amber-100 text-amber-600',
    title: 'text-amber-700',
    value: 'text-amber-900',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'bg-purple-100 text-purple-600',
    title: 'text-purple-700',
    value: 'text-purple-900',
  },
}

const sizeStyles = {
  sm: {
    padding: 'p-4',
    iconSize: 'h-8 w-8',
    iconInner: 'h-4 w-4',
    title: 'text-xs',
    value: 'text-xl',
    subtitle: 'text-xs',
  },
  md: {
    padding: 'p-5',
    iconSize: 'h-10 w-10',
    iconInner: 'h-5 w-5',
    title: 'text-sm',
    value: 'text-2xl',
    subtitle: 'text-xs',
  },
  lg: {
    padding: 'p-6',
    iconSize: 'h-12 w-12',
    iconInner: 'h-6 w-6',
    title: 'text-sm',
    value: 'text-3xl',
    subtitle: 'text-sm',
  },
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  alert,
  color = 'default',
  size = 'md',
  onClick,
}: MetricCardProps) {
  const colors = colorStyles[color]
  const sizes = sizeStyles[size]

  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
        ? TrendingDown
        : Minus
    : null

  const trendColor = trend
    ? trend.value > 0
      ? 'text-emerald-600'
      : trend.value < 0
        ? 'text-red-600'
        : 'text-slate-500'
    : ''

  return (
    <Card
      className={cn(
        colors.bg,
        colors.border,
        'shadow-sm transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.02]'
      )}
      onClick={onClick}
    >
      <CardContent className={cn(sizes.padding, 'relative')}>
        {/* Alert badge */}
        {alert && (
          <div
            className={cn(
              'absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              alert.type === 'critical' && 'bg-red-100 text-red-700',
              alert.type === 'warning' && 'bg-amber-100 text-amber-700',
              alert.type === 'info' && 'bg-blue-100 text-blue-700'
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            {alert.message}
          </div>
        )}

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className={cn(sizes.title, colors.title, 'font-medium mb-1')}>
              {title}
            </p>
            <p className={cn(sizes.value, colors.value, 'font-bold')}>
              {typeof value === 'number' ? value.toLocaleString('es-VE') : value}
            </p>
            {subtitle && (
              <p className={cn(sizes.subtitle, 'text-slate-500 mt-1')}>
                {subtitle}
              </p>
            )}
            {trend && (
              <div className={cn('flex items-center gap-1 mt-2', trendColor)}>
                {TrendIcon && <TrendIcon className="h-3 w-3" />}
                <span className="text-xs font-medium">
                  {trend.value > 0 ? '+' : ''}
                  {trend.value}% {trend.label}
                </span>
              </div>
            )}
          </div>

          {icon && (
            <div
              className={cn(
                sizes.iconSize,
                colors.icon,
                'rounded-lg flex items-center justify-center flex-shrink-0'
              )}
            >
              <div className={sizes.iconInner}>{icon}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// METRIC GRID - Grid de Métricas
// =============================================================================

interface MetricGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4 | 5
}

export function MetricGrid({ children, columns = 4 }: MetricGridProps) {
  const colsClass = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
    5: 'md:grid-cols-3 lg:grid-cols-5',
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4', colsClass[columns])}>
      {children}
    </div>
  )
}
