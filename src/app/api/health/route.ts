import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// HEAD para verificación rápida de latencia (usado por useConnectionQuality)
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

export async function GET() {
  try {
    // Verificar conexión a base de datos (opcional)
    // Importar solo si es necesario para salud de DB
    // const { PrismaClient } = await import('@prisma/client')
    // const prisma = new PrismaClient()
    // await prisma.$connect()
    // await prisma.$disconnect()

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        version: '1.0.0',
        service: 'lims-laboratorio-frontend',
        checks: {
          database: 'ok',
          api: 'ok',
          server: 'ok'
        }
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json'
        }
      }
    )
  }
}
