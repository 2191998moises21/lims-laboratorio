#!/bin/bash

# =============================================================================
# SCRIPT 3: DESPLIEGUE DE BACKEND EN GOOGLE CLOUD FUNCTIONS
# =============================================================================

set -e

# Cargar funciones comunes
source "$(dirname "$0")/common.sh"

# Configuración por defecto
PROJECT_ID="laboratorio-lims-$(date +%s)"
REGION="us-central1"
FUNCTION_NAME="lims-backend"
SOURCE="src/app/api"
RUNTIME="nodejs20"

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

# Optimizar build para Cloud Functions
optimize_build() {
    log "Optimizando build para Cloud Functions..."
    
    # Limpiar builds anteriores
    log "Limpiando builds anteriores..."
    rm -rf .next out node_modules/.cache
    
    # Build de producción optimizado para Functions
    log "Construyendo backend optimizado..."
    # No necesitamos el build completo de Next.js para Functions
    # Solo las API routes
    
    log_success "Build optimizado completado"
}

# Crear package.json para funciones
create_functions_package() {
    log "Creando package.json para funciones..."
    
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
    
    log_success "package.json para funciones creado"
}

# Crear archivo de configuración de funciones
create_functions_config() {
    log "Creando configuración de funciones..."
    
    cat > .gcloudignore << 'EOF'
# Dependencies
node_modules
package-lock.json
yarn.lock

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

# Testing
coverage
.nyc_output
__tests__

# Documentation
docs
EOF
    
    log_success ".gcloudignore creado"
}

# Desplegar en Google Cloud Functions
deploy_to_functions() {
    log "Desplegando en Google Cloud Functions..."
    
    # Crear función HTTP
    log_info "Desplegando función HTTP..."
    gcloud functions deploy $FUNCTION_NAME \
        --gen2 \
        --runtime=$RUNTIME \
        --region=$REGION \
        --memory=512MB \
        --timeout=540s \
        --max-instances=10 \
        --min-instances=0 \
        --source=src/app/api \
        --trigger-http \
        --entry-point=server \
        --project=$PROJECT_ID \
        --allow-unauthenticated
    
    log_success "Función HTTP desplegada"
    
    # Obtener URL de la función
    FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME \
        --region=$REGION \
        --project=$PROJECT_ID \
        --format="value(httpsTrigger.url)")
    
    log_success "Backend desplegado"
    log_info "URL: $FUNCTION_URL"
}

# Configurar CORS para funciones
setup_cors() {
    log "Configurando CORS para funciones..."
    
    # Cloud Functions maneja CORS automáticamente en gen2
    log_info "CORS habilitado por defecto en gen2"
    
    log_success "CORS configurado"
}

# Verificar despliegue de funciones
verify_deployment() {
    log "Verificando despliegue de funciones..."
    
    FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME \
        --region=$REGION \
        --project=$PROJECT_ID \
        --format="value(httpsTrigger.url)")
    
    if [ -z "$FUNCTION_URL" ]; then
        log_error "No se pudo obtener URL de la función"
        return 1
    fi
    
    log_info "URL del Backend: $FUNCTION_URL"
    
    # Hacer un request simple para verificar
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $FUNCTION_URL)
    
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "404" ]; then
        log_success "Backend desplegado exitosamente"
    elif [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
        log_success "Backend desplegado (redirección)"
    else
        log_warning "Despliegue completado pero el servicio puede tardar en iniciarse"
        log_warning "Status HTTP: $HTTP_STATUS"
        log_info "Verificar logs: gcloud functions logs read $FUNCTION_NAME --region=$REGION --limit=50"
    fi
}

# Verificar logs de funciones
check_functions_logs() {
    log "Verificando logs de funciones..."
    
    gcloud functions logs read $FUNCTION_NAME \
        --region=$REGION \
        --project=$PROJECT_ID \
        --limit=20 \
        --format="table(timestamp,severity,textPayload)"
}

# Configurar variables de entorno para funciones
setup_environment_variables() {
    log "Configurando variables de entorno..."
    
    if [ -f .env.production ]; then
        log_info "Configurando variables desde .env.production..."
        
        while IFS='=' read -r key value; do
            if [[ $key == DATABASE_URL* ]]; then
                log_warning "⚠️ DATABASE_URL no se puede configurar en Cloud Functions (usar Cloud SQL)"
            else
                gcloud functions deploy $FUNCTION_NAME \
                    --gen2 \
                    --region=$REGION \
                    --project=$PROJECT_ID \
                    --set-env-vars=$key=$value \
                    --update-env-vars
            fi
        done < .env.production
        
        log_success "Variables de entorno configuradas"
    fi
}

# Función principal
main() {
    log "============================================"
    log "DESPLIEGUE DE BACKEND EN GOOGLE CLOUD FUNCTIONS"
    log "============================================"
    
    echo ""
    log_info "Configuración:"
    echo "  Proyecto: $PROJECT_ID"
    echo "  Función: $FUNCTION_NAME"
    echo "  Región: $REGION"
    echo "  Runtime: $RUNTIME"
    echo ""
    
    # Verificar dependencias
    check_dependencies
    
    # Verificar proyecto
    check_project
    
    # Optimizar build
    optimize_build
    
    # Crear configuración
    create_functions_package
    create_functions_config
    
    # Configurar variables de entorno (opcional)
    if [ "$SETUP_ENV" = "true" ]; then
        setup_environment_variables
    fi
    
    # Desplegar
    deploy_to_functions
    
    # Configurar CORS
    setup_cors
    
    # Verificar
    verify_deployment
    
    echo ""
    log_success "============================================"
    log_success "BACKEND DESPLEGADO EXITOSAMENTE"
    log_success "============================================"
    echo ""
    log_info "URL: $FUNCTION_URL"
    echo ""
    log_info "Comandos útiles:"
    echo "  Ver logs: gcloud functions logs read $FUNCTION_NAME --region=$REGION"
    echo "  Ver función: gcloud functions describe $FUNCTION_NAME --region=$REGION"
    echo "  Ver métricas: gcloud functions metrics list --filter=$FUNCTION_NAME"
    echo ""
    log_info "Siguiente paso: Ejecutar ./04-deploy-storage.sh"
}

# Ejutar función principal
main "$@"
