import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// PATCH /api/profile/preferences - Actualizar preferencias
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { notifications, emailNotifications, darkMode } = body

    // Actualizar preferencias
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          notifications: notifications !== undefined ? notifications : session.user.preferences?.notifications,
          emailNotifications: emailNotifications !== undefined ? emailNotifications : session.user.preferences?.emailNotifications,
          darkMode: darkMode !== undefined ? darkMode : session.user.preferences?.darkMode
        }
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
          preferencesUpdated: { notifications, emailNotifications, darkMode }
        })
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating preferences:', error)
    return NextResponse.json(
      { error: 'Error al actualizar preferencias' },
      { status: 500 }
    )
  }
}
