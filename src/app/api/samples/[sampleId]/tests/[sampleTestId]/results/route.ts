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

    // Usar transacción para eliminar y crear resultados
    const createdResultIds: string[] = []

    await db.$transaction(async (tx) => {
      // Eliminar resultados existentes (esto también elimina attachments por cascade)
      await tx.testResult.deleteMany({
        where: { sampleTestId }
      })

      // Crear nuevos resultados uno por uno para obtener IDs
      for (const [parameterId, data] of Object.entries(results) as [string, Record<string, unknown>][]) {
        const parameter = sampleTest.test.parameters.find((p) => p.id === parameterId)

        if (!parameter) {
          throw new Error(`Parámetro no encontrado: ${parameterId}`)
        }

        // Determinar si es anormal basado en rangos de referencia
        let isAbnormal = false
        let isCritical = false
        const quantValue = data.quantitativeValue as number | undefined

        if (parameter.resultType === 'QUANTITATIVE' && quantValue !== undefined) {
          if (parameter.normalMin !== null && quantValue < parameter.normalMin) {
            isAbnormal = true
          }
          if (parameter.normalMax !== null && quantValue > parameter.normalMax) {
            isAbnormal = true
          }
          if (parameter.criticalMin !== null && quantValue <= parameter.criticalMin) {
            isCritical = true
          }
          if (parameter.criticalMax !== null && quantValue >= parameter.criticalMax) {
            isCritical = true
          }
        }

        const result = await tx.testResult.create({
          data: {
            sampleTestId,
            parameterId,
            quantitativeValue: quantValue,
            qualitativeValue: data.qualitativeValue as string | undefined,
            textValue: data.textValue as string | undefined,
            unit: parameter.unit,
            isAbnormal,
            isCritical,
            notes: (data.notes as string) || null
          }
        })

        createdResultIds.push(result.id)
      }
    })

    const createdResults = { count: createdResultIds.length }

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

    // Procesar archivos adjuntos (se asocian al primer resultado creado)
    const files = formData.getAll('files') as File[]
    if (files && files.length > 0 && createdResultIds.length > 0) {
      const primaryResultId = createdResultIds[0]

      for (const file of files) {
        if (file instanceof File && file.size > 0) {
          // TODO: En producción, subir archivo a Cloud Storage y obtener URL real
          const timestamp = Date.now()
          const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
          const fileUrl = `/uploads/results/${sampleTestId}/${timestamp}_${safeFileName}`

          await db.testResultAttachment.create({
            data: {
              testResultId: primaryResultId,
              fileName: file.name,
              fileUrl,
              fileType: file.type,
              fileSize: file.size,
              description: `Archivo adjunto para prueba ${sampleTest.test.code}`
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

    // Crear entrada de auditoría (sin datos sensibles de resultados)
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'SampleTest',
        entityId: sampleTest.id,
        entityName: `${sampleTest.test.code}`,
        changes: JSON.stringify({
          resultsSaved: createdResults.count,
          parametersUpdated: Object.keys(results).length,
          technique: technique || null,
          hasInterpretation: !!resultInterpretation,
          attachmentsAdded: files.filter(f => f instanceof File && f.size > 0).length
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
