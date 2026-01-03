// =============================================================================
// API: SAMPLE CHAIN OF CUSTODY
// =============================================================================
// Registro completo de la cadena de custodia de muestras
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    sampleId: string
  }>
}

// GET - Obtener cadena de custodia de una muestra
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { sampleId } = await params

    // Verificar que existe la muestra
    const sample = await db.sample.findUnique({
      where: { id: sampleId },
      select: { id: true, sampleCode: true, status: true },
    })

    if (!sample) {
      return NextResponse.json(
        { error: 'Muestra no encontrada' },
        { status: 404 }
      )
    }

    const custodyEvents = await db.sampleCustody.findMany({
      where: { sampleId },
      orderBy: { performedAt: 'asc' },
    })

    // Obtener nombres de usuarios
    const userIds = [...new Set(custodyEvents.flatMap((e) =>
      [e.performedById, e.witnessId].filter(Boolean) as string[]
    ))]

    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u.name]))

    const eventsWithNames = custodyEvents.map((event) => ({
      ...event,
      performedByName: userMap.get(event.performedById) || 'Desconocido',
      witnessName: event.witnessId ? userMap.get(event.witnessId) : null,
    }))

    // Calcular tiempo total en cada ubicación
    const locationTimes: Record<string, number> = {}
    for (let i = 0; i < custodyEvents.length; i++) {
      const event = custodyEvents[i]
      const nextEvent = custodyEvents[i + 1]
      const location = event.toLocation || event.fromLocation || 'Desconocido'

      if (nextEvent) {
        const duration = nextEvent.performedAt.getTime() - event.performedAt.getTime()
        locationTimes[location] = (locationTimes[location] || 0) + duration
      }
    }

    return NextResponse.json({
      sample,
      events: eventsWithNames,
      summary: {
        totalEvents: custodyEvents.length,
        firstEvent: custodyEvents[0]?.performedAt || null,
        lastEvent: custodyEvents[custodyEvents.length - 1]?.performedAt || null,
        currentLocation: custodyEvents[custodyEvents.length - 1]?.toLocation || null,
        locationTimes,
      },
    })
  } catch (error) {
    console.error('[SampleCustody GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener cadena de custodia' },
      { status: 500 }
    )
  }
}

// POST - Registrar evento de custodia
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { sampleId } = await params
    const body = await request.json()

    const {
      eventType,
      fromLocation,
      toLocation,
      temperature,
      condition,
      notes,
      witnessId,
    } = body

    // Validación
    if (!eventType) {
      return NextResponse.json(
        { error: 'Tipo de evento requerido' },
        { status: 400 }
      )
    }

    const validEventTypes = [
      'RECEIVED',
      'REGISTERED',
      'STORED',
      'RETRIEVED',
      'PROCESSED',
      'ALIQUOTED',
      'TRANSFERRED',
      'DISCARDED',
      'ARCHIVED',
    ]

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: 'Tipo de evento inválido' },
        { status: 400 }
      )
    }

    // Verificar que existe la muestra
    const sample = await db.sample.findUnique({
      where: { id: sampleId },
    })

    if (!sample) {
      return NextResponse.json(
        { error: 'Muestra no encontrada' },
        { status: 404 }
      )
    }

    const custodyEvent = await db.sampleCustody.create({
      data: {
        sampleId,
        eventType,
        performedById: session.user.id,
        fromLocation,
        toLocation,
        temperature: temperature ? parseFloat(temperature) : null,
        condition,
        notes,
        witnessId,
      },
    })

    return NextResponse.json(custodyEvent, { status: 201 })
  } catch (error) {
    console.error('[SampleCustody POST]', error)
    return NextResponse.json(
      { error: 'Error al registrar evento de custodia' },
      { status: 500 }
    )
  }
}
