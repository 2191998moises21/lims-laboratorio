'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, AlertCircle, ArrowLeft, Cog, Plus, Search, Filter, AlertTriangle, Calendar, Wrench, CheckCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface Equipment {
  id: string
  name: string
  code: string
  type: string
  category: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  location: string
  status: 'ACTIVE' | 'IN_MAINTENANCE' | 'OUT_OF_SERVICE' | 'CALIBRATING'
  installationDate?: string
  lastMaintenanceDate?: string
  lastCalibrationDate?: string
  nextMaintenanceDate?: string
  nextCalibrationDate?: string
  calibrationInterval?: number
  maintenanceInterval?: number
  isActive: boolean
  calibrationCount: number
  maintenanceCount: number
}

interface Calibration {
  id: string
  equipmentId: string
  calibrationDate: string
  performedBy?: string
  results?: string
  nextCalibrationDate: string
  notes?: string
  status: 'PENDING' | 'COMPLETED'
}

interface Maintenance {
  id: string
  equipmentId: string
  maintenanceDate: string
  maintenanceType: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY'
  description: string
  performedBy?: string
  cost?: number
  nextMaintenanceDate?: string
  notes?: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
}

export default function EquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Data
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Dialogs
  const [isEquipmentDialogOpen, setIsEquipmentDialogOpen] = useState(false)
  const [isCalibrationDialogOpen, setIsCalibrationDialogOpen] = useState(false)
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'equipment' | 'calibrations' | 'maintenance'>('equipment')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchEquipment()
    }
  }, [status, router])

  const fetchEquipment = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (filterType) params.append('type', filterType)
      if (filterCategory) params.append('category', filterCategory)
      if (filterLocation) params.append('location', filterLocation)
      if (filterStatus) params.append('status', filterStatus)

      const response = await fetch(`/api/equipment?${params}`)
      if (response.ok) {
        const data = await response.json()
        setEquipment(data)
      }
    } catch (err) {
      console.error('Error fetching equipment:', err)
      toast.error('Error al cargar equipos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    fetchEquipment()
  }

  const getEquipmentType = (type: string) => {
    switch (type) {
      case 'INCUBATOR':
        return 'Incubadora'
      case 'MICROSCOPE':
        return 'Microscopio'
      case 'CENTRIFUGE':
        return 'Centrífuga'
      case 'AUTOCLAVE':
        return 'Autoclave'
      case 'BALANCE':
        return 'Balanza'
      case 'PH_METER':
        return 'pH-metro'
      case 'STOVE':
        return 'Estufa'
      default:
        return type
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Activo</Badge>
      case 'IN_MAINTENANCE':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">En Mantenimiento</Badge>
      case 'OUT_OF_SERVICE':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Fuera de Servicio</Badge>
      case 'CALIBRATING':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Calibrando</Badge>
      default:
        return <Badge>{status}</Badge>
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
              <Cog className="h-6 w-6 text-slate-700" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  Gestión de Equipos e Instrumentos
                </h1>
                <p className="text-xs text-slate-500">Bacteriología</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              Gestión de Equipos
            </h2>
            <p className="text-slate-600">
              Registro, calibraciones y mantenimiento de equipos e instrumentos
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="equipment">Equipos</TabsTrigger>
            <TabsTrigger value="calibrations">Calibraciones</TabsTrigger>
            <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
          </TabsList>

          <TabsContent value="equipment">
            {/* Search & Filters */}
            <Card className="mb-6 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-5 w-5 text-slate-700" />
                  <span>Búsqueda y Filtros</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Buscar</Label>
                    <Input
                      id="search"
                      placeholder="Nombre, código, fabricante..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={filterType}
                      onValueChange={setFilterType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos</SelectItem>
                        <SelectItem value="INCUBATOR">Incubadora</SelectItem>
                        <SelectItem value="MICROSCOPE">Microscopio</SelectItem>
                        <SelectItem value="CENTRIFUGE">Centrífuga</SelectItem>
                        <SelectItem value="AUTOCLAVE">Autoclave</SelectItem>
                        <SelectItem value="BALANCE">Balanza</SelectItem>
                        <SelectItem value="PH_METER">pH-metro</SelectItem>
                        <SelectItem value="STOVE">Estufa</SelectItem>
                        <SelectItem value="OTHER">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Ubicación</Label>
                    <Input
                      placeholder="Filtrar por ubicación"
                      value={filterLocation}
                      onChange={(e) => setFilterLocation(e.target.value)}
                      className="border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select
                      value={filterStatus}
                      onValueChange={setFilterStatus}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos</SelectItem>
                        <SelectItem value="ACTIVE">Activo</SelectItem>
                        <SelectItem value="IN_MAINTENANCE">En Mantenimiento</SelectItem>
                        <SelectItem value="OUT_OF_SERVICE">Fuera de Servicio</SelectItem>
                        <SelectItem value="CALIBRATING">Calibrando</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('')
                      setFilterType('')
                      setFilterLocation('')
                      setFilterStatus('')
                      fetchEquipment()
                    }}
                    className="border-slate-300"
                  >
                    Limpiar Filtros
                  </Button>
                  <Button onClick={handleSearch} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                    <Search className="h-4 w-4 mr-2" />
                    Aplicar Filtros
                  </Button>
                </div>
              </CardContent>
            </Card>

            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Equipment Table */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Inventario de Equipos</CardTitle>
                <CardDescription>
                  {equipment.length} equipo(s) encontrado(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Fabricante</TableHead>
                        <TableHead>Ubicación</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Última Calibración</TableHead>
                        <TableHead>Último Mantenimiento</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-600" />
                          </TableCell>
                        </TableRow>
                      ) : equipment.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-slate-500 py-8">
                            No hay equipos que coincidan con los filtros
                          </TableCell>
                        </TableRow>
                      ) : (
                        equipment.map((equip) => (
                          <TableRow key={equip.id}>
                            <TableCell className="font-mono font-medium">
                              {equip.code}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{equip.name}</p>
                                {equip.model && (
                                  <p className="text-sm text-slate-500">{equip.model}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getEquipmentType(equip.type)}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{equip.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-slate-600">{equip.manufacturer || '-'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-slate-600">{equip.location}</span>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(equip.status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2 text-sm">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600">
                                  {equip.lastCalibrationDate 
                                    ? new Date(equip.lastCalibrationDate).toLocaleDateString('es-VE')
                                    : '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2 text-sm">
                                <Wrench className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600">
                                  {equip.lastMaintenanceDate
                                    ? new Date(equip.lastMaintenanceDate).toLocaleDateString('es-VE')
                                    : '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedEquipment(equip)}
                                title="Ver detalles"
                              >
                                <CheckCircle className="h-4 w-4 text-slate-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calibrations">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Calibraciones</CardTitle>
                <CardDescription>Histórico de calibraciones de equipos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-slate-500 py-8">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p>Módulo de calibraciones en desarrollo</p>
                  <p className="text-sm mt-2">Podrá ver y registrar calibraciones aquí</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Mantenimiento</CardTitle>
                <CardDescription>Histórico de mantenimientos de equipos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-slate-500 py-8">
                  <Wrench className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p>Módulo de mantenimiento en desarrollo</p>
                  <p className="text-sm mt-2">Podrá ver y registrar mantenimientos aquí</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Equipment Details Dialog */}
        <Dialog open={isEquipmentDialogOpen && selectedEquipment} onOpenChange={setIsEquipmentDialogOpen}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Detalles del Equipo</DialogTitle>
              <DialogDescription>
                {selectedEquipment?.name} ({selectedEquipment?.code})
              </DialogDescription>
            </DialogHeader>

            {selectedEquipment && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 mb-1">Código</Label>
                    <p className="font-mono font-medium">{selectedEquipment.code}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 mb-1">Tipo</Label>
                    <p className="font-medium">{getEquipmentType(selectedEquipment.type)}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-500 mb-1">Nombre</Label>
                  <p className="font-medium text-lg">{selectedEquipment.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 mb-1">Fabricante</Label>
                    <p className="font-medium">{selectedEquipment.manufacturer || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 mb-1">Modelo</Label>
                    <p className="font-medium">{selectedEquipment.model || '-'}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-500 mb-1">Número de Serie</Label>
                  <p className="font-mono font-medium">{selectedEquipment.serialNumber || '-'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 mb-1">Ubicación</Label>
                    <p className="font-medium">{selectedEquipment.location}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 mb-1">Estado</Label>
                    <div>
                      {getStatusBadge(selectedEquipment.status)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 mb-1">Última Calibración</Label>
                    <p className="text-sm text-slate-600">
                      {selectedEquipment.lastCalibrationDate
                        ? new Date(selectedEquipment.lastCalibrationDate).toLocaleDateString('es-VE')
                        : 'No registrada'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 mb-1">Próxima Calibración</Label>
                    <p className="text-sm text-slate-600">
                      {selectedEquipment.nextCalibrationDate
                        ? new Date(selectedEquipment.nextCalibrationDate).toLocaleDateString('es-VE')
                        : 'No programada'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 mb-1">Último Mantenimiento</Label>
                    <p className="text-sm text-slate-600">
                      {selectedEquipment.lastMaintenanceDate
                        ? new Date(selectedEquipment.lastMaintenanceDate).toLocaleDateString('es-VE')
                        : 'No registrado'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 mb-1">Próximo Mantenimiento</Label>
                    <p className="text-sm text-slate-600">
                      {selectedEquipment.nextMaintenanceDate
                        ? new Date(selectedEquipment.nextMaintenanceDate).toLocaleDateString('es-VE')
                        : 'No programado'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedEquipment.calibrationCount}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">Calibraciones</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedEquipment.maintenanceCount}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">Mantenimientos</p>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsEquipmentDialogOpen(false)}
                    className="border-slate-300"
                  >
                    Cerrar
                  </Button>
                  <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                    <Wrench className="h-4 w-4 mr-2" />
                    Programar Mantenimiento
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
