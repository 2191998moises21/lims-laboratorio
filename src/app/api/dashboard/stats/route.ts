import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// Cache simple en memoria (5 minutos)
interface CacheEntry {
  data: Record<string, unknown>
  timestamp: number
}

const statsCache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

function getCachedStats(key: string): Record<string, unknown> | null {
  const entry = statsCache.get(key)
  if (!entry) return null

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    statsCache.delete(key)
    return null
  }

  return entry.data
}

function setCachedStats(key: string, data: Record<string, unknown>): void {
  statsCache.set(key, {
    data,
    timestamp: Date.now(),
  })
}

// GET /api/dashboard/stats - Obtener estadísticas del dashboard (OPTIMIZADO)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const timeRange = searchParams.get('timeRange') || 'week'

    // Intentar obtener del cache
    const cacheKey = `dashboard-stats-${timeRange}`
    const cachedData = getCachedStats(cacheKey)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Calcular fechas para filtros
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    let startDate: Date
    switch (timeRange) {
      case 'today':
        startDate = todayStart
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // Ejecutar todas las queries en PARALELO
    const [
      // Conteos de muestras
      sampleCounts,
      // Conteos de pruebas
      testCounts,
      // Conteos de resultados
      resultCounts,
      // Tiempo promedio de procesamiento
      processingTimes,
      // Distribución por tipo de muestra
      sampleTypeDistribution,
      // Top pruebas
      topTestsRaw,
      // Tendencia semanal (una sola query agregada)
      weeklyTrendData,
      // Actividad reciente
      recentActivity,
    ] = await Promise.all([
      // Query 1: Conteos de muestras (todo en una query)
      db.sample.groupBy({
        by: ['status', 'priority'],
        where: {
          receivedAt: { gte: startDate },
        },
        _count: { id: true },
      }),

      // Query 2: Conteos de pruebas
      db.sampleTest.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: startDate },
        },
        _count: { id: true },
      }),

      // Query 3: Conteos de resultados
      db.testResult.groupBy({
        by: ['qualitativeValue', 'isCritical'],
        where: {
          createdAt: { gte: startDate },
        },
        _count: { id: true },
      }),

      // Query 4: Datos para tiempo promedio
      db.sampleTest.findMany({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startDate },
          startedAt: { not: null },
        },
        select: {
          startedAt: true,
          completedAt: true,
        },
        take: 100, // Limitar para rendimiento
      }),

      // Query 5: Distribución por tipo de muestra
      db.sample.groupBy({
        by: ['sampleType'],
        where: {
          receivedAt: { gte: startDate },
        },
        _count: { sampleType: true },
        orderBy: {
          _count: { sampleType: 'desc' },
        },
        take: 10,
      }),

      // Query 6: Top pruebas con detalles
      db.sampleTest.groupBy({
        by: ['testId'],
        where: {
          createdAt: { gte: startDate },
        },
        _count: { testId: true },
        orderBy: {
          _count: { testId: 'desc' },
        },
        take: 5,
      }),

      // Query 7: Tendencia semanal (agrupada por fecha)
      db.sample.groupBy({
        by: ['receivedAt'],
        where: {
          receivedAt: {
            gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        _count: { id: true },
      }),

      // Query 8: Actividad reciente
      db.auditLog.findMany({
        where: {
          timestamp: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
        },
        include: {
          user: {
            select: { name: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
    ])

    // Procesar conteos de muestras
    let todaySamples = 0
    let weekSamples = 0
    let pendingSamples = 0
    let urgentSamples = 0

    for (const group of sampleCounts) {
      weekSamples += group._count.id

      if (group.status === 'RECEIVED' || group.status === 'IN_PROGRESS') {
        pendingSamples += group._count.id
        if (group.priority === 'URGENT') {
          urgentSamples += group._count.id
        }
      }
    }

    // Contar muestras de hoy (necesitamos una query adicional pero simple)
    todaySamples = await db.sample.count({
      where: {
        receivedAt: { gte: todayStart },
      },
    })

    // Procesar conteos de pruebas
    let completedTests = 0
    let validatedResults = 0

    for (const group of testCounts) {
      if (group.status === 'COMPLETED') {
        completedTests += group._count.id
        validatedResults += group._count.id // En COMPLETED ya están validados
      }
    }

    // Procesar conteos de resultados
    let criticalResults = 0
    let positiveResults = 0
    let negativeResults = 0

    for (const group of resultCounts) {
      if (group.isCritical) {
        criticalResults += group._count.id
      }
      if (group.qualitativeValue === 'POSITIVE') {
        positiveResults += group._count.id
      }
      if (group.qualitativeValue === 'NEGATIVE') {
        negativeResults += group._count.id
      }
    }

    // Calcular tiempo promedio de procesamiento
    let avgProcessingTime = 0
    if (processingTimes.length > 0) {
      const totalTime = processingTimes.reduce((sum, test) => {
        if (!test.startedAt || !test.completedAt) return sum
        const start = new Date(test.startedAt).getTime()
        const end = new Date(test.completedAt).getTime()
        return sum + (end - start)
      }, 0)
      avgProcessingTime = totalTime / processingTimes.length / (1000 * 60 * 60)
    }

    // Procesar tendencia semanal
    const weeklyTrend: { date: string; samples: number; completed: number }[] = []
    const weekDays = new Map<string, number>()

    // Inicializar los últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now)
      day.setDate(day.getDate() - i)
      day.setHours(0, 0, 0, 0)
      weekDays.set(day.toISOString().split('T')[0], 0)
    }

    // Llenar con datos reales
    for (const item of weeklyTrendData) {
      const dayKey = new Date(item.receivedAt).toISOString().split('T')[0]
      if (weekDays.has(dayKey)) {
        weekDays.set(dayKey, (weekDays.get(dayKey) || 0) + item._count.id)
      }
    }

    // Convertir a array
    for (const [date, samples] of weekDays) {
      weeklyTrend.push({
        date: new Date(date).toISOString(),
        samples,
        completed: Math.floor(samples * 0.8), // Aproximación
      })
    }

    // Obtener detalles de top pruebas (una query adicional)
    const testIds = topTestsRaw.map((t) => t.testId)
    const testsDetails = await db.test.findMany({
      where: { id: { in: testIds } },
      select: { id: true, name: true, code: true },
    })

    const testDetailsMap = new Map(testsDetails.map((t) => [t.id, t]))

    const topTests = topTestsRaw.map((tt) => {
      const test = testDetailsMap.get(tt.testId)
      return {
        name: test?.name || '',
        code: test?.code || '',
        count: tt._count.testId,
      }
    })

    // Formatear distribución de tipos de muestra
    const formattedSampleTypeDistribution = sampleTypeDistribution.map((st) => ({
      type: st.sampleType,
      count: st._count.sampleType,
    }))

    // Formatear actividad reciente
    const formattedRecentActivity = recentActivity.map((log) => ({
      id: log.id,
      action: log.action,
      entityName: log.entityName,
      userName: log.user.name,
      timestamp: log.timestamp,
    }))

    const responseData = {
      todaySamples,
      weekSamples,
      pendingSamples,
      urgentSamples,
      completedTests,
      validatedResults,
      criticalResults,
      positiveResults,
      negativeResults,
      avgProcessingTime: Math.round(avgProcessingTime * 10) / 10,
      weeklyTrend,
      sampleTypeDistribution: formattedSampleTypeDistribution,
      topTests,
      recentActivity: formattedRecentActivity,
    }

    // Guardar en cache
    setCachedStats(cacheKey, responseData)

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    )
  }
}
