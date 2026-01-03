// =============================================================================
// API: REPORT VERSIONS
// =============================================================================
// Gestión de versiones de informes con control de cambios
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

// GET - Obtener versiones de un informe
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('reportId')

    if (!reportId) {
      return NextResponse.json(
        { error: 'ID de informe requerido' },
        { status: 400 }
      )
    }

    const versions = await db.reportVersion.findMany({
      where: { reportId },
      orderBy: { version: 'desc' },
    })

    // Obtener nombres de usuarios
    const userIds = [...new Set(
      versions.flatMap((v) => [v.createdById, v.approvedById].filter(Boolean) as string[])
    )]

    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u.name]))

    const versionsWithNames = versions.map((version) => ({
      ...version,
      createdByName: userMap.get(version.createdById) || 'Desconocido',
      approvedByName: version.approvedById ? userMap.get(version.approvedById) : null,
      changes: version.changes ? JSON.parse(version.changes) : null,
    }))

    return NextResponse.json({
      versions: versionsWithNames,
      currentVersion: versions[0]?.version || 0,
      totalVersions: versions.length,
    })
  } catch (error) {
    console.error('[ReportVersions GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener versiones' },
      { status: 500 }
    )
  }
}

// POST - Crear nueva versión de informe
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para crear versiones' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { reportId, reason, changes, newPdfUrl } = body

    if (!reportId || !reason || !newPdfUrl) {
      return NextResponse.json(
        { error: 'ID de informe, razón y URL del PDF son requeridos' },
        { status: 400 }
      )
    }

    // Obtener última versión
    const lastVersion = await db.reportVersion.findFirst({
      where: { reportId },
      orderBy: { version: 'desc' },
    })

    const newVersionNumber = (lastVersion?.version || 0) + 1

    // Obtener informe original para el PDF anterior
    const report = await db.report.findUnique({
      where: { id: reportId },
    })

    const version = await db.reportVersion.create({
      data: {
        reportId,
        version: newVersionNumber,
        reason,
        changes: changes ? JSON.stringify(changes) : null,
        previousPdfUrl: lastVersion?.newPdfUrl || report?.pdfUrl,
        newPdfUrl,
        createdById: session.user.id,
      },
    })

    // Actualizar el informe original con el nuevo PDF
    await db.report.update({
      where: { id: reportId },
      data: { pdfUrl: newPdfUrl },
    })

    return NextResponse.json(version, { status: 201 })
  } catch (error) {
    console.error('[ReportVersions POST]', error)
    return NextResponse.json(
      { error: 'Error al crear versión' },
      { status: 500 }
    )
  }
}

// PUT - Aprobar versión de informe
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para aprobar versiones' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { versionId, digitalSignature } = body

    if (!versionId) {
      return NextResponse.json(
        { error: 'ID de versión requerido' },
        { status: 400 }
      )
    }

    const updated = await db.reportVersion.update({
      where: { id: versionId },
      data: {
        approvedById: session.user.id,
        approvedAt: new Date(),
        digitalSignature,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[ReportVersions PUT]', error)
    return NextResponse.json(
      { error: 'Error al aprobar versión' },
      { status: 500 }
    )
  }
}
