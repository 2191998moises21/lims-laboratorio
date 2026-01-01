import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/doctors/search?q=term - Buscar médicos
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

    // Buscar por nombre
    const doctors = await db.doctor.findMany({
      where: {
        fullName: { contains: query },
        isActive: true
      },
      take: 10,
      orderBy: {
        fullName: 'asc'
      }
    })

    return NextResponse.json(doctors)
  } catch (error) {
    console.error('Error searching doctors:', error)
    return NextResponse.json(
      { error: 'Error al buscar médicos' },
      { status: 500 }
    )
  }
}
