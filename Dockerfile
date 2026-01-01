# =============================================================================
# DOCKERFILE PARA SISTEMA DE GESTIÓN LABORATORIAL (NEXT.JS 16)
# =============================================================================
# Compatibilidad: Google Cloud Build, Google App Engine, Google Cloud Run
# Runtime: Node.js 20
# Base: Alpine Linux 3.21 (optimizado para tamaño)
# =============================================================================

# -------------------------------------------------------------------------
# ETAPA 1: IMAGEN BASE (DEPENDENCIAS)
# -------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Instalar dependencias necesarias para sharp (procesamiento de imágenes)
RUN apk add --no-cache \
    libvips \
    libvips-dev \
    && rm -rf /var/cache/apk/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de gestión de paquetes
COPY package.json package-lock.json bun.lockb* ./

# Copiar solo archivos de dependencias del proyecto (no código fuente)
# Esto aprovecha el cache de Docker para builds repetitivos
COPY prisma ./prisma

# Instalar dependencias de producción
# --frozen-lockfile: Asegura que use lockfile exacto (reproducible)
RUN bun install --frozen-lockfile --production

# -------------------------------------------------------------------------
# ETAPA 2: BUILD DE LA APLICACIÓN (NEXT.JS)
# -------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Instalar dependencias necesarias para el build
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar dependencias instaladas desde la etapa deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/prisma ./prisma

# Copiar código fuente del proyecto
COPY . .

# Generar cliente Prisma
RUN bun run db:generate

# Build de Next.js para producción
# .next/standalone: Contiene todo lo necesario para ejecutar la app
RUN bun run build

# -------------------------------------------------------------------------
# ETAPA 3: IMAGEN FINAL (RUNTIME)
# -------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Instalar dependencias de runtime necesarias para sharp
RUN apk add --no-cache \
    libvips \
    libc6-compat \
    libstdc++ \
    curl \
    && rm -rf /var/cache/apk/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json (solo para referencias, no para instalar)
COPY package.json ./

# Crear usuario no root por seguridad (mejor práctica)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs -s /bin/sh nodejs

# Copiar build desde la etapa builder
# .next/standalone: Contiene servidor y assets
# .next/static: Contiene archivos estáticos optimizados
COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./.next/standalone
COPY --from=builder --chown=nodejs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nodejs:nodejs /app/public ./public

# Copiar cliente Prisma desde la etapa deps
COPY --from=deps --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# -------------------------------------------------------------------------
# CONFIGURACIÓN DE ENTORNO Y PUERTOS
# -------------------------------------------------------------------------

# Puerto que escucha la aplicación (Next.js default)
ENV PORT=3000
EXPOSE 3000

# Configuración de Node.js para producción
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# -------------------------------------------------------------------------
# HEALTH CHECK (VERIFICACIÓN DE SALUD)
# -------------------------------------------------------------------------
# Google App Engine/Cloud Run necesita verificar que el app esté saludable
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# -------------------------------------------------------------------------
# ARRANCAR LA APLICACIÓN
# -------------------------------------------------------------------------
# Cambiar a usuario no root por seguridad
USER nodejs

# Arrancar servidor Node.js (standalone build)
# server.js: El servidor generado por Next.js standalone
CMD ["node", ".next/standalone/server.js"]
