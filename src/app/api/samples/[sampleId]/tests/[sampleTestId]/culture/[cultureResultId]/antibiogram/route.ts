// =============================================================================
// API: ANTIBIOGRAM RESULTS
// =============================================================================
// Gestión de resultados de antibiograma para un aislado específico
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    sampleId: string
    sampleTestId: string
    cultureResultId: string
  }>
}

// GET - Obtener antibiograma de un aislado
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { cultureResultId } = await params

    const antibiogramResults = await db.antibiogramResult.findMany({
      where: { cultureResultId },
      include: {
        antibiotic: true,
      },
      orderBy: {
        antibiotic: { group: 'asc' },
      },
    })

    // Agrupar por grupo de antibiótico
    const grouped = antibiogramResults.reduce((acc, result) => {
      const group = result.antibiotic.group
      if (!acc[group]) {
        acc[group] = []
      }
      acc[group].push(result)
      return acc
    }, {} as Record<string, typeof antibiogramResults>)

    // Estadísticas
    const stats = {
      total: antibiogramResults.length,
      susceptible: antibiogramResults.filter((r) => r.sensitivity === 'SUSCEPTIBLE').length,
      intermediate: antibiogramResults.filter((r) => r.sensitivity === 'INTERMEDIATE').length,
      resistant: antibiogramResults.filter((r) => r.sensitivity === 'RESISTANT').length,
      notTested: antibiogramResults.filter((r) => r.sensitivity === 'NOT_TESTED').length,
    }

    return NextResponse.json({
      results: antibiogramResults,
      grouped,
      stats,
    })
  } catch (error) {
    console.error('[Antibiogram GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener antibiograma' },
      { status: 500 }
    )
  }
}

// POST - Agregar resultados de antibiograma
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para registrar antibiograma' },
        { status: 403 }
      )
    }

    const { cultureResultId } = await params
    const body = await request.json()

    // Puede recibir un solo resultado o un array
    const results = Array.isArray(body) ? body : [body]

    // Verificar que existe el cultivo
    const cultureResult = await db.cultureResult.findUnique({
      where: { id: cultureResultId },
    })

    if (!cultureResult) {
      return NextResponse.json(
        { error: 'Resultado de cultivo no encontrado' },
        { status: 404 }
      )
    }

    const createdResults = []

    for (const result of results) {
      const {
        antibioticId,
        sensitivity,
        zoneDiameter,
        mic,
        micMethod,
        interpretationStandard,
        notes,
      } = result

      if (!antibioticId || !sensitivity) {
        continue // Saltar resultados incompletos
      }

      // Validar sensibilidad
      const validSensitivities = ['SUSCEPTIBLE', 'INTERMEDIATE', 'RESISTANT', 'NOT_TESTED', 'SUSCEPTIBLE_DI']
      if (!validSensitivities.includes(sensitivity)) {
        continue
      }

      try {
        // Upsert: actualizar si existe, crear si no
        const antibiogramResult = await db.antibiogramResult.upsert({
          where: {
            cultureResultId_antibioticId: {
              cultureResultId,
              antibioticId,
            },
          },
          update: {
            sensitivity,
            zoneDiameter: zoneDiameter ? parseFloat(zoneDiameter) : null,
            mic: mic ? parseFloat(mic) : null,
            micMethod,
            interpretationStandard: interpretationStandard || 'CLSI',
            notes,
          },
          create: {
            cultureResultId,
            antibioticId,
            sensitivity,
            zoneDiameter: zoneDiameter ? parseFloat(zoneDiameter) : null,
            mic: mic ? parseFloat(mic) : null,
            micMethod,
            interpretationStandard: interpretationStandard || 'CLSI',
            notes,
          },
          include: {
            antibiotic: true,
          },
        })

        createdResults.push(antibiogramResult)
      } catch (err) {
        console.error('[Antibiogram] Error creating result:', err)
      }
    }

    return NextResponse.json({
      created: createdResults.length,
      results: createdResults,
    }, { status: 201 })
  } catch (error) {
    console.error('[Antibiogram POST]', error)
    return NextResponse.json(
      { error: 'Error al crear antibiograma' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar resultado de antibiograma individual
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para modificar antibiograma' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { antibiogramResultId, ...updateData } = body

    if (!antibiogramResultId) {
      return NextResponse.json(
        { error: 'ID de resultado requerido' },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}

    if (updateData.sensitivity !== undefined) data.sensitivity = updateData.sensitivity
    if (updateData.zoneDiameter !== undefined) {
      data.zoneDiameter = updateData.zoneDiameter ? parseFloat(updateData.zoneDiameter) : null
    }
    if (updateData.mic !== undefined) {
      data.mic = updateData.mic ? parseFloat(updateData.mic) : null
    }
    if (updateData.micMethod !== undefined) data.micMethod = updateData.micMethod
    if (updateData.interpretationStandard !== undefined) data.interpretationStandard = updateData.interpretationStandard
    if (updateData.notes !== undefined) data.notes = updateData.notes

    const updated = await db.antibiogramResult.update({
      where: { id: antibiogramResultId },
      data,
      include: {
        antibiotic: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[Antibiogram PUT]', error)
    return NextResponse.json(
      { error: 'Error al actualizar antibiograma' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar resultado de antibiograma
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para eliminar antibiograma' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const antibiogramResultId = searchParams.get('id')

    if (!antibiogramResultId) {
      return NextResponse.json(
        { error: 'ID requerido' },
        { status: 400 }
      )
    }

    await db.antibiogramResult.delete({
      where: { id: antibiogramResultId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Antibiogram DELETE]', error)
    return NextResponse.json(
      { error: 'Error al eliminar resultado' },
      { status: 500 }
    )
  }
}
