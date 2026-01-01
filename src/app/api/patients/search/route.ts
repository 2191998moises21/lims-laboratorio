import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/patients/search?q=term - Buscar pacientes
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
    const query = searchParams.get('q')

    if (!query || query.length < 3) {
      return NextResponse.json([])
    }

    // Buscar por cédula o nombre
    const patients = await db.patient.findMany({
      where: {
        OR: [
          { cedula: { contains: query } },
          { fullName: { contains: query } }
        ]
      },
      take: 10,
      orderBy: {
        fullName: 'asc'
      }
    })

    return NextResponse.json(patients)
  } catch (error) {
    console.error('Error searching patients:', error)
    return NextResponse.json(
      { error: 'Error al buscar pacientes' },
      { status: 500 }
    )
  }
}
