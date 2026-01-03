'use client'

// =============================================================================
// QUICK ACTIONS - Panel de Acciones Rápidas
// =============================================================================
// Accesos directos a las funciones más utilizadas del laboratorio
// =============================================================================

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FlaskConical,
  FileText,
  Package,
  Users,
  Thermometer,
  ClipboardCheck,
  Microscope,
  Settings,
  Activity,
  Plus,
  Search,
  BarChart3,
  Shield,
  Cog,
} from 'lucide-react'

interface QuickAction {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  href: string
  color: 'blue' | 'emerald' | 'purple' | 'amber' | 'red' | 'slate'
  badge?: string | number
  shortcut?: string
}

interface QuickActionsProps {
  actions?: QuickAction[]
  columns?: 2 | 3 | 4
  showDescriptions?: boolean
  variant?: 'cards' | 'buttons' | 'compact'
}

const defaultActions: QuickAction[] = [
  {
    id: 'new-sample',
    label: 'Nueva Muestra',
    description: 'Registrar muestra en el sistema',
    icon: Plus,
    href: '/samples/new',
    color: 'blue',
    shortcut: 'N',
  },
  {
    id: 'pending-results',
    label: 'Validar Resultados',
    description: 'Resultados pendientes de validación',
    icon: ClipboardCheck,
    href: '/results?filter=pending',
    color: 'purple',
  },
  {
    id: 'view-samples',
    label: 'Ver Muestras',
    description: 'Buscar y gestionar muestras',
    icon: FlaskConical,
    href: '/samples',
    color: 'emerald',
  },
  {
    id: 'reports',
    label: 'Informes',
    description: 'Generar y consultar informes',
    icon: FileText,
    href: '/results',
    color: 'slate',
  },
  {
    id: 'quality-control',
    label: 'Control de Calidad',
    description: 'Registrar QC diario',
    icon: Activity,
    href: '/quality-control',
    color: 'amber',
  },
  {
    id: 'reagents',
    label: 'Inventario',
    description: 'Gestión de reactivos',
    icon: Package,
    href: '/reagents',
    color: 'red',
  },
]

const colorStyles = {
  blue: {
    bg: 'bg-blue-50 hover:bg-blue-100',
    border: 'border-blue-200',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  emerald: {
    bg: 'bg-emerald-50 hover:bg-emerald-100',
    border: 'border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-600',
    text: 'text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  purple: {
    bg: 'bg-purple-50 hover:bg-purple-100',
    border: 'border-purple-200',
    icon: 'bg-purple-100 text-purple-600',
    text: 'text-purple-700',
    button: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
  amber: {
    bg: 'bg-amber-50 hover:bg-amber-100',
    border: 'border-amber-200',
    icon: 'bg-amber-100 text-amber-600',
    text: 'text-amber-700',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  red: {
    bg: 'bg-red-50 hover:bg-red-100',
    border: 'border-red-200',
    icon: 'bg-red-100 text-red-600',
    text: 'text-red-700',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  slate: {
    bg: 'bg-slate-50 hover:bg-slate-100',
    border: 'border-slate-200',
    icon: 'bg-slate-100 text-slate-600',
    text: 'text-slate-700',
    button: 'bg-slate-600 hover:bg-slate-700 text-white',
  },
}

export function QuickActions({
  actions = defaultActions,
  columns = 3,
  showDescriptions = true,
  variant = 'cards',
}: QuickActionsProps) {
  const router = useRouter()

  const columnsClass = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  }

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const colors = colorStyles[action.color]
          const Icon = action.icon

          return (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className={cn('gap-2', colors.border)}
              onClick={() => router.push(action.href)}
            >
              <Icon className={cn('h-4 w-4', colors.text)} />
              {action.label}
              {action.badge && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {action.badge}
                </span>
              )}
            </Button>
          )
        })}
      </div>
    )
  }

  if (variant === 'buttons') {
    return (
      <div className={cn('grid grid-cols-1 gap-3', columnsClass[columns])}>
        {actions.map((action) => {
          const colors = colorStyles[action.color]
          const Icon = action.icon

          return (
            <Button
              key={action.id}
              className={cn('h-auto py-3 justify-start gap-3', colors.button)}
              onClick={() => router.push(action.href)}
            >
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="font-medium">{action.label}</div>
                {showDescriptions && action.description && (
                  <div className="text-xs opacity-80">{action.description}</div>
                )}
              </div>
              {action.badge && (
                <span className="ml-auto px-2 py-0.5 text-xs bg-white/20 rounded-full">
                  {action.badge}
                </span>
              )}
            </Button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4', columnsClass[columns])}>
      {actions.map((action) => {
        const colors = colorStyles[action.color]
        const Icon = action.icon

        return (
          <Card
            key={action.id}
            className={cn(
              'cursor-pointer transition-all duration-200 hover:shadow-md',
              colors.bg,
              colors.border
            )}
            onClick={() => router.push(action.href)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    colors.icon
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={cn('font-medium', colors.text)}>
                      {action.label}
                    </h3>
                    {action.badge && (
                      <span className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                        {action.badge}
                      </span>
                    )}
                  </div>
                  {showDescriptions && action.description && (
                    <p className="text-sm text-slate-500 mt-0.5">
                      {action.description}
                    </p>
                  )}
                </div>
                {action.shortcut && (
                  <kbd className="hidden md:flex px-2 py-1 text-xs bg-white/50 rounded border border-slate-200 text-slate-500">
                    {action.shortcut}
                  </kbd>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// =============================================================================
// ROLE BASED ACTIONS - Acciones por Rol
// =============================================================================

interface RoleBasedActionsProps {
  role: 'ADMIN' | 'BIOANALYST' | 'LAB_ASSISTANT'
}

export function RoleBasedActions({ role }: RoleBasedActionsProps) {
  const actionsByRole: Record<string, QuickAction[]> = {
    ADMIN: [
      {
        id: 'dashboard',
        label: 'Dashboard Ejecutivo',
        icon: BarChart3,
        href: '/dashboard/executive',
        color: 'blue',
      },
      {
        id: 'users',
        label: 'Gestión de Usuarios',
        icon: Users,
        href: '/users',
        color: 'purple',
      },
      {
        id: 'audit',
        label: 'Auditoría',
        icon: Shield,
        href: '/audit',
        color: 'slate',
      },
      {
        id: 'settings',
        label: 'Configuración',
        icon: Settings,
        href: '/settings',
        color: 'amber',
      },
    ],
    BIOANALYST: [
      {
        id: 'new-sample',
        label: 'Nueva Muestra',
        icon: Plus,
        href: '/samples/new',
        color: 'blue',
      },
      {
        id: 'validate',
        label: 'Validar Resultados',
        icon: ClipboardCheck,
        href: '/results?filter=pending',
        color: 'purple',
      },
      {
        id: 'cultures',
        label: 'Cultivos',
        icon: Microscope,
        href: '/samples?filter=cultures',
        color: 'emerald',
      },
      {
        id: 'qc',
        label: 'Control de Calidad',
        icon: Activity,
        href: '/quality-control',
        color: 'amber',
      },
    ],
    LAB_ASSISTANT: [
      {
        id: 'new-sample',
        label: 'Registrar Muestra',
        icon: Plus,
        href: '/samples/new',
        color: 'blue',
      },
      {
        id: 'samples',
        label: 'Ver Muestras',
        icon: FlaskConical,
        href: '/samples',
        color: 'emerald',
      },
      {
        id: 'temperature',
        label: 'Registrar Temperatura',
        icon: Thermometer,
        href: '/temperature-logs',
        color: 'amber',
      },
      {
        id: 'reagents',
        label: 'Inventario',
        icon: Package,
        href: '/reagents',
        color: 'red',
      },
    ],
  }

  return <QuickActions actions={actionsByRole[role]} columns={4} />
}
