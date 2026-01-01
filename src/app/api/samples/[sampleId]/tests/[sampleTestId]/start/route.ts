import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// POST /api/samples/[sampleId]/tests/[sampleTestId]/start - Iniciar una prueba
export async function POST(
  request: NextRequest,
  { params }: { params: { sampleId: string; sampleTestId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { sampleTestId } = params

    // Verificar que la prueba existe y pertenece a esta muestra
    const sampleTest = await db.sampleTest.findUnique({
      where: { id: sampleTestId },
      include: {
        test: true
      }
    })

    if (!sampleTest) {
      return NextResponse.json(
        { error: 'Prueba no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que el usuario está asignado a esta prueba o es administrador
    if (sampleTest.assignedToId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No está autorizado para iniciar esta prueba' },
        { status: 403 }
      )
    }

    // Verificar estado
    if (sampleTest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'La prueba ya ha sido iniciada o completada' },
        { status: 400 }
      )
    }

    // Iniciar prueba
    const updatedSampleTest = await db.sampleTest.update({
      where: { id: sampleTestId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        assignedToId: session.user.id
      }
    })

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'SampleTest',
        entityId: sampleTest.id,
        entityName: `${sampleTest.test.code}`,
        changes: JSON.stringify({
          statusChanged: {
            from: sampleTest.status,
            to: 'IN_PROGRESS'
          },
          startedAt: new Date().toISOString()
        })
      }
    })

    return NextResponse.json(updatedSampleTest)
  } catch (error) {
    console.error('Error starting test:', error)
    return NextResponse.json(
      { error: 'Error al iniciar prueba' },
      { status: 500 }
    )
  }
}
