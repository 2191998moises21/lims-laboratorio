// =============================================================================
// API: QC LOTS (Lotes de Control de Calidad)
// =============================================================================
// Gestión de lotes de control con valores esperados y límites
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Listar lotes de QC
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('testId')
    const activeOnly = searchParams.get('active') !== 'false'
    const includeExpired = searchParams.get('includeExpired') === 'true'

    const where: Record<string, unknown> = {}

    if (activeOnly) {
      where.isActive = true
    }

    if (testId) {
      where.testId = testId
    }

    if (!includeExpired) {
      where.expiryDate = {
        gte: new Date(),
      }
    }

    const lots = await db.qCLot.findMany({
      where,
      include: {
        results: {
          orderBy: { performedAt: 'desc' },
          take: 20, // Últimos 20 resultados
        },
      },
      orderBy: [{ expiryDate: 'asc' }],
    })

    // Calcular estadísticas para cada lote
    const lotsWithStats = lots.map((lot) => {
      const results = lot.results
      const acceptedCount = results.filter((r) => r.isAccepted).length
      const totalCount = results.length

      return {
        ...lot,
        stats: {
          totalResults: totalCount,
          acceptedResults: acceptedCount,
          rejectedResults: totalCount - acceptedCount,
          acceptanceRate: totalCount > 0 ? (acceptedCount / totalCount) * 100 : 0,
          isExpiringSoon: lot.expiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isExpired: lot.expiryDate < new Date(),
        },
      }
    })

    return NextResponse.json({
      lots: lotsWithStats,
      total: lots.length,
    })
  } catch (error) {
    console.error('[QCLots GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener lotes de QC' },
      { status: 500 }
    )
  }
}

// POST - Crear lote de QC
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para crear lotes de QC' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      lotNumber,
      manufacturer,
      testId,
      parameterId,
      expectedValue,
      standardDeviation,
      unit,
      expiryDate,
      notes,
    } = body

    // Validación
    if (!name || !lotNumber || !manufacturer || !testId || !expectedValue || !standardDeviation) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // Verificar lote único
    const existing = await db.qCLot.findUnique({
      where: { lotNumber },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un lote con ese número' },
        { status: 400 }
      )
    }

    // Calcular límites aceptables (media ± 2SD)
    const mean = parseFloat(expectedValue)
    const sd = parseFloat(standardDeviation)
    const acceptableMin = mean - 2 * sd
    const acceptableMax = mean + 2 * sd

    const lot = await db.qCLot.create({
      data: {
        name,
        lotNumber,
        manufacturer,
        testId,
        parameterId,
        expectedValue: mean,
        standardDeviation: sd,
        acceptableMin,
        acceptableMax,
        unit,
        expiryDate: new Date(expiryDate),
        notes,
      },
    })

    return NextResponse.json(lot, { status: 201 })
  } catch (error) {
    console.error('[QCLots POST]', error)
    return NextResponse.json(
      { error: 'Error al crear lote de QC' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar lote de QC
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para modificar lotes de QC' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID requerido' },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}

    if (updateData.name) data.name = updateData.name
    if (updateData.manufacturer) data.manufacturer = updateData.manufacturer
    if (updateData.unit) data.unit = updateData.unit
    if (updateData.notes !== undefined) data.notes = updateData.notes
    if (updateData.isActive !== undefined) data.isActive = updateData.isActive
    if (updateData.openedDate) data.openedDate = new Date(updateData.openedDate)

    // Si se actualizan valores estadísticos, recalcular límites
    if (updateData.expectedValue || updateData.standardDeviation) {
      const lot = await db.qCLot.findUnique({ where: { id } })
      if (lot) {
        const mean = updateData.expectedValue ? parseFloat(updateData.expectedValue) : lot.expectedValue
        const sd = updateData.standardDeviation ? parseFloat(updateData.standardDeviation) : lot.standardDeviation

        data.expectedValue = mean
        data.standardDeviation = sd
        data.acceptableMin = mean - 2 * sd
        data.acceptableMax = mean + 2 * sd
      }
    }

    const updated = await db.qCLot.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[QCLots PUT]', error)
    return NextResponse.json(
      { error: 'Error al actualizar lote de QC' },
      { status: 500 }
    )
  }
}
