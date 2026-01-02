#!/bin/bash

# =============================================================================
# SCRIPT: DESPLIEGUE EN GOOGLE CLOUD RUN
# =============================================================================
# Cloud Run es SERVERLESS - solo pagas por lo que usas
# Scale-to-zero: cuando no hay tráfico, no hay costo
# Costo estimado: $5-15/mes (vs $120/mes en App Engine)
# =============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuración por defecto
PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-lims-app}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
MEMORY="${MEMORY:-512Mi}"
CPU="${CPU:-1}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-5}"
TIMEOUT="${TIMEOUT:-300}"
CONCURRENCY="${CONCURRENCY:-80}"

# Verificar dependencias
check_dependencies() {
    log "Verificando dependencias..."

    if ! command -v gcloud &> /dev/null; then
        log_error "Google Cloud CLI no está instalado"
        log "Instalar con: curl https://sdk.cloud.google.com | bash"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        log_error "Docker no está instalado"
        exit 1
    fi

    log_success "Dependencias verificadas"
}

# Obtener o crear proyecto
get_project() {
    if [ -z "$PROJECT_ID" ]; then
        PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
        if [ -z "$PROJECT_ID" ]; then
            log_error "No hay proyecto configurado"
            log "Ejecutar: gcloud config set project TU_PROYECTO"
            log "O definir: export PROJECT_ID=tu-proyecto"
            exit 1
        fi
    fi

    log "Proyecto: $PROJECT_ID"
}

# Habilitar APIs necesarias
enable_apis() {
    log "Habilitando APIs necesarias..."

    gcloud services enable \
        run.googleapis.com \
        containerregistry.googleapis.com \
        cloudbuild.googleapis.com \
        --project=$PROJECT_ID \
        --quiet

    log_success "APIs habilitadas"
}

# Build de la imagen Docker
build_image() {
    log "Construyendo imagen Docker..."

    # Ir al directorio raíz del proyecto
    cd "$(dirname "$0")/../.."

    # Build
    docker build \
        -t gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG \
        -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
        .

    log_success "Imagen construida: gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG"
}

# Push de la imagen
push_image() {
    log "Subiendo imagen a Container Registry..."

    # Autenticar Docker con GCR
    gcloud auth configure-docker gcr.io --quiet

    # Push
    docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG
    docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

    log_success "Imagen subida"
}

# Deploy a Cloud Run
deploy_cloudrun() {
    log "Desplegando a Cloud Run..."

    # Variables de entorno para el servicio
    ENV_VARS="NODE_ENV=production"

    if [ -n "$DATABASE_URL" ]; then
        ENV_VARS="$ENV_VARS,DATABASE_URL=$DATABASE_URL"
    fi

    if [ -n "$NEXTAUTH_SECRET" ]; then
        ENV_VARS="$ENV_VARS,NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
    fi

    # Deploy
    gcloud run deploy $SERVICE_NAME \
        --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG \
        --platform managed \
        --region $REGION \
        --memory $MEMORY \
        --cpu $CPU \
        --min-instances $MIN_INSTANCES \
        --max-instances $MAX_INSTANCES \
        --timeout $TIMEOUT \
        --concurrency $CONCURRENCY \
        --port 8080 \
        --allow-unauthenticated \
        --set-env-vars "$ENV_VARS" \
        --project $PROJECT_ID \
        --quiet

    log_success "Despliegue completado"
}

# Obtener URL del servicio
get_service_url() {
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
        --platform managed \
        --region $REGION \
        --project $PROJECT_ID \
        --format 'value(status.url)')

    echo "$SERVICE_URL"
}

# Verificar el despliegue
verify_deployment() {
    log "Verificando despliegue..."

    SERVICE_URL=$(get_service_url)

    log "URL del servicio: $SERVICE_URL"

    # Esperar un momento para que el servicio esté listo
    sleep 5

    # Health check
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/api/health" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        log_success "Health check OK (HTTP $HTTP_STATUS)"
    else
        log_warning "Health check pendiente (HTTP $HTTP_STATUS)"
        log "El servicio puede tardar unos segundos en iniciar (cold start)"
    fi
}

# Mostrar información de costos
show_cost_info() {
    echo ""
    log "=========================================="
    log "💰 INFORMACIÓN DE COSTOS"
    log "=========================================="
    echo ""
    echo "Cloud Run - Modelo de precios:"
    echo "  • CPU: \$0.00002400 por vCPU-segundo"
    echo "  • Memoria: \$0.00000250 por GB-segundo"
    echo "  • Requests: \$0.40 por millón"
    echo "  • Free tier: 2M requests/mes, 360K vCPU-segundos"
    echo ""
    echo "Estimación para laboratorio pequeño (~1000 requests/día):"
    echo "  • Sin min-instances: ~\$5-10/mes"
    echo "  • Con min-instances=1: ~\$25-35/mes"
    echo ""
    echo "Comparación con App Engine:"
    echo "  • App Engine F2 24/7: ~\$120/mes"
    echo "  • Cloud Run (este config): ~\$5-15/mes"
    echo "  • Ahorro: ~\$100/mes (85%)"
    echo ""
}

# Mostrar comandos útiles
show_useful_commands() {
    echo ""
    log "=========================================="
    log "📋 COMANDOS ÚTILES"
    log "=========================================="
    echo ""
    echo "Ver logs:"
    echo "  gcloud run logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID"
    echo ""
    echo "Ver métricas:"
    echo "  gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID"
    echo ""
    echo "Escalar manualmente (si necesitas min-instances):"
    echo "  gcloud run services update $SERVICE_NAME --min-instances 1 --region $REGION"
    echo ""
    echo "Actualizar variables de entorno:"
    echo "  gcloud run services update $SERVICE_NAME --update-env-vars KEY=VALUE --region $REGION"
    echo ""
    echo "Eliminar servicio (para ahorrar):"
    echo "  gcloud run services delete $SERVICE_NAME --region $REGION --project $PROJECT_ID"
    echo ""
}

# Función principal
main() {
    echo ""
    log "=========================================="
    log "🚀 DESPLIEGUE EN GOOGLE CLOUD RUN"
    log "=========================================="
    echo ""

    # Verificaciones
    check_dependencies
    get_project

    echo ""
    log "Configuración:"
    echo "  Proyecto: $PROJECT_ID"
    echo "  Servicio: $SERVICE_NAME"
    echo "  Región: $REGION"
    echo "  Memoria: $MEMORY"
    echo "  CPU: $CPU"
    echo "  Min instancias: $MIN_INSTANCES (0 = scale-to-zero)"
    echo "  Max instancias: $MAX_INSTANCES"
    echo ""

    # Ejecución
    enable_apis
    build_image
    push_image
    deploy_cloudrun
    verify_deployment

    # Obtener URL final
    SERVICE_URL=$(get_service_url)

    echo ""
    log "=========================================="
    log_success "✅ DESPLIEGUE COMPLETADO"
    log "=========================================="
    echo ""
    echo "🌐 URL: $SERVICE_URL"
    echo ""

    show_cost_info
    show_useful_commands
}

# Ejecutar
main "$@"
