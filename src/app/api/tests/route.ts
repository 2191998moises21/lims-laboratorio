import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/tests - Listar pruebas
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const tests = await db.test.findMany({
      include: {
        parameters: {
          orderBy: { displayOrder: 'asc' }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(tests)
  } catch (error) {
    console.error('Error fetching tests:', error)
    return NextResponse.json(
      { error: 'Error al obtener pruebas' },
      { status: 500 }
    )
  }
}

// POST /api/tests - Crear nueva prueba
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Solo administradores y bioanalistas pueden crear pruebas
    if (session.user.role === 'LAB_ASSISTANT') {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Administrador o Bioanalista.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, code, description, category, sampleType, method, unit, referenceRangeInfo, interpretationCriteria, estimatedDuration } = body

    // Validaciones
    if (!name || !code || !sampleType) {
      return NextResponse.json(
        { error: 'Nombre, código y tipo de muestra son obligatorios' },
        { status: 400 }
      )
    }

    // Verificar si el código ya existe
    const existingTest = await db.test.findUnique({
      where: { code }
    })

    if (existingTest) {
      return NextResponse.json(
        { error: 'El código de prueba ya existe' },
        { status: 409 }
      )
    }

    // Crear prueba
    const test = await db.test.create({
      data: {
        name,
        code: code.toUpperCase(),
        description,
        category,
        sampleType,
        method,
        unit,
        referenceRangeInfo,
        interpretationCriteria,
        estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : null,
        isActive: true
      }
    })

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Test',
        entityId: test.id,
        entityName: `${test.code} - ${test.name}`,
        changes: JSON.stringify({
          created: {
            code: test.code,
            name: test.name,
            category: test.category,
            sampleType: test.sampleType
          }
        })
      }
    })

    return NextResponse.json(test, { status: 201 })
  } catch (error) {
    console.error('Error creating test:', error)
    return NextResponse.json(
      { error: 'Error al crear prueba' },
      { status: 500 }
    )
  }
}
