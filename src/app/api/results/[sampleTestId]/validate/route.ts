import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// POST /api/results/[sampleTestId]/validate - Validar o invalidar resultado
export async function POST(
  request: NextRequest,
  { params }: { params: { sampleTestId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { isValid } = body

    // Solo bioanalistas y administradores pueden validar
    if (session.user.role === 'LAB_ASSISTANT') {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Bioanalista o Administrador.' },
        { status: 403 }
      )
    }

    const sampleTestId = params.sampleTestId

    // Obtener la prueba
    const sampleTest = await db.sampleTest.findUnique({
      where: { id: sampleTestId },
      include: {
        sample: true,
        test: true
      }
    })

    if (!sampleTest) {
      return NextResponse.json(
        { error: 'Prueba no encontrada' },
        { status: 404 }
      )
    }

    // Verificar estado
    if (sampleTest.status !== 'AWAITING_VALIDATION') {
      return NextResponse.json(
        { error: 'La prueba debe estar en estado de "Por Validar"' },
        { status: 400 }
      )
    }

    // Actualizar estado de la prueba
    const newStatus = isValid ? 'COMPLETED' : 'AWAITING_VALIDATION'
    const updateData: any = {
      status: newStatus,
      validatedAt: isValid ? new Date() : null,
      validatedById: isValid ? session.user.id : null
    }

    const updatedSampleTest = await db.sampleTest.update({
      where: { id: sampleTestId },
      data: updateData
    })

    // Si se valida y todas las pruebas de la muestra están completadas, actualizar estado de la muestra
    if (isValid) {
      const allTests = await db.sampleTest.findMany({
        where: { sampleId: sampleTest.sampleId }
      })

      const allCompleted = allTests.every(t => t.status === 'COMPLETED')

      if (allCompleted) {
        await db.sample.update({
          where: { id: sampleTest.sampleId },
          data: { status: 'COMPLETED', completedAt: new Date() }
        })
      }
    }

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'VALIDATE',
        entityType: 'SampleTest',
        entityId: sampleTestId,
        entityName: `${sampleTest.sample.sampleCode} - ${sampleTest.test.code}`,
        changes: JSON.stringify({
          validated: isValid,
          statusChanged: {
            from: sampleTest.status,
            to: newStatus
          },
          validatedBy: session.user.name
        })
      }
    })

    return NextResponse.json(updatedSampleTest)
  } catch (error) {
    console.error('Error validating result:', error)
    return NextResponse.json(
      { error: 'Error al validar resultado' },
      { status: 500 }
    )
  }
}
