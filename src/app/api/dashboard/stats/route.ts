import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/dashboard/stats - Obtener estadísticas del dashboard
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

    // Calcular fechas para filtros
    const now = new Date()
    let startDate: Date

    switch (timeRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        break
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        break
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1))
        break
      default:
        startDate = new Date(now.setDate(now.getDate() - 7))
    }

    // Estadísticas básicas
    const todaySamples = await db.sample.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })

    const weekSamples = await db.sample.count({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    })

    const pendingSamples = await db.sample.count({
      where: {
        status: {
          in: ['RECEIVED', 'IN_PROGRESS']
        }
      }
    })

    const urgentSamples = await db.sample.count({
      where: {
        priority: 'URGENT',
        status: {
          in: ['RECEIVED', 'IN_PROGRESS']
        }
      }
    })

    const completedTests = await db.sampleTest.count({
      where: {
        status: 'COMPLETED',
        completedAt: {
          gte: startDate
        }
      }
    })

    const validatedResults = await db.sampleTest.count({
      where: {
        status: 'COMPLETED',
        validatedAt: {
          gte: startDate
        }
      }
    })

    const criticalResults = await db.testResult.count({
      where: {
        isCritical: true,
        sampleTest: {
          status: 'COMPLETED',
          sample: {
            createdAt: {
              gte: startDate
            }
          }
        }
      }
    })

    const positiveResults = await db.testResult.count({
      where: {
        qualitativeValue: 'POSITIVE',
        parameter: {
          resultType: 'QUALITATIVE'
        },
        sampleTest: {
          status: 'COMPLETED',
          sample: {
            createdAt: {
              gte: startDate
            }
          }
        }
      }
    })

    const negativeResults = await db.testResult.count({
      where: {
        qualitativeValue: 'NEGATIVE',
        parameter: {
          resultType: 'QUALITATIVE'
        },
        sampleTest: {
          status: 'COMPLETED',
          sample: {
            createdAt: {
              gte: startDate
            }
          }
        }
      }
    })

    // Tiempo promedio de procesamiento (en horas)
    const completedTestsList = await db.sampleTest.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          gte: startDate
        },
        startedAt: {
          not: null
        }
      },
      select: {
        startedAt: true,
        completedAt: true
      }
    })

    let avgProcessingTime = 0
    if (completedTestsList.length > 0) {
      const totalTime = completedTestsList.reduce((sum, test) => {
        const start = new Date(test.startedAt).getTime()
        const end = new Date(test.completedAt!).getTime()
        return sum + (end - start)
      }, 0)
      avgProcessingTime = totalTime / completedTestsList.length / (1000 * 60 * 60) // Convertir a horas
    }

    // Tendencia semanal (últimos 7 días)
    const weeklyTrend = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now)
      dayStart.setDate(dayStart.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)

      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const daySamples = await db.sample.count({
        where: {
          createdAt: {
            gte: dayStart,
            lt: dayEnd
          }
        }
      })

      const dayCompleted = await db.sampleTest.count({
        where: {
          status: 'COMPLETED',
          completedAt: {
            gte: dayStart,
            lt: dayEnd
          }
        }
      })

      weeklyTrend.push({
        date: dayStart.toISOString(),
        samples: daySamples,
        completed: dayCompleted
      })
    }

    // Distribución por tipo de muestra
    const sampleTypes = await db.sample.groupBy({
      by: ['sampleType'],
      where: {
        createdAt: {
          gte: startDate
        }
      },
      _count: {
        sampleType: true
      },
      orderBy: {
        _count: {
          sampleType: 'desc'
        }
      }
    })

    const sampleTypeDistribution = sampleTypes.map(st => ({
      type: st.sampleType,
      count: st._count.sampleType
    }))

    // Pruebas más solicitadas
    const topTests = await db.sampleTest.groupBy({
      by: ['testId'],
      where: {
        createdAt: {
          gte: startDate
        }
      },
      _count: {
        testId: true
      },
      orderBy: {
        _count: {
          testId: 'desc'
        }
      },
      take: 5
    })

    const topTestsWithDetails = await Promise.all(
      topTests.map(async (tt) => {
        const test = await db.test.findUnique({
          where: { id: tt.testId }
        })
        return {
          name: test?.name || '',
          code: test?.code || '',
          count: tt._count.testId
        }
      })
    )

    // Actividad reciente (últimas 10 acciones de auditoría)
    const recentActivity = await db.auditLog.findMany({
      where: {
        createdAt: {
          gte: new Date(now.setHours(now.getHours() - 24))
        }
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    const formattedRecentActivity = recentActivity.map(log => ({
      id: log.id,
      action: log.action,
      entityName: log.entityName,
      userName: log.user.name,
      timestamp: log.createdAt
    }))

    return NextResponse.json({
      todaySamples,
      weekSamples,
      pendingSamples,
      urgentSamples,
      completedTests,
      validatedResults,
      criticalResults,
      positiveResults,
      negativeResults,
      avgProcessingTime: Math.round(avgProcessingTime * 10) / 10, // Redondear a 1 decimal
      weeklyTrend,
      sampleTypeDistribution,
      topTests: topTestsWithDetails,
      recentActivity: formattedRecentActivity
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    )
  }
}
