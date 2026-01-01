'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Loader2, AlertCircle, ArrowLeft, User, Lock, Settings, Shield, Camera, Save, LogOut, CheckCircle, XCircle, FileText, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  
  // Profile Data
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Signature
  const [signatureData, setSignatureData] = useState('')
  const [isSavingSignature, setIsSavingSignature] = useState(false)

  // Preferences
  const [notifications, setNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [isUpdatingPreferences, setIsUpdatingPreferences] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session) {
      setName(session.user.name || '')
      setEmail(session.user.email || '')
      setPhone(session.user.phone || '')
      setTitle(session.user.title || '')
    }
  }, [status, session, router])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError('')
    setIsUpdatingProfile(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, title })
      })

      if (response.ok) {
        await update({ name })
        toast.success('Perfil actualizado exitosamente')
      } else {
        const error = await response.json()
        setProfileError(error.message || 'Error al actualizar perfil')
      }
    } catch (err) {
      setProfileError('Error al actualizar perfil')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setIsChangingPassword(true)

    // Validaciones
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden')
      setIsChangingPassword(false)
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres')
      setIsChangingPassword(false)
      return
    }

    try {
      const response = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      if (response.ok) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        toast.success('Contraseña cambiada exitosamente')
        
        // Cerrar sesión y pedir que vuelva a entrar
        await signOut({ callback: '/login' })
      } else {
        const error = await response.json()
        setPasswordError(error.message || 'Error al cambiar contraseña')
      }
    } catch (err) {
      setPasswordError('Error al cambiar contraseña')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleSaveSignature = async () => {
    setIsSavingSignature(true)
    try {
      const response = await fetch('/api/profile/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData })
      })

      if (response.ok) {
        toast.success('Firma digital guardada exitosamente')
        setSignatureData('')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Error al guardar firma')
      }
    } catch (err) {
      toast.error('Error al guardar firma')
    } finally {
      setIsSavingSignature(false)
    }
  }

  const handleUpdatePreferences = async () => {
    setIsUpdatingPreferences(true)
    try {
      const response = await fetch('/api/profile/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications, emailNotifications, darkMode })
      })

      if (response.ok) {
        toast.success('Preferencias actualizadas exitosamente')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Error al actualizar preferencias')
      }
    } catch (err) {
      toast.error('Error al actualizar preferencias')
    } finally {
      setIsUpdatingPreferences(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                onClick={() => router.push('/')}
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Dashboard
              </Button>
              <div className="h-px w-8 bg-slate-300"></div>
              <User className="h-6 w-6 text-slate-700" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  Perfil de Usuario
                </h1>
                <p className="text-xs text-slate-500">Gestión de cuenta</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => signOut({ callback: '/login' })}
              className="border-slate-300"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            {session?.user?.name}
          </h2>
          <p className="text-slate-600">
            {session?.user?.email} • {session?.user?.role === 'ADMIN' ? 'Administrador' : session?.user?.role === 'BIOANALYST' ? 'Bioanalista' : 'Asistente de Laboratorio'}
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="password">
              <Lock className="h-4 w-4 mr-2" />
              Contraseña
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Settings className="h-4 w-4 mr-2" />
              Preferencias
            </TabsTrigger>
            <TabsTrigger value="signature">
              <FileText className="h-4 w-4 mr-2" />
              Firma Digital
            </TabsTrigger>
          </TabsList>

          {/* Profile Information Tab */}
          <TabsContent value="profile" className="space-y-6 pt-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-slate-700" />
                  <span>Información Personal</span>
                </CardTitle>
                <CardDescription>Actualice sus datos personales</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile}>
                  {profileError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{profileError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre Completo *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="border-slate-300"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Correo Electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        disabled
                        className="border-slate-300 bg-slate-50"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Para cambiar el correo, contácte al administrador
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+58 (xxx) xxx-xxxx"
                        className="border-slate-300"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="title">Título / Cargo</Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Bioanalista Jefe"
                        className="border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg mb-4">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-900">
                        <strong>Información de la Cuenta:</strong>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-blue-700">Rol</p>
                        <p className="font-medium text-blue-900">
                          {session?.user?.role === 'ADMIN' ? 'Administrador' : 
                           session?.user?.role === 'BIOANALYST' ? 'Bioanalista' : 'Asistente de Laboratorio'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700">Fecha de Registro</p>
                        <p className="font-medium text-blue-900">
                          {session?.user?.createdAt ? new Date(session.user.createdAt).toLocaleDateString('es-VE') : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setName(session?.user?.name || '')
                        setPhone(session?.user?.phone || '')
                        setTitle(session?.user?.title || '')
                      }}
                      disabled={isUpdatingProfile}
                      className="border-slate-300"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                      disabled={isUpdatingProfile}
                    >
                      {isUpdatingProfile ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar Cambios
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password" className="space-y-6 pt-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lock className="h-5 w-5 text-slate-700" />
                  <span>Cambiar Contraseña</span>
                </CardTitle>
                <CardDescription>Actualice su contraseña de forma segura</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4 bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <div className="font-semibold mb-1">Nota de Seguridad</div>
                    <div className="text-sm">
                      Después de cambiar la contraseña, será desconectado y deberá iniciar sesión nuevamente.
                    </div>
                  </AlertDescription>
                </Alert>

                <form onSubmit={handlePasswordChange}>
                  {passwordError && (
                    <Alert variant="destructive" className="mb-4">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="currentPassword">Contraseña Actual *</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="border-slate-300"
                      />
                    </div>

                    <div>
                      <Label htmlFor="newPassword">Nueva Contraseña *</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Mínimo 8 caracteres"
                        className="border-slate-300"
                      />
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="Ingrese la nueva contraseña nuevamente"
                        className="border-slate-300"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Requisitos de Contraseña:</Label>
                      <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                        <li>Mínimo 8 caracteres</li>
                        <li>Debe contener al menos una letra mayúscula</li>
                        <li>Debe contener al menos un número</li>
                        <li>No debe contener espacios</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Cambiando...
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 mr-2" />
                          Cambiar Contraseña
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6 pt-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5 text-slate-700" />
                  <span>Preferencias</span>
                </CardTitle>
                <CardDescription>Configure sus preferencias del sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-slate-600" />
                        <div>
                          <p className="font-medium text-slate-900">Notificaciones de Email</p>
                          <p className="text-sm text-slate-500">Reciba actualizaciones por correo</p>
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-slate-600" />
                        <div>
                          <p className="font-medium text-slate-900">Notificaciones de Sistema</p>
                          <p className="text-sm text-slate-500">Alertas del sistema</p>
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={notifications}
                      onCheckedChange={setNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-slate-600" />
                        <div>
                          <p className="font-medium text-slate-900">Modo Oscuro</p>
                          <p className="text-sm text-slate-500">Tema de interfaz</p>
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={darkMode}
                      onCheckedChange={setDarkMode}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleUpdatePreferences}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                    disabled={isUpdatingPreferences}
                  >
                    {isUpdatingPreferences ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Preferencias
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Digital Signature Tab */}
          <TabsContent value="signature" className="space-y-6 pt-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Camera className="h-5 w-5 text-slate-700" />
                  <span>Firma Digital</span>
                </CardTitle>
                <CardDescription>Añada su firma digital para validar informes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription>
                      <div className="font-semibold mb-1">Información</div>
                      <div className="text-sm">
                        La firma digital se utilizará para validar los informes de resultados de bacteriología que usted genere.
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div>
                    <Label htmlFor="signature">Firma Digital (Texto)</Label>
                    <p className="text-sm text-slate-500 mb-2">
                      Ingrese su nombre completo como firma digital para validar informes.
                    </p>
                    <Input
                      id="signature"
                      value={signatureData}
                      onChange={(e) => setSignatureData(e.target.value)}
                      placeholder="Ej: Dra. María González"
                      className="border-slate-300"
                    />
                  </div>

                  <div className="p-6 bg-slate-50 rounded-lg border-2 border-slate-200">
                    <p className="text-sm text-slate-600 mb-2">
                      <strong>Previsualización de Firma:</strong>
                    </p>
                    <div className="font-handwriting text-2xl text-slate-900 py-4">
                      {signatureData || (session?.user?.name || 'Sin firma')}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Esta es la firma que aparecerá en los informes PDF.
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      onClick={() => setSignatureData('')}
                      variant="outline"
                      className="border-slate-300"
                      disabled={isSavingSignature}
                    >
                      Limpiar
                    </Button>
                    <Button
                      onClick={handleSaveSignature}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                      disabled={isSavingSignature || !signatureData}
                    >
                      {isSavingSignature ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar Firma
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
