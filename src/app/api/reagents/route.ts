import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/reagents - Listar reactivos con filtros
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
    const type = searchParams.get('type') || ''
    const location = searchParams.get('location') || ''
    const status = searchParams.get('status') || ''

    // Construir where clause
    const where: any = { isActive: true }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { type: { contains: search } }
      ]
    }

    if (type) {
      where.type = type
    }

    if (location) {
      where.location = { contains: location }
    }

    if (status === 'low_stock') {
      where.currentStock = {
        lte: db.reagent.fields.minStockLevel
      }
    } else if (status === 'expiring_soon') {
      where.expirationDate = {
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        gt: new Date()
      }
    } else if (status === 'expired') {
      where.expirationDate = {
        lt: new Date()
      }
    }

    // Query con información de transacciones
    const reagents = await db.reagent.findMany({
      where,
      include: {
        _count: {
          select: {
            transactions: true
          }
        },
        transactions: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Calcular stock actual
    const reagentsWithStock = reagents.map(reagent => {
      const currentStock = reagent.transactions?.reduce((sum: number, t: any) => {
        if (t.type === 'IN') {
          return sum + t.quantity
        } else {
          return sum - t.quantity
        }
      }, 0) || 0

      const transactionCount = reagent.transactions?.length || 0
      const lastTransactionDate = reagent.transactions?.[0]?.createdAt || null

      return {
        ...reagent,
        currentStock,
        transactionCount,
        lastTransactionDate
      }
    })

    return NextResponse.json(reagentsWithStock)
  } catch (error) {
    console.error('Error fetching reagents:', error)
    return NextResponse.json(
      { error: 'Error al obtener reactivos' },
      { status: 500 }
    )
  }
}
