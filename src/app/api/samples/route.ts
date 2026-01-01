import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { db } from '@/lib/db'

// Generar código de muestra único
function generateSampleCode(): string {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `MUEST-${year}${month}-${random}`
}

// POST /api/samples - Crear nueva muestra
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    
    // Obtener datos del formulario
    const patientData = JSON.parse(formData.get('patient') as string)
    const sampleData = JSON.parse(formData.get('sample') as string)
    const doctorData = JSON.parse(formData.get('doctor') as string)
    const existingPatientId = formData.get('patientId') as string | null
    const existingDoctorId = formData.get('doctorId') as string | null

    // Validar datos del paciente
    if (!patientData.fullName || !patientData.cedula || !patientData.dateOfBirth || !patientData.gender) {
      return NextResponse.json(
        { error: 'Datos del paciente incompletos' },
        { status: 400 }
      )
    }

    // Validar datos de la muestra
    if (!sampleData.sampleType || !sampleData.collectionDate || !sampleData.collectionMethod) {
      return NextResponse.json(
        { error: 'Datos de la muestra incompletos' },
        { status: 400 }
      )
    }

    // Validar datos del médico
    if (!doctorData.fullName) {
      return NextResponse.json(
        { error: 'Datos del médico incompletos' },
        { status: 400 }
      )
    }

    // Crear o encontrar paciente
    let patient
    if (existingPatientId) {
      patient = await db.patient.findUnique({
        where: { id: existingPatientId }
      })
    } else {
      // Verificar si ya existe paciente con esa cédula
      const existingPatient = await db.patient.findUnique({
        where: { cedula: patientData.cedula }
      })

      if (existingPatient) {
        patient = existingPatient
      } else {
        patient = await db.patient.create({
          data: {
            fullName: patientData.fullName,
            cedula: patientData.cedula,
            dateOfBirth: new Date(patientData.dateOfBirth),
            gender: patientData.gender,
            phone: patientData.phone || null
          }
        })
      }
    }

    // Crear o encontrar médico
    let doctor
    if (existingDoctorId) {
      doctor = await db.doctor.findUnique({
        where: { id: existingDoctorId }
      })
    } else {
      // Verificar si ya existe médico con ese nombre
      const existingDoctor = await db.doctor.findFirst({
        where: { 
          fullName: doctorData.fullName
        }
      })

      if (existingDoctor) {
        doctor = existingDoctor
      } else {
        doctor = await db.doctor.create({
          data: {
            fullName: doctorData.fullName,
            specialty: doctorData.specialty || null,
            healthCenter: doctorData.healthCenter || null
          }
        })
      }
    }

    // Generar código de muestra único
    let sampleCode = generateSampleCode()
    let codeExists = await db.sample.findUnique({ where: { sampleCode } })
    while (codeExists) {
      sampleCode = generateSampleCode()
      codeExists = await db.sample.findUnique({ where: { sampleCode } })
    }

    // Combinar fecha y hora de recolección
    const collectionDateTime = new Date(`${sampleData.collectionDate}T${sampleData.collectionTime}:00`)

    // Crear muestra
    const sample = await db.sample.create({
      data: {
        sampleCode,
        patientId: patient.id,
        doctorId: doctor.id,
        collectionDate: collectionDateTime,
        sampleType: sampleData.sampleType,
        collectionMethod: sampleData.collectionMethod,
        status: 'RECEIVED',
        priority: sampleData.priority,
        clinicalNotes: sampleData.clinicalNotes || null,
        createdById: session.user.id
      }
    })

    // Procesar archivos adjuntos (por ahora solo guardamos metadatos)
    const files = formData.getAll('files') as File[]
    if (files && files.length > 0) {
      for (const file of files) {
        if (file instanceof File && file.size > 0) {
          // En producción, aquí se guardaría el archivo en storage (S3, local, etc.)
          // Por ahora solo guardamos los metadatos
          await db.sampleDocument.create({
            data: {
              sampleId: sample.id,
              fileName: file.name,
              fileUrl: `/uploads/samples/${sample.id}/${file.name}`, // URL placeholder
              fileType: file.type,
              fileSize: file.size
            }
          })
        }
      }
    }

    // Crear entrada de auditoría
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Sample',
        entityId: sample.id,
        entityName: `${sample.sampleCode} - ${patient.fullName}`,
        changes: JSON.stringify({
          patient: patient.fullName,
          doctor: doctor.fullName,
          sampleType: sampleData.sampleType,
          priority: sampleData.priority
        })
      }
    })

    return NextResponse.json(
      { 
        success: true, 
        sampleCode: sample.sampleCode,
        sampleId: sample.id
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating sample:', error)
    return NextResponse.json(
      { error: 'Error al crear muestra' },
      { status: 500 }
    )
  }
}
