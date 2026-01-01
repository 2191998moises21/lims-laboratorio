#!/bin/bash

# =============================================================================
# SCRIPT 2: DESPLIEGUE DE FRONTEND EN GOOGLE APP ENGINE
# =============================================================================

set -e

# Cargar funciones comunes
source "$(dirname "$0")/common.sh"

# Configuración por defecto
PROJECT_ID="laboratorio-lims-$(date +%s)"
REGION="us-central1"
ZONE="us-central1-a"
SERVICE_NAME="lims-frontend"
ENVIRONMENT="production"
APP_ENGINE_DIR=".next/standalone"

# Verificar dependencias
check_dependencies() {
    log "Verificando dependencias..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "Google Cloud CLI no está instalado"
        log_info "Instalar con: curl https://sdk.cloud.google.com | bash"
        exit 1
    fi
    
    log_success "Dependencias verificadas"
}

# Verificar que el proyecto existe
check_project() {
    log "Verificando proyecto..."
    
    if ! gcloud projects describe $PROJECT_ID &> /dev/null; then
        log_error "El proyecto $PROJECT_ID no existe"
        log_info "Ejecutar primero: ./01-setup-gcp.sh"
        exit 1
    fi
    
    log_success "Proyecto verificado: $PROJECT_ID"
}

# Optimizar build para producción
optimize_build() {
    log "Optimizando build para producción..."
    
    # Limpiar builds anteriores
    log "Limpiando builds anteriores..."
    rm -rf .next out node_modules/.cache
    
    # Build de producción
    log "Construyendo aplicación de producción..."
    NODE_ENV=production bun run build:production
    
    log_success "Build optimizado completado"
}

# Crear app.yaml para Google App Engine
create_app_yaml() {
    log "Creando configuración app.yaml..."
    
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

automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.6
  target_concurrent_requests: 10
EOF
    
    log_success "app.yaml creado"
}

# Crear .gcloudignore
create_gcloudignore() {
    log "Creando .gcloudignore..."
    
    cat > .gcloudignore << EOF
# Dependencies
node_modules
npm-debug.log
yarn-error.log

# Build artifacts
.next
out
dist
build

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs
dev.log
server.log

# Deployment
.deploy
.git
.gitignore

# Testing
coverage
.nyc_output
__tests__
tests

# Docs
docs
EOF
    
    log_success ".gcloudignore creado"
}

# Desplegar en Google App Engine
deploy_to_appengine() {
    log "Desplegando en Google App Engine..."
    
    # Verificar que el directorio de build existe
    if [ ! -d "$APP_ENGINE_DIR" ]; then
        log_error "Directorio de build no encontrado: $APP_ENGINE_DIR"
        log_info "Ejecutar primero: bun run build:production"
        exit 1
    fi
    
    # Desplegar
    log_info "Iniciando despliegue..."
    gcloud app deploy $APP_ENGINE_DIR \
        --project=$PROJECT_ID \
        --region=$REGION \
        --version=$(date +%s) \
        --promote \
        --quiet
    
    log_success "Despliegue completado"
}

# Verificar despliegue
verify_deployment() {
    log "Verificando despliegue..."
    
    # Esperar unos segundos para que el despliegue esté listo
    log "Esperando que el servicio esté listo..."
    sleep 10
    
    # Verificar el servicio
    SERVICE_URL="https://$SERVICE_NAME-dot-$PROJECT_ID.appspot.com"
    
    log_info "URL del servicio: $SERVICE_URL"
    
    # Intentar hacer un request
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $SERVICE_URL)
    
    if [ "$HTTP_STATUS" = "200" ]; then
        log_success "Frontend desplegado exitosamente"
        log_info "URL: $SERVICE_URL"
    elif [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
        log_success "Frontend desplegado (redirección)"
        log_info "URL: $SERVICE_URL"
    else
        log_warning "Despliegue completado pero el servicio puede tardar en iniciarse"
        log_warning "Status HTTP: $HTTP_STATUS"
        log_info "URL: $SERVICE_URL"
        log_info "Verificar logs: gcloud app logs tail --project=$PROJECT_ID"
    fi
    
    # Mostrar comandos útiles
    echo ""
    log_info "Comandos útiles:"
    echo "  Ver logs: gcloud app logs tail --project=$PROJECT_ID"
    echo "  Ver versión: gcloud app versions describe --project=$PROJECT_ID"
    echo "  Escalar: gcloud app instances resize --project=$PROJECT_ID"
    echo "  Abrir en navegador: gcloud app browse --project=$PROJECT_ID"
}

# Configurar dominio personalizado (opcional)
configure_custom_domain() {
    if [ -n "$CUSTOM_DOMAIN" ]; then
        log "Configurando dominio personalizado: $CUSTOM_DOMAIN"
        
        # Mapear dominio
        gcloud app domain-mappings create $SERVICE_NAME \
            --project=$PROJECT_ID \
            --domain=$CUSTOM_DOMAIN
        
        log_success "Dominio personalizado configurado"
    fi
}

# Función principal
main() {
    log "============================================"
    log "DESPLIEGUE DE FRONTEND EN GOOGLE APP ENGINE"
    log "============================================"
    
    echo ""
    log_info "Configuración:"
    echo "  Proyecto: $PROJECT_ID"
    echo "  Servicio: $SERVICE_NAME"
    echo "  Región: $REGION"
    echo "  Directorio: $APP_ENGINE_DIR"
    echo ""
    
    # Verificar dependencias
    check_dependencies
    
    # Verificar proyecto
    check_project
    
    # Optimizar build
    optimize_build
    
    # Crear archivos de configuración
    create_app_yaml
    create_gcloudignore
    
    # Desplegar
    deploy_to_appengine
    
    # Verificar
    verify_deployment
    
    echo ""
    log_success "============================================"
    log_success "FRONTEND DESPLEGADO EXITOSAMENTE"
    log_success "============================================"
    echo ""
    log_info "URL: https://$SERVICE_NAME-dot-$PROJECT_ID.appspot.com"
    echo ""
    log_warning "⚠️  IMPORTANTE:"
    log_warning "1. La primera carga puede tardar unos minutos (cold start)"
    log_warning "2. Para dominio personalizado, usar: CUSTOM_DOMAIN=tu-dominio.com ./02-deploy-frontend.sh"
    log_warning "3. Verificar logs si hay errores: gcloud app logs tail --project=$PROJECT_ID"
    log_warning "4. Monitorear instancias: gcloud app instances list --project=$PROJECT_ID"
    echo ""
}

# Ejutar función principal
main "$@"
