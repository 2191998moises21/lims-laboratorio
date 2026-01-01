import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import {
  isAccountLocked,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
} from '@/lib/rate-limit'

/**
 * Obtiene la IP del cliente desde los headers del request
 */
function getClientIPFromHeaders(): string {
  try {
    const headersList = headers()
    return (
      headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      'unknown'
    )
  } catch {
    return 'unknown'
  }
}

/**
 * Obtiene el User Agent desde los headers del request
 */
function getUserAgentFromHeaders(): string {
  try {
    const headersList = headers()
    return headersList.get('user-agent') || 'unknown'
  } catch {
    return 'unknown'
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Credenciales incompletas')
        }

        const email = credentials.email.toLowerCase().trim()

        // Verificar si la cuenta está bloqueada por intentos fallidos
        const lockStatus = isAccountLocked(email)
        if (lockStatus.locked) {
          throw new Error(
            `Cuenta bloqueada temporalmente. Intente nuevamente en ${lockStatus.retryAfter} segundos.`
          )
        }

        // Buscar usuario por email
        const user = await db.user.findUnique({
          where: { email }
        })

        if (!user) {
          // Registrar intento fallido
          recordFailedLoginAttempt(email)
          throw new Error('Credenciales inválidas')
        }

        // Verificar si el usuario está activo
        if (!user.isActive) {
          throw new Error('Usuario desactivado. Contacte al administrador.')
        }

        // Verificar contraseña
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          // Registrar intento fallido
          recordFailedLoginAttempt(email)
          throw new Error('Credenciales inválidas')
        }

        // Login exitoso - limpiar intentos fallidos
        clearFailedLoginAttempts(email)

        // Obtener información del request para auditoría
        const ipAddress = getClientIPFromHeaders()
        const userAgent = getUserAgentFromHeaders()

        // Actualizar último login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })

        // Crear entrada de auditoría para login con IP y UserAgent
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN',
            entityType: 'User',
            entityId: user.id,
            entityName: user.name,
            ipAddress,
            userAgent,
            changes: JSON.stringify({
              loginTime: new Date().toISOString(),
              method: 'credentials'
            })
          }
        })

        // Retornar usuario sin contraseña
        const { password, ...userWithoutPassword } = user

        return userWithoutPassword
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.role = token.role as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// Extender tipos de NextAuth
declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name: string
    role: string
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email: string
    name: string
    role: string
  }
}
