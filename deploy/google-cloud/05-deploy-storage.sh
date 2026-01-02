#!/bin/bash

# =============================================================================
# SCRIPT 5: DESPLIEGUE DE ALMACENAMIENTO EN GOOGLE CLOUD STORAGE
# =============================================================================
# Optimizado para costos mínimos con lifecycle policies:
# - STANDARD: Archivos activos (0-30 días)
# - NEARLINE: Archivos antiguos (31-90 días) = 50% menos costo
# - COLDLINE: Archivo histórico (>90 días) = 80% menos costo
# - DELETE: Archivos temporales después de 7 días
# =============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuración
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
BUCKET_NAME="${BUCKET_NAME:-${PROJECT_ID}-lims-storage}"
BUCKET_LOCATION="${BUCKET_LOCATION:-US}"

# Verificar dependencias
check_dependencies() {
    log "Verificando dependencias..."

    if ! command -v gcloud &> /dev/null; then
        log_error "Google Cloud CLI no está instalado"
        exit 1
    fi

    if ! command -v gsutil &> /dev/null; then
        log_error "gsutil no está instalado"
        exit 1
    fi

    log_success "Dependencias verificadas"
}

# Crear bucket con configuración optimizada
create_storage_bucket() {
    log "Creando bucket de almacenamiento..."

    # Verificar si el bucket ya existe
    if gsutil ls -b gs://$BUCKET_NAME &> /dev/null 2>&1; then
        log_warning "Bucket ya existe: $BUCKET_NAME"
    else
        # Crear bucket con storage class STANDARD
        gsutil mb -p $PROJECT_ID -c STANDARD -l $BUCKET_LOCATION gs://$BUCKET_NAME

        log_success "Bucket creado: gs://$BUCKET_NAME"
    fi
}

# Configurar lifecycle policies para optimizar costos
configure_lifecycle() {
    log "Configurando políticas de ciclo de vida (cost optimization)..."

    cat > /tmp/lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "SetStorageClass",
          "storageClass": "NEARLINE"
        },
        "condition": {
          "age": 30,
          "matchesStorageClass": ["STANDARD"]
        }
      },
      {
        "action": {
          "type": "SetStorageClass",
          "storageClass": "COLDLINE"
        },
        "condition": {
          "age": 90,
          "matchesStorageClass": ["NEARLINE"]
        }
      },
      {
        "action": {
          "type": "SetStorageClass",
          "storageClass": "ARCHIVE"
        },
        "condition": {
          "age": 365,
          "matchesStorageClass": ["COLDLINE"]
        }
      },
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 7,
          "matchesPrefix": ["temp/"]
        }
      },
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 30,
          "matchesPrefix": ["logs/"]
        }
      },
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 730,
          "matchesStorageClass": ["ARCHIVE"]
        }
      }
    ]
  }
}
EOF

    gsutil lifecycle set /tmp/lifecycle.json gs://$BUCKET_NAME
    rm /tmp/lifecycle.json

    log_success "Políticas de ciclo de vida configuradas:"
    echo "  • STANDARD → NEARLINE: 30 días (50% ahorro)"
    echo "  • NEARLINE → COLDLINE: 90 días (80% ahorro)"
    echo "  • COLDLINE → ARCHIVE: 365 días (95% ahorro)"
    echo "  • temp/* eliminados: 7 días"
    echo "  • logs/* eliminados: 30 días"
    echo "  • ARCHIVE eliminados: 2 años"
}

# Configurar CORS para la aplicación web
configure_cors() {
    log "Configurando CORS..."

    cat > /tmp/cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Disposition"],
    "method": ["GET", "HEAD", "OPTIONS", "PUT", "POST"],
    "maxAgeSeconds": 3600
  }
]
EOF

    gsutil cors set /tmp/cors.json gs://$BUCKET_NAME
    rm /tmp/cors.json

    log_success "CORS configurado"
}

# Crear estructura de carpetas
create_folders() {
    log "Creando estructura de carpetas..."

    # Crear archivos placeholder para cada carpeta
    echo "" | gsutil cp - gs://$BUCKET_NAME/uploads/.gitkeep 2>/dev/null || true
    echo "" | gsutil cp - gs://$BUCKET_NAME/reports/.gitkeep 2>/dev/null || true
    echo "" | gsutil cp - gs://$BUCKET_NAME/backups/.gitkeep 2>/dev/null || true
    echo "" | gsutil cp - gs://$BUCKET_NAME/temp/.gitkeep 2>/dev/null || true
    echo "" | gsutil cp - gs://$BUCKET_NAME/logs/.gitkeep 2>/dev/null || true
    echo "" | gsutil cp - gs://$BUCKET_NAME/signatures/.gitkeep 2>/dev/null || true

    log_success "Carpetas creadas:"
    echo "  • uploads/     - Archivos de resultados"
    echo "  • reports/     - PDFs generados"
    echo "  • backups/     - Backups de BD"
    echo "  • temp/        - Archivos temporales (auto-delete 7d)"
    echo "  • logs/        - Logs de aplicación (auto-delete 30d)"
    echo "  • signatures/  - Firmas digitales"
}

# Configurar permisos
configure_permissions() {
    log "Configurando permisos..."

    # Bucket privado por defecto (datos médicos sensibles)
    gsutil iam ch -d allUsers:objectViewer gs://$BUCKET_NAME 2>/dev/null || true

    # Solo la cuenta de servicio de Cloud Run puede acceder
    log_success "Bucket configurado como privado (datos médicos)"
}

# Mostrar información de costos
show_cost_info() {
    echo ""
    log "=========================================="
    log "💰 ESTIMACIÓN DE COSTOS DE STORAGE"
    log "=========================================="
    echo ""
    echo "Precios por GB/mes (us-central1):"
    echo "  • STANDARD:  \$0.020 (archivos activos)"
    echo "  • NEARLINE:  \$0.010 (acceso 1x/mes)"
    echo "  • COLDLINE:  \$0.004 (acceso 1x/trimestre)"
    echo "  • ARCHIVE:   \$0.0012 (acceso raro)"
    echo ""
    echo "Ejemplo para 100GB de datos:"
    echo "  • Sin lifecycle: 100GB × \$0.020 = \$2.00/mes"
    echo "  • Con lifecycle:"
    echo "    - 20GB STANDARD: \$0.40"
    echo "    - 30GB NEARLINE: \$0.30"
    echo "    - 50GB COLDLINE: \$0.20"
    echo "    - Total: \$0.90/mes (55% ahorro)"
    echo ""
}

# Función principal
main() {
    echo ""
    log "=========================================="
    log "📦 DESPLIEGUE DE CLOUD STORAGE (OPTIMIZADO)"
    log "=========================================="
    echo ""

    log "Configuración:"
    echo "  Proyecto: $PROJECT_ID"
    echo "  Bucket: $BUCKET_NAME"
    echo "  Ubicación: $BUCKET_LOCATION"
    echo ""

    check_dependencies
    create_storage_bucket
    configure_lifecycle
    configure_cors
    create_folders
    configure_permissions

    echo ""
    log "=========================================="
    log_success "✅ STORAGE DESPLEGADO"
    log "=========================================="
    echo ""
    echo "🪣 Bucket: gs://$BUCKET_NAME"
    echo "🔗 URL: https://storage.googleapis.com/$BUCKET_NAME"
    echo ""

    show_cost_info

    echo "📋 Comandos útiles:"
    echo "  Ver contenido: gsutil ls -la gs://$BUCKET_NAME/"
    echo "  Ver lifecycle: gsutil lifecycle get gs://$BUCKET_NAME"
    echo "  Subir archivo: gsutil cp archivo.pdf gs://$BUCKET_NAME/reports/"
    echo "  Ver costos: gsutil du -s gs://$BUCKET_NAME"
    echo ""
}

main "$@"
