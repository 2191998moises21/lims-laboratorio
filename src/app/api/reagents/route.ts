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
    const category = searchParams.get('category') || ''
    const location = searchParams.get('location') || ''
    const status = searchParams.get('status') || ''

    // Construir where clause base
    const where: Record<string, unknown> = { isActive: true }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { lotNumber: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (category) {
      where.category = category
    }

    if (location) {
      where.storageLocation = { contains: location, mode: 'insensitive' }
    }

    // Filtros de fecha para status específicos
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    if (status === 'expiring_soon') {
      where.expiryDate = {
        lte: sevenDaysFromNow,
        gt: now
      }
    } else if (status === 'expired') {
      where.expiryDate = {
        lt: now
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
          orderBy: { transactionDate: 'desc' },
          take: 5
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Procesar reactivos y calcular stock actual
    const reagentsWithStock = reagents.map(reagent => {
      // El stock actual es el campo quantity del reactivo
      // Las transacciones son para historial
      const currentStock = reagent.quantity
      const isLowStock = currentStock <= reagent.minStockLevel
      const isExpired = reagent.expiryDate < now
      const isExpiringSoon = !isExpired && reagent.expiryDate <= sevenDaysFromNow

      const transactionCount = reagent._count.transactions
      const lastTransaction = reagent.transactions[0] || null

      return {
        ...reagent,
        currentStock,
        isLowStock,
        isExpired,
        isExpiringSoon,
        transactionCount,
        lastTransactionDate: lastTransaction?.transactionDate || null
      }
    })

    // Filtrar por low_stock en memoria (ya que requiere comparación de campos)
    let filteredReagents = reagentsWithStock
    if (status === 'low_stock') {
      filteredReagents = reagentsWithStock.filter(r => r.isLowStock)
    }

    return NextResponse.json(filteredReagents)
  } catch (error) {
    console.error('Error fetching reagents:', error)
    return NextResponse.json(
      { error: 'Error al obtener reactivos' },
      { status: 500 }
    )
  }
}
