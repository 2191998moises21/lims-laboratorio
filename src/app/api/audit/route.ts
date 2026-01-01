import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// GET /api/audit - Listar logs de auditoría o exportar a CSV
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
    const action = searchParams.get('action') || ''
    const entityType = searchParams.get('entityType') || ''
    const user = searchParams.get('user') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const category = searchParams.get('category') || ''
    const shouldExport = searchParams.get('export') || '' // Parámetro para exportar a CSV

    // Construir where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
        { action: { contains: search } },
        { entityType: { contains: search } },
        { entityName: { contains: search } },
        { changes: { contains: search } }
      ]
    }

    if (action) {
      where.action = action
    }

    if (entityType) {
      where.entityType = entityType
    }

    if (user) {
      where.user = {
        OR: [
          { name: { contains: user } },
          { email: { contains: user } }
        ]
      }
    }

    if (dateFrom || dateTo) {
      const timestamp: any = {}
      
      if (dateFrom) {
        timestamp.gte = new Date(dateFrom)
      }
      
      if (dateTo) {
        const dateToMidnight = new Date(dateTo)
        dateToMidnight.setHours(23, 59, 59, 999)
        timestamp.lte = dateToMidnight
      }
      
      where.timestamp = timestamp
    }

    // Filtrar por categoría (tipo de entidad)
    if (category) {
      switch (category) {
        case 'samples':
          where.entityType = { in: ['Sample', 'SampleTest', 'TestResult'] }
          break
        case 'tests':
          where.entityType = { in: ['Test', 'TestParameter'] }
          break
        case 'reagents':
          where.entityType = { in: ['Reagent', 'ReagentTransaction', 'ReagentAlert'] }
          break
        case 'equipment':
          where.entityType = { in: ['Equipment', 'EquipmentCalibration', 'EquipmentMaintenance'] }
          break
        case 'users':
          where.entityType = 'User'
          break
        case 'settings':
          where.entityType = 'Setting'
          break
      }
    }

    // Si se solicita exportación CSV
    if (shouldExport === 'true') {
      // Obtener logs sin límite para exportación completa
      const auditLogs = await db.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      })

      // Generar CSV
      const csvHeaders = [
        'Fecha/Hora',
        'Usuario',
        'Email',
        'Rol',
        'Acción',
        'Tipo de Entidad',
        'ID de Entidad',
        'Nombre de Entidad',
        'Cambios'
      ]

      const csvRows = auditLogs.map((log: any) => {
        const changesParsed = JSON.parse(log.changes)
        const changesString = JSON.stringify(changesParsed)
          .replace(/"/g, '')
          .replace(/{/g, '(')
          .replace(/}/g, ')')
          .replace(/,/g, ';')

        return [
          new Date(log.timestamp).toLocaleString('es-VE'),
          log.user.name,
          log.user.email,
          log.user.role,
          log.action,
          log.entityType,
          log.entityId,
          log.entityName,
          `"${changesString}"` // Entrecomillas para manejar comas en el texto
        ].join(',')
      })

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows
      ].join('\n')

      // Crear respuesta CSV con BOM (Byte Order Mark) para Excel
      const csv = '\uFEFF' + csvContent

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv;charset=utf-8;',
          'Content-Disposition': `attachment; filename="auditoria_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // Query normal para listar logs (con límite de 100)
    const auditLogs = await db.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 100 // Limitar a 100 registros por página
    })

    return NextResponse.json(auditLogs)
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Error al obtener registros de auditoría' },
      { status: 500 }
    )
  }
}
