import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/equipment - Listar equipos con filtros
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
    const type = searchParams.get('type') || ''
    const category = searchParams.get('category') || ''
    const location = searchParams.get('location') || ''
    const status = searchParams.get('status') || ''

    // Construir where clause
    const where: any = { isActive: true }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { manufacturer: { contains: search } },
        { model: { contains: search } },
        { serialNumber: { contains: search } }
      ]
    }

    if (type) {
      where.type = type
    }

    if (category) {
      where.category = { contains: category }
    }

    if (location) {
      where.location = { contains: location }
    }

    if (status) {
      where.status = status
    }

    // Query con información de calibraciones y mantenimientos
    const equipment = await db.equipment.findMany({
      where,
      include: {
        _count: {
          select: {
            calibrations: true,
            maintenances: true
          }
        },
        calibrations: {
          take: 1,
          orderBy: { calibrationDate: 'desc' }
        },
        maintenances: {
          take: 1,
          orderBy: { maintenanceDate: 'desc' }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Procesar datos con contadores y fechas
    const equipmentWithDetails = equipment.map(equip => {
      return {
        ...equip,
        calibrationCount: equip._count?.calibrations || 0,
        maintenanceCount: equip._count?.maintenances || 0,
        lastCalibrationDate: equip.calibrations?.[0]?.calibrationDate || null,
        lastMaintenanceDate: equip.maintenances?.[0]?.maintenanceDate || null
      }
    })

    return NextResponse.json(equipmentWithDetails)
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json(
      { error: 'Error al obtener equipos' },
      { status: 500 }
    )
  }
}

// POST /api/equipment - Registrar nuevo equipo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Solo Bioanalistas y Administradores pueden registrar equipos
    if (session.user.role === 'LAB_ASSISTANT') {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Bioanalista o Administrador.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      code,
      type,
      category,
      manufacturer,
      model,
      serialNumber,
      location,
      status,
      calibrationInterval,
      maintenanceInterval
    } = body

    // Validaciones
    if (!name || !code || !type || !location) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // Verificar código duplicado
    const existingEquipment = await db.equipment.findUnique({
      where: { code }
    })

    if (existingEquipment) {
      return NextResponse.json(
        { error: 'Ya existe un equipo con este código' },
        { status: 409 }
      )
    }

    // Crear equipo
    const equipment = await db.equipment.create({
      data: {
        name,
        code: code.toUpperCase(),
        type,
        category,
        manufacturer: manufacturer || null,
        model: model || null,
        serialNumber: serialNumber || null,
        location,
        status: status || 'ACTIVE',
        calibrationInterval: calibrationInterval ? parseInt(calibrationInterval) : null,
        maintenanceInterval: maintenanceInterval ? parseInt(maintenanceInterval) : null,
        installationDate: new Date(),
        isActive: true
      }
    })

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Equipment',
        entityId: equipment.id,
        entityName: `${code} - ${name}`,
        changes: JSON.stringify({
          created: {
            name,
            type,
            category,
            location,
            status
          }
        })
      }
    })

    return NextResponse.json(equipment, { status: 201 })
  } catch (error) {
    console.error('Error creating equipment:', error)
    return NextResponse.json(
      { error: 'Error al registrar equipo' },
      { status: 500 }
    )
  }
}
