import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Inicializando base de datos del Sistema de Gestión Laboratorial...\n')

  // Verificar si ya existe un usuario administrador
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  })

  if (existingAdmin) {
    console.log('⚠️  Ya existe un usuario administrador en la base de datos.')
    console.log(`   Email: ${existingAdmin.email}`)
    console.log('   Si desea crear otro administrador, puede hacerlo desde la interfaz de gestión de usuarios.\n')
    return
  }

  // Crear usuario administrador por defecto
  const hashedPassword = await bcrypt.hash('Admin123!', 10)

  const admin = await prisma.user.create({
    data: {
      name: 'Administrador del Sistema',
      email: 'admin@laboratorio.com',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
      language: 'es',
    }
  })

  console.log('✅ Usuario administrador creado exitosamente:')
  console.log(`   Email: ${admin.email}`)
  console.log(`   Contraseña: Admin123!`)
  console.log('   ⚠️  Por seguridad, cambie esta contraseña después del primer inicio de sesión.\n')

  // Crear configuraciones por defecto
  const defaultConfigs = [
    {
      key: 'language',
      value: 'es',
      category: 'GENERAL',
      description: 'Idioma por defecto del sistema'
    },
    {
      key: 'dateFormat',
      value: 'DD/MM/YYYY',
      category: 'GENERAL',
      description: 'Formato de fecha por defecto'
    },
    {
      key: 'timezone',
      value: 'America/Caracas',
      category: 'GENERAL',
      description: 'Zona horaria por defecto'
    },
    {
      key: 'reportLogo',
      value: '',
      category: 'REPORTS',
      description: 'URL del logo para informes'
    },
    {
      key: 'lowStockAlertThreshold',
      value: '20',
      category: 'INVENTORY',
      description: 'Porcentaje mínimo de stock para alerta'
    },
    {
      key: 'expiryAlertDays',
      value: '30',
      category: 'INVENTORY',
      description: 'Días antes de caducidad para alerta'
    }
  ]

  for (const config of defaultConfigs) {
    const existing = await prisma.systemConfig.findUnique({
      where: { key: config.key }
    })

    if (!existing) {
      await prisma.systemConfig.create({
        data: config
      })
      console.log(`✅ Configuración creada: ${config.key}`)
    }
  }

  // Crear algunas pruebas de ejemplo
  const exampleTests = [
    {
      name: 'Cultivo de Orina',
      code: 'CULT_ORI',
      description: 'Análisis bacteriológico de muestra de orina',
      category: 'Bacteriología',
      sampleType: 'Orina',
      method: 'Siembra en agar selectivo',
      isActive: true,
      estimatedDuration: 24
    },
    {
      name: 'Cultivo de Sangre (Hemocultivo)',
      code: 'CULT_SAN',
      description: 'Detección de bacteriemias y fungemias',
      category: 'Bacteriología',
      sampleType: 'Sangre',
      method: 'Automatizado',
      isActive: true,
      estimatedDuration: 72
    },
    {
      name: 'Cultivo de Exudado Faríngeo',
      code: 'CULT_FAR',
      description: 'Identificación de patógenos en faringe',
      category: 'Bacteriología',
      sampleType: 'Exudado',
      method: 'Siembra en agar sangre',
      isActive: true,
      estimatedDuration: 48
    },
    {
      name: 'Antibiograma',
      code: 'ANTIBIO',
      description: 'Prueba de susceptibilidad antimicrobiana',
      category: 'Bacteriología',
      sampleType: 'Varios',
      method: 'Método de difusión en disco (Kirby-Bauer)',
      isActive: true,
      estimatedDuration: 24
    }
  ]

  for (const test of exampleTests) {
    const existing = await prisma.test.findUnique({
      where: { code: test.code }
    })

    if (!existing) {
      await prisma.test.create({
        data: test
      })
      console.log(`✅ Prueba creada: ${test.name} (${test.code})`)
    }
  }

  console.log('\n🎉 Inicialización completada exitosamente!')
  console.log('🌐 Visite http://localhost:3000/login para acceder al sistema.')
  console.log('👤 Use el usuario administrador para comenzar.\n')
}

main()
  .catch((e) => {
    console.error('❌ Error durante la inicialización:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
