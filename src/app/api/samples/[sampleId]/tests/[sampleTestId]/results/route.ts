import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// POST /api/samples/[sampleId]/tests/[sampleTestId]/results - Guardar resultados de prueba
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
    const formData = await request.formData()
    
    // Obtener datos del formulario
    const results = JSON.parse(formData.get('results') as string)
    const resultsText = formData.get('resultsText') as string | null
    const technique = formData.get('technique') as string | null
    const resultInterpretation = formData.get('resultInterpretation') as string | null

    // Verificar que la prueba existe
    const sampleTest = await db.sampleTest.findUnique({
      where: { id: sampleTestId },
      include: {
        test: {
          include: {
            parameters: true
          }
        }
      }
    })

    if (!sampleTest) {
      return NextResponse.json(
        { error: 'Prueba no encontrada' },
        { status: 404 }
      )
    }

    // Verificar permisos
    if (sampleTest.assignedToId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No está autorizado para modificar esta prueba' },
        { status: 403 }
      )
    }

    // Validar que la prueba esté en progreso
    if (sampleTest.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'La prueba debe estar en proceso para guardar resultados' },
        { status: 400 }
      )
    }

    // Eliminar resultados existentes
    await db.testResult.deleteMany({
      where: { sampleTestId }
    })

    // Crear nuevos resultados
    const createdResults = await db.testResult.createMany({
      data: Object.entries(results).map(([parameterId, data]: [string, any]) => {
        const parameter = sampleTest.test.parameters.find((p: any) => p.id === parameterId)
        
        if (!parameter) {
          throw new Error(`Parámetro no encontrado: ${parameterId}`)
        }

        // Determinar si es anormal basado en rangos de referencia
        let isAbnormal = false
        let isCritical = false

        if (parameter.resultType === 'QUANTITATIVE' && data.quantitativeValue !== undefined) {
          if (parameter.normalMin !== null && data.quantitativeValue < parameter.normalMin) {
            isAbnormal = true
          }
          if (parameter.normalMax !== null && data.quantitativeValue > parameter.normalMax) {
            isAbnormal = true
          }
          if (parameter.criticalMin !== null && data.quantitativeValue <= parameter.criticalMin) {
            isCritical = true
          }
          if (parameter.criticalMax !== null && data.quantitativeValue >= parameter.criticalMax) {
            isCritical = true
          }
        }

        return {
          sampleTestId,
          parameterId,
          quantitativeValue: data.quantitativeValue,
          qualitativeValue: data.qualitativeValue,
          textValue: data.textValue,
          unit: parameter.unit,
          isAbnormal,
          isCritical,
          notes: data.notes || null
        }
      })
    })

    // Actualizar información general de la prueba
    await db.sampleTest.update({
      where: { id: sampleTestId },
      data: {
        resultsText,
        technique,
        resultInterpretation,
        status: 'AWAITING_VALIDATION',
        completedAt: new Date()
      }
    })

    // Procesar archivos adjuntos
    const files = formData.getAll('files') as File[]
    if (files && files.length > 0) {
      for (const file of files) {
        if (file instanceof File && file.size > 0) {
          // En producción, guardar en storage
          await db.testResultAttachment.create({
            data: {
              testResultId: '', // Se asociará después
              fileName: file.name,
              fileUrl: `/uploads/results/${sampleTestId}/${file.name}`,
              fileType: file.type,
              fileSize: file.size
            }
          })
        }
      }
    }

    // Actualizar estado de la muestra si todas las pruebas están completadas
    const allTests = await db.sampleTest.findMany({
      where: { sampleId: params.sampleId }
    })

    const allCompleted = allTests.every(t => 
      t.status === 'COMPLETED' || t.status === 'AWAITING_VALIDATION'
    )

    if (allCompleted) {
      await db.sample.update({
        where: { id: params.sampleId },
        data: { status: 'ANALYZED' }
      })
    }

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'SampleTest',
        entityId: sampleTest.id,
        entityName: `${sampleTest.test.code}`,
        changes: JSON.stringify({
          resultsSaved: createdResults.count,
          results: results,
          technique,
          resultInterpretation
        })
      }
    })

    return NextResponse.json({
      success: true,
      resultsCount: createdResults.count
    })
  } catch (error) {
    console.error('Error saving test results:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al guardar resultados' },
      { status: 500 }
    )
  }
}
