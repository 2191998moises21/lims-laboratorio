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
    const { reagentId, transactionType, quantity, reason, referenceNumber } = body

    // Validaciones
    if (!reagentId || !transactionType || !quantity) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos (reagentId, transactionType, quantity)' },
        { status: 400 }
      )
    }

    if (!['ENTRY', 'EXIT', 'ADJUSTMENT'].includes(transactionType)) {
      return NextResponse.json(
        { error: 'Tipo de transacción inválido. Use ENTRY, EXIT o ADJUSTMENT' },
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

    const previousQuantity = reagent.quantity

    // Verificar si hay stock suficiente para salidas
    if (transactionType === 'EXIT' && previousQuantity < quantity) {
      return NextResponse.json(
        { error: 'No hay suficiente stock' },
        { status: 400 }
      )
    }

    // Calcular nueva cantidad
    let newQuantity: number
    if (transactionType === 'ENTRY') {
      newQuantity = previousQuantity + quantity
    } else if (transactionType === 'EXIT') {
      newQuantity = previousQuantity - quantity
    } else {
      // ADJUSTMENT - la cantidad es el nuevo valor absoluto
      newQuantity = quantity
    }

    // Crear transacción
    const transaction = await db.reagentTransaction.create({
      data: {
        reagentId,
        transactionType,
        quantity,
        previousQuantity,
        newQuantity,
        performedBy: session.user.name || session.user.email || 'Usuario',
        reason: reason || null,
        referenceNumber: referenceNumber || null,
        transactionDate: new Date()
      }
    })

    // Actualizar cantidad del reactivo
    await db.reagent.update({
      where: { id: reagentId },
      data: { quantity: newQuantity }
    })

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Reagent',
        entityId: reagent.id,
        entityName: reagent.name,
        changes: JSON.stringify({
          transactionType,
          quantity,
          previousQuantity,
          newQuantity,
          reason,
          referenceNumber
        })
      }
    })

    return NextResponse.json({
      success: true,
      transaction,
      previousStock: previousQuantity,
      newStock: newQuantity
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating reagent transaction:', error)
    return NextResponse.json(
      { error: 'Error al registrar transacción' },
      { status: 500 }
    )
  }
}
