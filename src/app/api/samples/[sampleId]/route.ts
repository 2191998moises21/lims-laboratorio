import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ sampleId: string }>
}

// GET /api/samples/[sampleId] - Obtener detalles de una muestra
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { sampleId } = await params

    const sample = await db.sample.findUnique({
      where: { id: sampleId },
      include: {
        patient: true,
        doctor: true,
        sampleTests: {
          include: {
            test: {
              include: {
                parameters: {
                  orderBy: { displayOrder: 'asc' }
                }
              }
            },
            assignedTo: true,
            results: {
              include: {
                parameter: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        documents: true
      }
    })

    if (!sample) {
      return NextResponse.json(
        { error: 'Muestra no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(sample)
  } catch (error) {
    console.error('Error fetching sample:', error)
    return NextResponse.json(
      { error: 'Error al obtener muestra' },
      { status: 500 }
    )
  }
}

// POST /api/samples/[sampleId]/tests - Asignar prueba a muestra
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { sampleId } = await params
    const body = await request.json()
    const { testId, assignedToId } = body

    // Validaciones
    if (!testId) {
      return NextResponse.json(
        { error: 'Debe seleccionar una prueba' },
        { status: 400 }
      )
    }

    // Verificar que la muestra existe
    const sample = await db.sample.findUnique({
      where: { id: sampleId }
    })

    if (!sample) {
      return NextResponse.json(
        { error: 'Muestra no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que la prueba existe
    const test = await db.test.findUnique({
      where: { id: testId }
    })

    if (!test) {
      return NextResponse.json(
        { error: 'Prueba no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que la prueba no esté ya asignada a esta muestra
    const existingAssignment = await db.sampleTest.findUnique({
      where: {
        sampleId_testId: {
          sampleId,
          testId
        }
      }
    })

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Esta prueba ya está asignada a esta muestra' },
        { status: 409 }
      )
    }

    // Asignar prueba
    const sampleTest = await db.sampleTest.create({
      data: {
        sampleId,
        testId,
        status: 'PENDING',
        assignedToId: assignedToId || null
      }
    })

    // Actualizar estado de la muestra si es necesario
    if (sample.status === 'RECEIVED') {
      await db.sample.update({
        where: { id: sampleId },
        data: { status: 'IN_PROGRESS' }
      })
    }

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'SampleTest',
        entityId: sampleTest.id,
        entityName: `${sample.sampleCode} - ${test.code}`,
        changes: JSON.stringify({
          assigned: {
            test: test.code,
            testId: testId
          }
        })
      }
    })

    return NextResponse.json(sampleTest, { status: 201 })
  } catch (error) {
    console.error('Error assigning test to sample:', error)
    return NextResponse.json(
      { error: 'Error al asignar prueba' },
      { status: 500 }
    )
  }
}
