'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Settings, Save, Globe, FlaskConical, FileText, Bell, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

interface SystemConfig {
  id: string
  key: string
  value: string
  category: string
  description?: string
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [configs, setConfigs] = useState<Record<string, string>>({})

  // Estado para cada categoría
  const [generalSettings, setGeneralSettings] = useState({
    language: 'es',
    dateFormat: 'DD/MM/YYYY',
    timezone: 'America/Caracas'
  })

  const [labSettings, setLabSettings] = useState({
    defaultUnit: 'mg/dL',
    referenceRangeDefault: 'Normal'
  })

  const [reportSettings, setReportSettings] = useState({
    reportLogo: '',
    reportHeader: '',
    reportFooter: ''
  })

  const [notificationSettings, setNotificationSettings] = useState({
    lowStockAlerts: true,
    expiryAlerts: true,
    lowStockThreshold: 20,
    expiryAlertDays: 30,
    emailNotifications: false
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      toast.error('Acceso denegado', {
        description: 'Esta página es exclusiva para administradores'
      })
      router.push('/')
    } else if (status === 'authenticated') {
      fetchConfigs()
    }
  }, [status, session, router])

  const fetchConfigs = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data: SystemConfig[] = await response.json()
        const configMap: Record<string, string> = {}
        data.forEach(config => {
          configMap[config.key] = config.value
        })
        setConfigs(configMap)

        // Cargar configuraciones en el estado
        setGeneralSettings({
          language: configMap['language'] || 'es',
          dateFormat: configMap['dateFormat'] || 'DD/MM/YYYY',
          timezone: configMap['timezone'] || 'America/Caracas'
        })

        setLabSettings({
          defaultUnit: configMap['defaultUnit'] || 'mg/dL',
          referenceRangeDefault: configMap['referenceRangeDefault'] || 'Normal'
        })

        setReportSettings({
          reportLogo: configMap['reportLogo'] || '',
          reportHeader: configMap['reportHeader'] || '',
          reportFooter: configMap['reportFooter'] || ''
        })

        setNotificationSettings({
          lowStockAlerts: configMap['lowStockAlerts'] === 'true',
          expiryAlerts: configMap['expiryAlerts'] === 'true',
          lowStockThreshold: parseInt(configMap['lowStockThreshold'] || '20'),
          expiryAlertDays: parseInt(configMap['expiryAlertDays'] || '30'),
          emailNotifications: configMap['emailNotifications'] === 'true'
        })
      }
    } catch (error) {
      console.error('Error fetching configs:', error)
      toast.error('Error al cargar configuraciones')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveGeneral = async () => {
    await saveConfigs({
      language: generalSettings.language,
      dateFormat: generalSettings.dateFormat,
      timezone: generalSettings.timezone
    })
  }

  const handleSaveLab = async () => {
    await saveConfigs({
      defaultUnit: labSettings.defaultUnit,
      referenceRangeDefault: labSettings.referenceRangeDefault
    })
  }

  const handleSaveReport = async () => {
    await saveConfigs({
      reportLogo: reportSettings.reportLogo,
      reportHeader: reportSettings.reportHeader,
      reportFooter: reportSettings.reportFooter
    })
  }

  const handleSaveNotifications = async () => {
    await saveConfigs({
      lowStockAlerts: notificationSettings.lowStockAlerts.toString(),
      expiryAlerts: notificationSettings.expiryAlerts.toString(),
      lowStockThreshold: notificationSettings.lowStockThreshold.toString(),
      expiryAlertDays: notificationSettings.expiryAlertDays.toString(),
      emailNotifications: notificationSettings.emailNotifications.toString()
    })
  }

  const saveConfigs = async (configData: Record<string, string>) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      })

      if (response.ok) {
        toast.success('Configuración guardada exitosamente')
        await fetchConfigs()
      } else {
        const error = await response.json()
        toast.error('Error al guardar configuración', {
          description: error.message
        })
      }
    } catch (error) {
      toast.error('Error al guardar configuración')
    } finally {
      setIsSaving(false)
    }
  }

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'ADMIN')) {
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
              <Settings className="h-6 w-6 text-slate-700" />
              <h1 className="text-xl font-bold text-slate-900">
                Configuración del Sistema
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div>
        ) : (
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
              <TabsTrigger value="general" className="flex items-center space-x-2">
                <Globe className="h-4 w-4" />
                <span>General</span>
              </TabsTrigger>
              <TabsTrigger value="laboratory" className="flex items-center space-x-2">
                <FlaskConical className="h-4 w-4" />
                <span>Laboratorio</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Informes</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center space-x-2">
                <Bell className="h-4 w-4" />
                <span>Notificaciones</span>
              </TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Configuración General</CardTitle>
                  <CardDescription>
                    Configure las preferencias generales del sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="language">Idioma</Label>
                    <Select
                      value={generalSettings.language}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Formato de Fecha</Label>
                    <Select
                      value={generalSettings.dateFormat}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, dateFormat: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Zona Horaria</Label>
                    <Select
                      value={generalSettings.timezone}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, timezone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Caracas">Caracas (VET)</SelectItem>
                        <SelectItem value="America/Maracaibo">Maracaibo (VET)</SelectItem>
                        <SelectItem value="America/Margarita">La Margarita (VET)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleSaveGeneral}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Configuración
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Laboratory Settings */}
            <TabsContent value="laboratory">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Configuración de Laboratorio</CardTitle>
                  <CardDescription>
                    Configure los parámetros predeterminados de análisis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="defaultUnit">Unidad de Medida Predeterminada</Label>
                    <Select
                      value={labSettings.defaultUnit}
                      onValueChange={(value) => setLabSettings({ ...labSettings, defaultUnit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mg/dL">mg/dL (Miligramos por decilitro)</SelectItem>
                        <SelectItem value="g/L">g/L (Gramos por litro)</SelectItem>
                        <SelectItem value="U/L">U/L (Unidades por litro)</SelectItem>
                        <SelectItem value="mL">mL (Mililitros)</SelectItem>
                        <SelectItem value="µL">µL (Microlitros)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referenceRangeDefault">Rango de Referencia por Defecto</Label>
                    <Input
                      id="referenceRangeDefault"
                      value={labSettings.referenceRangeDefault}
                      onChange={(e) => setLabSettings({ ...labSettings, referenceRangeDefault: e.target.value })}
                      placeholder="Normal"
                    />
                  </div>

                  <Alert>
                    <Bell className="h-4 w-4" />
                    <AlertDescription>
                      Estas configuraciones se aplicarán como valores predeterminados al crear nuevas pruebas y parámetros.
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={handleSaveLab}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Configuración
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reports Settings */}
            <TabsContent value="reports">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Configuración de Informes</CardTitle>
                  <CardDescription>
                    Personalice el aspecto de los informes generados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="reportLogo">URL del Logo</Label>
                    <Input
                      id="reportLogo"
                      value={reportSettings.reportLogo}
                      onChange={(e) => setReportSettings({ ...reportSettings, reportLogo: e.target.value })}
                      placeholder="https://ejemplo.com/logo.png"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reportHeader">Encabezado del Informe</Label>
                    <Textarea
                      id="reportHeader"
                      value={reportSettings.reportHeader}
                      onChange={(e) => setReportSettings({ ...reportSettings, reportHeader: e.target.value })}
                      placeholder="Información del encabezado del informe"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reportFooter">Pie de Página del Informe</Label>
                    <Textarea
                      id="reportFooter"
                      value={reportSettings.reportFooter}
                      onChange={(e) => setReportSettings({ ...reportSettings, reportFooter: e.target.value })}
                      placeholder="Información del pie de página del informe"
                      rows={3}
                    />
                  </div>

                  <Button
                    onClick={handleSaveReport}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Configuración
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Settings */}
            <TabsContent value="notifications">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Configuración de Notificaciones</CardTitle>
                  <CardDescription>
                    Configure las alertas y notificaciones del sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Alertas de Bajo Stock</Label>
                      <p className="text-sm text-slate-500">
                        Recibir alertas cuando los reactivos estén por debajo del nivel mínimo
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.lowStockAlerts}
                      onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, lowStockAlerts: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Alertas de Caducidad</Label>
                      <p className="text-sm text-slate-500">
                        Recibir alertas cuando los reactivos estén próximos a caducar
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.expiryAlerts}
                      onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, expiryAlerts: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificaciones por Email</Label>
                      <p className="text-sm text-slate-500">
                        Enviar notificaciones importantes por correo electrónico
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailNotifications: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lowStockThreshold">
                      Porcentaje Mínimo de Stock para Alerta
                    </Label>
                    <Input
                      id="lowStockThreshold"
                      type="number"
                      value={notificationSettings.lowStockThreshold}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, lowStockThreshold: parseInt(e.target.value) || 0 })}
                      min="1"
                      max="100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiryAlertDays">
                      Días Antes de Caducidad para Alerta
                    </Label>
                    <Input
                      id="expiryAlertDays"
                      type="number"
                      value={notificationSettings.expiryAlertDays}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, expiryAlertDays: parseInt(e.target.value) || 0 })}
                      min="1"
                      max="365"
                    />
                  </div>

                  <Button
                    onClick={handleSaveNotifications}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Configuración
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}
