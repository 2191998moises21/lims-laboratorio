import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/equipment-maintenances - Listar mantenimientos
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
    const equipmentId = searchParams.get('equipmentId') || ''
    const status = searchParams.get('status') || ''

    const where: any = {}

    if (equipmentId) {
      where.equipmentId = equipmentId
    }

    if (status) {
      where.status = status
    }

    const maintenances = await db.equipmentMaintenance.findMany({
      where,
      include: {
        equipment: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        maintenanceDate: 'desc'
      }
    })

    return NextResponse.json(maintenances)
  } catch (error) {
    console.error('Error fetching maintenances:', error)
    return NextResponse.json(
      { error: 'Error al obtener mantenimientos' },
      { status: 500 }
    )
  }
}

// POST /api/equipment-maintenances - Registrar mantenimiento
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    if (session.user.role === 'LAB_ASSISTANT') {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Bioanalista o Administrador.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      equipmentId,
      maintenanceDate,
      maintenanceType,
      description,
      performedBy,
      cost,
      nextMaintenanceDate,
      notes
    } = body

    if (!equipmentId || !maintenanceDate || !maintenanceType) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    const equipment = await db.equipment.findUnique({
      where: { id: equipmentId }
    })

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipo no encontrado' },
        { status: 404 }
      )
    }

    // Crear mantenimiento
    const maintenance = await db.equipmentMaintenance.create({
      data: {
        equipmentId,
        maintenanceDate: new Date(maintenanceDate),
        maintenanceType,
        description: description || null,
        performedBy: performedBy || null,
        cost: cost ? parseFloat(cost) : null,
        nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null,
        notes: notes || null,
        status: 'COMPLETED'
      }
    })

    // Actualizar equipo
    await db.equipment.update({
      where: { id: equipmentId },
      data: {
        lastMaintenanceDate: new Date(maintenanceDate),
        nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null,
        maintenanceCount: equipment.maintenanceCount + 1,
        status: equipment.status === 'IN_MAINTENANCE' ? 'ACTIVE' : equipment.status
      }
    })

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'MAINTAIN',
        entityType: 'Equipment',
        entityId: equipmentId,
        entityName: `${equipment.code} - ${equipment.name}`,
        changes: JSON.stringify({
          maintenanceType,
          maintenanceDate,
          cost,
          nextMaintenanceDate,
          statusChanged: {
            from: equipment.status,
            to: 'ACTIVE'
          }
        })
      }
    })

    return NextResponse.json(maintenance, { status: 201 })
  } catch (error) {
    console.error('Error creating maintenance:', error)
    return NextResponse.json(
      { error: 'Error al registrar mantenimiento' },
      { status: 500 }
    )
  }
}
