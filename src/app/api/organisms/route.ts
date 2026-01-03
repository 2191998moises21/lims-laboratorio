// =============================================================================
// API: ORGANISMS CATALOG
// =============================================================================
// CRUD para catálogo de microorganismos
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Listar organismos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const gramStain = searchParams.get('gramStain')
    const activeOnly = searchParams.get('active') !== 'false'
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (activeOnly) {
      where.isActive = true
    }

    if (gramStain) {
      where.gramStain = gramStain
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { commonName: { contains: search } },
        { genus: { contains: search } },
        { species: { contains: search } },
      ]
    }

    const organisms = await db.organism.findMany({
      where,
      orderBy: [{ genus: 'asc' }, { species: 'asc' }],
    })

    // Agrupar por tinción Gram
    const byGramStain = {
      POSITIVE: organisms.filter((o) => o.gramStain === 'POSITIVE'),
      NEGATIVE: organisms.filter((o) => o.gramStain === 'NEGATIVE'),
      VARIABLE: organisms.filter((o) => o.gramStain === 'VARIABLE'),
      OTHER: organisms.filter((o) => !o.gramStain),
    }

    return NextResponse.json({
      organisms,
      byGramStain,
      total: organisms.length,
    })
  } catch (error) {
    console.error('[Organisms GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener organismos' },
      { status: 500 }
    )
  }
}

// POST - Crear organismo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo admin y bioanalistas pueden crear organismos
    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para crear organismos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      commonName,
      genus,
      species,
      gramStain,
      morphology,
      oxygen,
      clinicalRelevance,
      resistanceProfile,
      notes,
    } = body

    // Validación
    if (!name || !genus || !species) {
      return NextResponse.json(
        { error: 'Nombre, género y especie son requeridos' },
        { status: 400 }
      )
    }

    // Verificar combinación única
    const existing = await db.organism.findUnique({
      where: { genus_species: { genus, species } },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un organismo con ese género y especie' },
        { status: 400 }
      )
    }

    const organism = await db.organism.create({
      data: {
        name,
        commonName,
        genus,
        species,
        gramStain,
        morphology,
        oxygen,
        clinicalRelevance,
        resistanceProfile: resistanceProfile ? JSON.stringify(resistanceProfile) : null,
        notes,
      },
    })

    return NextResponse.json(organism, { status: 201 })
  } catch (error) {
    console.error('[Organisms POST]', error)
    return NextResponse.json(
      { error: 'Error al crear organismo' },
      { status: 500 }
    )
  }
}
