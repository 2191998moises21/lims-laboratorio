'use client'

// =============================================================================
// SAMPLE WORKFLOW - Visualización de Flujo de Muestra
// =============================================================================
// Stepper visual para mostrar el estado actual de una muestra en el proceso
// =============================================================================

import { cn } from '@/lib/utils'
import {
  Package,
  FlaskConical,
  Microscope,
  ClipboardCheck,
  FileText,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
} from 'lucide-react'

export type SampleStatus = 'RECEIVED' | 'IN_PROGRESS' | 'ANALYZED' | 'COMPLETED' | 'CANCELLED'

interface WorkflowStep {
  id: string
  label: string
  description: string
  icon: React.ElementType
  status: 'completed' | 'current' | 'pending' | 'error'
}

interface SampleWorkflowProps {
  currentStatus: SampleStatus
  sampleCode?: string
  showLabels?: boolean
  size?: 'sm' | 'md' | 'lg'
  orientation?: 'horizontal' | 'vertical'
}

const statusToStep: Record<SampleStatus, number> = {
  RECEIVED: 1,
  IN_PROGRESS: 2,
  ANALYZED: 3,
  COMPLETED: 4,
  CANCELLED: -1,
}

const baseSteps = [
  {
    id: 'received',
    label: 'Recibida',
    description: 'Muestra registrada en el sistema',
    icon: Package,
  },
  {
    id: 'in_progress',
    label: 'En Proceso',
    description: 'Análisis en progreso',
    icon: FlaskConical,
  },
  {
    id: 'analyzed',
    label: 'Analizada',
    description: 'Resultados pendientes de validación',
    icon: Microscope,
  },
  {
    id: 'validated',
    label: 'Validada',
    description: 'Resultados validados',
    icon: ClipboardCheck,
  },
  {
    id: 'completed',
    label: 'Completada',
    description: 'Informe disponible',
    icon: FileText,
  },
]

function getStepStatus(stepIndex: number, currentStep: number, isCancelled: boolean): WorkflowStep['status'] {
  if (isCancelled) return stepIndex === 0 ? 'error' : 'pending'
  if (stepIndex < currentStep) return 'completed'
  if (stepIndex === currentStep) return 'current'
  return 'pending'
}

export function SampleWorkflow({
  currentStatus,
  sampleCode,
  showLabels = true,
  size = 'md',
  orientation = 'horizontal',
}: SampleWorkflowProps) {
  const currentStep = statusToStep[currentStatus]
  const isCancelled = currentStatus === 'CANCELLED'

  const steps: WorkflowStep[] = baseSteps.map((step, index) => ({
    ...step,
    status: getStepStatus(index, currentStep - 1, isCancelled),
  }))

  const sizeStyles = {
    sm: {
      icon: 'h-6 w-6',
      iconContainer: 'h-8 w-8',
      label: 'text-xs',
      description: 'text-[10px]',
      connector: 'h-0.5',
      verticalConnector: 'w-0.5 h-6',
    },
    md: {
      icon: 'h-5 w-5',
      iconContainer: 'h-10 w-10',
      label: 'text-sm',
      description: 'text-xs',
      connector: 'h-0.5',
      verticalConnector: 'w-0.5 h-8',
    },
    lg: {
      icon: 'h-6 w-6',
      iconContainer: 'h-12 w-12',
      label: 'text-base',
      description: 'text-sm',
      connector: 'h-1',
      verticalConnector: 'w-1 h-10',
    },
  }

  const styles = sizeStyles[size]

  const getStatusColors = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-emerald-500',
          text: 'text-white',
          border: 'border-emerald-500',
          label: 'text-emerald-700',
        }
      case 'current':
        return {
          bg: 'bg-blue-500',
          text: 'text-white',
          border: 'border-blue-500',
          label: 'text-blue-700',
        }
      case 'error':
        return {
          bg: 'bg-red-500',
          text: 'text-white',
          border: 'border-red-500',
          label: 'text-red-700',
        }
      default:
        return {
          bg: 'bg-slate-200',
          text: 'text-slate-400',
          border: 'border-slate-300',
          label: 'text-slate-500',
        }
    }
  }

  const getStatusIcon = (status: WorkflowStep['status'], StepIcon: React.ElementType) => {
    switch (status) {
      case 'completed':
        return CheckCircle2
      case 'current':
        return Clock
      case 'error':
        return XCircle
      default:
        return StepIcon
    }
  }

  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col">
        {sampleCode && (
          <p className="text-sm font-medium text-slate-600 mb-4">
            Muestra: <span className="text-slate-900">{sampleCode}</span>
          </p>
        )}
        <div className="space-y-2">
          {steps.map((step, index) => {
            const colors = getStatusColors(step.status)
            const Icon = getStatusIcon(step.status, step.icon)
            const isLast = index === steps.length - 1

            return (
              <div key={step.id} className="flex items-start">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      styles.iconContainer,
                      colors.bg,
                      'rounded-full flex items-center justify-center transition-all'
                    )}
                  >
                    <Icon className={cn(styles.icon, colors.text)} />
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        styles.verticalConnector,
                        step.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'
                      )}
                    />
                  )}
                </div>
                {showLabels && (
                  <div className="ml-3 pb-6">
                    <p className={cn(styles.label, 'font-medium', colors.label)}>
                      {step.label}
                    </p>
                    <p className={cn(styles.description, 'text-slate-500')}>
                      {step.description}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {sampleCode && (
        <p className="text-sm font-medium text-slate-600 mb-4 text-center">
          Muestra: <span className="text-slate-900">{sampleCode}</span>
        </p>
      )}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const colors = getStatusColors(step.status)
          const Icon = getStatusIcon(step.status, step.icon)
          const isLast = index === steps.length - 1

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    styles.iconContainer,
                    colors.bg,
                    'rounded-full flex items-center justify-center transition-all'
                  )}
                >
                  <Icon className={cn(styles.icon, colors.text)} />
                </div>
                {showLabels && (
                  <div className="mt-2 text-center">
                    <p className={cn(styles.label, 'font-medium', colors.label)}>
                      {step.label}
                    </p>
                  </div>
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 mx-2',
                    styles.connector,
                    step.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// SAMPLE STATUS BADGE - Badge de Estado de Muestra
// =============================================================================

interface SampleStatusBadgeProps {
  status: SampleStatus
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

export function SampleStatusBadge({ status, size = 'md', showIcon = true }: SampleStatusBadgeProps) {
  const config = {
    RECEIVED: {
      label: 'Recibida',
      icon: Package,
      colors: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    IN_PROGRESS: {
      label: 'En Proceso',
      icon: FlaskConical,
      colors: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    ANALYZED: {
      label: 'Analizada',
      icon: Microscope,
      colors: 'bg-purple-100 text-purple-700 border-purple-200',
    },
    COMPLETED: {
      label: 'Completada',
      icon: CheckCircle2,
      colors: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    CANCELLED: {
      label: 'Cancelada',
      icon: XCircle,
      colors: 'bg-red-100 text-red-700 border-red-200',
    },
  }

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const { label, icon: Icon, colors } = config[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        colors,
        sizeStyles[size]
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {label}
    </span>
  )
}
