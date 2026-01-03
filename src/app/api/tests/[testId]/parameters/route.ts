import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ testId: string }>
}

// POST /api/tests/[testId]/parameters - Guardar parámetros de prueba
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

    // Solo administradores y bioanalistas pueden modificar parámetros
    if (session.user.role === 'LAB_ASSISTANT') {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Administrador o Bioanalista.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { parameters } = body

    if (!parameters || !Array.isArray(parameters)) {
      return NextResponse.json(
        { error: 'Parámetros inválidos' },
        { status: 400 }
      )
    }

    const { testId } = await params

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

    // Eliminar parámetros existentes
    await db.testParameter.deleteMany({
      where: { testId }
    })

    // Crear nuevos parámetros
    const createdParameters = await db.testParameter.createMany({
      data: parameters.map((param: any) => ({
        testId,
        name: param.name,
        code: param.code,
        resultType: param.resultType,
        unit: param.unit || null,
        minValue: param.minValue !== undefined ? param.minValue : null,
        maxValue: param.maxValue !== undefined ? param.maxValue : null,
        normalMin: param.normalMin !== undefined ? param.normalMin : null,
        normalMax: param.normalMax !== undefined ? param.normalMax : null,
        criticalMin: param.criticalMin !== undefined ? param.criticalMin : null,
        criticalMax: param.criticalMax !== undefined ? param.criticalMax : null,
        allowedValues: param.allowedValues || null,
        displayOrder: param.displayOrder,
        isRequired: param.isRequired
      }))
    })

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Test',
        entityId: testId,
        entityName: `${test.code} - ${test.name}`,
        changes: JSON.stringify({
          parametersUpdated: parameters.length,
          parameters: parameters.map((p: any) => ({
            code: p.code,
            name: p.name,
            resultType: p.resultType
          }))
        })
      }
    })

    return NextResponse.json({
      success: true,
      count: createdParameters.count
    })
  } catch (error) {
    console.error('Error updating test parameters:', error)
    return NextResponse.json(
      { error: 'Error al actualizar parámetros' },
      { status: 500 }
    )
  }
}
