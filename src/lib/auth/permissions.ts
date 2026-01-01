import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './options'

/**
 * Roles del sistema
 */
export type UserRole = 'ADMIN' | 'BIOANALYST' | 'LAB_ASSISTANT'

/**
 * Acciones que se pueden realizar en el sistema
 */
export type Action =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'validate'
  | 'export'
  | 'manage'

/**
 * Recursos del sistema
 */
export type Resource =
  | 'users'
  | 'samples'
  | 'tests'
  | 'results'
  | 'reagents'
  | 'equipment'
  | 'audit'
  | 'settings'
  | 'reports'

/**
 * Matriz de permisos: define qué acciones puede realizar cada rol en cada recurso
 */
const permissionMatrix: Record<UserRole, Record<Resource, Action[]>> = {
  ADMIN: {
    users: ['create', 'read', 'update', 'delete', 'manage'],
    samples: ['create', 'read', 'update', 'delete', 'export'],
    tests: ['create', 'read', 'update', 'delete', 'manage'],
    results: ['create', 'read', 'update', 'delete', 'validate', 'export'],
    reagents: ['create', 'read', 'update', 'delete', 'manage'],
    equipment: ['create', 'read', 'update', 'delete', 'manage'],
    audit: ['read', 'export'],
    settings: ['read', 'update', 'manage'],
    reports: ['create', 'read', 'export'],
  },
  BIOANALYST: {
    users: ['read'],
    samples: ['create', 'read', 'update'],
    tests: ['read'],
    results: ['create', 'read', 'update', 'validate', 'export'],
    reagents: ['read', 'update'],
    equipment: ['read', 'update'],
    audit: ['read'],
    settings: ['read'],
    reports: ['create', 'read', 'export'],
  },
  LAB_ASSISTANT: {
    users: [],
    samples: ['create', 'read'],
    tests: ['read'],
    results: ['read'],
    reagents: ['read'],
    equipment: ['read'],
    audit: [],
    settings: [],
    reports: ['read'],
  },
}

/**
 * Verifica si un rol tiene permiso para realizar una acción en un recurso
 */
export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: Action
): boolean {
  const rolePermissions = permissionMatrix[role]
  if (!rolePermissions) return false

  const resourcePermissions = rolePermissions[resource]
  if (!resourcePermissions) return false

  return resourcePermissions.includes(action)
}

/**
 * Verifica si el usuario actual tiene permiso para realizar una acción
 */
export async function checkPermission(
  resource: Resource,
  action: Action
): Promise<{ allowed: boolean; session: Awaited<ReturnType<typeof getServerSession>> }> {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    return { allowed: false, session: null }
  }

  const userRole = session.user.role as UserRole
  const allowed = hasPermission(userRole, resource, action)

  return { allowed, session }
}

/**
 * Respuesta de error de autorización
 */
export function unauthorizedResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: message || 'No autorizado' },
    { status: 401 }
  )
}

/**
 * Respuesta de error de permisos
 */
export function forbiddenResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: message || 'No tiene permisos para realizar esta acción' },
    { status: 403 }
  )
}

/**
 * Middleware wrapper que verifica permisos antes de ejecutar el handler
 */
export function withPermission<T extends (...args: unknown[]) => Promise<NextResponse>>(
  resource: Resource,
  action: Action,
  handler: T
) {
  return async (request: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
    const { allowed, session } = await checkPermission(resource, action)

    if (!session) {
      return unauthorizedResponse()
    }

    if (!allowed) {
      return forbiddenResponse(
        `Su rol (${session.user.role}) no tiene permiso para ${action} en ${resource}`
      )
    }

    // Inyectar session en el request para uso posterior
    ;(request as NextRequest & { session: typeof session }).session = session

    return handler(request, ...args)
  }
}

/**
 * Hook para verificar permisos en componentes de servidor
 */
export async function requirePermission(
  resource: Resource,
  action: Action
): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>
  role: UserRole
}> {
  const { allowed, session } = await checkPermission(resource, action)

  if (!session) {
    throw new Error('No autorizado')
  }

  if (!allowed) {
    throw new Error(`No tiene permisos para ${action} en ${resource}`)
  }

  return {
    session,
    role: session.user.role as UserRole,
  }
}

/**
 * Obtener todos los permisos de un rol
 */
export function getRolePermissions(role: UserRole): Record<Resource, Action[]> {
  return permissionMatrix[role] || {}
}

/**
 * Verificar si un usuario puede acceder a datos de otro usuario
 */
export function canAccessUserData(
  currentUserRole: UserRole,
  currentUserId: string,
  targetUserId: string
): boolean {
  // Admin puede acceder a todos
  if (currentUserRole === 'ADMIN') return true

  // Los demás solo pueden acceder a sus propios datos
  return currentUserId === targetUserId
}

/**
 * Verificar si un usuario puede validar resultados
 */
export function canValidateResults(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'BIOANALYST'
}

/**
 * Verificar si un usuario puede modificar configuración del sistema
 */
export function canModifySettings(role: UserRole): boolean {
  return role === 'ADMIN'
}
