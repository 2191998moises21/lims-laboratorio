import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

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

        // Buscar usuario por email
        const user = await db.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user) {
          throw new Error('Usuario no encontrado')
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
          throw new Error('Contraseña incorrecta')
        }

        // Actualizar último login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })

        // Crear entrada de auditoría para login
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN',
            entityType: 'User',
            entityId: user.id,
            entityName: user.name,
            ipAddress: '', // TODO: Obtener IP real del request
            userAgent: '' // TODO: Obtener user agent real
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
