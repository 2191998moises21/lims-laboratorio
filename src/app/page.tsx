'use client'

import { useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, LogOut, User, Shield, FlaskConical, FileText, Activity, Package, Cog } from 'lucide-react'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Navegar a login si no está autenticado (usando useEffect para evitar error de React 19)
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Administrador</Badge>
      case 'BIOANALYST':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Bioanalista</Badge>
      case 'LAB_ASSISTANT':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Asistente de Laboratorio</Badge>
      default:
        return <Badge>{role}</Badge>
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null // La redirección se maneja en useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  Sistema de Gestión Laboratorial
                </h1>
                <p className="text-xs text-slate-500">Bacteriología</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-slate-600 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-slate-700" />
              <div>
                <CardTitle className="text-lg">Bienvenido de nuevo</CardTitle>
                <CardDescription>
                  {session.user.name} - {session.user.email}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="text-xs">
                {session.user.role}
              </Badge>
              {getRoleBadge(session.user.role)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Nombre</p>
                <p className="text-slate-900">{session.user.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Correo Electrónico</p>
                <p className="text-slate-900">{session.user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Rol</p>
                {getRoleBadge(session.user.role)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Registrar Muestra</CardTitle>
                <CardDescription>Ingresar muestra al sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  onClick={() => router.push('/samples/new')}
                >
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Nueva Muestra
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Panel de Control</CardTitle>
                <CardDescription>Ver métricas y estadísticas</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full border-slate-300"
                  onClick={() => router.push('/dashboard/executive')}
                >
                  Ver Dashboard
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Resultados</CardTitle>
                <CardDescription>Ver resultados e informes</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full border-slate-300"
                  onClick={() => router.push('/results')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Resultados
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Inventario</CardTitle>
                <CardDescription>Gestión de reactivos</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  onClick={() => router.push('/reagents')}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Ver Inventario
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Equipos</CardTitle>
                <CardDescription>Gestión de equipos e instrumentos</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  onClick={() => router.push('/equipment')}
                >
                  <Cog className="h-4 w-4 mr-2" />
                  Ver Equipos
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Auditoría</CardTitle>
                <CardDescription>Registro de acciones</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full border-slate-300"
                  onClick={() => router.push('/audit')}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Ver Auditoría
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Configuración</CardTitle>
                <CardDescription>Ajustes del sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  onClick={() => router.push('/settings')}
                >
                  <Cog className="h-4 w-4 mr-2" />
                  Configurar Sistema
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Status Message */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Sistema Activo</h3>
                <p className="text-sm text-blue-700">
                  El sistema de gestión laboratorial está funcionando correctamente. La autenticación ha sido establecida exitosamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-center text-sm text-slate-500">
              © {new Date().getFullYear()} Sistema de Gestión Laboratorial - Bacteriología. Todos los derechos reservados.
            </p>
          </div>
        </footer>
      </main>
    </div>
  )
}
