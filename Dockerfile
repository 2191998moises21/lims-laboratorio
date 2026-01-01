# =============================================================================
# DOCKERFILE PARA SISTEMA DE GESTIÓN LABORATORIAL (NEXT.JS 16)
# =============================================================================
# Compatibilidad: Google Cloud Build, Google App Engine, Google Cloud Run
# Runtime: Node.js 20 (Slim - Debian-based)
# Base: Debian Bookworm (stable, con libvips disponible)
# =============================================================================

# -------------------------------------------------------------------------
# ETAPA 1: IMAGEN BASE (DEPENDENCIAS)
# -------------------------------------------------------------------------
FROM node:20-slim AS deps

# Instalar dependencias necesarias para Sharp (procesamiento de imágenes)
# libvips-dev: Librerías de desarrollo para Sharp
# libvips: Librerías runtime para Sharp
# libglib2.0-dev: Dependencia para libvips
# libglib2.0-0: Dependencia runtime para libvips
# build-essential: Compiladores y herramientas (gcc, make)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    libvips \
    libglib2.0-dev \
    libglib2.0-0 \
    libexpat1-dev \
    libexpat1 \
    build-essential \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar solo archivos de gestión de paquetes (no código fuente)
# Esto aprovecha el cache de Docker para builds repetitivos
COPY package.json ./
COPY bun.lockb* ./

# Instalar dependencias de producción
# NOTA: Usamos bun install porque el proyecto usa Bun
RUN bun install --frozen-lockfile --production

# -------------------------------------------------------------------------
# ETAPA 2: BUILD DE LA APLICACIÓN (NEXT.JS)
# -------------------------------------------------------------------------
FROM node:20-slim AS builder

# Instalar dependencias necesarias para el build
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar dependencias instaladas desde la etapa deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copiar código fuente del proyecto
COPY . .

# Generar cliente Prisma
RUN npx prisma generate

# Build de Next.js para producción
# .next/standalone: Contiene todo lo necesario para ejecutar la app
RUN bun run build

# -------------------------------------------------------------------------
# ETAPA 3: IMAGEN FINAL (RUNTIME)
# -------------------------------------------------------------------------
FROM node:20-slim AS runner

# Instalar dependencias de runtime necesarias para Sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips \
    libglib2.0-0 \
    libexpat1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json (solo para referencias, no para instalar)
COPY package.json ./

# Crear usuario no root por seguridad (mejor práctica)
RUN groupadd -r 1001 -S nodejs && \
    useradd -r -u 1001 -G nodejs -s /bin/sh nodejs

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
