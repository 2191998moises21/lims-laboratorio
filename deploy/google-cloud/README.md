# 📚 Scripts de Despliegue en Google Cloud Platform (GCP)

## 🚀 Resumen de Scripts

Esta carpeta contiene scripts completos para desplegar el Sistema de Gestión Laboratorial en Google Cloud Platform.

### 📁 Estructura de Scripts

```
deploy/google-cloud/
├── common.sh                    # Funciones comunes de logging
├── 01-setup-gcp.sh              # Configuración inicial del proyecto
├── 02-deploy-frontend.sh        # Despliegue de Next.js Frontend
├── 03-deploy-backend.sh         # Despliegue de Next.js Backend
├── 04-deploy-database.sh        # Despliegue de PostgreSQL en Cloud SQL
├── 05-deploy-storage.sh          # Despliegue de Google Cloud Storage
├── 06-deploy-all.sh             # Despliegue completo (Orquestración)
└── README.md                     # Este archivo
```

---

## 📋 Requisitos Previos

### 🔐 Credenciales de Google Cloud
1. Crear una cuenta de Google Cloud (o usar existente)
2. Habilitar facturación en Google Cloud Platform
3. Crear un proyecto nuevo o usar uno existente

### 💻 Herramientas Requeridas
- **Google Cloud CLI (gcloud)** - Para gestionar recursos de GCP
- **gsutil** - Para gestionar Google Cloud Storage
- **Bun** - Para build y runtime
- **Node.js 20+** - Para runtime de Next.js
- **Playwright** - Para testing (opcional)

### 📥 Instalación de Dependencias

```bash
# Instalar Google Cloud CLI
curl https://sdk.cloud.google.com | bash

# Autenticar con Google Cloud
gcloud auth login

# Instalar gsutil (se instala con gcloud)
gcloud components install gsutil

# Verificar instalación
gcloud --version
gsutil --version
```

---

## 🚀 Scripts de Despliegue

### 1️⃣ 01-setup-gcp.sh - Configuración Inicial

**Propósito**: Configura un nuevo proyecto de Google Cloud Platform.

**Comandos**:
```bash
# Ejecutar con valores por defecto
./deploy/google-cloud/01-setup-gcp.sh

# Ejecutar con valores personalizados
PROJECT_ID="mi-lims-proyecto" \
ORG_ID="mi-org-id" \
BILLING_ACCOUNT="mi-cuenta-facturacion" \
./deploy/google-cloud/01-setup-gcp.sh
```

**Variables de Entorno**:
- `PROJECT_ID` - ID único del proyecto (por defecto: laboratorio-lims-TIMESTAMP)
- `PROJECT_NAME` - Nombre del proyecto
- `PROJECT_NUMBER` - Número del proyecto
- `ORG_ID` - ID de la organización (opcional)
- `BILLING_ACCOUNT` - ID de cuenta de facturación
- `AUTH_FILE` - Archivo de autenticación (google-auth.json)

**Funciones**:
- ✅ Crear nuevo proyecto en Google Cloud
- ✅ Configurar facturación
- ✅ Crear archivo de autenticación
- ✅ Habilitar APIs necesarias
- ✅ Crear bucket de almacenamiento inicial

---

### 2️⃣ 02-deploy-frontend.sh - Despliegue del Frontend

**Propósito**: Despliega el Frontend (Next.js) en Google App Engine.

**Comandos**:
```bash
# Ejecutar con valores por defecto
./deploy/google-cloud/02-deploy-frontend.sh

# Ejecutar con valores personalizados
PROJECT_ID="mi-lims-proyecto" \
REGION="us-east1" \
SERVICE_NAME="lims-frontend" \
./deploy/google-cloud/02-deploy-frontend.sh

# Con dominio personalizado
CUSTOM_DOMAIN="lims.tu-dominio.com" \
./deploy/google-cloud/02-deploy-frontend.sh
```

**Variables de Entorno**:
- `PROJECT_ID` - ID del proyecto de GCP
- `REGION` - Región de despliegue (por defecto: us-central1)
- `ZONE` - Zona de despliegue
- `SERVICE_NAME` - Nombre del servicio en App Engine
- `ENVIRONMENT` - Entorno (production)
- `APP_ENGINE_DIR` - Directorio del build de Next.js
- `CUSTOM_DOMAIN` - Dominio personalizado (opcional)

**Funciones**:
- ✅ Optimizar build para producción
- ✅ Crear app.yaml para App Engine
- ✅ Crear .gcloudignore
- ✅ Desplegar en Google App Engine
- ✅ Verificar despliegue (HTTP checks)
- ✅ Configurar dominio personalizado (opcional)

**Resultado**:
- URL del Frontend: `https://lims-frontend-dot-PROJECT_ID.appspot.com`

---

### 3️⃣ 03-deploy-backend.sh - Despliegue del Backend

**Propósito**: Despliega el Backend (Next.js API Routes) en Google Cloud Functions.

**Comandos**:
```bash
# Ejecutar con valores por defecto
./deploy/google-cloud/03-deploy-backend.sh

# Ejecutar con variables de entorno
SETUP_ENV=true \
./deploy/google-cloud/03-deploy-backend.sh
```

**Variables de Entorno**:
- `PROJECT_ID` - ID del proyecto de GCP
- `REGION` - Región de despliegue (por defecto: us-central1)
- `FUNCTION_NAME` - Nombre de la función Cloud Functions
- `SOURCE` - Directorio fuente (src/app/api)
- `RUNTIME` - Runtime de Node.js (por defecto: nodejs20)
- `SETUP_ENV` - Si se deben configurar variables de entorno

**Funciones**:
- ✅ Optimizar build para Cloud Functions
- ✅ Crear package.json para funciones
- ✅ Crear archivo de configuración
- ✅ Desplegar en Google Cloud Functions (gen2)
- ✅ Configurar CORS automáticamente
- ✅ Verificar despliegue (HTTP checks)
- ✅ Configurar variables de entorno (opcional)

**Resultado**:
- URL del Backend: `https://FUNCTION_NAME-REGION-PROJECT_ID.cloudfunctions.net`

---

### 4️⃣ 04-deploy-database.sh - Despliegue de la Base de Datos

**Propósito**: Despliega la base de datos PostgreSQL en Google Cloud SQL.

**Comandos**:
```bash
# Ejecutar con valores por defecto
./deploy/google-cloud/04-deploy-database.sh
```

**Variables de Entorno**:
- `PROJECT_ID` - ID del proyecto de GCP
- `REGION` - Región de despliegue (por defecto: us-central1)
- `ZONE` - Zona de despliegue
- `DB_NAME` - Nombre de la instancia de base de datos
- `DB_VERSION` - Versión de PostgreSQL (por defecto: POSTGRES_15)
- `TIER` - Tipo de instancia (por defecto: db-f1-micro)
- `STORAGE` - Almacenamiento en GB (por defecto: 100)
- `CONNECTOR_NAME` - Nombre del conector de VPC
- `NETWORK_NAME` - Nombre de la red VPC
- `SUBNET_NAME` - Nombre de la subred

**Funciones**:
- ✅ Crear red VPC personalizada
- ✅ Crear subred en la VPC
- ✅ Crear instancia de Google Cloud SQL
- ✅ Crear usuario de base de datos
- ✅ Crear base de datos
- ✅ Crear conector de base de datos
- ✅ Configurar reglas de firewall
- ✅ Ejecutar migraciones de Prisma
- ✅ Configurar proxy para desarrollo local
- ✅ Obtener información de conexión

**Resultado**:
- Instancia de PostgreSQL creada
- Base de datos "lims" creada
- Usuario "lims-user" creado
- Conector de VPC configurado
- Reglas de firewall configuradas
- Migraciones aplicadas

---

### 5️⃣ 05-deploy-storage.sh - Despliegue del Almacenamiento

**Propósito**: Despliega Google Cloud Storage para imágenes, documentos y assets estáticos.

**Comandos**:
```bash
# Ejecutar con valores por defecto
./deploy/google-cloud/05-deploy-storage.sh

# Con subida de assets
UPLOAD_ASSETS=true \
./deploy/google-cloud/05-deploy-storage.sh

# Con CDN habilitado
SETUP_CDN=true \
./deploy/google-cloud/05-deploy-storage.sh
```

**Variables de Entorno**:
- `PROJECT_ID` - ID del proyecto de GCP
- `REGION` - Región de despliegue (por defecto: us-central1)
- `ZONE` - Zona de despliegue
- `BUCKET_NAME` - Nombre del bucket (por defecto: PROJECT_ID-assets)
- `BUCKET_LOCATION` - Ubicación del bucket (US, EU, ASIA)
- `UPLOAD_ASSETS` - Si se deben subir los assets estáticos
- `SETUP_CDN` - Si se debe configurar Cloud CDN

**Funciones**:
- ✅ Crear bucket de almacenamiento
- ✅ Configurar CORS para el bucket
- ✅ Configurar ciclo de vida (30 días para archivos temporales)
- ✅ Configurar versioning del bucket
- ✅ Crear carpetas necesarias (assets, images, documents, pdfs, backups, temp)
- ✅ Subir assets estáticos (opcional)
- ✅ Configurar Cloud CDN (opcional)
- ✅ Crear URL firmada para uploads

**Resultado**:
- Bucket de almacenamiento creado
- Carpetas de almacenamiento creadas
- Assets subidos (si se habilitó)
- CDN configurado (si se habilitó)
- URLs de almacenamiento generadas

---

### 6️⃣ 06-deploy-all.sh - Despliegue Completo (Orquestración)

**Propósito**: Despliega todo el sistema (Frontend, Backend, Base de Datos, Storage) en Google Cloud Platform.

**Comandos**:
```bash
# Desplegar todo con valores por defecto
./deploy/google-cloud/06-deploy-all.sh

# Desplegar solo frontend y backend
DEPLOY_DATABASE=false \
DEPLOY_STORAGE=false \
./deploy/google-cloud/06-deploy-all.sh

# Desplegar sin ejecutar tests
RUN_TESTS=false \
./deploy/google-cloud/06-deploy-all.sh

# Saltar migraciones de base de datos
SKIP_MIGRATIONS=true \
./deploy/google-cloud/06-deploy-all.sh
```

**Variables de Entorno**:
- `PROJECT_ID` - ID del proyecto de GCP
- `REGION` - Región de despliegue
- `DEPLOY_FRONTEND` - Si se debe desplegar el frontend (por defecto: true)
- `DEPLOY_BACKEND` - Si se debe desplegar el backend (por defecto: true)
- `DEPLOY_DATABASE` - Si se debe desplegar la base de datos (por defecto: true)
- `DEPLOY_STORAGE` - Si se debe desplegar el almacenamiento (por defecto: true)
- `RUN_TESTS` - Si se deben ejecutar los tests E2E (por defecto: true)
- `SKIP_MIGRATIONS` - Si se deben saltar las migraciones de base de datos (por defecto: false)

**Funciones**:
- ✅ Verificar todas las dependencias
- ✅ Verificar proyecto y autenticación
- ✅ Build de producción optimizado
- ✅ Desplegar Frontend en Google App Engine
- ✅ Desplegar Backend en Google Cloud Functions
- ✅ Desplegar Base de Datos en Google Cloud SQL
- ✅ Desplegar Almacenamiento en Google Cloud Storage
- ✅ Ejecutar tests E2E (si está habilitado)
- ✅ Verificar despliegue completo
- ✅ Mostrar resumen final
- ✅ Mostrar comandos útiles

**Resultado**:
- Frontend desplegado en Google App Engine
- Backend desplegado en Google Cloud Functions
- Base de datos PostgreSQL en Google Cloud SQL
- Almacenamiento en Google Cloud Storage
- Tests E2E ejecutados (si está habilitado)
- URLs de todos los servicios generadas

---

## 🔧 Variables de Entorno Comunes

### Para Todos los Scripts
```bash
# ID del proyecto
export PROJECT_ID="laboratorio-lims-$(date +%s)"

# Región de despliegue
export REGION="us-central1"
export ZONE="us-central1-a"

# Configuración de facturación
export BILLING_ACCOUNT="tu-cuenta-facturacion"

# Organización (opcional)
export ORG_ID="tu-org-id"
```

### Configuración de Producción
```bash
# Variables de entorno para producción
export NODE_ENV="production"
export NEXTAUTH_URL="https://lims-frontend-dot-$PROJECT_ID.appspot.com"
export DATABASE_URL="postgresql://usuario:password@IP:5432/lims?sslmode=require"
```

---

## 🚀 Flujo de Despliegue Completo

### Paso 1: Configuración Inicial
```bash
# 1. Dar permisos de ejecución a los scripts
chmod +x deploy/google-cloud/*.sh

# 2. Configurar el proyecto
cd deploy/google-cloud
./01-setup-gcp.sh
```

### Paso 2: Despliegue de Servicios
```bash
# Opción A: Despliegue completo automático
./06-deploy-all.sh

# Opción B: Despliegue manual paso a paso
./02-deploy-frontend.sh
./03-deploy-backend.sh
./04-deploy-database.sh
./05-deploy-storage.sh
```

### Paso 3: Verificación y Post-Despliegue
```bash
# Verificar estado de todos los servicios
gcloud app services list --project=$PROJECT_ID
gcloud functions list --project=$PROJECT_ID
gcloud sql instances list --project=$PROJECT_ID
gsutil ls gs://$PROJECT_ID-assets

# Ver logs de cada servicio
gcloud app logs tail --project=$PROJECT_ID
gcloud functions logs read lims-backend --region=$REGION --project=$PROJECT_ID
gcloud sql instances logs tail lims-database --project=$PROJECT_ID
```

---

## 📊 Arquitectura de Despliegue en GCP

### Componentes del Sistema en GCP

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                    │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│   Frontend    │  │     Backend      │  │   Database    │  │   Storage     │
│   (App Engine)│  │ (Cloud Functions)│  │  (Cloud SQL)  │  │ (Cloud Storage)│
└──────────────┘  └──────────────────┘  └──────────────┘  └──────────────┘
       │                   │                   │                   │
       │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Sistema Completo   │
              │   de Gestión         │
              │   Laboratorial        │
              └────────────────────────┘
```

### Especificaciones de Recursos

**Frontend (Google App Engine)**:
- Runtime: Node.js 20
- Instancias: F2 (1GB RAM, 2.4 GHz CPU)
- Escalado: 1-10 instancias automáticas
- Tiempo de espera: 120 segundos para escalar abajo
- Target CPU: 60%
- Concurrent Requests: 10 por instancia

**Backend (Google Cloud Functions)**:
- Runtime: Node.js 20
- Memoria: 512MB por instancia
- Timeout: 540 segundos (9 minutos)
- Instancias: 0-10 (sin servidor mínimo, scale-to-zero)
- Trigger: HTTP (gen2)
- Permisos: allow-unauthenticated

**Base de Datos (Google Cloud SQL)**:
- Motor: PostgreSQL 15
- Tier: db-f1-micro (1 vCPU, 614 MB RAM)
- Storage: 100 GB SSD
- Región: us-central1
- Disponibilidad: Regional
- Backups: Habilitados (retención de 7 días)
- Logs binarios: Habilitados (retención de 7 días)
- Ventana de mantenimiento: Domingo 3:00 AM - 4:00 AM

**Almacenamiento (Google Cloud Storage)**:
- Región: us-central1
- Clase de almacenamiento: Standard
- Ciclo de vida: 30 días para archivos temporales
- Versióning: Habilitado
- CDN: Cloud CDN (opcional)
- CORS: Habilitado para dominios * (configurable)

---

## 💻 Costos Estimados (Google Cloud Platform)

### Costos Mensuales Estimados

**Frontend (App Engine)**:
- F2 Instancia (1GB RAM): ~$20.55/mes
- 10 instancias promedio: ~$205.50/mes
- Escalado automático: Incluido
- **Total Frontend**: ~$205.50/mes

**Backend (Cloud Functions)**:
- 512MB memoria: $0.0000025/invocación * 100ms
- Requests: $0.40/millón (si > 2M)
- Tiempo de CPU: $10.00/segundo
- **Total Backend**: ~$20-50/mes (carga media)

**Base de Datos (Cloud SQL)**:
- db-f1-micro: $8.83/mes
- 100 GB storage: $20.00/mes ($0.20/GB)
- Backups: Incluido
- Logs binarios: Incluido
- **Total Base de Datos**: ~$28.83/mes

**Almacenamiento (Cloud Storage)**:
- 100 GB storage: $2.00/mes ($0.02/GB)
- Operaciones A: $0.004 por 10,000
- Operaciones B: $0.05 por 10,000
- **Total Almacenamiento**: ~$2-5/mes (carga media)

**TOTAL ESTIMADO**: ~$256-289/mes (carga alta)

> ⚠️ **IMPORTANTE**: Estos son costos estimados. Los costos reales pueden variar según el uso.
> 
> Para reducir costos:
> - Reducir instancias de App Engine a 1-3
> - Usar tier más pequeño de base de datos
> - Optimizar uso de almacenamiento
> - Usar escalado automático agresivo para backend

---

## 🔧 Configuración de Entorno Local

### .env.local para Desarrollo Local con GCP

```env
# Database
DATABASE_URL="postgresql://lims-user:password@IP:5432/lims?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-secret-local-aqui"

# API URLs
NEXT_PUBLIC_API_URL="http://localhost:3000/api"

# Storage
NEXT_PUBLIC_STORAGE_URL="https://storage.googleapis.com/PROJECT_ID-assets"
NEXT_PUBLIC_BUCKET_NAME="PROJECT_ID-assets"
```

### .env.production para Producción en GCP

```env
# Database (Google Cloud SQL)
DATABASE_URL="postgresql://lims-user:password@IP:5432/lims?sslmode=require"

# NextAuth (Google App Engine)
NEXTAUTH_URL="https://lims-frontend-dot-PROJECT_ID.appspot.com"
NEXTAUTH_SECRET="tu-secret-produccion-aqui"

# API URLs (Google Cloud Functions)
NEXT_PUBLIC_API_URL="https://lims-backend-REGION-PROJECT_ID.cloudfunctions.net"

# Storage (Google Cloud Storage)
NEXT_PUBLIC_STORAGE_URL="https://storage.googleapis.com/PROJECT_ID-assets"
NEXT_PUBLIC_BUCKET_NAME="PROJECT_ID-assets"
```

---

## 🔍 Troubleshooting

### Problema: Error de autenticación de GCP
**Solución**:
```bash
# Reautenticar
gcloud auth login

# Verificar autenticación activa
gcloud auth list
```

### Problema: No se puede conectar a la base de datos
**Solución**:
```bash
# Verificar estado de la instancia
gcloud sql instances describe lims-database --project=$PROJECT_ID

# Verificar reglas de firewall
gcloud compute firewall-rules list --project=$PROJECT_ID

# Conectar directamente
gcloud sql connect lims-database --project=$PROJECT_ID --user=lims-user
```

### Problema: Error de despliegue en App Engine
**Solución**:
```bash
# Verificar logs de deployment
gcloud app logs tail --project=$PROJECT_ID

# Verificar versiones
gcloud app versions list --project=$PROJECT_ID

# Desplegar nueva versión
gcloud app deploy .next/standalone --project=$PROJECT_ID --version=v$(date +%s)
```

### Problema: Error de Cloud Functions
**Solución**:
```bash
# Verificar logs de función
gcloud functions logs read lims-backend --region=$REGION --project=$PROJECT_ID --limit=20

# Verificar descripción de función
gcloud functions describe lims-backend --region=$REGION --project=$PROJECT_ID
```

### Problema: Build falla
**Solución**:
```bash
# Limpiar cache y rebuild
bun run clean
bun run build:production

# Verificar logs de build
bun run build:production 2>&1 | tee build.log
```

---

## 📚 Documentación Adicional

### Documentación de Google Cloud Platform
- [Google Cloud Platform Console](https://console.cloud.google.com/)
- [Google App Engine Documentation](https://cloud.google.com/appengine/docs)
- [Google Cloud Functions Documentation](https://cloud.google.com/functions/docs)
- [Google Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Google Cloud Storage Documentation](https://cloud.google.com/storage/docs)

### Comandos Útiles de gcloud
```bash
# Ver todos los proyectos
gcloud projects list

# Cambiar proyecto activo
gcloud config set project PROJECT_ID

# Ver información del proyecto
gcloud project describe PROJECT_ID

# Ver todas las facturas
gcloud alpha billing accounts list
gcloud alpha billing invoices list --billing-account=ACCOUNT_ID

# Ver costos
gcloud billing budgets describe --billing-account=ACCOUNT_ID
```

### Comandos Útiles de gsutil
```bash
# Listar todos los buckets
gsutil ls

# Copiar archivo a bucket
gsutil cp archivo.txt gs://bucket/archivo.txt

# Descargar archivo de bucket
gsutil cp gs://bucket/archivo.txt archivo.txt

# Sincronizar directorio local
gsutil -m rsync -r directorio/ gs://bucket/directorio/

# Ver tamaño de bucket
gsutil du -sh gs://bucket
```

---

## 🎉 Despliegue Exitoso

Después de ejecutar el despliegue completo, el sistema estará disponible en:

**Frontend**: `https://lims-frontend-dot-PROJECT_ID.appspot.com`
**Backend**: `https://lims-backend-us-central1-PROJECT_ID.cloudfunctions.net`
**Database**: PostgreSQL en Google Cloud SQL (conexión via VPC)
**Storage**: `https://storage.googleapis.com/PROJECT_ID-assets`

### Próximos Pasos:

1. **Configurar dominio personalizado** (opcional)
2. **Monitorear costos** en Google Cloud Console
3. **Configurar alerts de facturación**
4. **Establecer políticas de seguridad**
5. **Configurar backups automáticos**
6. **Implementar CI/CD** (opcional)

---

## 📞 Soporte

Para problemas o preguntas sobre el despliegue en Google Cloud Platform:

1. Revisar [Documentación de GCP](https://cloud.google.com/docs)
2. Verificar logs de cada servicio
3. Revisar Stackdriver Monitoring
4. Abrir ticket de soporte en Google Cloud Console

---

**Última Actualización**: 2025  
**Versión**: 1.0.0  
**Estado**: ✅ Producción Ready
