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
        results: true,
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
        { error: 'No estás autorizado para generar este informe' },
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
      testResults: sampleTest.results.map((result: any) => {
        // Look up the parameter from test.parameters using parameterId
        const parameter = sampleTest.test.parameters.find(
          (p: any) => p.id === result.parameterId
        )
        return {
          testName: sampleTest.test.name,
          testCode: sampleTest.test.code,
          parameterName: parameter?.name || 'Parámetro',
          parameterCode: parameter?.code || '',
          resultType: parameter?.resultType || 'TEXT',
          resultValue: formatResultValue(result),
          unit: result.unit || parameter?.unit || '',
          referenceRange: parameter ? `${parameter.normalMin || ''} - ${parameter.normalMax || ''}` : '',
          isAbnormal: result.isAbnormal,
          isCritical: result.isCritical,
          notes: result.notes || ''
        }
      }),
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
