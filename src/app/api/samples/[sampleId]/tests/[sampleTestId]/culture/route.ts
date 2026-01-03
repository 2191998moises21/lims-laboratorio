// =============================================================================
// API: CULTURE RESULTS (Resultados de Cultivo)
// =============================================================================
// Gestión de aislados microbiológicos para pruebas de cultivo
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
  }>
}

// GET - Obtener resultados de cultivo para una prueba
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { sampleTestId } = await params

    const cultureResults = await db.cultureResult.findMany({
      where: { sampleTestId },
      include: {
        organism: true,
        antibiogramResults: {
          include: {
            antibiotic: true,
          },
          orderBy: {
            antibiotic: { group: 'asc' },
          },
        },
      },
      orderBy: { isolateNumber: 'asc' },
    })

    return NextResponse.json({
      cultureResults,
      isolateCount: cultureResults.length,
    })
  } catch (error) {
    console.error('[CultureResults GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener resultados de cultivo' },
      { status: 500 }
    )
  }
}

// POST - Crear resultado de cultivo (aislado)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo bioanalistas pueden registrar cultivos
    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para registrar cultivos' },
        { status: 403 }
      )
    }

    const { sampleTestId } = await params
    const body = await request.json()

    const {
      organismId,
      colonyCount,
      cultureMedia,
      incubationTemp,
      incubationHours,
      morphologyNotes,
      gramStainResult,
      biochemicalTests,
      identificationMethod,
      confidenceLevel,
      notes,
    } = body

    // Verificar que existe el sampleTest
    const sampleTest = await db.sampleTest.findUnique({
      where: { id: sampleTestId },
    })

    if (!sampleTest) {
      return NextResponse.json(
        { error: 'Prueba no encontrada' },
        { status: 404 }
      )
    }

    // Obtener siguiente número de aislado
    const lastIsolate = await db.cultureResult.findFirst({
      where: { sampleTestId },
      orderBy: { isolateNumber: 'desc' },
    })

    const isolateNumber = (lastIsolate?.isolateNumber || 0) + 1

    const cultureResult = await db.cultureResult.create({
      data: {
        sampleTestId,
        organismId,
        isolateNumber,
        colonyCount,
        cultureMedia,
        incubationTemp: incubationTemp ? parseFloat(incubationTemp) : null,
        incubationHours: incubationHours ? parseInt(incubationHours) : null,
        morphologyNotes,
        gramStainResult,
        biochemicalTests: biochemicalTests ? JSON.stringify(biochemicalTests) : null,
        identificationMethod,
        confidenceLevel: confidenceLevel ? parseFloat(confidenceLevel) : null,
        notes,
      },
      include: {
        organism: true,
      },
    })

    return NextResponse.json(cultureResult, { status: 201 })
  } catch (error) {
    console.error('[CultureResults POST]', error)
    return NextResponse.json(
      { error: 'Error al crear resultado de cultivo' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar resultado de cultivo
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para modificar cultivos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { cultureResultId, ...updateData } = body

    if (!cultureResultId) {
      return NextResponse.json(
        { error: 'ID de resultado de cultivo requerido' },
        { status: 400 }
      )
    }

    // Preparar datos para actualización
    const data: Record<string, unknown> = {}

    if (updateData.organismId !== undefined) data.organismId = updateData.organismId
    if (updateData.colonyCount !== undefined) data.colonyCount = updateData.colonyCount
    if (updateData.cultureMedia !== undefined) data.cultureMedia = updateData.cultureMedia
    if (updateData.incubationTemp !== undefined) {
      data.incubationTemp = updateData.incubationTemp ? parseFloat(updateData.incubationTemp) : null
    }
    if (updateData.incubationHours !== undefined) {
      data.incubationHours = updateData.incubationHours ? parseInt(updateData.incubationHours) : null
    }
    if (updateData.morphologyNotes !== undefined) data.morphologyNotes = updateData.morphologyNotes
    if (updateData.gramStainResult !== undefined) data.gramStainResult = updateData.gramStainResult
    if (updateData.biochemicalTests !== undefined) {
      data.biochemicalTests = updateData.biochemicalTests ? JSON.stringify(updateData.biochemicalTests) : null
    }
    if (updateData.identificationMethod !== undefined) data.identificationMethod = updateData.identificationMethod
    if (updateData.confidenceLevel !== undefined) {
      data.confidenceLevel = updateData.confidenceLevel ? parseFloat(updateData.confidenceLevel) : null
    }
    if (updateData.isFinalResult !== undefined) data.isFinalResult = updateData.isFinalResult
    if (updateData.notes !== undefined) data.notes = updateData.notes

    const updated = await db.cultureResult.update({
      where: { id: cultureResultId },
      data,
      include: {
        organism: true,
        antibiogramResults: {
          include: { antibiotic: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[CultureResults PUT]', error)
    return NextResponse.json(
      { error: 'Error al actualizar resultado de cultivo' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar resultado de cultivo
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para eliminar cultivos' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const cultureResultId = searchParams.get('id')

    if (!cultureResultId) {
      return NextResponse.json(
        { error: 'ID de resultado de cultivo requerido' },
        { status: 400 }
      )
    }

    await db.cultureResult.delete({
      where: { id: cultureResultId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CultureResults DELETE]', error)
    return NextResponse.json(
      { error: 'Error al eliminar resultado de cultivo' },
      { status: 500 }
    )
  }
}
