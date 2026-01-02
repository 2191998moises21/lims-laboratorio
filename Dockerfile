# =============================================================================
# DOCKERFILE PARA SISTEMA DE GESTIÓN LABORATORIAL (NEXT.JS 16)
# =============================================================================
# Optimizado para: Google Cloud Run (serverless, pay-per-use)
# Runtime: Node.js 20 Alpine (ligero, ~170MB vs ~340MB slim)
# Objetivo: Reducir costos de GCP (~80% menos que App Engine)
# =============================================================================

# -------------------------------------------------------------------------
# ETAPA 1: DEPENDENCIAS (deps)
# -------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Instalar dependencias del sistema para compilación
# - vips-dev: Para Sharp (procesamiento de imágenes)
# - python3, make, g++: Para compilar módulos nativos
RUN apk add --no-cache \
    libc6-compat \
    vips-dev \
    python3 \
    make \
    g++

# Instalar Bun
RUN apk add --no-cache curl bash && \
    curl -fsSL https://bun.sh/install | bash

ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json bun.lock* ./

# Instalar dependencias de producción
RUN bun install --frozen-lockfile --production

# -------------------------------------------------------------------------
# ETAPA 2: BUILD (builder)
# -------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Dependencias para build
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++

# Instalar Bun
RUN apk add --no-cache curl bash && \
    curl -fsSL https://bun.sh/install | bash

ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

WORKDIR /app

# Copiar dependencias y código
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generar cliente Prisma y build
RUN bunx prisma generate
RUN bun run build

# -------------------------------------------------------------------------
# ETAPA 3: RUNTIME (runner) - Imagen final mínima
# -------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Solo dependencias de runtime (sin herramientas de compilación)
RUN apk add --no-cache \
    libc6-compat \
    vips \
    curl

WORKDIR /app

# Crear usuario no-root (seguridad)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copiar solo lo necesario para producción
COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Configuración de entorno
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

EXPOSE 8080

# Health check para Cloud Run
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Ejecutar como usuario no-root
USER nodejs

# Iniciar servidor (Cloud Run usa puerto 8080)
CMD ["node", "server.js"]
