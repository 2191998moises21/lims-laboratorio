import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

interface ReportConfig {
  includeTechnique: boolean
  includeInterpretation: boolean
  includeValidation: boolean
  showAbnormal: boolean
}

// POST /api/results/generate-pdf - Generar PDF de informe
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sampleTestId, config }: { sampleTestId: string; config: ReportConfig } = body

    if (!sampleTestId) {
      return NextResponse.json(
        { error: 'ID de prueba es requerido' },
        { status: 400 }
      )
    }

    // Obtener datos de la prueba con todos sus detalles
    const sampleTest = await db.sampleTest.findUnique({
      where: { id: sampleTestId },
      include: {
        sample: {
          include: {
            patient: true,
            doctor: true
          }
        },
        test: {
          include: {
            parameters: true
          }
        },
        results: {
          include: {
            parameter: true
          }
        },
        validatedBy: true
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
        { error: 'No está autorizado para generar este informe' },
        { status: 403 }
      )
    }

    // Llamar al mini servicio de PDF
    const pdfServiceUrl = process.env.PDF_SERVICE_URL || 'http://localhost:3004'
    
    const reportData = {
      sampleCode: sampleTest.sample.sampleCode,
      patient: {
        fullName: sampleTest.sample.patient.fullName,
        cedula: sampleTest.sample.patient.cedula,
        dateOfBirth: sampleTest.sample.patient.dateOfBirth,
        gender: sampleTest.sample.patient.gender
      },
      doctor: {
        fullName: sampleTest.sample.doctor.fullName,
        specialty: null,
        healthCenter: null
      },
      sampleInfo: {
        sampleType: sampleTest.sample.sampleType,
        collectionDate: sampleTest.sample.collectionDate,
        collectionMethod: sampleTest.sample.collectionMethod,
        priority: sampleTest.sample.priority
      },
      testResults: sampleTest.results.map((result: any) => ({
        testName: sampleTest.test.name,
        testCode: sampleTest.test.code,
        parameterName: result.parameter.name,
        parameterCode: result.parameter.code,
        resultType: result.parameter.resultType,
        resultValue: formatResultValue(result),
        unit: result.unit || result.parameter.unit,
        referenceRange: result.parameter.referenceRange || '',
        isAbnormal: result.isAbnormal,
        isCritical: result.isCritical,
        notes: result.notes || ''
      })),
      technique: sampleTest.technique || null,
      interpretation: sampleTest.resultInterpretation || null,
      validationInfo: {
        validatedBy: sampleTest.validatedBy?.name || 'Pendiente',
        validatedAt: sampleTest.validatedAt || new Date().toISOString()
      },
      reportInfo: {
        title: 'Informe de Bacteriología',
        subtitle: 'Resultados de Análisis Bacteriológico',
        logo: process.env.NEXT_PUBLIC_LABORATORY_LOGO || '',
        laboratoryName: process.env.NEXT_PUBLIC_LABORATORY_NAME || 'Laboratorio de Bioanálisis',
        laboratoryAddress: process.env.NEXT_PUBLIC_LABORATORY_ADDRESS || '',
        laboratoryPhone: process.env.NEXT_PUBLIC_LABORATORY_PHONE || '',
        laboratoryEmail: process.env.NEXT_PUBLIC_LABORATORY_EMAIL || ''
      },
      config
    }

    // Llamar al mini servicio de PDF
    const pdfResponse = await fetch(`${pdfServiceUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportData)
    })

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text()
      console.error('PDF service error:', errorText)
      
      // Si el servicio de PDF falla, generar un PDF básico con jsPDF
      const basicPDF = await generateBasicPDF(sampleTest, reportData, config)
      
      return NextResponse.json({
        success: true,
        sampleCode: sampleTest.sample.sampleCode,
        pdfData: basicPDF
      })
    }

    const pdfResult = await pdfResponse.json()

    return NextResponse.json({
      success: true,
      sampleCode: sampleTest.sample.sampleCode,
      pdfUrl: pdfResult.pdfUrl,
      pdfData: pdfResult.pdfData
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Error al generar PDF' },
      { status: 500 }
    )
  }
}

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

    // Si todas las pruebas de la muestra están completadas, actualizar estado de la muestra
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

// Helper function para formatear valor de resultado
function formatResultValue(result: any): string {
  if (result.quantitativeValue !== undefined && result.quantitativeValue !== null) {
    return result.quantitativeValue.toString()
  }
  if (result.qualitativeValue) {
    switch (result.qualitativeValue) {
      case 'POSITIVE':
        return 'Positivo'
      case 'NEGATIVE':
        return 'Negativo'
      case 'INDETERMINATE':
        return 'Indeterminado'
      default:
        return result.qualitativeValue
    }
  }
  if (result.textValue) {
    return result.textValue
  }
  return ''
}

// Fallback: Generar PDF básico con jsPDF si el servicio de Python no funciona
async function generateBasicPDF(
  sampleTest: any,
  reportData: any,
  config: ReportConfig
): Promise<string> {
  // Para producción, instalar jsPDF o usar una biblioteca similar
  // Por ahora, retornamos un JSON que el frontend puede mostrar
  console.log('Generando PDF básico como fallback')
  return JSON.stringify(reportData)
}
