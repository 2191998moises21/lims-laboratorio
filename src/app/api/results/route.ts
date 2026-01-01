import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/results - Listar resultados con filtros
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const patient = searchParams.get('patient') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const status = searchParams.get('status') || ''
    const testType = searchParams.get('testType') || ''
    const resultType = searchParams.get('resultType') || ''

    // Construir where clause para filtros
    const where: any = {}

    // Solo pruebas con resultados
    where.status = {
      in: ['AWAITING_VALIDATION', 'COMPLETED']
    }

    // Filtro de búsqueda (código de muestra, paciente, médico)
    if (search) {
      where.OR = [
        { sample: { sampleCode: { contains: search } } },
        { sample: { patient: { fullName: { contains: search } } } },
        { sample: { patient: { cedula: { contains: search } } } },
        { sample: { doctor: { fullName: { contains: search } } } }
      ]
    }

    // Filtro de paciente
    if (patient) {
      where.sample = {
        ...where.sample,
        patient: {
          OR: [
            { fullName: { contains: patient } },
            { cedula: { contains: patient } }
          ]
        }
      }
    }

    // Filtro de fecha
    if (dateFrom || dateTo) {
      where.sample = {
        ...where.sample,
        collectionDate: {}
      }
      
      if (dateFrom) {
        where.sample.collectionDate = {
          ...where.sample.collectionDate,
          gte: new Date(dateFrom)
        }
      }
      
      if (dateTo) {
        where.sample.collectionDate = {
          ...where.sample.collectionDate,
          lte: new Date(dateTo)
        }
      }
    }

    // Filtro de estado
    if (status) {
      where.status = status
    }

    // Filtro de tipo de prueba
    if (testType) {
      where.test = {
        sampleType: testType
      }
    }

    // Filtro de tipo de resultado
    if (resultType === 'ABNORMAL') {
      where.results = {
        some: {
          isAbnormal: true
        }
      }
    } else if (resultType === 'CRITICAL') {
      where.results = {
        some: {
          isCritical: true
        }
      }
    } else if (resultType === 'POSITIVE') {
      where.results = {
        some: {
          qualitativeValue: 'POSITIVE'
        }
      }
    } else if (resultType === 'NEGATIVE') {
      where.results = {
        some: {
          qualitativeValue: 'NEGATIVE'
        }
      }
    }

    // Query con filtros
    const results = await db.sampleTest.findMany({
      where,
      include: {
        sample: {
          include: {
            patient: true,
            doctor: true
          }
        },
        test: true,
        results: {
          include: {
            parameter: true
          }
        },
        validatedBy: true
      },
      orderBy: {
        sample: {
          collectionDate: 'desc'
        }
      }
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching results:', error)
    return NextResponse.json(
      { error: 'Error al obtener resultados' },
      { status: 500 }
    )
  }
}
