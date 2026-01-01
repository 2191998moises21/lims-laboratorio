import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// POST /api/profile/signature - Guardar firma digital
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
    const { signature } = body

    // Validaciones
    if (!signature || signature.trim().length < 2) {
      return NextResponse.json(
        { error: 'La firma debe tener al menos 2 caracteres' },
        { status: 400 }
      )
    }

    // Actualizar firma del usuario
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        signature: signature.trim()
      }
    })

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'User',
        entityId: session.user.id,
        entityName: updatedUser.name,
        changes: JSON.stringify({
          signatureUpdated: true,
          newSignature: signature.trim()
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Firma digital guardada exitosamente'
    })
  } catch (error) {
    console.error('Error saving signature:', error)
    return NextResponse.json(
      { error: 'Error al guardar firma digital' },
      { status: 500 }
    )
  }
}
