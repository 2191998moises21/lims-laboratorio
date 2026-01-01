import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// POST /api/reagents/transactions - Registrar transacción de reactivo
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
    const { reagentId, type, quantity, batchNumber, notes } = body

    // Validaciones
    if (!reagentId || !type || !quantity) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    if (type !== 'IN' && type !== 'OUT') {
      return NextResponse.json(
        { error: 'Tipo de transacción inválido' },
        { status: 400 }
      )
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'La cantidad debe ser mayor a 0' },
        { status: 400 }
      )
    }

    // Obtener reactivo
    const reagent = await db.reagent.findUnique({
      where: { id: reagentId }
    })

    if (!reagent) {
      return NextResponse.json(
        { error: 'Reactivo no encontrado' },
        { status: 404 }
      )
    }

    // Verificar si hay stock suficiente para salidas
    if (type === 'OUT') {
      const currentStock = await calculateCurrentStock(reagentId)
      if (currentStock < quantity) {
        return NextResponse.json(
          { error: 'No hay suficiente stock' },
          { status: 400 }
        )
      }
    }

    // Crear transacción
    const transaction = await db.reagentTransaction.create({
      data: {
        reagentId,
        type,
        quantity,
        batchNumber: batchNumber || null,
        notes: notes || null,
        transactionDate: new Date(),
        userId: session.user.id
      }
    })

    // Verificar alertas después de la transacción
    const newCurrentStock = await calculateCurrentStock(reagentId)
    let alertType: 'LOW_STOCK' | 'EXPIRING_SOON' | 'EXPIRED' | null = null

    if (newCurrentStock <= reagent.minStockLevel) {
      alertType = 'LOW_STOCK'
    }

    if (reagent.expirationDate) {
      const today = new Date()
      const expiration = new Date(reagent.expirationDate)
      const daysUntilExpiration = Math.floor((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntilExpiration < 0) {
        alertType = alertType ? alertType : 'EXPIRED'
      } else if (daysUntilExpiration <= 30) {
        alertType = alertType ? alertType : 'EXPIRING_SOON'
      }
    }

    // Crear alertas si es necesario
    if (alertType) {
      await db.reagentAlert.create({
        data: {
          reagentId,
          alertType,
          alertMessage: getAlertMessage(alertType, reagent.name, newCurrentStock, reagent.expirationDate),
          isResolved: false,
          userId: session.user.id
        }
      })
    }

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: type === 'IN' ? 'STOCK_IN' : 'STOCK_OUT',
        entityType: 'Reagent',
        entityId: reagent.id,
        entityName: reagent.name,
        changes: JSON.stringify({
          transactionType: type,
          quantity,
          batchNumber,
          previousStock: reagent.currentStock,
          newStock: newCurrentStock,
          alertCreated: alertType
        })
      }
    })

    return NextResponse.json({
      success: true,
      transaction,
      newStock: newCurrentStock
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating reagent transaction:', error)
    return NextResponse.json(
      { error: 'Error al registrar transacción' },
      { status: 500 }
    )
  }
}

// Función auxiliar para calcular stock actual
async function calculateCurrentStock(reagentId: string): Promise<number> {
  const transactions = await db.reagentTransaction.findMany({
    where: { reagentId },
    orderBy: { createdAt: 'desc' }
  })

  const currentStock = transactions.reduce((stock, t) => {
    if (t.type === 'IN') {
      return stock + t.quantity
    } else {
      return stock - t.quantity
    }
  }, 0)

  return currentStock
}

// Función auxiliar para obtener mensaje de alerta
function getAlertMessage(
  alertType: string,
  reagentName: string,
  currentStock: number,
  expirationDate?: Date | null
): string {
  switch (alertType) {
    case 'LOW_STOCK':
      return `Bajo stock: ${reagentName} tiene solo ${currentStock} unidades`
    case 'EXPIRING_SOON':
      return `Caducidad próxima: ${reagentName} caduca el ${expirationDate?.toLocaleDateString('es-VE')}`
    case 'EXPIRED':
      return `Caducado: ${reagentName} está caducado desde ${expirationDate?.toLocaleDateString('es-VE')}`
    default:
      return ''
  }
}
