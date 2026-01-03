import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/equipment-calibrations - Listar calibraciones
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

    const where: Record<string, string> = {}

    if (equipmentId) {
      where.equipmentId = equipmentId
    }

    const calibrations = await db.calibration.findMany({
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
        calibrationDate: 'desc'
      }
    })

    return NextResponse.json(calibrations)
  } catch (error) {
    console.error('Error fetching calibrations:', error)
    return NextResponse.json(
      { error: 'Error al obtener calibraciones' },
      { status: 500 }
    )
  }
}

// POST /api/equipment-calibrations - Registrar calibración
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
      calibrationDate,
      performedBy,
      results,
      nextCalibrationDate,
      notes,
      certificateUrl
    } = body

    if (!equipmentId || !calibrationDate || !performedBy || !results) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos (equipmentId, calibrationDate, performedBy, results)' },
        { status: 400 }
      )
    }

    // Obtener equipo
    const equipment = await db.equipment.findUnique({
      where: { id: equipmentId }
    })

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipo no encontrado' },
        { status: 404 }
      )
    }

    // Crear calibración
    const calibration = await db.calibration.create({
      data: {
        equipmentId,
        calibrationDate: new Date(calibrationDate),
        performedBy,
        results,
        nextCalibrationDate: nextCalibrationDate ? new Date(nextCalibrationDate) : null,
        notes: notes || null,
        certificateUrl: certificateUrl || null
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
          calibratedBy: performedBy,
          calibrationDate,
          results,
          nextCalibrationDate
        })
      }
    })

    return NextResponse.json(calibration, { status: 201 })
  } catch (error) {
    console.error('Error creating calibration:', error)
    return NextResponse.json(
      { error: 'Error al registrar calibración' },
      { status: 500 }
    )
  }
}
