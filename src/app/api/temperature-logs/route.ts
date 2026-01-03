// =============================================================================
// API: TEMPERATURE LOGS
// =============================================================================
// Registro de temperatura de equipos y ubicaciones
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Obtener registros de temperatura
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')
    const equipmentId = searchParams.get('equipmentId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const outOfRangeOnly = searchParams.get('outOfRangeOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: Record<string, unknown> = {}

    if (location) {
      where.location = location
    }

    if (equipmentId) {
      where.equipmentId = equipmentId
    }

    if (outOfRangeOnly) {
      where.isOutOfRange = true
    }

    if (startDate || endDate) {
      where.recordedAt = {}
      if (startDate) {
        (where.recordedAt as Record<string, Date>).gte = new Date(startDate)
      }
      if (endDate) {
        (where.recordedAt as Record<string, Date>).lte = new Date(endDate)
      }
    }

    const logs = await db.temperatureLog.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: limit,
    })

    // Obtener ubicaciones únicas
    const locations = await db.temperatureLog.findMany({
      select: { location: true },
      distinct: ['location'],
    })

    // Estadísticas por ubicación
    const statsByLocation: Record<string, {
      avgTemp: number
      minTemp: number
      maxTemp: number
      outOfRangeCount: number
      totalCount: number
    }> = {}

    for (const log of logs) {
      if (!statsByLocation[log.location]) {
        statsByLocation[log.location] = {
          avgTemp: 0,
          minTemp: Infinity,
          maxTemp: -Infinity,
          outOfRangeCount: 0,
          totalCount: 0,
        }
      }

      const stats = statsByLocation[log.location]
      stats.avgTemp = (stats.avgTemp * stats.totalCount + log.temperature) / (stats.totalCount + 1)
      stats.minTemp = Math.min(stats.minTemp, log.temperature)
      stats.maxTemp = Math.max(stats.maxTemp, log.temperature)
      stats.totalCount++
      if (log.isOutOfRange) stats.outOfRangeCount++
    }

    return NextResponse.json({
      logs,
      locations: locations.map((l) => l.location),
      statsByLocation,
      total: logs.length,
    })
  } catch (error) {
    console.error('[TemperatureLogs GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener registros de temperatura' },
      { status: 500 }
    )
  }
}

// POST - Registrar temperatura
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      location,
      equipmentId,
      temperature,
      humidity,
      minAcceptable,
      maxAcceptable,
      isAutomatic,
      notes,
    } = body

    if (!location || temperature === undefined) {
      return NextResponse.json(
        { error: 'Ubicación y temperatura son requeridos' },
        { status: 400 }
      )
    }

    const temp = parseFloat(temperature)
    const min = minAcceptable ? parseFloat(minAcceptable) : null
    const max = maxAcceptable ? parseFloat(maxAcceptable) : null

    // Determinar si está fuera de rango
    let isOutOfRange = false
    if (min !== null && temp < min) isOutOfRange = true
    if (max !== null && temp > max) isOutOfRange = true

    const log = await db.temperatureLog.create({
      data: {
        location,
        equipmentId,
        temperature: temp,
        humidity: humidity ? parseFloat(humidity) : null,
        minAcceptable: min,
        maxAcceptable: max,
        isOutOfRange,
        isAutomatic: isAutomatic || false,
        recordedById: isAutomatic ? null : session.user.id,
        notes,
      },
    })

    // Si está fuera de rango, crear alerta (podrías integrar con sistema de notificaciones)
    if (isOutOfRange) {
      console.warn(`[TemperatureLog] ALERTA: Temperatura fuera de rango en ${location}: ${temp}°C`)
    }

    return NextResponse.json({
      log,
      alert: isOutOfRange ? {
        message: `Temperatura fuera de rango: ${temp}°C`,
        location,
        expectedRange: `${min || 'N/A'} - ${max || 'N/A'}°C`,
      } : null,
    }, { status: 201 })
  } catch (error) {
    console.error('[TemperatureLogs POST]', error)
    return NextResponse.json(
      { error: 'Error al registrar temperatura' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar registro (agregar corrección aplicada)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, correctionApplied, notes } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID requerido' },
        { status: 400 }
      )
    }

    const updated = await db.temperatureLog.update({
      where: { id },
      data: {
        correctionApplied,
        notes,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[TemperatureLogs PUT]', error)
    return NextResponse.json(
      { error: 'Error al actualizar registro' },
      { status: 500 }
    )
  }
}
