// =============================================================================
// API: DIGITAL SIGNATURES
// =============================================================================
// Gestión de firmas digitales para documentos y resultados
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'
import { headers } from 'next/headers'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

// Generar hash de firma
function generateSignatureHash(
  userId: string,
  entityType: string,
  entityId: string,
  timestamp: Date
): string {
  const data = `${userId}:${entityType}:${entityId}:${timestamp.toISOString()}`
  return createHash('sha256').update(data).digest('hex')
}

// GET - Obtener firmas de una entidad
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'Tipo y ID de entidad requeridos' },
        { status: 400 }
      )
    }

    const signatures = await db.digitalSignature.findMany({
      where: { entityType, entityId },
      orderBy: { signedAt: 'desc' },
    })

    // Obtener nombres de usuarios
    const userIds = [...new Set(signatures.map((s) => s.userId))]
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, role: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    const signaturesWithNames = signatures.map((sig) => ({
      ...sig,
      userName: userMap.get(sig.userId)?.name || 'Desconocido',
      userRole: userMap.get(sig.userId)?.role || 'Desconocido',
    }))

    return NextResponse.json({
      signatures: signaturesWithNames,
      isFullySigned: signatures.length > 0 && signatures.every((s) => s.isValid),
      validSignatures: signatures.filter((s) => s.isValid).length,
      invalidSignatures: signatures.filter((s) => !s.isValid).length,
    })
  } catch (error) {
    console.error('[Signatures GET]', error)
    return NextResponse.json(
      { error: 'Error al obtener firmas' },
      { status: 500 }
    )
  }
}

// POST - Crear firma digital
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo bioanalistas y admins pueden firmar
    if (!['ADMIN', 'BIOANALYST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para firmar documentos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { entityType, entityId } = body

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'Tipo y ID de entidad requeridos' },
        { status: 400 }
      )
    }

    // Validar tipos de entidad permitidos
    const validEntityTypes = ['Report', 'SampleTest', 'QCResult', 'ReportVersion']
    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        { error: 'Tipo de entidad no válido para firma' },
        { status: 400 }
      )
    }

    // Verificar si ya existe firma de este usuario para esta entidad
    const existingSignature = await db.digitalSignature.findUnique({
      where: {
        entityType_entityId_userId: {
          entityType,
          entityId,
          userId: session.user.id,
        },
      },
    })

    if (existingSignature) {
      return NextResponse.json(
        { error: 'Ya ha firmado este documento' },
        { status: 400 }
      )
    }

    // Obtener información del dispositivo
    const headersList = await headers()
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    const signedAt = new Date()
    const signatureHash = generateSignatureHash(
      session.user.id,
      entityType,
      entityId,
      signedAt
    )

    const signature = await db.digitalSignature.create({
      data: {
        userId: session.user.id,
        entityType,
        entityId,
        signatureHash,
        signedAt,
        ipAddress,
        deviceInfo: userAgent.substring(0, 500), // Limitar longitud
      },
    })

    // Obtener nombre del usuario
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, role: true },
    })

    return NextResponse.json({
      signature: {
        ...signature,
        userName: user?.name,
        userRole: user?.role,
      },
      message: 'Documento firmado exitosamente',
    }, { status: 201 })
  } catch (error) {
    console.error('[Signatures POST]', error)
    return NextResponse.json(
      { error: 'Error al firmar documento' },
      { status: 500 }
    )
  }
}

// DELETE - Invalidar firma (solo admin)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo administradores pueden invalidar firmas' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const signatureId = searchParams.get('id')
    const reason = searchParams.get('reason')

    if (!signatureId || !reason) {
      return NextResponse.json(
        { error: 'ID de firma y razón de invalidación requeridos' },
        { status: 400 }
      )
    }

    const updated = await db.digitalSignature.update({
      where: { id: signatureId },
      data: {
        isValid: false,
        invalidatedAt: new Date(),
        invalidatedReason: reason,
      },
    })

    return NextResponse.json({
      signature: updated,
      message: 'Firma invalidada',
    })
  } catch (error) {
    console.error('[Signatures DELETE]', error)
    return NextResponse.json(
      { error: 'Error al invalidar firma' },
      { status: 500 }
    )
  }
}

// Verificar firma
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { signatureHash } = body

    if (!signatureHash) {
      return NextResponse.json(
        { error: 'Hash de firma requerido' },
        { status: 400 }
      )
    }

    const signature = await db.digitalSignature.findFirst({
      where: { signatureHash },
    })

    if (!signature) {
      return NextResponse.json({
        valid: false,
        message: 'Firma no encontrada',
      })
    }

    // Obtener información del firmante
    const user = await db.user.findUnique({
      where: { id: signature.userId },
      select: { name: true, role: true },
    })

    return NextResponse.json({
      valid: signature.isValid,
      signature: {
        signedAt: signature.signedAt,
        userName: user?.name,
        userRole: user?.role,
        entityType: signature.entityType,
        entityId: signature.entityId,
      },
      invalidatedAt: signature.invalidatedAt,
      invalidatedReason: signature.invalidatedReason,
    })
  } catch (error) {
    console.error('[Signatures PATCH]', error)
    return NextResponse.json(
      { error: 'Error al verificar firma' },
      { status: 500 }
    )
  }
}
