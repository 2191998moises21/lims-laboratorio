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
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, AlertCircle, ArrowLeft, FlaskConical, Plus, Edit2, Trash2, Settings, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface TestParameter {
  name: string
  code: string
  resultType: 'QUANTITATIVE' | 'QUALITATIVE' | 'TEXT'
  unit?: string
  minValue?: number
  maxValue?: number
  normalMin?: number
  normalMax?: number
  criticalMin?: number
  criticalMax?: number
  allowedValues?: string
  displayOrder: number
  isRequired: boolean
}

interface Test {
  id: string
  code: string
  name: string
  description?: string
  category?: string
  sampleType: string
  method?: string
  unit?: string
  referenceRangeInfo?: string
  interpretationCriteria?: string
  isActive: boolean
  estimatedDuration?: number
  parameters: TestParameter[]
}

export default function TestsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isParametersDialogOpen, setIsParametersDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [selectedTest, setSelectedTest] = useState<Test | null>(null)

  // Form state para pruebas
  const [testFormData, setTestFormData] = useState({
    name: '',
    code: '',
    description: '',
    category: '',
    sampleType: '',
    method: '',
    unit: '',
    referenceRangeInfo: '',
    interpretationCriteria: '',
    estimatedDuration: ''
  })

  // Form state para parámetros
  const [parameters, setParameters] = useState<TestParameter[]>([
    {
      name: '',
      code: '',
      resultType: 'QUANTITATIVE',
      unit: '',
      minValue: undefined,
      maxValue: undefined,
      normalMin: undefined,
      normalMax: undefined,
      criticalMin: undefined,
      criticalMax: undefined,
      allowedValues: '',
      displayOrder: 0,
      isRequired: true
    }
  ])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchTests()
    }
  }, [status, router])

  const fetchTests = async () => {
    try {
      const response = await fetch('/api/tests')
      if (response.ok) {
        const data = await response.json()
        setTests(data)
      }
    } catch (err) {
      console.error('Error fetching tests:', err)
    }
  }

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!testFormData.name || !testFormData.code || !testFormData.sampleType) {
      setError('Nombre, código y tipo de muestra son obligatorios')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testFormData)
      })

      if (response.ok) {
        toast.success('Prueba creada exitosamente')
        setIsDialogOpen(false)
        setTestFormData({
          name: '',
          code: '',
          description: '',
          category: '',
          sampleType: '',
          method: '',
          unit: '',
          referenceRangeInfo: '',
          interpretationCriteria: '',
          estimatedDuration: ''
        })
        fetchTests()
      } else {
        const error = await response.json()
        setError(error.message || 'Error al crear prueba')
      }
    } catch (err) {
      setError('Error al crear prueba')
    } finally {
      setIsLoading(false)
    }
  }

  const openParametersDialog = (test: Test) => {
    setSelectedTest(test)
    if (test.parameters && test.parameters.length > 0) {
      setParameters(test.parameters)
    } else {
      setParameters([{
        name: '',
        code: '',
        resultType: 'QUANTITATIVE',
        unit: '',
        minValue: undefined,
        maxValue: undefined,
        normalMin: undefined,
        normalMax: undefined,
        criticalMin: undefined,
        criticalMax: undefined,
        allowedValues: '',
        displayOrder: 0,
        isRequired: true
      }])
    }
    setIsParametersDialogOpen(true)
  }

  const addParameter = () => {
    setParameters([
      ...parameters,
      {
        name: '',
        code: '',
        resultType: 'QUANTITATIVE',
        unit: '',
        minValue: undefined,
        maxValue: undefined,
        normalMin: undefined,
        normalMax: undefined,
        criticalMin: undefined,
        criticalMax: undefined,
        allowedValues: '',
        displayOrder: parameters.length,
        isRequired: true
      }
    ])
  }

  const removeParameter = (index: number) => {
    if (parameters.length > 1) {
      const newParams = [...parameters]
      newParams.splice(index, 1)
      setParameters(newParams)
    }
  }

  const updateParameter = (index: number, field: string, value: any) => {
    const newParams = [...parameters]
    newParams[index] = { ...newParams[index], [field]: value }
    setParameters(newParams)
  }

  const handleParametersSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTest) return

    setIsLoading(true)

    try {
      const response = await fetch(`/api/tests/${selectedTest.id}/parameters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters })
      })

      if (response.ok) {
        toast.success('Parámetros actualizados exitosamente')
        setIsParametersDialogOpen(false)
        fetchTests()
      } else {
        const error = await response.json()
        setError(error.message || 'Error al actualizar parámetros')
      }
    } catch (err) {
      setError('Error al actualizar parámetros')
    } finally {
      setIsLoading(false)
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
              <FlaskConical className="h-6 w-6 text-slate-700" />
              <h1 className="text-xl font-bold text-slate-900">
                Configuración de Pruebas
              </h1>
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
              Gestión de Pruebas Bacteriológicas
            </h2>
            <p className="text-slate-600">
              Defina y configure las pruebas del laboratorio con sus parámetros y rangos de referencia
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Prueba
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nueva Prueba</DialogTitle>
                <DialogDescription>
                  Defina los datos generales de la prueba bacteriológica
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleTestSubmit}>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre de la Prueba *</Label>
                      <Input
                        id="name"
                        value={testFormData.name}
                        onChange={(e) => setTestFormData({ ...testFormData, name: e.target.value })}
                        placeholder="Cultivo de Orina"
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="code">Código *</Label>
                      <Input
                        id="code"
                        value={testFormData.code}
                        onChange={(e) => setTestFormData({ ...testFormData, code: e.target.value.toUpperCase() })}
                        placeholder="CULT_ORI"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={testFormData.description}
                      onChange={(e) => setTestFormData({ ...testFormData, description: e.target.value })}
                      placeholder="Descripción detallada de la prueba..."
                      rows={2}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Categoría</Label>
                      <Input
                        id="category"
                        value={testFormData.category}
                        onChange={(e) => setTestFormData({ ...testFormData, category: e.target.value })}
                        placeholder="Bacteriología"
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sampleType">Tipo de Muestra *</Label>
                      <Select
                        value={testFormData.sampleType}
                        onValueChange={(value) => setTestFormData({ ...testFormData, sampleType: value })}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sangre">Sangre</SelectItem>
                          <SelectItem value="Orina">Orina</SelectItem>
                          <SelectItem value="Exudado">Exudado</SelectItem>
                          <SelectItem value="Heces">Heces</SelectItem>
                          <SelectItem value="LCR">LCR</SelectItem>
                          <SelectItem value="Esputo">Esputo</SelectItem>
                          <SelectItem value="Secrecion">Secreción</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="method">Método de Análisis</Label>
                      <Input
                        id="method"
                        value={testFormData.method}
                        onChange={(e) => setTestFormData({ ...testFormData, method: e.target.value })}
                        placeholder="Cultivo en agar..."
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="estimatedDuration">Duración Estimada (horas)</Label>
                      <Input
                        id="estimatedDuration"
                        type="number"
                        value={testFormData.estimatedDuration}
                        onChange={(e) => setTestFormData({ ...testFormData, estimatedDuration: e.target.value })}
                        placeholder="24"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referenceRangeInfo">Información de Rango de Referencia</Label>
                    <Textarea
                      id="referenceRangeInfo"
                      value={testFormData.referenceRangeInfo}
                      onChange={(e) => setTestFormData({ ...testFormData, referenceRangeInfo: e.target.value })}
                      placeholder="Rangos normales esperados..."
                      rows={2}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interpretationCriteria">Criterios de Interpretación</Label>
                    <Textarea
                      id="interpretationCriteria"
                      value={testFormData.interpretationCriteria}
                      onChange={(e) => setTestFormData({ ...testFormData, interpretationCriteria: e.target.value })}
                      placeholder="Criterios para interpretar resultados positivos/negativos..."
                      rows={3}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      'Crear Prueba'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tests List */}
        <Card>
          <CardHeader>
            <CardTitle>Pruebas Configuradas</CardTitle>
            <CardDescription>
              Listado de pruebas bacteriológicas disponibles en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Tipo de Muestra</TableHead>
                  <TableHead>Parámetros</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                      No hay pruebas configuradas
                    </TableCell>
                  </TableRow>
                ) : (
                  tests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell className="font-mono font-medium">{test.code}</TableCell>
                      <TableCell>{test.name}</TableCell>
                      <TableCell>
                        {test.category && <Badge variant="outline">{test.category}</Badge>}
                      </TableCell>
                      <TableCell>{test.sampleType}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {test.parameters?.length || 0} parámetros
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {test.isActive ? (
                          <div className="flex items-center text-green-600">
                            <div className="h-2 w-2 rounded-full bg-green-600 mr-2"></div>
                            Activo
                          </div>
                        ) : (
                          <div className="flex items-center text-red-600">
                            <div className="h-2 w-2 rounded-full bg-red-600 mr-2"></div>
                            Inactivo
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openParametersDialog(test)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Dialog de Parámetros */}
      <Dialog open={isParametersDialogOpen} onOpenChange={setIsParametersDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parámetros de Prueba</DialogTitle>
            <DialogDescription>
              {selectedTest?.name} ({selectedTest?.code})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleParametersSubmit}>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {parameters.map((param, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Parámetro {index + 1}</h4>
                    {parameters.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeParameter(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Nombre del Parámetro</Label>
                      <Input
                        value={param.name}
                        onChange={(e) => updateParameter(index, 'name', e.target.value)}
                        placeholder="Recuento de colonias"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Código</Label>
                      <Input
                        value={param.code}
                        onChange={(e) => updateParameter(index, 'code', e.target.value.toUpperCase())}
                        placeholder="COL_COUNT"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Tipo de Resultado</Label>
                      <Select
                        value={param.resultType}
                        onValueChange={(value: any) => updateParameter(index, 'resultType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="QUANTITATIVE">Cuantitativo</SelectItem>
                          <SelectItem value="QUALITATIVE">Cualitativo</SelectItem>
                          <SelectItem value="TEXT">Texto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Unidad</Label>
                      <Input
                        value={param.unit || ''}
                        onChange={(e) => updateParameter(index, 'unit', e.target.value)}
                        placeholder="UFC/mL"
                      />
                    </div>
                  </div>

                  {param.resultType === 'QUANTITATIVE' && (
                    <>
                      <Separator className="my-4" />
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="space-y-2">
                          <Label>Mínimo</Label>
                          <Input
                            type="number"
                            value={param.minValue || ''}
                            onChange={(e) => updateParameter(index, 'minValue', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="0"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Máximo</Label>
                          <Input
                            type="number"
                            value={param.maxValue || ''}
                            onChange={(e) => updateParameter(index, 'maxValue', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="1000000"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Normal Mín</Label>
                          <Input
                            type="number"
                            value={param.normalMin || ''}
                            onChange={(e) => updateParameter(index, 'normalMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="0"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Normal Máx</Label>
                          <Input
                            type="number"
                            value={param.normalMax || ''}
                            onChange={(e) => updateParameter(index, 'normalMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="100000"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Crítico Mín</Label>
                          <Input
                            type="number"
                            value={param.criticalMin || ''}
                            onChange={(e) => updateParameter(index, 'criticalMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="1000000"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Crítico Máx</Label>
                          <Input
                            type="number"
                            value={param.criticalMax || ''}
                            onChange={(e) => updateParameter(index, 'criticalMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="5000000"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {param.resultType === 'QUALITATIVE' && (
                    <div className="space-y-2 mt-4">
                      <Label>Valores Permitidos (separados por coma)</Label>
                      <Textarea
                        value={param.allowedValues || ''}
                        onChange={(e) => updateParameter(index, 'allowedValues', e.target.value)}
                        placeholder="POSITIVO,NEGATIVO,INDETERMINADO"
                        rows={2}
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2 mt-4">
                    <input
                      type="checkbox"
                      id={`required-${index}`}
                      checked={param.isRequired}
                      onChange={(e) => updateParameter(index, 'isRequired', e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`required-${index}`} className="mb-0">
                      Parámetro obligatorio
                    </Label>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addParameter}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Parámetro
              </Button>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsParametersDialogOpen(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Guardar Parámetros
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
