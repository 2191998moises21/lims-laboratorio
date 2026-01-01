# 🧪 Sistema de Gestión Laboratorial - Bacteriología

## 📋 Descripción del Proyecto

Sistema completo de gestión para laboratorios de bioanálisis en Venezuela, especializado en el área de Bacteriología. Aplicación web moderna desarrollada con Next.js 15, TypeScript, Tailwind CSS 4 y shadcn/ui.

## 🚀 Características Principales

### 🔐 Seguridad y Autenticación
- ✅ Sistema de autenticación seguro con NextAuth.js v4
- ✅ Gestión de usuarios con roles (Admin, Bioanalista, Asistente de Laboratorio)
- ✅ Auditoría completa de todas las acciones del sistema
- ✅ Trazabilidad completa con 15 tipos de acciones
- ✅ Protección por roles en todos los endpoints

### 📝 Registro de Muestras
- ✅ Formulario completo de registro en 3 secciones
- ✅ Datos del Paciente (nombre, cédula, edad, sexo, etc.)
- ✅ Datos de la Muestra (tipo, prioridad, método, ubicación)
- ✅ Datos del Médico Solicitante (nombre, teléfono, email)
- ✅ Autocompletado de pacientes y médicos existentes
- ✅ Generación automática de código único
- ✅ Adjuntar documentos y archivos adjuntos

### 🧪 Gestión de Pruebas
- ✅ Configuración de pruebas y parámetros
- ✅ 3 tipos de resultados: Cuantitativo, Cualitativo, Texto
- ✅ Definición de rangos de referencia
- ✅ Criterios de interpretación automáticos
- ✅ Categorización de pruebas (Hematología, Bacteriología, Parasitología, Micología)
- ✅ Definición de precios y coberturas

### 🔬 Gestión de Pruebas Bacteriológicas
- ✅ Asignación de pruebas a muestras
- ✅ Estados de pruebas (Pendiente → En Proceso → Por Validar → Completada)
- ✅ Ingreso de resultados dinámico según tipo
- ✅ Detección automática de valores anormales y críticos
- ✅ Validación de resultados por Bioanalistas/Admin
- ✅ Adjuntar imágenes de pruebas (fotografías, microscopias)

### 📊 Resultados e Informes
- ✅ Búsqueda avanzada con múltiples filtros
- ✅ Vista previa de informes en modal
- ✅ Generación de informes PDF profesionales
- ✅ Configuración personalizable de informes
- ✅ Resaltado de valores anormales (amarillo) y críticos (rojo)
- ✅ Exportación a CSV compatible con Excel

### 📈 Panel de Control Ejecutivo
- ✅ 4 widgets de métricas principales
- ✅ Gráfico de tendencia semanal con barras apiladas
- ✅ Gráfico de distribución por tipo de muestra
- ✅ Top 5 pruebas más solicitadas
- ✅ Resumen de resultados cualitativos
- ✅ Selector de rango de tiempo (Hoy, Semana, Mes)
- ✅ Botón de actualización manual

### 🧫 Inventario de Reactivos
- ✅ Listado completo de reactivos
- ✅ Registro de entradas y salidas de stock
- ✅ Cálculo automático de stock actual
- ✅ Alertas automáticas de bajo stock
- ✅ Alertas automáticas de caducidad (próximos y caducados)
- ✅ Filtros avanzados (tipo, ubicación, estado de stock)
- ✅ Histórico completo de transacciones

### ⚙️ Gestión de Equipos
- ✅ Inventario de equipos e instrumentos
- ✅ 8 categorías de equipos (Incubadora, Microscopio, Centrífuga, Autoclave, etc.)
- ✅ Estados de equipos (Activo, En Mantenimiento, Fuera de Servicio, Calibrando)
- ✅ Registro de calibraciones con fechas de próximas calibraciones
- ✅ Registro de mantenimientos preventivos y correctivos
- ✅ 3 tipos de mantenimiento (Preventivo, Correctivo, Emergencia)
- ✅ Histórico completo de calibraciones y mantenimientos
- ✅ Contadores de actividades

### 🔍 Auditoría y Trazabilidad
- ✅ Registro automático de todas las acciones
- ✅ 15 tipos de acciones con badges de colores
- ✅ 12 tipos de entidades rastreadas
- ✅ Búsqueda avanzada por texto
- ✅ Filtros por acción, tipo de entidad, usuario, fechas
- ✅ 7 tabs de categorías (Todas, Muestras, Pruebas, Reactivos, Equipos, Usuarios, Sistema)
- ✅ Detalle completo de cada acción con JSON de cambios
- ✅ Exportación a CSV/Excel compatible

### 🎨 UI/UX Profesional
- ✅ **15 animaciones CSS personalizadas** (fade, slide, scale, bounce, shimmer, etc.)
- ✅ **20+ categorías de clases de utilidad**
- ✅ **6 componentes de loading states** (Card, Inline, Page, Overlay, Dots, Spinner)
- ✅ **4 componentes de empty states** (State, Card, Table)
- ✅ **4 componentes de skeletons** (Table, Card, Form, Stats)
- ✅ **9 componentes de accesibilidad** (WCAG 2.1 compliant)
- ✅ Efectos de hover y focus consistentes
- ✅ Transiciones suaves con curvas cúbicas
- ✅ Responsive design completo (móvil, tablet, desktop)
- ✅ Tema claro profesional con gradientes azul-cyan

### ⚙️ Configuración del Sistema
- ✅ Configuración General del Laboratorio
- ✅ Configuración de Informes (logo, header, footer)
- ✅ Configuración de Notificaciones (email, in-app)
- ✅ Configuración de Seguridad (política de contraseñas, 2FA)

## 🛠️ Tecnologías Utilizadas

### Frontend
- **Next.js 15** - Framework React con App Router
- **TypeScript** - Type safety y mejores prácticas
- **Tailwind CSS 4** - Estilos utility-first
- **shadcn/ui** - Componentes UI profesionales
- **Lucide React** - Iconos modernos y consistentes
- **Recharts** - Gráficos interactivos
- **Framer Motion** - Animaciones fluidas
- **Sonner** - Toast notifications
- **React Hook Form** - Manejo de formularios
- **Zod** - Validación de esquemas

### Backend
- **Prisma ORM** - Base de datos relacional
- **SQLite** - Base de datos ligera (fácil desarrollo)
- **NextAuth.js v4** - Autenticación y sesiones
- **API Routes** - Endpoints RESTful

### Desarrollo
- **Bun** - Runtime JavaScript ultra-rápido
- **ESLint** - Linting de código
- **TypeScript Compiler** - Verificación de tipos
- **Playwright** - Testing end-to-end

## 📁 Estructura del Proyecto

```
/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/              # Grupo de rutas de autenticación
│   │   ├── api/                 # API Routes
│   │   │   ├── audit/          # Auditoría
│   │   │   ├── auth/           # NextAuth
│   │   │   ├── dashboard/      # Stats del dashboard
│   │   │   ├── equipment/      # Calibraciones y mantenimientos
│   │   │   ├── reagents/       # Transacciones de reactivos
│   │   │   ├── results/        # Validación y generación de PDFs
│   │   │   ├── samples/        # Gestión de muestras
│   │   │   ├── tests/           # Gestión de pruebas
│   │   │   └── users/          # Gestión de usuarios
│   │   ├── audit/             # Página de auditoría
│   │   ├── dashboard/         # Página principal del dashboard
│   │   ├── dashboard/executive/ # Panel de control ejecutivo
│   │   ├── equipment/         # Gestión de equipos
│   │   ├── login/             # Página de login
│   │   ├── page.tsx           # Dashboard principal
│   │   ├── reagents/          # Inventario de reactivos
│   │   ├── results/           # Resultados e informes
│   │   ├── samples/           # Registro de muestras
│   │   ├── settings/          # Configuración del sistema
│   │   ├── tests/             # Gestión de pruebas
│   │   └── users/            # Gestión de usuarios
│   ├── components/              # Componentes React
│   │   ├── ui/                # Componentes shadcn/ui
│   │   └── ui-improved/       # Componentes mejorados (loading, empty states, etc.)
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilidades y configuraciones
│   │   ├── auth/options.ts    # Configuración NextAuth
│   │   ├── db.ts             # Cliente Prisma
│   │   └── utils.ts          # Utilidades compartidas
│   └── styles/                # Estilos globales
│       └── globals.css          # Tailwind + CSS custom
├── prisma/
│   ├── schema.prisma            # Esquema de base de datos
│   └── seed.prisma              # Datos iniciales (admin, configuración)
├── tests/
│   └── e2e/                   # Tests end-to-end (Playwright)
│       └── dashboard.spec.ts     # Tests del dashboard
├── docs/                      # Documentación
│   ├── SCRIPTS.md               # Scripts de testing y optimización
│   └── README.md                # Este archivo
├── mini-services/              # Servicios auxiliares
│   └── pdf-reports-service/   # Servicio de generación de PDFs (Bun runtime)
├── playwright.config.ts         # Configuración de Playwright
├── package.json                # Dependencias y scripts
├── tsconfig.json              # Configuración TypeScript
├── tailwind.config.ts          # Configuración Tailwind CSS
└── next.config.js             # Configuración Next.js
```

## 🚀 Scripts de NPM

### Desarrollo
```bash
bun run dev                    # Inicia servidor de desarrollo
bun run dev:fast              # Dev mode con optimizaciones
bun run dev:debug             # Dev mode con debugging
```

### Build y Producción
```bash
bun run build                  # Build de producción
bun run build:production        # Build con optimizaciones finales
bun run build:analyze          # Analiza tamaño del bundle
bun run start                  # Inicia servidor de producción
```

### Testing
```bash
bun run test:e2e               # Ejecuta tests E2E
bun run test:e2e:ui           # Abre Playwright UI
bun run test:e2e:headed        # Tests con navegador visible
bun run test:all               # Todos los tests
```

### Calidad de Código
```bash
bun run lint                   # Verifica código con ESLint
bun run lint:fix               # Auto-fix problemas
bun run type-check             # Verifica tipos de TypeScript
bun run format                 # Formatea código con Prettier
```

### Base de Datos
```bash
bun run db:generate             # Genera cliente Prisma
bun run db:migrate             # Ejecuta migraciones
bun run db:push                # Sube schema a DB
bun run db:seed                # Siembra datos iniciales
bun run db:reset               # Reseta DB (desarrollo)
bun run db:backup              # Realiza backup de DB
```

### Optimización
```bash
bun run analyze:performance     # Analiza performance
bun run analyze:bundle         # Analiza tamaño del bundle
bun run lighthouse              # Ejecuta análisis Lighthouse
bun run clean                   # Limpia cache y builds
```

### Despliegue
```bash
bun run deploy:vercel         # Despliega a Vercel
bun run deploy:netlify         # Despliega a Netlify
bun run deploy:preview          # Crea preview de producción
```

## 🔐 Credenciales Iniciales

### Admin
- **Email**: `admin@laboratorio.com`
- **Contraseña**: `Admin123!`
- **Rol**: Administrador

### Bioanalista
- **Email**: `bioanalista@laboratorio.com`
- **Contraseña**: `Bio123!`
- **Rol**: Bioanalista

### Asistente de Laboratorio
- **Email**: `asistente@laboratorio.com`
- **Contraseña**: `Asistente123!`
- **Rol**: Asistente de Laboratorio

> ⚠️ **IMPORTANTE**: Cambiar estas contraseñas en el primer inicio de sesión en producción

## 📊 Base de Datos

### Entidades Principales
- **User** - Usuarios del sistema
- **Patient** - Pacientes
- **Doctor** - Médicos
- **Sample** - Muestras
- **SampleTest** - Pruebas de muestras
- **Test** - Pruebas configuradas
- **TestParameter** - Parámetros de pruebas
- **TestResult** - Resultados de pruebas
- **Reagent** - Reactivos
- **ReagentTransaction** - Movimientos de reactivos
- **Equipment** - Equipos
- **EquipmentCalibration** - Calibraciones
- **EquipmentMaintenance** - Mantenimientos
- **AuditLog** - Auditoría de acciones
- **SystemSettings** - Configuraciones del sistema

## 📈 Panel de Control Ejecutivo

### Métricas Disponibles
- Muestras hoy y esta semana
- Muestras pendientes y urgentes
- Pruebas completadas y validadas
- Resultados críticos (requieren atención inmediata)
- Resultados positivos y negativos
- Tendencia semanal con gráfica de barras
- Distribución por tipo de muestra
- Top 5 pruebas más solicitadas

### Funciones
- Selector de rango de tiempo (Hoy, Semana, Mes)
- Actualización manual de datos
- Navegación rápida a módulos principales

## 📊 Auditoría y Trazabilidad

### Acciones Registradas
- **CREATE** - Creación de entidades
- **UPDATE** - Actualización de datos
- **DELETE** - Eliminación de registros
- **LOGIN/LOGOUT** - Sesiones de usuario
- **STOCK_IN/OUT** - Movimientos de inventario
- **CALIBRATE** - Calibraciones de equipos
- **MAINTAIN** - Mantenimientos de equipos
- **VALIDATE** - Validación de resultados
- **GENERATE** - Generación de informes PDF

### Filtros Disponibles
- Búsqueda por texto
- Filtro por tipo de acción
- Filtro por tipo de entidad
- Filtro por usuario
- Filtro por rango de fechas
- Tabs de categorías (Todas, Muestras, Pruebas, Reactivos, Equipos, Usuarios, Sistema)

### Exportación
- Exportación a CSV compatible con Excel
- BOM UTF-8 para caracteres especiales
- Filtros aplicados a exportación
- Descarga automática del archivo

## 🎨 UI/UX

### Características Visuales
- ✅ Diseño profesional y consistente
- ✅ Tema claro con gradientes azul-cyan
- ✅ Responsive design completo
- ✅ Animaciones suaves en toda la aplicación
- ✅ Transiciones fluidas
- ✅ Estados de carga visuales (skeletons, spinners)
- ✅ Estados vacíos informativos
- ✅ Feedback visual claro (hover, focus, error, success)

### Accesibilidad (WCAG 2.1)
- ✅ Skip links para navegación
- ✅ Focus visible con rings
- ✅ Live regions para actualizaciones
- ✅ Focus traps en modales
- ✅ Soporte completo de teclado
- ✅ Screen reader friendly
- ✅ ARIA attributes en todos los componentes
- ✅ Contrast ratio WCAG AA

### Performance
- ✅ Animaciones GPU-accelerated
- ✅ Optimización de bundle
- ✅ Carga diferida de componentes
- ✅ Image optimization
- ✅ Code splitting por rutas

## 📦 Despliegue

### Opciones de Despliegue

#### Vercel (Recomendado)
```bash
bun run deploy:vercel
```
- Build automático
- HTTPS automático
- CDN global
- Edge functions

#### Netlify
```bash
bun run deploy:netlify
```
- Build automático
- HTTPS automático
- Edge functions
- Preview deployments

#### Docker
```bash
# Construir imagen
docker build -t laboratorio-sistema .

# Ejecutar contenedor
docker run -p 3000:3000 laboratorio-sistema
```

#### Self-hosted (VPS/Servidor Dedicado)
```bash
# Instalar dependencias
bun install

# Build de producción
bun run build:production

# Iniciar servidor
bun run start
```

## 🧪 Testing

### E2E Tests (Playwright)
- Tests de navegación
- Tests de autenticación
- Tests de funcionalidad principal
- Tests de validación de datos
- Tests de responsive design
- Tests de accesibilidad

### Ejecutar Tests
```bash
# Todos los tests
bun run test:e2e

# UI de Playwright
bun run test:e2e:ui

# Con navegador visible
bun run test:e2e:headed
```

## 📚 Documentación Adicional

### Scripts Utilidades
Ver `docs/SCRIPTS.md` para documentación completa de:
- Scripts de testing
- Scripts de optimización
- Scripts de despliegue
- Scripts de monitoreo
- Scripts de mantenimiento

### API Documentation
```bash
# Generar documentación de Prisma
bun run docs:api

# Generar Swagger docs
bun run docs:swagger
```

## 🔧 Configuración

### Variables de Entorno (`.env.local`)
```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-secret-seguro-aqui"
```

### Configuración de Tailwind
- Colores personalizados en `tailwind.config.ts`
- Temas consistentes
- Plugins de animación
- Fuentes personalizadas

## 🐛 Solución de Problemas

### Problemas Comunes

#### Error: "No autorizado"
- Solución: Verificar credenciales
- Solución: Cerrar y volver a iniciar sesión

#### Error: "Database connection failed"
- Solución: Verificar archivo `.env`
- Solución: Ejecutar `bun run db:migrate`

#### Build falla
- Solución: Limpiar cache: `bun run clean`
- Solución: Reinstalar dependencias: `bun install`

## 📞 Soporte

Para soporte técnico o preguntas:
- Revisar la documentación en `docs/`
- Verificar logs en `dev.log` y `server.log`
- Abrir issue en el repositorio del proyecto

## 📄 Licencia

Este proyecto es propiedad del laboratorio de bioanálisis. Todos los derechos reservados.

## 🙏 Agradecimientos

- Next.js team por el excelente framework
- shadcn/ui por los componentes UI profesionales
- Prisma team por el ORM excelente
- Vercel por la plataforma de hosting

---

**Versión**: 1.0.0  
**Última Actualización**: 2025  
**Estado**: ✅ Producción Ready
