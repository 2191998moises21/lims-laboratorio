// =============================================================================
// API: QC RESULTS (Resultados de Control de Calidad)
// =============================================================================
// Registro de resultados de QC con validación de reglas Westgard
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ============================================================================
// REGLAS WESTGARD
// ============================================================================

interface WestgardResult {
  rule: string | null
  isViolation: boolean
  description: string
}

function checkWestgardRules(
  newValue: number,
  expectedValue: number,
  sd: number,
  previousResults: { obtainedValue: number; deviationSD: number }[]
): WestgardResult {
  const newDeviationSD = (newValue - expectedValue) / sd

  // 1:3s - Un valor excede ±3SD (Error aleatorio o sistemático grave)
  if (Math.abs(newDeviationSD) > 3) {
    return {
      rule: '1:3s',
      isViolation: true,
      description: 'Valor excede ±3SD - Posible error grave',
    }
  }

  // 1:2s - Un valor excede ±2SD (Advertencia, verificar siguiente control)
  if (Math.abs(newDeviationSD) > 2) {
    return {
      rule: '1:2s',
      isViolation: true,
      description: 'Valor excede ±2SD - Revisar siguiente control',
    }
  }

  // Necesitamos al menos 1 resultado previo para las siguientes reglas
  if (previousResults.length < 1) {
    return { rule: null, isViolation: false, description: 'Dentro de límites aceptables' }
  }

  const lastResult = previousResults[0]

  // 2:2s - Dos valores consecutivos exceden el mismo límite ±2SD
  if (
    Math.abs(newDeviationSD) > 2 &&
    Math.abs(lastResult.deviationSD) > 2 &&
    Math.sign(newDeviationSD) === Math.sign(lastResult.deviationSD)
  ) {
    return {
      rule: '2:2s',
      isViolation: true,
      description: 'Dos valores consecutivos exceden ±2SD en la misma dirección - Error sistemático',
    }
  }

  // R:4s - Diferencia entre dos valores consecutivos excede 4SD
  if (Math.abs(newDeviationSD - lastResult.deviationSD) > 4) {
    return {
      rule: 'R:4s',
      isViolation: true,
      description: 'Diferencia entre valores consecutivos excede 4SD - Error aleatorio',
    }
  }

  // Necesitamos al menos 3 resultados previos para las siguientes reglas
  if (previousResults.length < 3) {
    return { rule: null, isViolation: false, description: 'Dentro de límites aceptables' }
  }

  // 4:1s - Cuatro valores consecutivos exceden el mismo límite ±1SD
  const last4Values = [newDeviationSD, ...previousResults.slice(0, 3).map((r) => r.deviationSD)]
  const allAbove1s = last4Values.every((v) => v > 1)
  const allBelow1s = last4Values.every((v) => v < -1)

  if (allAbove1s || allBelow1s) {
    return {
      rule: '4:1s',
      isViolation: true,
      description: 'Cuatro valores consecutivos exceden ±1SD en la misma dirección - Error sistemático',
    }
  }

  // Necesitamos al menos 9 resultados previos para la siguiente regla
  if (previousResults.length < 9) {
    return { rule: null, isViolation: false, description: 'Dentro de límites aceptables' }
  }

  // 10x - Diez valores consecutivos en el mismo lado de la media
  const last10Values = [newDeviationSD, ...previousResults.slice(0, 9).map((r) => r.deviationSD)]
  const allPositive = last10Values.every((v) => v > 0)
  const allNegative = last10Values.every((v) => v < 0)

  if (allPositive || allNegative) {
    return {
      rule: '10x',
      isViolation: true,
      description: 'Diez valores consecutivos en el mismo lado de la media - Sesgo sistemático',
    }
  }

  return { rule: null, isViolation: false, description: 'Dentro de límites aceptables' }
}

// GET - Listar resultados de QC
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const qcLotId = searchParams.get('qcLotId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: Record<string, unknown> = {}

    if (qcLotId) {
      where.qcLotId = qcLotId
    }

    if (startDate || endDate) {
      where.performedAt = {}
      if (startDate) {
        (where.performedAt as Record<string, Date>).gte = new Date(startDate)
      }
      if (endDate) {
        (where.performedAt as Record<string, Date>).lte = new Date(endDate)
      }
    }

    const results = await db.qCResult.findMany({
      where,
      include: {
        qcLot: true,
      },
      orderBy: { performedAt: 'desc' },
      take: limit,
    })

    // Calcular estadísticas
    const acceptedResults = results.filter((r) => r.isAccepted)
    const rejectedResults = results.filter((r) => !r.isAccepted)

    // Datos para gráfico Levey-Jennings
    const chartData = results.reverse().map((r) => ({
      date: r.performedAt,
      value: r.obtainedValue,
      expected: r.expectedValue,
      deviationSD: r.deviationSD,
      isAccepted: r.isAccepted,
      westgardRule: r.westgardRule,
    }))

    return NextResponse.json({
      results,
      stats: {
        total: results.length,
        accepted: acceptedResults.length,
        rejected: rejectedResults.length,
        acceptanceRate: results.length > 0 ? (acceptedResults.length / results.length) * 100 : 0,
      },
      chartData,
    })
  } catch (error) {
    console.error('[QCResults GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener resultados de QC' },
      { status: 500 }
    )
  }
}

// POST - Registrar resultado de QC
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para registrar QC' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { qcLotId, obtainedValue, equipmentId, reagentLotId, notes } = body

    if (!qcLotId || obtainedValue === undefined) {
      return NextResponse.json(
        { error: 'Lote de QC y valor obtenido son requeridos' },
        { status: 400 }
      )
    }

    // Obtener lote de QC
    const qcLot = await db.qCLot.findUnique({
      where: { id: qcLotId },
    })

    if (!qcLot) {
      return NextResponse.json(
        { error: 'Lote de QC no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el lote no esté expirado
    if (qcLot.expiryDate < new Date()) {
      return NextResponse.json(
        { error: 'El lote de QC está expirado' },
        { status: 400 }
      )
    }

    const value = parseFloat(obtainedValue)
    const deviation = value - qcLot.expectedValue
    const deviationSD = deviation / qcLot.standardDeviation

    // Verificar si está dentro de límites aceptables
    const isAccepted = value >= qcLot.acceptableMin && value <= qcLot.acceptableMax

    // Obtener resultados previos para reglas Westgard
    const previousResults = await db.qCResult.findMany({
      where: { qcLotId },
      orderBy: { performedAt: 'desc' },
      take: 10,
      select: { obtainedValue: true, deviationSD: true },
    })

    // Verificar reglas Westgard
    const westgardCheck = checkWestgardRules(
      value,
      qcLot.expectedValue,
      qcLot.standardDeviation,
      previousResults
    )

    const result = await db.qCResult.create({
      data: {
        qcLotId,
        performedById: session.user.id,
        obtainedValue: value,
        expectedValue: qcLot.expectedValue,
        deviation,
        deviationSD,
        isAccepted: isAccepted && !westgardCheck.isViolation,
        westgardRule: westgardCheck.rule,
        equipmentId,
        reagentLotId,
        notes,
      },
      include: {
        qcLot: true,
      },
    })

    return NextResponse.json({
      result,
      westgard: westgardCheck,
      limits: {
        min: qcLot.acceptableMin,
        max: qcLot.acceptableMax,
        mean: qcLot.expectedValue,
        sd: qcLot.standardDeviation,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[QCResults POST]', error)
    return NextResponse.json(
      { error: 'Error al registrar resultado de QC' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar resultado de QC (agregar corrección)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para modificar QC' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, correctionApplied, notes } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID requerido' },
        { status: 400 }
      )
    }

    const updated = await db.qCResult.update({
      where: { id },
      data: {
        correctionApplied,
        notes,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[QCResults PUT]', error)
    return NextResponse.json(
      { error: 'Error al actualizar resultado de QC' },
      { status: 500 }
    )
  }
}
