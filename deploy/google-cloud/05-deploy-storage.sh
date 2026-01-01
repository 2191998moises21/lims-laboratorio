#!/bin/bash

# =============================================================================
# SCRIPT 5: DESPLIEGUE DE ALMACENAMIENTO EN GOOGLE CLOUD STORAGE
# =============================================================================

set -e

# Cargar funciones comunes
source "$(dirname "$0")/common.sh"

# Configuración por defecto
PROJECT_ID="laboratorio-lims-$(date +%s)"
REGION="us-central1"
ZONE="us-central1-a"
BUCKET_NAME="${PROJECT_ID}-assets"
BUCKET_LOCATION="US"

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

# Crear bucket de almacenamiento
create_storage_bucket() {
    log "Creando bucket de almacenamiento..."
    
    # Verificar si el bucket ya existe
    if gsutil ls gs://$BUCKET_NAME &> /dev/null 2>&1; then
        log_warning "Bucket ya existe: $BUCKET_NAME"
        return 0
    fi
    
    # Crear bucket
    gsutil mb -p $BUCKET_NAME -l $REGION
    
    # Configurar ciclo de vida (30 días para archivos temporales)
    log "Configurando ciclo de vida..."
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
    
    # Configurar CORS
    log "Configurando CORS..."
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
    
    # Configurar versióning
    log "Configurando versioning..."
    gsutil versioning set on gs://$BUCKET_NAME
    
    # Hacer bucket público (para assets estáticos)
    log "Configurando permisos públicos para assets..."
    gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME/assets/**
    
    log_success "Bucket creado: gs://$BUCKET_NAME"
}

# Crear carpetas necesarias
create_folders() {
    log "Creando carpetas necesarias..."
    
    gsutil mb -p $BUCKET_NAME/assets 2>/dev/null || true
    gsutil mb -p $BUCKET_NAME/images 2>/dev/null || true
    gsutil mb -p $BUCKET_NAME/documents 2>/dev/null || true
    gsutil mb -p $BUCKET_NAME/pdfs 2>/dev/null || true
    gsutil mb -p $BUCKET_NAME/backups 2>/dev/null || true
    gsutil mb -p $BUCKET_NAME/temp 2>/dev/null || true
    
    log_success "Carpetas creadas"
}

# Subir assets estáticos
upload_assets() {
    log "Subiendo assets estáticos..."
    
    # Verificar si el build existe
    if [ ! -d "public" ]; then
        log_warning "Directorio 'public' no encontrado, buscando 'out'..."
        if [ -d "out" ]; then
            log_info "Usando directorio 'out'..."
        else
            log_error "No se encontró directorio de build ('public' o 'out')"
            log_info "Ejecutar primero: bun run build"
            exit 1
        fi
    fi
    
    # Subir todos los archivos estáticos
    if [ -d "public" ]; then
        gsutil -m rs -r -d public gs://$BUCKET_NAME/assets/
    else
        gsutil -m rs -r -d out gs://$BUCKET_NAME/assets/
    fi
    
    log_success "Assets subidos"
}

# Configurar CDN (opcional)
setup_cdn() {
    log "Configurando Cloud CDN..."
    
    gcloud compute backend-buckets create lims-cdn \
        --project=$PROJECT_ID \
        --gcs-bucket-name=$BUCKET_NAME \
        --enable-cdn
    
    log_success "CDN configurado: lims-cdn"
}

# Crear URL firmada para uploads
create_signed_url() {
    log "Creando configuración de URL firmada para uploads..."
    
    # Generar URL firmada válida por 1 hora
    SIGNED_URL=$(gsutil signurl -d 1h gs://$BUCKET_NAME/uploads/*)
    
    log_info "URL firmada generada para uploads"
    log_info "Esta URL es válida por 1 hora"
    
    # Crear archivo de configuración
    cat > storage-config.json << EOF
{
  "bucketName": "$BUCKET_NAME",
  "bucketUrl": "gs://$BUCKET_NAME",
  "publicUrl": "https://storage.googleapis.com/$BUCKET_NAME",
  "assetsUrl": "https://storage.googleapis.com/$BUCKET_NAME/assets",
  "imagesUrl": "https://storage.googleapis.com/$BUCKET_NAME/images",
  "documentsUrl": "https://storage.googleapis.com/$BUCKET_NAME/documents",
  "uploadsUrl": "https://storage.googleapis.com/$BUCKET_NAME/uploads",
  "cdnUrl": "https://lims-cdn.storage.googleapis.com"
}
EOF
    
    log_success "Configuración de almacenamiento creada"
}

# Verificar bucket
verify_bucket() {
    log "Verificando bucket..."
    
    # Verificar que el bucket existe
    if ! gsutil ls gs://$BUCKET_NAME &> /dev/null; then
        log_error "Bucket no existe"
        return 1
    fi
    
    # Listar contenido
    log_info "Contenido del bucket:"
    gsutil ls -R gs://$BUCKET_NAME/
    
    log_success "Bucket verificado"
}

# Obtener información de conexión
get_connection_info() {
    log "Información de conexión de almacenamiento:"
    
    echo ""
    echo "============================================"
    echo "INFORMACIÓN DE ALMACENAMIENTO"
    echo "============================================"
    echo ""
    echo "Bucket: gs://$BUCKET_NAME"
    echo "URL Pública: https://storage.googleapis.com/$BUCKET_NAME"
    echo "URL CDN: https://lims-cdn.storage.googleapis.com"
    echo ""
    echo "Carpetas:"
    echo "  - assets/"
    echo "  - images/"
    echo "  - documents/"
    echo "  - pdfs/"
    echo "  - backups/"
    echo "  - temp/"
    echo ""
    echo "Permisos:"
    echo "  - Assets públicos: https://$BUCKET_NAME.storage.googleapis.com/assets/**"
    echo "  - Otros: Privados (requiere autenticación)"
    echo ""
    echo "============================================"
}

# Función principal
main() {
    log "============================================"
    log "DESPLIEGUE DE ALMACENAMIENTO EN GOOGLE CLOUD STORAGE"
    log "============================================"
    
    echo ""
    log_info "Configuración:"
    echo "  Bucket: $BUCKET_NAME"
    echo "  Región: $REGION"
    echo "  Ubicación: $BUCKET_LOCATION"
    echo ""
    
    # Verificar dependencias
    check_dependencies
    
    # Verificar proyecto
    check_project
    
    # Crear bucket
    create_storage_bucket
    
    # Crear carpetas
    create_folders
    
    # Subir assets (opcional)
    if [ "$UPLOAD_ASSETS" = "true" ]; then
        upload_assets
    fi
    
    # Configurar CDN (opcional)
    if [ "$SETUP_CDN" = "true" ]; then
        setup_cdn
    fi
    
    # Crear URL firmada
    create_signed_url
    
    # Verificar
    verify_bucket
    
    # Obtener información de conexión
    get_connection_info
    
    echo ""
    log_success "============================================"
    log_success "ALMACENAMIENTO DESPLEGADO EXITOSAMENTE"
    log_success "============================================"
    echo ""
    log_info "Siguiente paso: Ejecutar ./06-deploy-all.sh para desplegar todo el sistema"
}

# Ejecutar función principal
main "$@"
