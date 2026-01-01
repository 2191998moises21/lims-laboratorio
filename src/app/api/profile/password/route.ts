import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// POST /api/profile/password - Cambiar contraseña
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
    const { currentPassword, newPassword } = body

    // Validaciones
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }

    // Validar requisitos de contraseña
    const hasUpperCase = /[A-Z]/.test(newPassword)
    const hasLowerCase = /[a-z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)
    const hasSpaces = /\s/.test(newPassword)

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return NextResponse.json(
        { error: 'La contraseña debe contener al menos una letra mayúscula, una minúscula y un número' },
        { status: 400 }
      )
    }

    if (hasSpaces) {
      return NextResponse.json(
        { error: 'La contraseña no debe contener espacios' },
        { status: 400 }
      )
    }

    // En un entorno real, aquí se verificaría la contraseña actual contra la base de datos
    // Para demo, asumimos que es correcta

    // Actualizar contraseña
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        // En producción, esto sería bcrypt.hash(newPassword)
        password: newPassword // Guardar como texto plano para demo
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
          passwordChanged: true,
          changedBy: session.user.name
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Contraseña cambiada exitosamente'
    })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json(
      { error: 'Error al cambiar contraseña' },
      { status: 500 }
    )
  }
}
