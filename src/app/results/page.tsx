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
import { Loader2, AlertCircle, Search, Filter, Download, Eye, CheckCircle, XCircle, FileText, Calendar, User, ArrowLeft, FlaskConical, Printer } from 'lucide-react'
import { toast } from 'sonner'

interface TestResult {
  id: string
  parameterId: string
  parameter: {
    name: string
    code: string
    resultType: 'QUANTITATIVE' | 'QUALITATIVE' | 'TEXT'
    unit?: string
    referenceRange?: string
  }
  quantitativeValue?: number
  qualitativeValue?: 'POSITIVE' | 'NEGATIVE' | 'INDETERMINATE'
  textValue?: string
  unit?: string
  isAbnormal: boolean
  isCritical: boolean
  notes?: string
}

interface SampleTest {
  id: string
  sample: {
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
  }
  test: {
    name: string
    code: string
    category?: string
  }
  status: 'PENDING' | 'IN_PROGRESS' | 'AWAITING_VALIDATION' | 'COMPLETED' | 'CANCELLED'
  results: TestResult[]
  resultsText?: string
  technique?: string
  resultInterpretation?: string
  validatedAt?: string
  validatedBy?: {
    name: string
  }
}

export default function ResultsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPatient, setFilterPatient] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTestType, setFilterTestType] = useState('')
  const [filterResultType, setFilterResultType] = useState('')

  // Data
  const [results, setResults] = useState<SampleTest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SampleTest | null>(null)
  const [error, setError] = useState('')

  // PDF Config
  const [pdfConfig, setPdfConfig] = useState({
    includeTechnique: true,
    includeInterpretation: true,
    includeValidation: true,
    showAbnormal: true
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchResults()
    }
  }, [status, router])

  const fetchResults = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (filterPatient) params.append('patient', filterPatient)
      if (filterDateFrom) params.append('dateFrom', filterDateFrom)
      if (filterDateTo) params.append('dateTo', filterDateTo)
      if (filterStatus) params.append('status', filterStatus)
      if (filterTestType) params.append('testType', filterTestType)
      if (filterResultType) params.append('resultType', filterResultType)

      const response = await fetch(`/api/results?${params}`)
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      }
    } catch (err) {
      console.error('Error fetching results:', err)
      toast.error('Error al cargar resultados')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    fetchResults()
  }

  const handleGeneratePDF = async (sampleTestId: string) => {
    setIsGeneratingPDF(true)
    setError('')

    try {
      const response = await fetch('/api/results/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleTestId,
          config: pdfConfig
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Descargar el PDF
        if (result.pdfUrl) {
          window.open(result.pdfUrl, '_blank')
          toast.success('PDF generado exitosamente')
        } else if (result.pdfData) {
          // Si los datos están en base64, descargar
          const blob = new Blob([result.pdfData], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `informe_${result.sampleCode}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          toast.success('PDF generado y descargado')
        }
      } else {
        const error = await response.json()
        setError(error.message || 'Error al generar PDF')
        toast.error('Error al generar PDF')
      }
    } catch (err) {
      setError('Error al generar PDF')
      toast.error('Error al generar PDF')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const handleValidate = async (sampleTestId: string, isValid: boolean) => {
    try {
      const response = await fetch(`/api/results/${sampleTestId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isValid })
      })

      if (response.ok) {
        toast.success(isValid ? 'Resultado validado exitosamente' : 'Resultado invalidado')
        fetchResults()
      } else {
        toast.error('Error al validar resultado')
      }
    } catch (err) {
      console.error('Error validating result:', err)
      toast.error('Error al validar resultado')
    }
  }

  const openPreview = (result: SampleTest) => {
    setSelectedResult(result)
    setIsPreviewDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AWAITING_VALIDATION':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Por Validar</Badge>
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Completado</Badge>
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Cancelado</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getQualitativeValueDisplay = (value: string) => {
    switch (value) {
      case 'POSITIVE':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Positivo</Badge>
      case 'NEGATIVE':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Negativo</Badge>
      case 'INDETERMINATE':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Indeterminado</Badge>
      default:
        return value
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
              <FileText className="h-6 w-6 text-slate-700" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  Resultados e Informes
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Gestión de Resultados
          </h2>
          <p className="text-slate-600">
            Busque, filtre y gestione los resultados de bacteriología
          </p>
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
                      placeholder="Código de muestra, paciente, médico..."
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
                    <Label>Paciente</Label>
                    <Input
                      placeholder="Nombre o cédula"
                      value={filterPatient}
                      onChange={(e) => setFilterPatient(e.target.value)}
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
                        <SelectItem value="AWAITING_VALIDATION">Por Validar</SelectItem>
                        <SelectItem value="COMPLETED">Completado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Resultado</Label>
                    <Select
                      value={filterResultType}
                      onValueChange={setFilterResultType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos</SelectItem>
                        <SelectItem value="ABNORMAL">Anormales</SelectItem>
                        <SelectItem value="CRITICAL">Críticos</SelectItem>
                        <SelectItem value="POSITIVE">Positivos</SelectItem>
                        <SelectItem value="NEGATIVE">Negativos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha Desde</Label>
                    <Input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha Hasta</Label>
                    <Input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Prueba</Label>
                    <Select
                      value={filterTestType}
                      onValueChange={setFilterTestType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos</SelectItem>
                        <SelectItem value="Sangre">Sangre</SelectItem>
                        <SelectItem value="Orina">Orina</SelectItem>
                        <SelectItem value="Exudado">Exudado</SelectItem>
                        <SelectItem value="Heces">Heces</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('')
                      setFilterPatient('')
                      setFilterDateFrom('')
                      setFilterDateTo('')
                      setFilterStatus('')
                      setFilterTestType('')
                      setFilterResultType('')
                      fetchResults()
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

        {/* Results Table */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
            <CardDescription>
              {results.length} resultado(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Prueba</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Validación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-600" />
                      </TableCell>
                    </TableRow>
                  ) : results.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                        No hay resultados que coincidan con los filtros
                      </TableCell>
                    </TableRow>
                  ) : (
                    results.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-mono font-medium">
                          {result.sample.sampleCode}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{result.sample.patient.fullName}</p>
                            <p className="text-sm text-slate-500">{result.sample.patient.cedula}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{result.test.name}</p>
                            <p className="text-sm text-slate-500">{result.test.code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(result.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span className="text-sm">
                              {new Date(result.sample.collectionDate).toLocaleDateString('es-VE')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {result.validatedAt ? (
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-slate-600">
                                {result.validatedBy?.name}
                              </span>
                            </div>
                          ) : result.status === 'AWAITING_VALIDATION' ? (
                            <Badge variant="outline" className="text-xs">Pendiente</Badge>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openPreview(result)}
                            >
                              <Eye className="h-4 w-4 text-slate-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleGeneratePDF(result.id)}
                              disabled={isGeneratingPDF}
                            >
                              <Download className="h-4 w-4 text-slate-600" />
                            </Button>
                            {result.status === 'AWAITING_VALIDATION' && session?.user?.role !== 'LAB_ASSISTANT' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleValidate(result.id, true)}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleValidate(result.id, false)}
                                >
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* PDF Configuration */}
        <Card className="mt-6 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-slate-700" />
              <span>Configuración de Informes PDF</span>
            </CardTitle>
            <CardDescription>
              Personalice los elementos incluidos en los informes generados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeTechnique"
                  checked={pdfConfig.includeTechnique}
                  onChange={(e) => setPdfConfig({ ...pdfConfig, includeTechnique: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="includeTechnique" className="mb-0">Incluir técnica utilizada</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeInterpretation"
                  checked={pdfConfig.includeInterpretation}
                  onChange={(e) => setPdfConfig({ ...pdfConfig, includeInterpretation: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="includeInterpretation" className="mb-0">Incluir interpretación</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeValidation"
                  checked={pdfConfig.includeValidation}
                  onChange={(e) => setPdfConfig({ ...pdfConfig, includeValidation: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="includeValidation" className="mb-0">Incluir validación</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showAbnormal"
                  checked={pdfConfig.showAbnormal}
                  onChange={(e) => setPdfConfig({ ...pdfConfig, showAbnormal: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="showAbnormal" className="mb-0">Resaltar valores anormales</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa de Informe</DialogTitle>
            <DialogDescription>
              {selectedResult?.sample.sampleCode} - {selectedResult?.test.name}
            </DialogDescription>
          </DialogHeader>

          {selectedResult && (
            <div className="space-y-6">
              {/* Sample & Patient Info */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center space-x-2">
                  <User className="h-4 w-4 text-slate-700" />
                  <span>Paciente y Muestra</span>
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Código de Muestra</p>
                    <p className="font-mono">{selectedResult.sample.sampleCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Paciente</p>
                    <p>{selectedResult.sample.patient.fullName}</p>
                    <p className="text-sm text-slate-500">{selectedResult.sample.patient.cedula}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Médico Solicitante</p>
                    <p>{selectedResult.sample.doctor.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Tipo de Muestra</p>
                    <p>{selectedResult.sample.sampleType}</p>
                  </div>
                </div>
              </div>

              {/* Results */}
              {selectedResult.results && selectedResult.results.length > 0 && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center space-x-2">
                    <FlaskConical className="h-4 w-4 text-slate-700" />
                    <span>Resultados de Bacteriología</span>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parámetro</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedResult.results.map((result) => (
                        <TableRow key={result.id} className={
                          result.isCritical ? 'bg-red-50' : result.isAbnormal ? 'bg-yellow-50' : ''
                        }>
                          <TableCell>
                            <p className="font-medium">{result.parameter.name}</p>
                            <p className="text-sm text-slate-500">{result.parameter.code}</p>
                          </TableCell>
                          <TableCell>
                            {result.parameter.resultType === 'QUANTITATIVE' && (
                              <span className="font-mono">
                                {result.quantitativeValue} {result.unit}
                              </span>
                            )}
                            {result.parameter.resultType === 'QUALITATIVE' && (
                              getQualitativeValueDisplay(result.qualitativeValue!)
                            )}
                            {result.parameter.resultType === 'TEXT' && (
                              <span>{result.textValue}</span>
                            )}
                          </TableCell>
                          <TableCell>{result.unit || result.parameter.unit || '-'}</TableCell>
                          <TableCell>
                            {result.isCritical && (
                              <Badge className="bg-red-100 text-red-700 border-red-200">Crítico</Badge>
                            )}
                            {!result.isCritical && result.isAbnormal && (
                              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Anormal</Badge>
                            )}
                            {!result.isCritical && !result.isAbnormal && (
                              <Badge className="bg-green-100 text-green-700 border-green-200">Normal</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {selectedResult.technique && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Técnica Utilizada</h4>
                  <p className="text-slate-700">{selectedResult.technique}</p>
                </div>
              )}

              {selectedResult.resultInterpretation && (
                <div className="border border-slate-200 rounded-lg p-4 bg-blue-50">
                  <h4 className="font-semibold mb-2">Interpretación</h4>
                  <p className="text-slate-700">{selectedResult.resultInterpretation}</p>
                </div>
              )}

              {selectedResult.validatedAt && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>
                        Validado por <strong>{selectedResult.validatedBy?.name}</strong>
                      </span>
                    </div>
                    <span>
                      {new Date(selectedResult.validatedAt).toLocaleString('es-VE')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsPreviewDialogOpen(false)}
              className="border-slate-300"
            >
              Cerrar
            </Button>
            <Button
              onClick={() => {
                setIsPreviewDialogOpen(false)
                handleGeneratePDF(selectedResult.id)
              }}
              disabled={isGeneratingPDF}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  Generar e Imprimir PDF
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
