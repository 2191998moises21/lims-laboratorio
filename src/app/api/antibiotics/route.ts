// =============================================================================
// API: ANTIBIOTICS CATALOG
// =============================================================================
// CRUD para catálogo de antibióticos con breakpoints CLSI/EUCAST
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Listar antibióticos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const group = searchParams.get('group')
    const activeOnly = searchParams.get('active') !== 'false'
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (activeOnly) {
      where.isActive = true
    }

    if (group) {
      where.group = group
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ]
    }

    const antibiotics = await db.antibiotic.findMany({
      where,
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    })

    // Agrupar por grupo de antibióticos
    const grouped = antibiotics.reduce((acc, antibiotic) => {
      if (!acc[antibiotic.group]) {
        acc[antibiotic.group] = []
      }
      acc[antibiotic.group].push(antibiotic)
      return acc
    }, {} as Record<string, typeof antibiotics>)

    return NextResponse.json({
      antibiotics,
      grouped,
      total: antibiotics.length,
    })
  } catch (error) {
    console.error('[Antibiotics GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener antibióticos' },
      { status: 500 }
    )
  }
}

// POST - Crear antibiótico
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo admin puede crear antibióticos
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo administradores pueden crear antibióticos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      code,
      group,
      concentration,
      diskCode,
      clsiBreakpoints,
      eucastBreakpoints,
      notes,
    } = body

    // Validación
    if (!name || !code || !group) {
      return NextResponse.json(
        { error: 'Nombre, código y grupo son requeridos' },
        { status: 400 }
      )
    }

    // Verificar código único
    const existing = await db.antibiotic.findUnique({
      where: { code },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un antibiótico con ese código' },
        { status: 400 }
      )
    }

    const antibiotic = await db.antibiotic.create({
      data: {
        name,
        code: code.toUpperCase(),
        group,
        concentration,
        diskCode,
        clsiBreakpoints: clsiBreakpoints ? JSON.stringify(clsiBreakpoints) : null,
        eucastBreakpoints: eucastBreakpoints ? JSON.stringify(eucastBreakpoints) : null,
        notes,
      },
    })

    return NextResponse.json(antibiotic, { status: 201 })
  } catch (error) {
    console.error('[Antibiotics POST]', error)
    return NextResponse.json(
      { error: 'Error al crear antibiótico' },
      { status: 500 }
    )
  }
}
