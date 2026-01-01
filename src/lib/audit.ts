import { NextRequest } from 'next/server'
import { db } from './db'
import { AuditAction } from '@prisma/client'

interface AuditLogData {
  userId: string
  action: AuditAction
  entityType: string
  entityId: string
  entityName?: string
  changes?: Record<string, unknown>
  request?: NextRequest
}

/**
 * Extrae la IP del cliente del request
 */
export function getClientIP(request: NextRequest): string {
  // Orden de prioridad para obtener IP real
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for puede contener múltiples IPs, la primera es el cliente
    return forwardedFor.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback
  return request.headers.get('x-client-ip') || 'unknown'
}

/**
 * Extrae el User Agent del request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown'
}

/**
 * Crea una entrada en el log de auditoría con información completa del request
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  const ipAddress = data.request ? getClientIP(data.request) : 'system'
  const userAgent = data.request ? getUserAgent(data.request) : 'system'

  await db.auditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      entityName: data.entityName || null,
      changes: data.changes ? JSON.stringify(data.changes) : null,
      ipAddress,
      userAgent
    }
  })
}

/**
 * Sanitiza datos sensibles antes de guardar en auditoría
 * Elimina información que no debe ser almacenada en logs
 */
export function sanitizeForAudit(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'cedula',
    'results', // Resultados de pruebas médicas
    'medicalHistory',
    'allergies'
  ]

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()

    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForAudit(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}
