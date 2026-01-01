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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, ArrowLeft, User as UserIcon, CalendarClock, Stethoscope, FileText, Plus, X, Upload } from 'lucide-react'
import { toast } from 'sonner'

interface Patient {
  id: string
  fullName: string
  cedula: string
  dateOfBirth: string
  gender: string
  phone?: string
}

interface Doctor {
  id: string
  fullName: string
  specialty?: string
  healthCenter?: string
}

interface FileAttachment {
  file: File
  preview?: string
}

export default function NewSamplePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Datos del Paciente
  const [patientData, setPatientData] = useState({
    fullName: '',
    cedula: '',
    dateOfBirth: '',
    gender: '',
    phone: ''
  })
  const [patientSuggestions, setPatientSuggestions] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)

  // Datos de la Muestra
  const [sampleData, setSampleData] = useState({
    sampleType: '',
    collectionDate: new Date().toISOString().split('T')[0],
    collectionTime: new Date().toTimeString().slice(0, 5),
    collectionMethod: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    clinicalNotes: ''
  })

  // Datos del Médico
  const [doctorData, setDoctorData] = useState({
    fullName: '',
    specialty: '',
    healthCenter: ''
  })
  const [doctorSuggestions, setDoctorSuggestions] = useState<Doctor[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null)

  // Documentos adjuntos
  const [attachments, setAttachments] = useState<FileAttachment[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Buscar paciente por cédula
  const searchPatient = async (cedula: string) => {
    if (cedula.length < 5) {
      setPatientSuggestions([])
      return
    }

    try {
      const response = await fetch(`/api/patients/search?q=${cedula}`)
      if (response.ok) {
        const data = await response.json()
        setPatientSuggestions(data)
      }
    } catch (err) {
      console.error('Error searching patient:', err)
    }
  }

  // Buscar médico por nombre
  const searchDoctor = async (name: string) => {
    if (name.length < 3) {
      setDoctorSuggestions([])
      return
    }

    try {
      const response = await fetch(`/api/doctors/search?q=${name}`)
      if (response.ok) {
        const data = await response.json()
        setDoctorSuggestions(data)
      }
    } catch (err) {
      console.error('Error searching doctor:', err)
    }
  }

  // Seleccionar paciente de sugerencias
  const selectPatient = (patient: Patient) => {
    setPatientData({
      fullName: patient.fullName,
      cedula: patient.cedula,
      dateOfBirth: patient.dateOfBirth.split('T')[0],
      gender: patient.gender,
      phone: patient.phone || ''
    })
    setSelectedPatientId(patient.id)
    setPatientSuggestions([])
  }

  // Seleccionar médico de sugerencias
  const selectDoctor = (doctor: Doctor) => {
    setDoctorData({
      fullName: doctor.fullName,
      specialty: doctor.specialty || '',
      healthCenter: doctor.healthCenter || ''
    })
    setSelectedDoctorId(doctor.id)
    setDoctorSuggestions([])
  }

  // Manejar carga de archivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newAttachments = files.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }))
    setAttachments([...attachments, ...newAttachments])
  }

  // Eliminar archivo
  const removeAttachment = (index: number) => {
    const newAttachments = [...attachments]
    if (newAttachments[index].preview) {
      URL.revokeObjectURL(newAttachments[index].preview!)
    }
    newAttachments.splice(index, 1)
    setAttachments(newAttachments)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validaciones
    if (!patientData.fullName || !patientData.cedula || !patientData.dateOfBirth || !patientData.gender) {
      setError('Por favor, complete todos los campos del paciente')
      return
    }

    if (!sampleData.sampleType || !sampleData.collectionDate || !sampleData.collectionTime || !sampleData.collectionMethod) {
      setError('Por favor, complete todos los campos de la muestra')
      return
    }

    if (!doctorData.fullName) {
      setError('Por favor, ingrese el nombre del médico solicitante')
      return
    }

    setIsLoading(true)

    try {
      // Crear muestra con FormData para incluir archivos
      const formData = new FormData()
      formData.append('patient', JSON.stringify(patientData))
      formData.append('sample', JSON.stringify(sampleData))
      formData.append('doctor', JSON.stringify(doctorData))
      if (selectedPatientId) formData.append('patientId', selectedPatientId)
      if (selectedDoctorId) formData.append('doctorId', selectedDoctorId)
      
      attachments.forEach((attachment, index) => {
        formData.append(`files[${index}]`, attachment.file)
      })

      const response = await fetch('/api/samples', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('Muestra registrada exitosamente', {
          description: `Código de muestra: ${result.sampleCode}`
        })
        router.push('/')
      } else {
        const error = await response.json()
        setError(error.message || 'Error al registrar muestra')
      }
    } catch (err) {
      setError('Error al registrar muestra')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || (status === 'unauthenticated')) {
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
              <h1 className="text-xl font-bold text-slate-900">
                Registro de Muestra
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Nueva Muestra de Bacteriología
          </h2>
          <p className="text-slate-600">
            Complete el formulario para registrar una nueva muestra en el sistema
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="patient" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="patient" className="flex items-center space-x-2">
                <UserIcon className="h-4 w-4" />
                <span>Datos del Paciente</span>
              </TabsTrigger>
              <TabsTrigger value="sample" className="flex items-center space-x-2">
                <CalendarClock className="h-4 w-4" />
                <span>Datos de la Muestra</span>
              </TabsTrigger>
              <TabsTrigger value="doctor" className="flex items-center space-x-2">
                <Stethoscope className="h-4 w-4" />
                <span>Médico Solicitante</span>
              </TabsTrigger>
            </TabsList>

            {/* Sección 1: Datos del Paciente */}
            <TabsContent value="patient">
              <Card>
                <CardHeader>
                  <CardTitle>Información del Paciente</CardTitle>
                  <CardDescription>
                    Ingrese los datos del paciente. El sistema buscará pacientes existentes automáticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 relative">
                    <Label htmlFor="cedula">Cédula de Identidad *</Label>
                    <Input
                      id="cedula"
                      value={patientData.cedula}
                      onChange={(e) => {
                        setPatientData({ ...patientData, cedula: e.target.value })
                        searchPatient(e.target.value)
                      }}
                      placeholder="V-12345678"
                      maxLength={10}
                    />
                    {patientSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {patientSuggestions.map((patient) => (
                          <div
                            key={patient.id}
                            onClick={() => selectPatient(patient)}
                            className="px-4 py-2 hover:bg-slate-100 cursor-pointer flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium">{patient.fullName}</p>
                              <p className="text-sm text-slate-500">{patient.cedula}</p>
                            </div>
                            <Button size="sm" variant="ghost" type="button">
                              Seleccionar
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nombre Completo *</Label>
                      <Input
                        id="fullName"
                        value={patientData.fullName}
                        onChange={(e) => setPatientData({ ...patientData, fullName: e.target.value })}
                        placeholder="Juan Pérez"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">Fecha de Nacimiento *</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={patientData.dateOfBirth}
                        onChange={(e) => setPatientData({ ...patientData, dateOfBirth: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gender">Sexo *</Label>
                      <Select
                        value={patientData.gender}
                        onValueChange={(value) => setPatientData({ ...patientData, gender: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Femenino</SelectItem>
                          <SelectItem value="O">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={patientData.phone}
                        onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })}
                        placeholder="0414-1234567"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sección 2: Datos de la Muestra */}
            <TabsContent value="sample">
              <Card>
                <CardHeader>
                  <CardTitle>Información de la Muestra</CardTitle>
                  <CardDescription>
                    Ingrese los detalles de la muestra recolectada para análisis bacteriológico.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sampleType">Tipo de Muestra *</Label>
                      <Select
                        value={sampleData.sampleType}
                        onValueChange={(value) => setSampleData({ ...sampleData, sampleType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione el tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sangre">Sangre</SelectItem>
                          <SelectItem value="Orina">Orina</SelectItem>
                          <SelectItem value="Exudado">Exudado</SelectItem>
                          <SelectItem value="Heces">Heces</SelectItem>
                          <SelectItem value="LCR">Líquido Cefalorraquídeo</SelectItem>
                          <SelectItem value="Esputo">Esputo</SelectItem>
                          <SelectItem value="Secrecion">Secreción</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority">Prioridad</Label>
                      <Select
                        value={sampleData.priority}
                        onValueChange={(value: any) => setSampleData({ ...sampleData, priority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Baja</SelectItem>
                          <SelectItem value="MEDIUM">Media</SelectItem>
                          <SelectItem value="HIGH">Alta</SelectItem>
                          <SelectItem value="URGENT">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="collectionDate">Fecha de Recolección *</Label>
                      <Input
                        id="collectionDate"
                        type="date"
                        value={sampleData.collectionDate}
                        onChange={(e) => setSampleData({ ...sampleData, collectionDate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="collectionTime">Hora de Recolección *</Label>
                      <Input
                        id="collectionTime"
                        type="time"
                        value={sampleData.collectionTime}
                        onChange={(e) => setSampleData({ ...sampleData, collectionTime: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="collectionMethod">Método de Recolección *</Label>
                    <Select
                      value={sampleData.collectionMethod}
                      onValueChange={(value) => setSampleData({ ...sampleData, collectionMethod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VENIPUNCTURE">Venopunción</SelectItem>
                        <SelectItem value="SWAB">Hisopado (Swab)</SelectItem>
                        <SelectItem value="URINE">Micción Espontánea</SelectItem>
                        <SelectItem value="STOOL">Recolección Directa</SelectItem>
                        <SelectItem value="THROAT">Hisopado Faríngeo</SelectItem>
                        <SelectItem value="NASAL">Hisopado Nasal</SelectItem>
                        <SelectItem value="WOUND">Herida/Lesión</SelectItem>
                        <SelectItem value="CATHETER">Catéter</SelectItem>
                        <SelectItem value="OTHER">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clinicalNotes">Notas Clínicas</Label>
                    <Textarea
                      id="clinicalNotes"
                      value={sampleData.clinicalNotes}
                      onChange={(e) => setSampleData({ ...sampleData, clinicalNotes: e.target.value })}
                      placeholder="Notas adicionales o información clínica relevante..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Documentos Adjuntos</Label>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm text-slate-600 mb-2">
                        Arrastra archivos aquí o haz clic para seleccionar
                      </p>
                      <Input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="max-w-xs mx-auto"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      />
                    </div>

                    {attachments.length > 0 && (
                      <div className="space-y-2 mt-4">
                        {attachments.map((attachment, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-slate-500" />
                              <span className="text-sm">{attachment.file.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {(attachment.file.size / 1024).toFixed(1)} KB
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sección 3: Médico Solicitante */}
            <TabsContent value="doctor">
              <Card>
                <CardHeader>
                  <CardTitle>Médico Solicitante</CardTitle>
                  <CardDescription>
                    Ingrese los datos del médico que solicitó los análisis.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 relative">
                    <Label htmlFor="doctorName">Nombre del Médico *</Label>
                    <Input
                      id="doctorName"
                      value={doctorData.fullName}
                      onChange={(e) => {
                        setDoctorData({ ...doctorData, fullName: e.target.value })
                        searchDoctor(e.target.value)
                      }}
                      placeholder="Dr. María González"
                    />
                    {doctorSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {doctorSuggestions.map((doctor) => (
                          <div
                            key={doctor.id}
                            onClick={() => selectDoctor(doctor)}
                            className="px-4 py-2 hover:bg-slate-100 cursor-pointer"
                          >
                            <p className="font-medium">{doctor.fullName}</p>
                            {doctor.specialty && (
                              <p className="text-sm text-slate-500">{doctor.specialty}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specialty">Especialidad</Label>
                    <Input
                      id="specialty"
                      value={doctorData.specialty}
                      onChange={(e) => setDoctorData({ ...doctorData, specialty: e.target.value })}
                      placeholder="Medicina Interna"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="healthCenter">Centro de Salud</Label>
                    <Input
                      id="healthCenter"
                      value={doctorData.healthCenter}
                      onChange={(e) => setDoctorData({ ...doctorData, healthCenter: e.target.value })}
                      placeholder="Hospital Central"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Botones de acción */}
          <div className="flex justify-end space-x-4 mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/')}
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
                  Registrando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Muestra
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
