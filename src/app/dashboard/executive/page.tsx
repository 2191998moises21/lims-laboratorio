'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, Activity, FlaskConical, Clock, CheckCircle, AlertTriangle, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface DashboardStats {
  todaySamples: number
  weekSamples: number
  pendingSamples: number
  urgentSamples: number
  completedTests: number
  validatedResults: number
  criticalResults: number
  positiveResults: number
  negativeResults: number
  avgProcessingTime: number
  weeklyTrend: Array<{ date: string; samples: number; completed: number }>
  sampleTypeDistribution: Array<{ type: string; count: number }>
  topTests: Array<{ name: string; code: string; count: number }>
}

export default function ExecutiveDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchStats()
    }
  }, [status, router, timeRange])

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/dashboard/stats?timeRange=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
      toast.error('Error al cargar estadísticas')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                onClick={() => router.push('/')}
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Dashboard
              </Button>
              <div className="h-px w-8 bg-slate-300"></div>
              <Activity className="h-6 w-6 text-slate-700" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  Panel de Control Ejecutivo
                </h1>
                <p className="text-xs text-slate-500">Bacteriología</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2"
              >
                <option value="today">Hoy</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={isLoading}
                className="border-slate-300"
              >
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Visión General del Laboratorio
          </h2>
          <p className="text-slate-600">
            Métricas y estadísticas del área de bacteriología
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div>
        )}

        {!isLoading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Muestras Hoy</CardTitle>
                  <CardDescription>Recibidas este día</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{stats.todaySamples}</div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Pendientes</CardTitle>
                  <CardDescription>En proceso</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{stats.pendingSamples}</div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Completados</CardTitle>
                  <CardDescription>Pruebas finalizadas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{stats.completedTests}</div>
                </CardContent>
              </Card>

              {stats.criticalResults > 0 && (
                <Card className="border-red-200 shadow-sm bg-red-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-red-900">Críticos</CardTitle>
                    <CardDescription className="text-red-700">Resultados urgentes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-900">{stats.criticalResults}</div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Resultados Cualitativos</CardTitle>
                <CardDescription>Distribución de resultados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-900">{stats.positiveResults}</div>
                    <div className="text-sm text-red-700">Positivos</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-900">{stats.negativeResults}</div>
                    <div className="text-sm text-green-700">Negativos</div>
                  </div>
                  <div className="text-center p-4 bg-slate-100 rounded-lg">
                    <div className="text-2xl font-bold text-slate-900">{stats.positiveResults + stats.negativeResults}</div>
                    <div className="text-sm text-slate-700">Total</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Accesos Rápidos</CardTitle>
                <CardDescription>Acciones frecuentes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="border-slate-300"
                    onClick={() => router.push('/samples/new')}
                  >
                    <FlaskConical className="h-4 w-4 mr-2" />
                    Registrar Muestra
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-300"
                    onClick={() => router.push('/results')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Ver Resultados
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
