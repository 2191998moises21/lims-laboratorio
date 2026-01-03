// =============================================================================
// API: SAMPLE REJECTION
// =============================================================================
// Gestión de rechazos de muestras con categorización y seguimiento
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

// Categorías de rechazo estándar
const REJECTION_CATEGORIES = {
  HEMOLYSIS: 'Hemólisis',
  LIPEMIA: 'Lipemia',
  ICTERICIA: 'Ictericia',
  INSUFFICIENT: 'Cantidad insuficiente',
  CONTAMINATED: 'Contaminación',
  CLOTTED: 'Muestra coagulada',
  WRONG_TUBE: 'Tubo incorrecto',
  EXPIRED: 'Muestra expirada',
  TRANSPORT: 'Problema de transporte',
  LABELING: 'Error de etiquetado',
  TEMPERATURE: 'Temperatura inadecuada',
  DELAY: 'Tiempo de procesamiento excedido',
  OTHER: 'Otro',
}

// GET - Obtener rechazos de una muestra
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { sampleId } = await params

    const rejections = await db.sampleRejection.findMany({
      where: { sampleId },
      orderBy: { rejectedAt: 'desc' },
    })

    // Obtener nombres de usuarios
    const userIds = [...new Set(rejections.map((r) => r.rejectedById))]
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u.name]))

    const rejectionsWithNames = rejections.map((rejection) => ({
      ...rejection,
      rejectedByName: userMap.get(rejection.rejectedById) || 'Desconocido',
      categoryName: REJECTION_CATEGORIES[rejection.category as keyof typeof REJECTION_CATEGORIES] || rejection.category,
    }))

    return NextResponse.json({
      rejections: rejectionsWithNames,
      categories: REJECTION_CATEGORIES,
    })
  } catch (error) {
    console.error('[SampleRejection GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener rechazos' },
      { status: 500 }
    )
  }
}

// POST - Registrar rechazo de muestra
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { sampleId } = await params
    const body = await request.json()

    const {
      reason,
      category,
      description,
      actionTaken,
      notifiedTo,
    } = body

    // Validación
    if (!reason || !category) {
      return NextResponse.json(
        { error: 'Razón y categoría son requeridos' },
        { status: 400 }
      )
    }

    if (!Object.keys(REJECTION_CATEGORIES).includes(category)) {
      return NextResponse.json(
        { error: 'Categoría de rechazo inválida' },
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

    // Crear rechazo y actualizar estado de muestra en transacción
    const [rejection] = await db.$transaction([
      db.sampleRejection.create({
        data: {
          sampleId,
          rejectedById: session.user.id,
          reason,
          category,
          description,
          actionTaken,
          notifiedTo,
          notifiedAt: notifiedTo ? new Date() : null,
        },
      }),
      db.sample.update({
        where: { id: sampleId },
        data: { status: 'CANCELLED' },
      }),
      // Registrar evento de custodia
      db.sampleCustody.create({
        data: {
          sampleId,
          eventType: 'DISCARDED',
          performedById: session.user.id,
          notes: `Muestra rechazada: ${reason}`,
        },
      }),
    ])

    return NextResponse.json({
      rejection,
      message: 'Muestra rechazada y marcada como cancelada',
    }, { status: 201 })
  } catch (error) {
    console.error('[SampleRejection POST]', error)
    return NextResponse.json(
      { error: 'Error al registrar rechazo' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar rechazo (agregar nueva muestra, acción tomada)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { rejectionId, newSampleId, actionTaken, notifiedTo } = body

    if (!rejectionId) {
      return NextResponse.json(
        { error: 'ID de rechazo requerido' },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}

    if (newSampleId) data.newSampleId = newSampleId
    if (actionTaken) data.actionTaken = actionTaken
    if (notifiedTo) {
      data.notifiedTo = notifiedTo
      data.notifiedAt = new Date()
    }

    const updated = await db.sampleRejection.update({
      where: { id: rejectionId },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[SampleRejection PUT]', error)
    return NextResponse.json(
      { error: 'Error al actualizar rechazo' },
      { status: 500 }
    )
  }
}
