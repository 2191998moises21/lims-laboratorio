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
    const maintenanceType = searchParams.get('maintenanceType') || ''

    const where: Record<string, string> = {}

    if (equipmentId) {
      where.equipmentId = equipmentId
    }

    if (maintenanceType) {
      where.maintenanceType = maintenanceType
    }

    const maintenances = await db.maintenance.findMany({
      where,
      include: {
        equipment: {
          select: {
            name: true,
            serialNumber: true
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
      partsReplaced,
      cost,
      nextMaintenanceDate,
      notes
    } = body

    if (!equipmentId || !maintenanceDate || !maintenanceType || !performedBy || !description) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos (equipmentId, maintenanceDate, maintenanceType, performedBy, description)' },
        { status: 400 }
      )
    }

    // Validar tipo de mantenimiento
    if (!['PREVENTIVE', 'CORRECTIVE'].includes(maintenanceType)) {
      return NextResponse.json(
        { error: 'Tipo de mantenimiento inválido. Use PREVENTIVE o CORRECTIVE' },
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
    const maintenance = await db.maintenance.create({
      data: {
        equipmentId,
        maintenanceDate: new Date(maintenanceDate),
        maintenanceType,
        description,
        performedBy,
        partsReplaced: partsReplaced ? JSON.stringify(partsReplaced) : null,
        cost: cost ? parseFloat(cost) : null,
        nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null,
        notes: notes || null
      }
    })

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Equipment',
        entityId: equipmentId,
        entityName: `${equipment.serialNumber} - ${equipment.name}`,
        changes: JSON.stringify({
          maintenanceType,
          maintenanceDate,
          performedBy,
          description,
          cost,
          nextMaintenanceDate
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
