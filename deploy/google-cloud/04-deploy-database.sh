#!/bin/bash

# =============================================================================
# SCRIPT 4: DESPLIEGUE DE BASE DE DATOS EN GOOGLE CLOUD SQL
# =============================================================================

set -e

# Cargar funciones comunes
source "$(dirname "$0")/common.sh"

# Configuración por defecto
PROJECT_ID="laboratorio-lims-$(date +%s)"
REGION="us-central1"
ZONE="us-central1-a"
DB_NAME="lims-database"
DB_VERSION="POSTGRES_15"
TIER="db-f1-micro"
STORAGE="100"
CONNECTOR_NAME="lims-connector"
NETWORK_NAME="lims-vpc"

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

# Crear red VPC personalizada
create_vpc_network() {
    log "Creando red VPC personalizada..."
    
    gcloud compute networks create $NETWORK_NAME \
        --project=$PROJECT_ID \
        --subnet-mode=custom
    
    log_success "Red VPC creada: $NETWORK_NAME"
}

# Crear subred en la VPC
create_subnet() {
    log "Creando subred en VPC..."
    
    gcloud compute networks subnets create lims-subnet \
        --project=$PROJECT_ID \
        --network=$NETWORK_NAME \
        --range=10.148.0.0/24 \
        --region=$REGION
    
    log_success "Subred creada: 10.148.0.0/24"
}

# Crear instancia de base de datos
create_cloudsql_instance() {
    log "Creando instancia de Google Cloud SQL..."
    
    gcloud sql instances create $DB_NAME \
        --project=$PROJECT_ID \
        --tier=$TIER \
        --database-version=$DB_VERSION \
        --region=$REGION \
        --storage=$STORAGE \
        --network=$NETWORK_NAME \
        --availability-type=regional \
        --root-password=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16) \
        --backup \
        --enable-bin-log \
        --bin-log-retention=7 \
        --maintenance-window-day=1 \
        --maintenance-window-hour=3 \
        --deletion-policy=on \
        --retained-backups=7
    
    # Esperar que la instancia esté lista
    log "Esperando que la instancia esté lista (esto puede tardar unos minutos)..."
    gcloud sql instances wait $DB_NAME --project=$PROJECT_ID --timeout=600
    
    log_success "Instancia creada: $DB_NAME"
}

# Crear usuario de base de datos
create_db_user() {
    log "Creando usuario de base de datos..."
    
    gcloud sql users create lims-user \
        --instance=$DB_NAME \
        --project=$PROJECT_ID \
        --password=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    log_success "Usuario de DB creado: lims-user"
}

# Crear base de datos
create_database() {
    log "Creando base de datos..."
    
    gcloud sql databases create lims \
        --instance=$DB_NAME \
        --project=$PROJECT_ID
    
    log_success "Base de datos creada: lims"
}

# Crear conector de base de datos
create_connector() {
    log "Creando conector de base de datos..."
    
    gcloud sql connectors create $CONNECTOR_NAME \
        --instance=$DB_NAME \
        --project=$PROJECT_ID \
        --region=$REGION \
        --network=$NETWORK_NAME \
        --subnet=lims-subnet
    
    log_success "Conector creado: $CONNECTOR_NAME"
}

# Configurar reglas de firewall
configure_firewall() {
    log "Configurando reglas de firewall..."
    
    gcloud compute firewall-rules create lims-allow-ingress \
        --project=$PROJECT_ID \
        --network=$NETWORK_NAME \
        --allow=tcp:5432 \
        --source-ranges=0.0.0.0/0 \
        --target-tags=cloud-sql
    
    gcloud compute firewall-rules create lims-allow-egress \
        --project=$PROJECT_ID \
        --network=$NETWORK_NAME \
        --allow=tcp:443 \
        --destination-ranges=0.0.0.0/0
    
    log_success "Reglas de firewall configuradas"
}

# Ejecutar migraciones de Prisma
run_prisma_migrations() {
    log "Ejecutando migraciones de Prisma..."
    
    # Obtener IP de la instancia
    DB_IP=$(gcloud sql instances describe $DB_NAME --project=$PROJECT_ID --format="value(ipAddresses[0].ipAddress)")
    
    if [ -z "$DB_IP" ]; then
        log_warning "No se pudo obtener IP de la instancia de base de datos"
        log_info "La IP se asignará dinámicamente"
    fi
    
    # Configurar DATABASE_URL para producción
    if [ -n "$DB_IP" ]; then
        export DATABASE_URL="postgresql://lims-user:$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)@${DB_IP}:5432/lims?sslmode=require"
        log_info "DATABASE_URL configurada"
    fi
    
    # Generar cliente Prisma
    log "Generando cliente Prisma..."
    bun run db:generate
    
    # Ejecutar migraciones
    log "Aplicando migraciones..."
    bun run db:push
    
    log_success "Migraciones aplicadas"
}

# Configurar proxy para desarrollo local
setup_local_proxy() {
    log "Configurando proxy para desarrollo local..."
    
    # Crear regla de autorización de IPs
    gcloud sql instances patch $DB_NAME \
        --project=$PROJECT_ID \
        --authorized-networks=0.0.0.0/0
    
    log_warning "⚠️ IMPORTANTE: Esto permite acceso desde cualquier IP (solo para desarrollo)"
    log_warning "Para producción, usar conector de VPC y reglas de firewall específicas"
}

# Obtener información de conexión
get_connection_info() {
    log "Información de conexión de base de datos:"
    
    # Obtener nombre de conexión
    CONNECTION_NAME=$(gcloud sql instances describe $DB_NAME --project=$PROJECT_ID --format="value(connectionName)")
    
    # Obtener IP (si existe)
    DB_IP=$(gcloud sql instances describe $DB_NAME --project=$PROJECT_ID --format="value(ipAddresses[0].ipAddress)")
    
    echo ""
    echo "============================================"
    echo "INFORMACIÓN DE CONEXIÓN"
    echo "============================================"
    echo ""
    echo "Proyecto: $PROJECT_ID"
    echo "Instancia: $DB_NAME"
    echo "Versión: PostgreSQL 15"
    echo "Región: $REGION"
    echo "Network: $NETWORK_NAME"
    echo "Subnet: 10.148.0.0/24"
    echo ""
    
    if [ -n "$CONNECTION_NAME" ]; then
        echo "Nombre de Conexión: $CONNECTION_NAME"
    fi
    
    if [ -n "$DB_IP" ]; then
        echo "IP Externa: $DB_IP (solo disponible si se habilita IP pública)"
    fi
    
    echo ""
    echo "============================================"
    echo "STRING DE CONEXIÓN PRISMA"
    echo "============================================"
    echo ""
    
    # Generar string de conexión
    if [ -n "$DB_IP" ]; then
        echo "postgresql://lims-user:PASSWORD@${DB_IP}:5432/lims?sslmode=require"
    else
        echo "Usar conector de VPC o Proxy SQL"
    fi
    
    echo ""
    echo "Para conectar localmente:"
    echo "1. gcloud sql connect $DB_NAME --project=$PROJECT_ID"
    echo "2. gcloud sql connect $DB_NAME --project=$PROJECT_ID --user=lims-user"
    echo ""
    
    echo "============================================"
    echo "COMANDOS ÚTILES"
    echo "============================================"
    echo ""
    echo "Ver estado de la instancia:"
    echo "  gcloud sql instances describe $DB_NAME --project=$PROJECT_ID"
    echo ""
    echo "Ver logs:"
    echo "  gcloud sql instances logs tail $DB_NAME --project=$PROJECT_ID"
    echo ""
    echo "Escalar instancia:"
    echo "  gcloud sql instances patch $DB_NAME --tier=db-f1-micro --project=$PROJECT_ID"
    echo ""
    echo "Realizar backup:"
    echo "  gcloud sql backups create --instance=$DB_NAME --project=$PROJECT_ID"
    echo ""
    echo "Verificar estado:"
    echo "  gcloud sql instances describe $DB_NAME --project=$PROJECT_ID --format='state,ipAddresses[0].ipAddress'"
    echo ""
}

# Función principal
main() {
    log "============================================"
    log "DESPLIEGUE DE BASE DE DATOS EN GOOGLE CLOUD SQL"
    log "============================================"
    
    echo ""
    log_info "Configuración:"
    echo "  Proyecto: $PROJECT_ID"
    echo "  Región: $REGION"
    echo "  Base de Datos: $DB_NAME"
    echo "  Versión: PostgreSQL 15"
    echo "  Tier: $TIER"
    echo "  Storage: $STORAGE GB"
    echo "  Network: $NETWORK_NAME"
    echo ""
    
    # Verificar dependencias
    check_dependencies
    
    # Verificar proyecto
    check_project
    
    # Crear red VPC (para producción)
    create_vpc_network
    
    # Crear subred
    create_subnet
    
    # Crear instancia
    create_cloudsql_instance
    
    # Crear usuario
    create_db_user
    
    # Crear base de datos
    create_database
    
    # Crear conector
    create_connector
    
    # Configurar firewall
    configure_firewall
    
    # Ejecutar migraciones
    run_prisma_migrations
    
    # Obtener información de conexión
    get_connection_info
    
    echo ""
    log_success "============================================"
    log_success "BASE DE DATOS DESPLEGADA EXITOSAMENTE"
    log_success "============================================"
    echo ""
    log_warning "⚠️ IMPORTANTE:"
    log_warning "1. Guardar las credenciales de la base de datos en un lugar seguro"
    log_warning "2. Actualizar el archivo .env.production con DATABASE_URL"
    log_warning "3. Para conectar localmente, usar gcloud sql connect"
    log_warning "4. Para producción, deshabilitar acceso desde cualquier IP"
    echo ""
    log_info "Siguiente paso: Ejecutar ./04-deploy-storage.sh"
}

# Ejecutar función principal
main "$@"
