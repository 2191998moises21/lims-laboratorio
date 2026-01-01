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
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle, ArrowLeft, Package, Plus, Minus, Search, Filter, TrendingDown, AlertTriangle, Calendar, FlaskConical, CheckCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface Reagent {
  id: string
  name: string
  code: string
  type: string
  description?: string
  quantity: number
  unit: string
  minStockLevel: number
  maxStockLevel: number
  location: string
  supplier?: string
  batchNumber?: string
  expirationDate?: string
  isActive: boolean
  currentStock: number
  transactionCount: number
  lastTransactionDate?: string
}

export default function ReagentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'low_stock' | 'expiring_soon' | 'expired'>('all')

  // Data
  const [reagents, setReagents] = useState<Reagent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false)
  const [selectedReagent, setSelectedReagent] = useState<Reagent | null>(null)
  const [error, setError] = useState('')

  // Transaction Form
  const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('IN')
  const [transactionQuantity, setTransactionQuantity] = useState('')
  const [transactionNotes, setTransactionNotes] = useState('')
  const [transactionBatch, setTransactionBatch] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchReagents()
    }
  }, [status, router])

  const fetchReagents = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (filterType) params.append('type', filterType)
      if (filterLocation) params.append('location', filterLocation)
      if (filterStatus !== 'all') params.append('status', filterStatus)

      const response = await fetch(`/api/reagents?${params}`)
      if (response.ok) {
        const data = await response.json()
        setReagents(data)
      }
    } catch (err) {
      console.error('Error fetching reagents:', err)
      toast.error('Error al cargar reactivos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    fetchReagents()
  }

  const openTransactionDialog = (reagent: Reagent, type: 'IN' | 'OUT') => {
    setSelectedReagent(reagent)
    setTransactionType(type)
    setIsTransactionDialogOpen(true)
  }

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedReagent) return

    if (!transactionQuantity || parseFloat(transactionQuantity) <= 0) {
      setError('La cantidad debe ser mayor a 0')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/reagents/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reagentId: selectedReagent.id,
          type: transactionType,
          quantity: parseFloat(transactionQuantity),
          batchNumber: transactionBatch,
          notes: transactionNotes
        })
      })

      if (response.ok) {
        toast.success(transactionType === 'IN' ? 'Entrada registrada exitosamente' : 'Salida registrada exitosamente')
        setIsTransactionDialogOpen(false)
        setTransactionQuantity('')
        setTransactionNotes('')
        setTransactionBatch('')
        setSelectedReagent(null)
        fetchReagents()
      } else {
        const error = await response.json()
        setError(error.message || 'Error al registrar transacción')
      }
    } catch (err) {
      setError('Error al registrar transacción')
    } finally {
      setIsLoading(false)
    }
  }

  const getStockStatus = (reagent: Reagent) => {
    const percentage = (reagent.currentStock / reagent.maxStockLevel) * 100
    
    if (reagent.currentStock <= reagent.minStockLevel) {
      return { status: 'critical', color: 'bg-red-100 text-red-700 border-red-200', label: 'Bajo Stock' }
    } else if (percentage < 25) {
      return { status: 'warning', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Bajo' }
    } else if (percentage < 50) {
      return { status: 'medium', color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Normal' }
    } else {
      return { status: 'good', color: 'bg-green-100 text-green-700 border-green-200', label: 'Bueno' }
    }
  }

  const getExpirationStatus = (reagent: Reagent) => {
    if (!reagent.expirationDate) {
      return null
    }

    const today = new Date()
    const expiration = new Date(reagent.expirationDate)
    const daysUntilExpiration = Math.floor((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiration < 0) {
      return { status: 'expired', color: 'bg-red-900 text-white', label: 'Caducado' }
    } else if (daysUntilExpiration <= 7) {
      return { status: 'critical', color: 'bg-red-100 text-red-700 border-red-200', label: 'Próximo a Caducar (7 días)' }
    } else if (daysUntilExpiration <= 30) {
      return { status: 'warning', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: `Caduca en ${daysUntilExpiration} días` }
    } else {
      return null
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
              <Package className="h-6 w-6 text-slate-700" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  Inventario de Reactivos
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
              Gestión de Inventario
            </h2>
            <p className="text-slate-600">
              Control de stock, entradas, salidas y alertas de caducidad
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-slate-700" />
              <span>Búsqueda y Filtros</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="search" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search">Búsqueda</TabsTrigger>
                <TabsTrigger value="filters">Filtros Avanzados</TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-4 pt-4">
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Label htmlFor="search">Buscar</Label>
                    <Input
                      id="search"
                      placeholder="Nombre, código, tipo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border-slate-300"
                    />
                  </div>
                  <Button onClick={handleSearch} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="filters" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <SelectItem value="CULTIVO">Cultivo</SelectItem>
                        <SelectItem value="ANTIBIOTICO">Antibiótico</SelectItem>
                        <SelectItem value="REACTIVO">Reactivo</SelectItem>
                        <SelectItem value="MEDIO">Medio</SelectItem>
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
                      onValueChange={(value: any) => setFilterStatus(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="low_stock">Bajo Stock</SelectItem>
                        <SelectItem value="expiring_soon">Próximo a Caducar</SelectItem>
                        <SelectItem value="expired">Caducados</SelectItem>
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
                      setFilterStatus('all')
                      fetchReagents()
                    }}
                    className="border-slate-300"
                  >
                    Limpiar Filtros
                  </Button>
                  <Button onClick={handleSearch} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                    <Filter className="h-4 w-4 mr-2" />
                    Aplicar Filtros
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Inventory Alerts */}
        {(reagents.some(r => r.currentStock <= r.minStockLevel) || 
          reagents.some(r => r.expirationDate && new Date(r.expirationDate) < new Date())) && (
          <Alert variant="destructive" className="mb-6 bg-orange-50 border-orange-200">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-900">
              <div className="font-semibold mb-1">Alertas de Inventario</div>
              <div className="space-y-1">
                {reagents.some(r => r.currentStock <= r.minStockLevel) && (
                  <div>• Hay reactivos con bajo stock</div>
                )}
                {reagents.some(r => r.expirationDate && new Date(r.expirationDate) < new Date()) && (
                  <div>• Hay reactivos caducados</div>
                )}
                {reagents.some(r => {
                  if (!r.expirationDate) return false
                  const daysUntil = Math.floor((new Date(r.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  return daysUntil > 0 && daysUntil <= 7
                }) && (
                  <div>• Hay reactivos próximos a caducar</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Reagents Table */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Inventario</CardTitle>
            <CardDescription>
              {reagents.length} reactivo(s) encontrado(s)
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
                    <TableHead>Cantidad Actual</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Caducidad</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-600" />
                      </TableCell>
                    </TableRow>
                  ) : reagents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-slate-500 py-8">
                        No hay reactivos que coincidan con los filtros
                      </TableCell>
                    </TableRow>
                  ) : (
                    reagents.map((reagent) => {
                      const stockStatus = getStockStatus(reagent)
                      const expirationStatus = getExpirationStatus(reagent)

                      return (
                        <TableRow 
                          key={reagent.id}
                          className={stockStatus.status === 'critical' ? 'bg-red-50' : ''}
                        >
                          <TableCell className="font-mono font-medium">
                            {reagent.code}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{reagent.name}</p>
                              {reagent.description && (
                                <p className="text-sm text-slate-500">{reagent.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{reagent.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-medium">
                                {reagent.currentStock} {reagent.unit}
                              </span>
                              {stockStatus.status === 'critical' && (
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={stockStatus.color}>
                              {stockStatus.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {expirationStatus ? (
                              <Badge className={expirationStatus.color}>
                                {expirationStatus.label}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {expirationStatus && expirationStatus.status === 'expired' && (
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-red-600" />
                                <span className="text-red-600">
                                  {new Date(reagent.expirationDate).toLocaleDateString('es-VE')}
                                </span>
                              </div>
                            )}
                            {reagent.location}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openTransactionDialog(reagent, 'IN')}
                                title="Registrar entrada"
                              disabled={isLoading}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openTransactionDialog(reagent, 'OUT')}
                                title="Registrar salida"
                                disabled={isLoading}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Dialog */}
        <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {transactionType === 'IN' ? 'Registrar Entrada' : 'Registrar Salida'}
              </DialogTitle>
              <DialogDescription>
                {selectedReagent?.name} ({selectedReagent?.code})
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleTransaction}>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Cantidad Actual</p>
                      <p className="font-mono text-lg">
                        {selectedReagent?.currentStock} {selectedReagent?.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Stock Min</p>
                      <p className="font-mono text-lg">
                        {selectedReagent?.minStockLevel} {selectedReagent?.unit}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cantidad {transactionType === 'IN' ? 'a agregar' : 'a retirar'} *</Label>
                  <Input
                    type="number"
                    step="any"
                    value={transactionQuantity}
                    onChange={(e) => setTransactionQuantity(e.target.value)}
                    placeholder={`Cantidad en ${selectedReagent?.unit}`}
                    className="border-slate-300"
                  />
                  {transactionType === 'IN' && selectedReagent && (
                    <p className="text-sm text-slate-500">
                      Nueva cantidad: {(selectedReagent.currentStock + parseFloat(transactionQuantity || 0)).toFixed(2)} {selectedReagent.unit}
                    </p>
                  )}
                  {transactionType === 'OUT' && selectedReagent && (
                    <p className="text-sm text-slate-500">
                      Nueva cantidad: {(selectedReagent.currentStock - parseFloat(transactionQuantity || 0)).toFixed(2)} {selectedReagent.unit}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Número de Lote</Label>
                  <Input
                    value={transactionBatch}
                    onChange={(e) => setTransactionBatch(e.target.value)}
                    placeholder="Opcional"
                    className="border-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={transactionNotes}
                    onChange={(e) => setTransactionNotes(e.target.value)}
                    placeholder="Observaciones sobre la transacción..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTransactionDialogOpen(false)}
                  disabled={isLoading}
                  className="border-slate-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className={`${
                    transactionType === 'IN' 
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' 
                      : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                  }`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      {transactionType === 'IN' ? (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Registrar Entrada
                        </>
                      ) : (
                        <>
                          <Minus className="h-4 w-4 mr-2" />
                          Registrar Salida
                        </>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
