import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  interval: number // Intervalo en milisegundos
  maxRequests: number // Máximo de requests por intervalo
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Almacenamiento en memoria para rate limiting
// En producción con múltiples instancias, usar Redis
const rateLimitStore = new Map<string, RateLimitEntry>()

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Configuraciones predefinidas de rate limiting
 */
export const RateLimitPresets = {
  // Para autenticación: 5 intentos por minuto
  auth: { interval: 60 * 1000, maxRequests: 5 },
  // Para APIs normales: 100 requests por minuto
  api: { interval: 60 * 1000, maxRequests: 100 },
  // Para operaciones sensibles: 10 por minuto
  sensitive: { interval: 60 * 1000, maxRequests: 10 },
  // Para búsquedas: 30 por minuto
  search: { interval: 60 * 1000, maxRequests: 30 },
} as const

/**
 * Obtiene la IP del cliente para rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

/**
 * Verifica rate limiting para una request
 * @returns null si está permitido, NextResponse si está bloqueado
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  keyPrefix: string = 'default'
): NextResponse | null {
  const clientId = getClientIdentifier(request)
  const key = `${keyPrefix}:${clientId}`
  const now = Date.now()

  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetTime < now) {
    // Primera request o período expirado
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.interval,
    })
    return null
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit excedido
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)

    return NextResponse.json(
      {
        error: 'Demasiadas solicitudes. Por favor, espere antes de intentar nuevamente.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString(),
        },
      }
    )
  }

  // Incrementar contador
  entry.count++
  rateLimitStore.set(key, entry)

  return null
}

/**
 * Wrapper para aplicar rate limiting a un handler de API
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<NextResponse>>(
  handler: T,
  config: RateLimitConfig = RateLimitPresets.api,
  keyPrefix: string = 'api'
) {
  return async (request: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
    const rateLimitResponse = checkRateLimit(request, config, keyPrefix)

    if (rateLimitResponse) {
      return rateLimitResponse
    }

    return handler(request, ...args)
  }
}

/**
 * Registra un intento de login fallido para rate limiting más estricto
 */
export function recordFailedLoginAttempt(identifier: string): void {
  const key = `failed-login:${identifier}`
  const now = Date.now()
  const lockoutPeriod = 15 * 60 * 1000 // 15 minutos de lockout

  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + lockoutPeriod,
    })
  } else {
    entry.count++
    rateLimitStore.set(key, entry)
  }
}

/**
 * Verifica si una cuenta está bloqueada por intentos fallidos
 */
export function isAccountLocked(identifier: string): { locked: boolean; retryAfter?: number } {
  const key = `failed-login:${identifier}`
  const now = Date.now()
  const maxFailedAttempts = 5

  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetTime < now) {
    return { locked: false }
  }

  if (entry.count >= maxFailedAttempts) {
    return {
      locked: true,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    }
  }

  return { locked: false }
}

/**
 * Limpia los intentos fallidos después de un login exitoso
 */
export function clearFailedLoginAttempts(identifier: string): void {
  rateLimitStore.delete(`failed-login:${identifier}`)
}
