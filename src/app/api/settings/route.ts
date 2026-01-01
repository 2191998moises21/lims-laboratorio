import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/settings - Obtener todas las configuraciones
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Solo administradores pueden acceder a las configuraciones
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de administrador.' },
        { status: 403 }
      )
    }

    const configs = await db.systemConfig.findMany({
      orderBy: { category: 'asc' }
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Error al obtener configuraciones' },
      { status: 500 }
    )
  }
}

// POST /api/settings - Actualizar o crear configuraciones
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Solo administradores pueden modificar configuraciones
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de administrador.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const configs = body

    if (!configs || typeof configs !== 'object') {
      return NextResponse.json(
        { error: 'Formato de configuración inválido' },
        { status: 400 }
      )
    }

    // Actualizar o crear cada configuración
    const results = []
    for (const [key, value] of Object.entries(configs)) {
      try {
        const config = await db.systemConfig.upsert({
          where: { key },
          update: { value },
          create: {
            key,
            value: String(value),
            category: getCategoryForKey(key)
          }
        })
        results.push(config)
      } catch (error) {
        console.error(`Error updating config ${key}:`, error)
      }
    }

    // Crear entrada de auditoría para cada configuración modificada
    if (results.length > 0) {
      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE',
          entityType: 'SystemConfig',
          entityId: session.user.id,
          entityName: 'Configuraciones del Sistema',
          changes: JSON.stringify(configs)
        }
      })
    }

    return NextResponse.json({ success: true, updated: results.length })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Error al actualizar configuraciones' },
      { status: 500 }
    )
  }
}

// Función auxiliar para determinar la categoría de una configuración
function getCategoryForKey(key: string): string {
  const categories: Record<string, string> = {
    // General
    language: 'GENERAL',
    dateFormat: 'GENERAL',
    timezone: 'GENERAL',
    // Laboratory
    defaultUnit: 'LABORATORY',
    referenceRangeDefault: 'LABORATORY',
    // Reports
    reportLogo: 'REPORTS',
    reportHeader: 'REPORTS',
    reportFooter: 'REPORTS',
    // Notifications
    lowStockAlerts: 'NOTIFICATIONS',
    expiryAlerts: 'NOTIFICATIONS',
    lowStockThreshold: 'NOTIFICATIONS',
    expiryAlertDays: 'NOTIFICATIONS',
    emailNotifications: 'NOTIFICATIONS'
  }

  return categories[key] || 'OTHER'
}
