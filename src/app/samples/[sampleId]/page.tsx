'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
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
import { Loader2, AlertCircle, ArrowLeft, FlaskConical, Plus, Play, CheckCircle, Clock, Edit2, FileText, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  name: string
}

interface Test {
  id: string
  name: string
  code: string
  category?: string
}

interface SampleTest {
  id: string
  sampleId: string
  testId: string
  status: 'PENDING' | 'IN_PROGRESS' | 'AWAITING_VALIDATION' | 'COMPLETED' | 'CANCELLED'
  assignedToId?: string
  assignedTo?: User
  startedAt?: string
  completedAt?: string
  test: Test
  results?: TestResult[]
  resultsText?: string
  technique?: string
  resultInterpretation?: string
}

interface TestResult {
  id: string
  parameterId: string
  parameter: {
    id: string
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
  }
  quantitativeValue?: number
  qualitativeValue?: 'POSITIVE' | 'NEGATIVE' | 'INDETERMINATE'
  textValue?: string
  unit?: string
  isAbnormal: boolean
  isCritical: boolean
  notes?: string
}

interface Sample {
  id: string
  sampleCode: string
  patient: {
    fullName: string
    cedula: string
  }
  doctor: {
    fullName: string
  }
  collectionDate: string
  sampleType: string
  collectionMethod: string
  status: 'RECEIVED' | 'IN_PROGRESS' | 'ANALYZED' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  clinicalNotes?: string
  sampleTests: SampleTest[]
  documents: Array<{
    fileName: string
    fileUrl: string
  }>
}

export default function SampleDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const sampleId = params.sampleId as string
  
  const [sample, setSample] = useState<Sample | null>(null)
  const [availableTests, setAvailableTests] = useState<Test[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false)
  const [selectedTestId, setSelectedTestId] = useState('')
  const [selectedSampleTest, setSelectedSampleTest] = useState<SampleTest | null>(null)
  const [error, setError] = useState('')

  // Form state para asignar pruebas
  const [assignFormData, setAssignFormData] = useState({
    testId: '',
    assignedToId: session?.user?.id || ''
  })

  // Form state para resultados
  const [resultsFormData, setResultsFormData] = useState<{
    [key: string]: {
      quantitativeValue?: number
      qualitativeValue?: string
      textValue?: string
      notes?: string
    }
  }>({})

  // Adjuntos de resultados
  const [resultAttachments, setResultAttachments] = useState<File[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && sampleId) {
      fetchSample()
      fetchAvailableTests()
    }
  }, [status, sampleId, router])

  const fetchSample = async () => {
    try {
      const response = await fetch(`/api/samples/${sampleId}`)
      if (response.ok) {
        const data = await response.json()
        setSample(data)
      } else {
        toast.error('Error al cargar muestra')
      }
    } catch (err) {
      console.error('Error fetching sample:', err)
      toast.error('Error al cargar muestra')
    }
  }

  const fetchAvailableTests = async () => {
    try {
      const response = await fetch('/api/tests')
      if (response.ok) {
        const data = await response.json()
        setAvailableTests(data.filter((t: Test) => t.isActive))
      }
    } catch (err) {
      console.error('Error fetching tests:', err)
    }
  }

  const handleAssignTest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!assignFormData.testId) {
      setError('Seleccione una prueba')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/samples/${sampleId}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignFormData)
      })

      if (response.ok) {
        toast.success('Prueba asignada exitosamente')
        setIsAssignDialogOpen(false)
        setAssignFormData({ testId: '', assignedToId: session?.user?.id || '' })
        fetchSample()
      } else {
        const error = await response.json()
        setError(error.message || 'Error al asignar prueba')
      }
    } catch (err) {
      setError('Error al asignar prueba')
    } finally {
      setIsLoading(false)
    }
  }

  const startTest = async (sampleTestId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/samples/${sampleId}/tests/${sampleTestId}/start`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Prueba iniciada')
        fetchSample()
      } else {
        toast.error('Error al iniciar prueba')
      }
    } catch (err) {
      toast.error('Error al iniciar prueba')
    } finally {
      setIsLoading(false)
    }
  }

  const openResultsDialog = (sampleTest: SampleTest) => {
    setSelectedSampleTest(sampleTest)
    
    // Inicializar formulario de resultados
    const initialResults: any = {}
    if (sampleTest.results) {
      sampleTest.results.forEach((result: TestResult) => {
        initialResults[result.parameterId] = {
          quantitativeValue: result.quantitativeValue,
          qualitativeValue: result.qualitativeValue,
          textValue: result.textValue,
          notes: result.notes || ''
        }
      })
    }
    setResultsFormData(initialResults)
    setResultAttachments([])
    setIsResultsDialogOpen(true)
  }

  const handleResultChange = (parameterId: string, field: string, value: any) => {
    setResultsFormData({
      ...resultsFormData,
      [parameterId]: {
        ...resultsFormData[parameterId],
        [field]: value
      }
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setResultAttachments([...resultAttachments, ...files])
  }

  const removeAttachment = (index: number) => {
    const newAttachments = [...resultAttachments]
    newAttachments.splice(index, 1)
    setResultAttachments(newAttachments)
  }

  const handleSaveResults = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedSampleTest) return

    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('results', JSON.stringify(resultsFormData))
      
      resultAttachments.forEach((file, index) => {
        formData.append(`files[${index}]`, file)
      })

      const response = await fetch(`/api/samples/${sampleId}/tests/${selectedSampleTest.id}/results`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        toast.success('Resultados guardados exitosamente')
        setIsResultsDialogOpen(false)
        setResultAttachments([])
        fetchSample()
      } else {
        const error = await response.json()
        setError(error.message || 'Error al guardar resultados')
      }
    } catch (err) {
      setError('Error al guardar resultados')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Pendiente</Badge>
      case 'IN_PROGRESS':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">En Proceso</Badge>
      case 'AWAITING_VALIDATION':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Por Validar</Badge>
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Completada</Badge>
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Cancelada</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Urgente</Badge>
      case 'HIGH':
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Alta</Badge>
      case 'MEDIUM':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Media</Badge>
      case 'LOW':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Baja</Badge>
      default:
        return <Badge>{priority}</Badge>
    }
  }

  if (status === 'loading' || (status === 'authenticated' && !sample)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    )
  }

  if (!sample) {
    return null
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
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  Muestra {sample.sampleCode}
                </h1>
                <p className="text-xs text-slate-500">Gestión de Pruebas</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sample Info */}
        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Información de la Muestra</CardTitle>
            <CardDescription>Detalles del paciente y la muestra</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Paciente</p>
                <p className="text-slate-900 font-medium">{sample.patient.fullName}</p>
                <p className="text-sm text-slate-500">{sample.patient.cedula}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Médico Solicitante</p>
                <p className="text-slate-900">{sample.doctor.fullName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Tipo de Muestra</p>
                <p className="text-slate-900">{sample.sampleType}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Fecha Recolección</p>
                <p className="text-slate-900">
                  {new Date(sample.collectionDate).toLocaleDateString('es-VE')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Prioridad</p>
                {getPriorityBadge(sample.priority)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Estado</p>
                {getStatusBadge(sample.status)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Método Recolección</p>
                <p className="text-slate-900">{sample.collectionMethod}</p>
              </div>
            </div>
            {sample.clinicalNotes && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-500 mb-1">Notas Clínicas</p>
                <p className="text-slate-900">{sample.clinicalNotes}</p>
              </div>
            )}
            {sample.documents.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-500 mb-2">Documentos Adjuntos</p>
                <div className="flex flex-wrap gap-2">
                  {sample.documents.map((doc, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      {doc.fileName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tests Section */}
        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Pruebas Asignadas</CardTitle>
                <CardDescription>
                  Gestione las pruebas bacteriológicas asignadas a esta muestra
                </CardDescription>
              </div>
              <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Asignar Prueba
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Asignar Nueva Prueba</DialogTitle>
                    <DialogDescription>
                      Seleccione una prueba bacteriológica para asignar a esta muestra
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleAssignTest}>
                    {error && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="test">Prueba *</Label>
                        <Select
                          value={assignFormData.testId}
                          onValueChange={(value) => setAssignFormData({ ...assignFormData, testId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione una prueba" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTests.map((test) => (
                              <SelectItem key={test.id} value={test.id}>
                                {test.code} - {test.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="assignedTo">Asignar a</Label>
                        <Select
                          value={assignFormData.assignedToId}
                          onValueChange={(value) => setAssignFormData({ ...assignFormData, assignedToId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={session?.user?.id || ''}>
                              {session?.user?.name} (Yo)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 mt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAssignDialogOpen(false)}
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
                            Asignando...
                          </>
                        ) : (
                          'Asignar Prueba'
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Inicio</TableHead>
                  <TableHead>Fecha Completado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sample.sampleTests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                      No hay pruebas asignadas. Asigne una prueba para comenzar.
                    </TableCell>
                  </TableRow>
                ) : (
                  sample.sampleTests.map((sampleTest) => (
                    <TableRow key={sampleTest.id}>
                      <TableCell className="font-mono font-medium">
                        {sampleTest.test.code}
                      </TableCell>
                      <TableCell>{sampleTest.test.name}</TableCell>
                      <TableCell>
                        {sampleTest.assignedTo ? (
                          <div>
                            <p className="font-medium">{sampleTest.assignedTo.name}</p>
                            {sampleTest.assignedToId === session?.user?.id && (
                              <span className="text-xs text-slate-500">(Asignado a mí)</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">No asignado</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(sampleTest.status)}</TableCell>
                      <TableCell>
                        {sampleTest.startedAt
                          ? new Date(sampleTest.startedAt).toLocaleDateString('es-VE')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {sampleTest.completedAt
                          ? new Date(sampleTest.completedAt).toLocaleDateString('es-VE')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {sampleTest.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startTest(sampleTest.id)}
                              disabled={isLoading}
                            >
                              <Play className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {sampleTest.status !== 'COMPLETED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openResultsDialog(sampleTest)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {sampleTest.status === 'COMPLETED' && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
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

      {/* Dialog de Resultados */}
      <Dialog open={isResultsDialogOpen} onOpenChange={setIsResultsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ingresar Resultados</DialogTitle>
            <DialogDescription>
              {selectedSampleTest?.test.name} ({selectedSampleTest?.test.code})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveResults}>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-6">
              {/* Parámetros de resultados */}
              {selectedSampleTest?.test.parameters && selectedSampleTest.test.parameters.length > 0 ? (
                selectedSampleTest.test.parameters.map((parameter) => (
                  <div key={parameter.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">{parameter.name}</h4>
                      <Badge variant="outline">{parameter.code}</Badge>
                    </div>

                    {parameter.resultType === 'QUANTITATIVE' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Valor *</Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              step="any"
                              value={resultsFormData[parameter.id]?.quantitativeValue || ''}
                              onChange={(e) => handleResultChange(parameter.id, 'quantitativeValue', parseFloat(e.target.value))}
                              placeholder="0.00"
                            />
                            {parameter.unit && (
                              <span className="text-sm text-slate-500">{parameter.unit}</span>
                            )}
                          </div>
                          {(parameter.normalMin !== null || parameter.normalMax !== null) && (
                            <p className="text-xs text-slate-500 mt-1">
                              Rango normal: {parameter.normalMin} - {parameter.normalMax} {parameter.unit}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Notas</Label>
                          <Textarea
                            value={resultsFormData[parameter.id]?.notes || ''}
                            onChange={(e) => handleResultChange(parameter.id, 'notes', e.target.value)}
                            placeholder="Observaciones..."
                            rows={2}
                          />
                        </div>
                      </div>
                    )}

                    {parameter.resultType === 'QUALITATIVE' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Resultado *</Label>
                          <Select
                            value={resultsFormData[parameter.id]?.qualitativeValue || ''}
                            onValueChange={(value) => handleResultChange(parameter.id, 'qualitativeValue', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="POSITIVE">Positivo</SelectItem>
                              <SelectItem value="NEGATIVE">Negativo</SelectItem>
                              <SelectItem value="INDETERMINATE">Indeterminado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Notas</Label>
                          <Textarea
                            value={resultsFormData[parameter.id]?.notes || ''}
                            onChange={(e) => handleResultChange(parameter.id, 'notes', e.target.value)}
                            placeholder="Observaciones..."
                            rows={2}
                          />
                        </div>
                      </div>
                    )}

                    {parameter.resultType === 'TEXT' && (
                      <div className="space-y-2">
                        <Label>Resultado *</Label>
                        <Textarea
                          value={resultsFormData[parameter.id]?.textValue || ''}
                          onChange={(e) => handleResultChange(parameter.id, 'textValue', e.target.value)}
                          placeholder="Ingrese el resultado..."
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <Alert>
                  <AlertDescription>
                    Esta prueba no tiene parámetros configurados. Configure los parámetros en la página de pruebas.
                  </AlertDescription>
                </Alert>
              )}

              {/* Resultados generales */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-medium mb-3">Información General de Resultados</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="technique">Técnica Utilizada</Label>
                    <Input
                      id="technique"
                      value={selectedSampleTest?.technique || ''}
                      onChange={(e) => {
                        if (selectedSampleTest) {
                          setSelectedSampleTest({ ...selectedSampleTest, technique: e.target.value })
                        }
                      }}
                      placeholder="Describa la técnica utilizada..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interpretation">Interpretación General</Label>
                    <Textarea
                      id="interpretation"
                      value={selectedSampleTest?.resultInterpretation || ''}
                      onChange={(e) => {
                        if (selectedSampleTest) {
                          setSelectedSampleTest({ ...selectedSampleTest, resultInterpretation: e.target.value })
                        }
                      }}
                      placeholder="Interpretación general de los resultados..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Adjuntar imágenes/documentos */}
              <div className="space-y-2">
                <Label>Archivos Adjuntos (imágenes, documentos)</Label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                  <Input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                  />
                </div>
                {resultAttachments.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {resultAttachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-slate-500" />
                          <span className="text-sm">{file.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {(file.size / 1024).toFixed(1)} KB
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResultsDialogOpen(false)}
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
                  'Guardar Resultados'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
