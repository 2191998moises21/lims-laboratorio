#!/bin/bash

# =============================================================================
# SCRIPT 4: DESPLIEGUE DE BASE DE DATOS EN GOOGLE CLOUD SQL
# =============================================================================
# Optimizado para costos mínimos:
# - Sin VPC personalizada (ahorro ~$15/mes)
# - Cloud SQL Auth Proxy para conexiones seguras
# - Tier mínimo db-f1-micro (~$10/mes)
# - Storage reducido a 10GB (~$2/mes)
# - Sin alta disponibilidad (zonal, no regional)
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

# Configuración optimizada para costos
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
INSTANCE_NAME="${INSTANCE_NAME:-lims-db}"
DB_NAME="${DB_NAME:-lims}"
DB_USER="${DB_USER:-lims_user}"
DB_VERSION="POSTGRES_15"
TIER="${TIER:-db-f1-micro}"
STORAGE="${STORAGE:-10}"

# Verificar dependencias
check_dependencies() {
    log "Verificando dependencias..."

    if ! command -v gcloud &> /dev/null; then
        log_error "Google Cloud CLI no está instalado"
        exit 1
    fi

    log_success "Dependencias verificadas"
}

# Habilitar APIs necesarias
enable_apis() {
    log "Habilitando APIs necesarias..."

    gcloud services enable \
        sqladmin.googleapis.com \
        sql-component.googleapis.com \
        --project=$PROJECT_ID \
        --quiet

    log_success "APIs habilitadas"
}

# Crear instancia de Cloud SQL (SIMPLIFICADA - sin VPC)
create_cloudsql_instance() {
    log "Creando instancia de Cloud SQL (configuración económica)..."

    # Verificar si ya existe
    if gcloud sql instances describe $INSTANCE_NAME --project=$PROJECT_ID &>/dev/null; then
        log_warning "La instancia $INSTANCE_NAME ya existe"
        return 0
    fi

    # Generar contraseña segura
    ROOT_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/")
    USER_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/")

    # Guardar credenciales en archivo temporal seguro
    CREDS_FILE="/tmp/lims-db-credentials-$(date +%s).txt"
    cat > $CREDS_FILE << EOF
# CREDENCIALES DE BASE DE DATOS LIMS
# Generadas: $(date)
# GUARDAR EN LUGAR SEGURO Y ELIMINAR ESTE ARCHIVO

PROJECT_ID=$PROJECT_ID
INSTANCE_NAME=$INSTANCE_NAME
REGION=$REGION
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$USER_PASSWORD
ROOT_PASSWORD=$ROOT_PASSWORD

# String de conexión para Prisma (actualizar HOST después del deploy)
DATABASE_URL="postgresql://$DB_USER:$USER_PASSWORD@HOST:5432/$DB_NAME?sslmode=require"
EOF

    chmod 600 $CREDS_FILE
    log "Credenciales guardadas en: $CREDS_FILE"

    # Crear instancia con configuración mínima
    gcloud sql instances create $INSTANCE_NAME \
        --project=$PROJECT_ID \
        --database-version=$DB_VERSION \
        --tier=$TIER \
        --region=$REGION \
        --storage-size=$STORAGE \
        --storage-type=HDD \
        --storage-auto-increase \
        --availability-type=zonal \
        --backup-start-time=03:00 \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=03 \
        --root-password=$ROOT_PASSWORD \
        --database-flags=max_connections=25 \
        --quiet

    log "Esperando que la instancia esté lista..."
    sleep 30

    log_success "Instancia creada: $INSTANCE_NAME"
}

# Crear usuario de base de datos
create_db_user() {
    log "Creando usuario de base de datos..."

    # Leer contraseña del archivo de credenciales
    if [ -f "$CREDS_FILE" ]; then
        USER_PASSWORD=$(grep "DB_PASSWORD=" $CREDS_FILE | cut -d= -f2)
    else
        USER_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/")
    fi

    gcloud sql users create $DB_USER \
        --instance=$INSTANCE_NAME \
        --project=$PROJECT_ID \
        --password=$USER_PASSWORD \
        --quiet || log_warning "Usuario ya existe o error al crear"

    log_success "Usuario creado: $DB_USER"
}

# Crear base de datos
create_database() {
    log "Creando base de datos..."

    gcloud sql databases create $DB_NAME \
        --instance=$INSTANCE_NAME \
        --project=$PROJECT_ID \
        --quiet || log_warning "Base de datos ya existe o error al crear"

    log_success "Base de datos creada: $DB_NAME"
}

# Configurar conexión para Cloud Run
configure_cloudrun_connection() {
    log "Configurando conexión para Cloud Run..."

    # Obtener la cuenta de servicio de Cloud Run
    PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
    CLOUDRUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

    # Dar permisos de Cloud SQL Client a Cloud Run
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$CLOUDRUN_SA" \
        --role="roles/cloudsql.client" \
        --quiet

    log_success "Permisos configurados para Cloud Run"

    # Obtener nombre de conexión
    CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME \
        --project=$PROJECT_ID \
        --format="value(connectionName)")

    log "Connection Name: $CONNECTION_NAME"
    log "Usar --add-cloudsql-instances=$CONNECTION_NAME al desplegar Cloud Run"
}

# Mostrar información de conexión
show_connection_info() {
    echo ""
    log "=========================================="
    log "📊 INFORMACIÓN DE CONEXIÓN"
    log "=========================================="
    echo ""

    CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME \
        --project=$PROJECT_ID \
        --format="value(connectionName)" 2>/dev/null || echo "N/A")

    echo "Proyecto: $PROJECT_ID"
    echo "Instancia: $INSTANCE_NAME"
    echo "Región: $REGION"
    echo "Base de datos: $DB_NAME"
    echo "Usuario: $DB_USER"
    echo ""
    echo "Connection Name: $CONNECTION_NAME"
    echo ""

    if [ -f "$CREDS_FILE" ]; then
        echo "📁 Credenciales guardadas en: $CREDS_FILE"
        echo ""
    fi

    echo "Para Cloud Run, usar:"
    echo "  --add-cloudsql-instances=$CONNECTION_NAME"
    echo "  --set-env-vars DATABASE_URL=postgresql://$DB_USER:PASSWORD@/cloudsql/$CONNECTION_NAME/$DB_NAME"
    echo ""
}

# Mostrar información de costos
show_cost_info() {
    echo ""
    log "=========================================="
    log "💰 ESTIMACIÓN DE COSTOS"
    log "=========================================="
    echo ""
    echo "Cloud SQL (db-f1-micro):"
    echo "  • Instancia: ~\$7.67/mes (shared vCPU, 0.6GB RAM)"
    echo "  • Storage HDD 10GB: ~\$1.70/mes"
    echo "  • Backups: ~\$0.80/mes"
    echo "  • Total: ~\$10-12/mes"
    echo ""
    echo "Comparación con configuración anterior:"
    echo "  • Con VPC + Regional + 100GB: ~\$45/mes"
    echo "  • Esta configuración: ~\$10-12/mes"
    echo "  • Ahorro: ~\$33/mes (73%)"
    echo ""
    echo "Para escalar después:"
    echo "  gcloud sql instances patch $INSTANCE_NAME --tier=db-g1-small"
    echo ""
}

# Función principal
main() {
    echo ""
    log "=========================================="
    log "🗄️ DESPLIEGUE DE CLOUD SQL (OPTIMIZADO)"
    log "=========================================="
    echo ""

    log "Configuración:"
    echo "  Proyecto: $PROJECT_ID"
    echo "  Instancia: $INSTANCE_NAME"
    echo "  Región: $REGION"
    echo "  Tier: $TIER (económico)"
    echo "  Storage: ${STORAGE}GB HDD"
    echo "  Alta disponibilidad: No (zonal)"
    echo ""

    check_dependencies
    enable_apis
    create_cloudsql_instance
    create_db_user
    create_database
    configure_cloudrun_connection

    echo ""
    log "=========================================="
    log_success "✅ BASE DE DATOS DESPLEGADA"
    log "=========================================="

    show_connection_info
    show_cost_info

    echo ""
    log_warning "⚠️ IMPORTANTE:"
    echo "1. Guardar las credenciales de $CREDS_FILE en lugar seguro"
    echo "2. Eliminar el archivo de credenciales después de guardarlas"
    echo "3. Actualizar DATABASE_URL en el despliegue de Cloud Run"
    echo ""
}

main "$@"
