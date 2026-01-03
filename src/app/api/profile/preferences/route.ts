import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

interface NotificationPreferences {
  notifications?: boolean
  emailNotifications?: boolean
  darkMode?: boolean
}

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

    // Obtener preferencias actuales
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { notificationPreferences: true }
    })

    // Parsear preferencias existentes
    let currentPreferences: NotificationPreferences = {}
    if (currentUser?.notificationPreferences) {
      try {
        currentPreferences = JSON.parse(currentUser.notificationPreferences)
      } catch {
        currentPreferences = {}
      }
    }

    // Merge con nuevas preferencias
    const newPreferences: NotificationPreferences = {
      notifications: notifications !== undefined ? notifications : currentPreferences.notifications,
      emailNotifications: emailNotifications !== undefined ? emailNotifications : currentPreferences.emailNotifications,
      darkMode: darkMode !== undefined ? darkMode : currentPreferences.darkMode
    }

    // Actualizar preferencias como JSON string
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        notificationPreferences: JSON.stringify(newPreferences)
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
          preferencesUpdated: newPreferences
        })
      }
    })

    return NextResponse.json({
      ...updatedUser,
      preferences: newPreferences
    })
  } catch (error) {
    console.error('Error updating preferences:', error)
    return NextResponse.json(
      { error: 'Error al actualizar preferencias' },
      { status: 500 }
    )
  }
}
