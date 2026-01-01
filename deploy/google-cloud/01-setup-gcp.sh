#!/bin/bash

# =============================================================================
# SCRIPT 1: CONFIGURACIÓN DE ENTORNO GOOGLE CLOUD
# =============================================================================

set -e

# Cargar funciones comunes
source "$(dirname "$0")/common.sh"

# Configuración por defecto
PROJECT_ID="laboratorio-lims-$(date +%s)"
REGION="us-central1"
ZONE="us-central1-a"
PROJECT_NAME="Sistema de Gestión Laboratorial"
PROJECT_NUMBER="000001"
ORG_ID=""
BILLING_ACCOUNT=""
AUTH_FILE="google-auth.json"

# Verificar dependencias
check_dependencies() {
    log "Verificando dependencias..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "Google Cloud CLI no está instalado"
        log_info "Instalar con: curl https://sdk.cloud.google.com | bash"
        exit 1
    fi
    
    if ! command -v gsutil &> /dev/null; then
        log_warning "gsutil no está instalado (se instalará con gcloud)"
    fi
    
    log_success "Dependencias verificadas"
}

# Crear proyecto en Google Cloud
create_project() {
    log "Creando nuevo proyecto en Google Cloud..."
    
    # Verificar si el usuario tiene una organización
    if [ -z "$ORG_ID" ]; then
        log_warning "No se especificó ORG_ID, creando proyecto sin organización"
        gcloud projects create $PROJECT_ID --name="$PROJECT_NAME"
    else
        log_info "Usando organización: $ORG_ID"
        gcloud projects create $PROJECT_ID --name="$PROJECT_NAME" --organization=$ORG_ID
    fi
    
    # Esperar que el proyecto esté listo
    log "Esperando que el proyecto esté listo..."
    gcloud services enable cloudresourcemanager.googleapis.com --project=$PROJECT_ID
    
    # Configurar zona
    log "Configurando zona predeterminada: $ZONE"
    gcloud config set compute/zone $ZONE
    
    # Configurar región
    gcloud config set compute/region $REGION
    
    log_success "Proyecto creado: $PROJECT_ID"
}

# Configurar facturación
setup_billing() {
    log "Configurando facturación..."
    
    if [ -n "$BILLING_ACCOUNT" ]; then
        gcloud beta billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT
        log_success "Facturación configurada"
    else
        log_warning "No se especificó BILLING_ACCOUNT"
        log_info "Configurar facturación manualmente:"
        log_info "gcloud beta billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ID"
    fi
}

# Crear archivo de autenticación
create_auth_file() {
    log "Creando archivo de autenticación..."
    
    # Verificar si ya existe el archivo
    if [ -f "$AUTH_FILE" ]; then
        log_warning "Archivo de autenticación ya existe: $AUTH_FILE"
        read -p "¿Desea reemplazarlo? (y/n): " -r -n 1 -e
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Usando archivo de autenticación existente"
            return 0
        fi
    fi
    
    # Crear nuevo archivo de autenticación
    log_info "Autenticando con Google Cloud..."
    gcloud auth application-default login --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/appengine.admin,https://www.googleapis.com/auth/sqladmin,https://www.googleapis.com/auth/devstorage.full_control,https://www.googleapis.com/auth/compute"
    
    # Copiar credenciales
    cp ~/.config/gcloud/application_default_credentials.json $AUTH_FILE
    
    log_success "Archivo de autenticación creado: $AUTH_FILE"
    log_warning "⚠️  IMPORTANTE: Nunca hacer commit de $AUTH_FILE al control de versiones"
    log_warning "⚠️  Agregar $AUTH_FILE a .gitignore"
}

# Habilitar APIs necesarias
enable_apis() {
    log "Habilitando APIs necesarias..."
    
    # APIs de App Engine
    gcloud services enable appengine.googleapis.com --project=$PROJECT_ID
    gcloud services enable appengineflex.googleapis.com --project=$PROJECT_ID
    
    # APIs de Cloud Functions
    gcloud services enable cloudfunctions.googleapis.com --project=$PROJECT_ID
    gcloud services enable eventarc.googleapis.com --project=$PROJECT_ID
    
    # APIs de Compute Engine
    gcloud services enable compute.googleapis.com --project=$PROJECT_ID
    
    # APIs de SQL
    gcloud services enable sql-component.googleapis.com --project=$PROJECT_ID
    gcloud services enable sqladmin.googleapis.com --project=$PROJECT_ID
    
    # APIs de Storage
    gcloud services enable storage.googleapis.com --project=$PROJECT_ID
    gcloud services enable storage-component.googleapis.com --project=$PROJECT_ID
    
    log_success "APIs habilitadas"
}

# Crear bucket de almacenamiento
create_storage_bucket() {
    log "Creando bucket de almacenamiento..."
    
    BUCKET_NAME="${PROJECT_ID}-assets"
    
    gsutil mb -p $BUCKET_NAME -l $REGION
    
    # Configurar CORS
    gsutil cors set ./deploy/google-cloud/storage-cors.json gs://$BUCKET_NAME
    
    # Configurar ciclo de vida
    gsutil lifecycle set ./deploy/google-cloud/lifecycle.json gs://$BUCKET_NAME
    
    log_success "Bucket creado: gs://$BUCKET_NAME"
}

# Función principal
main() {
    log "============================================"
    log "CONFIGURACIÓN DE GOOGLE CLOUD"
    log "============================================"
    
    echo ""
    log_info "Información del Proyecto:"
    echo "  ID: $PROJECT_ID"
    echo "  Nombre: $PROJECT_NAME"
    echo "  Región: $REGION"
    echo "  Zona: $ZONE"
    echo ""
    
    # Verificar dependencias
    check_dependencies
    
    # Crear proyecto
    create_project
    
    # Configurar facturación
    setup_billing
    
    # Crear archivo de autenticación
    create_auth_file
    
    # Habilitar APIs
    enable_apis
    
    # Crear bucket de almacenamiento
    create_storage_bucket
    
    echo ""
    log_success "============================================"
    log_success "CONFIGURACIÓN COMPLETADA"
    log_success "============================================"
    echo ""
    log_info "Proyecto: $PROJECT_ID"
    log_info "Archivo de Autenticación: $AUTH_FILE"
    log_info "Bucket: gs://${PROJECT_ID}-assets"
    echo ""
    log_info "Siguiente paso: Ejecutar ./deploy-frontend.sh"
}

# Ejutar función principal
main
