#!/bin/bash

# =============================================================================
# SCRIPT 6: DESPLIEGUE COMPLETO DEL SISTEMA (ORQUESTRACIÓN)
# =============================================================================

set -e

# Cargar funciones comunes
source "$(dirname "$0")/common.sh"

# Configuración por defecto
PROJECT_ID="laboratorio-lims-$(date +%s)"
REGION="us-central1"
ZONE="us-central1-a"
SERVICE_NAME="lims-app"
FUNCTION_NAME="lims-backend"
DB_NAME="lims-database"
BUCKET_NAME="${PROJECT_ID}-assets"
NETWORK_NAME="lims-vpc"
SUBNET_NAME="lims-subnet"
CONNECTOR_NAME="lims-connector"

# Opciones de despliegue
DEPLOY_FRONTEND=${DEPLOY_FRONTEND:-true}
DEPLOY_BACKEND=${DEPLOY_BACKEND:-true}
DEPLOY_DATABASE=${DEPLOY_DATABASE:-true}
DEPLOY_STORAGE=${DEPLOY_STORAGE:-true}
RUN_TESTS=${RUN_TESTS:-true}
SKIP_MIGRATIONS=${SKIP_MIGRATIONS:-false}

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Función de logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Función de verificación de paso
check_step() {
    if [ $? -eq 0 ]; then
        log_success "$1"
    else
        log_error "Error en: $1"
        exit 1
    fi
}

# Verificar dependencias
verify_dependencies() {
    log "============================================"
    log "VERIFICANDO DEPENDENCIAS"
    log "============================================"
    
    local deps_missing=0
    
    # Verificar Google Cloud CLI
    if ! command -v gcloud &> /dev/null; then
        log_error "Google Cloud CLI no está instalado"
        log_info "Instalar con: curl https://sdk.cloud.google.com | bash"
        deps_missing=1
    else
        log_success "Google Cloud CLI instalado"
        gcloud --version
    fi
    
    # Verificar gsutil
    if ! command -v gsutil &> /dev/null; then
        log_warning "gsutil no está instalado (se instalará con gcloud)"
    else
        log_success "gsutil instalado"
        gsutil --version
    fi
    
    # Verificar Bun
    if ! command -v bun &> /dev/null; then
        log_error "Bun no está instalado"
        log_info "Instalar con: curl -fsSL https://bun.sh/install | bash"
        deps_missing=1
    else
        log_success "Bun instalado"
        bun --version
    fi
    
    # Verificar Node
    if ! command -v node &> /dev/null; then
        log_error "Node.js no está instalado"
        deps_missing=1
    else
        log_success "Node.js instalado"
        node --version
    fi
    
    if [ $deps_missing -eq 1 ]; then
        log_error "Dependencias faltantes, por favor instálalas"
        exit 1
    fi
    
    log_success "Todas las dependencias están instaladas"
}

# Verificar proyecto y autenticación
verify_project() {
    log "============================================"
    log "VERIFICANDO PROYECTO Y AUTENTICACIÓN"
    log "============================================"
    
    # Verificar que el proyecto existe
    if ! gcloud projects describe $PROJECT_ID &> /dev/null; then
        log_error "El proyecto $PROJECT_ID no existe"
        log_info "Ejecutar: ./01-setup-gcp.sh"
        exit 1
    fi
    
    log_success "Proyecto verificado: $PROJECT_ID"
    
    # Verificar autenticación
    gcloud auth list 2>&1 | grep -q "active account"
    if [ $? -ne 0 ]; then
        log_warning "No hay sesión activa en Google Cloud"
        log_info "Autenticando..."
        gcloud auth login
    else
        log_success "Autenticación verificada"
    fi
}

# Verificar que el proyecto existe
check_project() {
    log "Verificando proyecto..."
    
    if ! gcloud projects describe $PROJECT_ID &> /dev/null; then
        log_error "El proyecto $PROJECT_ID no existe"
        log_info "Ejecutar: ./01-setup-gcp.sh"
        exit 1
    fi
    
    log_success "Proyecto verificado: $PROJECT_ID"
}

# Build de producción
production_build() {
    log "============================================"
    log "BUILD DE PRODUCCIÓN"
    log "============================================"
    
    # Limpiar builds anteriores
    log "Limpiando builds anteriores..."
    rm -rf .next out node_modules/.cache
    
    # Build optimizado
    log "Construyendo aplicación optimizada para producción..."
    NODE_ENV=production bun run build:production
    
    check_step "Build de producción completado"
}

# Desplegar Frontend
deploy_frontend() {
    if [ "$DEPLOY_FRONTEND" != "true" ]; then
        log_warning "Saltando despliegue de frontend (DEPLOY_FRONTEND=false)"
        return 0
    fi
    
    log "============================================"
    log "DESPLIEGANDO FRONTEND (NEXT.JS)"
    log "============================================"
    
    # Crear configuración de App Engine
    cat > app.yaml << EOF
runtime: nodejs20
env: standard
instance_class: F2

manual_scaling:
  min_instances: 1
  max_instances: 10
  cool_down_period: 120s

handlers:
  - url: /.*
    script: auto
    secure: always

env_variables:
  NODE_ENV: production
  PORT: 3000
  DATABASE_URL: \${DATABASE_URL}
  NEXTAUTH_URL: \${NEXTAUTH_URL}
  NEXTAUTH_SECRET: \${NEXTAUTH_SECRET}

automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.6
  target_concurrent_requests: 10
EOF
    
    # Desplegar
    log "Desplegando en Google App Engine..."
    gcloud app deploy .next/standalone \
        --project=$PROJECT_ID \
        --region=$REGION \
        --version=$(date +%s) \
        --promote \
        --quiet
    
    check_step "Frontend desplegado"
    
    # Verificar despliegue
    log "Verificando despliegue de frontend..."
    SERVICE_URL="https://$SERVICE_NAME-dot-$PROJECT_ID.appspot.com"
    
    sleep 5
    
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $SERVICE_URL)
    
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
        log_success "Frontend verificado: $SERVICE_URL"
    else
        log_warning "Frontend desplegado pero puede estar iniciándose (HTTP $HTTP_STATUS)"
        log_info "Verificar logs: gcloud app logs tail --project=$PROJECT_ID"
    fi
}

# Desplegar Backend (API Routes)
deploy_backend() {
    if [ "$DEPLOY_BACKEND" != "true" ]; then
        log_warning "Saltando despliegue de backend (DEPLOY_BACKEND=false)"
        return 0
    fi
    
    log "============================================"
    log "DESPLIEGANDO BACKEND (NEXT.JS API ROUTES)"
    log "============================================"
    
    # Verificar directorio de API
    if [ ! -d "src/app/api" ]; then
        log_error "Directorio de API no encontrado"
        return 1
    fi
    
    # Crear archivo package.json para Cloud Functions
    cat > package-functions.json << 'EOF'
{
  "name": "lims-backend",
  "version": "1.0.0",
  "description": "Backend del Sistema de Gestión Laboratorial",
  "main": "index.js",
  "scripts": {
    "start": "functions-framework --target=nextjs12"
  },
  "dependencies": {
    "next": "^15.3.5",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^6.11.1",
    "bcryptjs": "^3.0.3",
    "next-auth": "^4.24.11",
    "date-fns": "^4.1.0",
    "zod": "^4.0.2",
    "zustand": "^5.0.6"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
EOF
    
    # Desplegar en Google Cloud Functions
    log "Desplegando en Google Cloud Functions..."
    gcloud functions deploy $FUNCTION_NAME \
        --gen2 \
        --runtime=nodejs20 \
        --region=$REGION \
        --memory=512MB \
        --timeout=540s \
        --max-instances=10 \
        --min-instances=0 \
        --source=src/app/api \
        --trigger-http \
        --entry-point=server \
        --project=$PROJECT_ID \
        --allow-unauthenticated \
        --quiet
    
    check_step "Backend desplegado"
    
    # Obtener URL
    FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME \
        --region=$REGION \
        --project=$PROJECT_ID \
        --format="value(httpsTrigger.url)")
    
    log_success "Backend URL: $FUNCTION_URL"
}

# Desplegar Base de Datos
deploy_database() {
    if [ "$DEPLOY_DATABASE" != "true" ]; then
        log_warning "Saltando despliegue de base de datos (DEPLOY_DATABASE=false)"
        return 0
    fi
    
    log "============================================"
    log "DESPLIEGANDO BASE DE DATOS (GOOGLE CLOUD SQL)"
    log "============================================"
    
    # Verificar si la instancia ya existe
    if gcloud sql instances describe $DB_NAME --project=$PROJECT_ID &> /dev/null 2>&1; then
        log_warning "La instancia de base de datos ya existe: $DB_NAME"
        log_info "Para recrear, ejecutar: gcloud sql instances delete $DB_NAME --project=$PROJECT_ID"
        log_info "Saltando creación de base de datos"
        return 0
    fi
    
    # Crear instancia de Cloud SQL
    log "Creando instancia de Google Cloud SQL..."
    gcloud sql instances create $DB_NAME \
        --project=$PROJECT_ID \
        --tier=db-f1-micro \
        --database-version=POSTGRES_15 \
        --region=$REGION \
        --storage=100 \
        --availability-type=regional \
        --root-password=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16) \
        --backup \
        --enable-bin-log \
        --bin-log-retention=7 \
        --maintenance-window-day=1 \
        --maintenance-window-hour=3
    
    log_success "Instancia creada: $DB_NAME"
    
    # Esperar que la instancia esté lista
    log "Esperando que la instancia esté lista (puede tardar unos minutos)..."
    gcloud sql instances wait $DB_NAME --project=$PROJECT_ID --timeout=600
    
    # Crear base de datos y usuario
    log "Creando base de datos y usuario..."
    gcloud sql databases create lims --instance=$DB_NAME --project=$PROJECT_ID
    gcloud sql users create lims-user --instance=$DB_NAME --project=$PROJECT_ID --password=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    log_success "Base de datos creada"
    
    # Obtener IP de la instancia
    DB_IP=$(gcloud sql instances describe $DB_NAME --project=$PROJECT_ID --format="value(ipAddresses[0].ipAddress)")
    
    # Ejecutar migraciones
    if [ "$SKIP_MIGRATIONS" != "true" ]; then
        log "Ejecutando migraciones de Prisma..."
        
        # Configurar DATABASE_URL temporal
        export DATABASE_URL="postgresql://lims-user:$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)@${DB_IP}:5432/lims?sslmode=require"
        
        # Generar cliente Prisma
        log "Generando cliente Prisma..."
        bun run db:generate
        
        # Aplicar migraciones
        log "Aplicando migraciones..."
        bun run db:push
        
        check_step "Migraciones aplicadas"
    else
        log_warning "Saltando migraciones (SKIP_MIGRATIONS=true)"
    fi
    
    # Guardar credenciales de DB (¡CUIDADO! No hacer commit al repositorio)
    cat > .env.production << EOF
DATABASE_URL="postgresql://lims-user:$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)@${DB_IP}:5432/lims?sslmode=require"
NEXTAUTH_URL=https://$SERVICE_NAME-dot-$PROJECT_ID.appspot.com
NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
EOF
    
    log_warning "⚠️  IMPORTANTE: Archivo .env.production creado con credenciales de DB"
    log_warning "⚠️  NUNCA hacer commit de .env.production al control de versiones"
    log_warning "⚠️  Agregar .env.production a .gitignore"
    
    log_success "Base de datos configurada"
}

# Desplegar Almacenamiento
deploy_storage() {
    if [ "$DEPLOY_STORAGE" != "true" ]; then
        log_warning "Saltando despliegue de almacenamiento (DEPLOY_STORAGE=false)"
        return 0
    fi
    
    log "============================================"
    log "DESPLIEGANDO ALMACENAMIENTO (GOOGLE CLOUD STORAGE)"
    log "============================================"
    
    # Verificar si el bucket ya existe
    if gsutil ls gs://$BUCKET_NAME &> /dev/null 2>&1; then
        log_warning "El bucket ya existe: $BUCKET_NAME"
        log_info "Para recrear, ejecutar: gsutil rm -r gs://$BUCKET_NAME"
        log_info "Saltando creación de bucket"
    else
        # Crear bucket
        log "Creando bucket de almacenamiento..."
        gsutil mb -p $BUCKET_NAME -l $REGION
        
        # Configurar CORS
        cat > cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "responseHeader": ["Content-Type"],
    "method": ["GET", "HEAD", "OPTIONS"],
    "maxAgeSeconds": 3600
  }
]
EOF
        
        gsutil cors set cors.json gs://$BUCKET_NAME
        
        # Configurar ciclo de vida
        cat > lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [{
      "action": {
        "type": "Delete"
      },
      "condition": {
        "age": 30,
        "matchesStorageClass": "NEARLINE"
      }
    }]
  }
}
EOF
        
        gsutil lifecycle set lifecycle.json gs://$BUCKET_NAME
        
        check_step "Bucket creado"
    fi
    
    # Crear carpetas
    log "Creando carpetas en bucket..."
    gsutil mb -p $BUCKET_NAME/assets 2>/dev/null || true
    gsutil mb -p $BUCKET_NAME/images 2>/dev/null || true
    gsutil mb -p $BUCKET_NAME/documents 2>/dev/null || true
    gsutil mb -p $BUCKET_NAME/pdfs 2>/dev/null || true
    gsutil mb -p $BUCKET_NAME/backups 2>/dev/null || true
    gsutil mb -p $BUCKET_NAME/temp 2>/dev/null || true
    
    # Subir assets estáticos
    log "Subiendo assets estáticos..."
    if [ -d "public" ]; then
        gsutil -m rs -r -d public gs://$BUCKET_NAME/assets/
    elif [ -d "out" ]; then
        gsutil -m rs -r -d out gs://$BUCKET_NAME/assets/
    fi
    
    # Hacer públicos los assets
    log "Configurando permisos públicos..."
    gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME/assets/**
    
    log_success "Almacenamiento desplegado"
    log_info "Bucket: gs://$BUCKET_NAME"
    log_info "URL: https://storage.googleapis.com/$BUCKET_NAME"
}

# Ejecutar tests end-to-end
run_e2e_tests() {
    if [ "$RUN_TESTS" != "true" ]; then
        log_warning "Saltando tests E2E (RUN_TESTS=false)"
        return 0
    fi
    
    log "============================================"
    log "EJECUTANDO TESTS END-TO-END"
    log "============================================"
    
    # Verificar que Playwright está instalado
    if ! command -v npx playwright &> /dev/null; then
        log_error "Playwright no está instalado"
        log_info "Instalar con: bun install -D @playwright/test"
        return 1
    fi
    
    # Ejecutar tests
    log "Ejecutando tests E2E..."
    bun run test:e2e:chromium
    
    if [ $? -eq 0 ]; then
        log_success "Todos los tests E2E pasaron"
    else
        log_error "Algunos tests E2E fallaron"
        log_info "Ver reporte: bun run test:e2e:report"
    fi
}

# Verificar despliegue completo
verify_deployment() {
    log "============================================"
    log "VERIFICANDO DESPLIEGUE COMPLETO"
    log "============================================"
    
    SERVICE_URL="https://$SERVICE_NAME-dot-$PROJECT_ID.appspot.com"
    
    # Verificar frontend
    log "Verificando Frontend..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $SERVICE_URL)
    
    if [ "$HTTP_STATUS" = "200" ]; then
        log_success "Frontend: OK ($SERVICE_URL)"
    else
        log_warning "Frontend: HTTP $HTTP_STATUS (puede estar iniciándose)"
    fi
    
    # Verificar backend
    if [ "$DEPLOY_BACKEND" = "true" ]; then
        log "Verificando Backend..."
        FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME \
            --region=$REGION \
            --project=$PROJECT_ID \
            --format="value(httpsTrigger.url)")
        
        BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $FUNCTION_URL)
        
        if [ "$BACKEND_STATUS" = "200" ]; then
            log_success "Backend: OK ($FUNCTION_URL)"
        else
            log_warning "Backend: HTTP $BACKEND_STATUS (puede estar iniciándose)"
        fi
    fi
    
    # Verificar almacenamiento
    if [ "$DEPLOY_STORAGE" = "true" ]; then
        log "Verificando Almacenamiento..."
        if gsutil ls gs://$BUCKET_NAME &> /dev/null 2>&1; then
            log_success "Almacenamiento: OK (gs://$BUCKET_NAME)"
        else
            log_error "Almacenamiento: ERROR"
        fi
    fi
    
    # Verificar base de datos
    if [ "$DEPLOY_DATABASE" = "true" ]; then
        log "Verificando Base de Datos..."
        DB_STATE=$(gcloud sql instances describe $DB_NAME --project=$PROJECT_ID --format="value(state)" 2>&1)
        
        if echo "$DB_STATE" | grep -q "RUNNABLE"; then
            log_success "Base de Datos: OK ($DB_NAME)"
        else
            log_warning "Base de Datos: $DB_STATE"
        fi
    fi
}

# Mostrar resumen
show_summary() {
    log ""
    log "============================================"
    log "RESUMEN DEL DESPLIEGUE"
    log "============================================"
    log ""
    
    echo "🌟 Proyecto: $PROJECT_ID"
    echo "🌟 Región: $REGION"
    echo ""
    
    if [ "$DEPLOY_FRONTEND" = "true" ]; then
        echo "✅ Frontend (App Engine):"
        echo "   URL: https://$SERVICE_NAME-dot-$PROJECT_ID.appspot.com"
        echo "   Runtime: Node.js 20"
        echo "   Instancias: F2 (1-10)"
        echo ""
    fi
    
    if [ "$DEPLOY_BACKEND" = "true" ]; then
        echo "✅ Backend (Cloud Functions):"
        FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME \
            --region=$REGION \
            --project=$PROJECT_ID \
            --format="value(httpsTrigger.url)")
        echo "   URL: $FUNCTION_URL"
        echo "   Runtime: Node.js 20"
        echo "   Memoria: 512MB"
        echo "   Timeout: 540s"
        echo "   Instancias: 0-10"
        echo ""
    fi
    
    if [ "$DEPLOY_DATABASE" = "true" ]; then
        echo "✅ Base de Datos (Cloud SQL):"
        echo "   Instancia: $DB_NAME"
        echo "   Versión: PostgreSQL 15"
        echo "   Tier: db-f1-micro"
        echo "   Storage: 100 GB"
        echo "   Región: $REGION"
        echo ""
    fi
    
    if [ "$DEPLOY_STORAGE" = "true" ]; then
        echo "✅ Almacenamiento (Cloud Storage):"
        echo "   Bucket: gs://$BUCKET_NAME"
        echo "   URL: https://storage.googleapis.com/$BUCKET_NAME"
        echo "   Región: $REGION"
        echo ""
    fi
    
    echo "============================================"
    echo "🎮 COMANDOS ÚTILES:"
    echo "============================================"
    echo ""
    echo "Frontend:"
    echo "  gcloud app logs tail --project=$PROJECT_ID"
    echo "  gcloud app instances list --project=$PROJECT_ID"
    echo "  gcloud app versions list --project=$PROJECT_ID"
    echo "  gcloud app browse --project=$PROJECT_ID"
    echo ""
    
    echo "Backend:"
    echo "  gcloud functions logs read $FUNCTION_NAME --region=$REGION --project=$PROJECT_ID"
    echo "  gcloud functions describe $FUNCTION_NAME --region=$REGION --project=$PROJECT_ID"
    echo "  gcloud functions metrics list --filter=$FUNCTION_NAME"
    echo ""
    
    echo "Base de Datos:"
    echo "  gcloud sql connect $DB_NAME --project=$PROJECT_ID"
    echo "  gcloud sql instances describe $DB_NAME --project=$PROJECT_ID"
    echo "  gcloud sql instances logs tail $DB_NAME --project=$PROJECT_ID"
    echo "  gcloud sql backups list --instance=$DB_NAME --project=$PROJECT_ID"
    echo ""
    
    echo "Almacenamiento:"
    echo "  gsutil ls -R gs://$BUCKET_NAME"
    echo "  gsutil du -sh gs://$BUCKET_NAME"
    echo "  gsutil cors get gs://$BUCKET_NAME"
    echo ""
    
    echo "General:"
    echo "  gcloud info"
    echo "  gcloud config list"
    echo "  gsutil config list"
    echo ""
    
    echo "============================================"
    echo "⚠️  IMPORTANTE:"
    echo "============================================"
    echo ""
    echo "1. Las credenciales de la base de datos están en .env.production"
    echo "2. NUNCA hacer commit de .env.production al repositorio"
    echo "3. Agregar .env.production a .gitignore"
    echo "4. La primera carga puede tardar unos minutos (cold start)"
    echo "5. Verificar logs si hay errores"
    echo "6. Monitorear instancias y costos en Google Cloud Console"
    echo ""
}

# Función principal
main() {
    log "============================================"
    log "INICIANDO DESPLIEGUE COMPLETO EN GOOGLE CLOUD"
    log "============================================"
    log ""
    
    log_info "Información del Proyecto:"
    echo "  ID: $PROJECT_ID"
    echo "  Región: $REGION"
    echo "  Zona: $ZONE"
    echo ""
    
    log_info "Opciones de Despliegue:"
    echo "  Frontend: $DEPLOY_FRONTEND"
    echo "  Backend: $DEPLOY_BACKEND"
    echo "  Base de Datos: $DEPLOY_DATABASE"
    echo "  Almacenamiento: $DEPLOY_STORAGE"
    echo "  Tests: $RUN_TESTS"
    echo "  Migraciones: $([ "$SKIP_MIGRATIONS" != "true" ] && echo "Ejecutar" || echo "Saltar")"
    echo ""
    
    # Verificar dependencias
    verify_dependencies
    
    # Verificar proyecto
    check_project
    
    # Build de producción
    production_build
    
    # Desplegar servicios
    deploy_frontend
    deploy_backend
    deploy_database
    deploy_storage
    
    # Ejecutar tests (si está habilitado)
    if [ "$RUN_TESTS" = "true" ]; then
        run_e2e_tests
    fi
    
    # Verificar despliegue completo
    verify_deployment
    
    # Mostrar resumen
    show_summary
    
    log ""
    log_success "============================================"
    log_success "DESPLIEGUE COMPLETO FINALIZADO"
    log_success "============================================"
    log ""
    log_info "🎉 El sistema está desplegado en Google Cloud Platform"
    log ""
}

# Ejecutar función principal
main "$@"
