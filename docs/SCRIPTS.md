# 📋 Scripts de Testing y Optimización

## 🧪 Scripts de Testing (E2E)

### Playwright Tests
- `bun run test:e2e` - Ejecuta todos los tests end-to-end
- `bun run test:e2e:ui` - Abre Playwright UI para ver tests interactivo
- `bun run test:e2e:headed` - Ejecuta tests con browser visible
- `bun run test:e2e:debug` - Ejecuta tests en modo debug
- `bun run test:e2e:chromium` - Ejecuta tests solo en Chromium
- `bun run test:e2e:report` - Genera reporte HTML de tests

### Unit Tests
- `bun run test` - Ejecuta todos los tests unitarios
- `bun run test:watch` - Ejecuta tests en modo watch
- `bun run test:coverage` - Ejecuta tests con reporte de coverage

---

## 📦 Scripts de Optimización de Build

### Build Optimizations
- `bun run build` - Build de producción optimizado
- `bun run build:analyze` - Analiza bundle size
- `bun run build:profile` - Perfila performance del build
- `bun run build:export` - Exporta análisis de bundle

### Code Optimization
- `bun run lint:fix` - Auto-fix problemas de linting
- `bun run format` - Formatea código con Prettier
- `bun run type-check` - Verifica tipos de TypeScript
- `bun run clean` - Limpia cache y build

---

## 🚀 Scripts de Producción

### Deployment
- `bun run deploy:vercel` - Despliega a Vercel
- `bun run deploy:netlify` - Despliega a Netlify
- `bun run deploy:preview` - Crea preview de producción
- `bun run deploy:check` - Verifica configuración de deployment

### Production Build
- `bun run build:production` - Build de producción final
- `bun run build:static` - Genera exportación estática
- `bun run build:docker` - Construye imagen Docker

---

## 📊 Scripts de Monitoreo

### Performance
- `bun run lighthouse` - Ejecuta Lighthouse para análisis
- `bun run lighthouse:ci` - Ejecuta Lighthouse en CI
- `bun run analyze:bundle` - Analiza tamaño de bundle
- `bun run analyze:performance` - Analiza performance

### Quality
- `bun run lint:strict` - Linting con reglas estrictas
- `bun run test:all` - Ejecuta todos los tests (unit + e2e)
- `bun run security:check` - Verifica vulnerabilidades
- `bun run dependencies:check` - Verifica dependencias desactualizadas

---

## 🛠️ Scripts de Mantenimiento

### Database
- `bun run db:migrate` - Ejecuta migraciones de DB
- `bun run db:seed` - Siembra DB con datos de prueba
- `bun run db:reset` - Reseta DB (cuidado en prod)
- `bun run db:backup` - Realiza backup de DB

### Cache
- `bun run cache:clear` - Limpia todo el cache
- `bun run cache:next` - Limpia cache de Next.js
- `bun run cache:node` - Limpia cache de Node
- `bun run cache:browser` - Limpia cache de browser

---

## 📝 Scripts de Documentación

### API Docs
- `bun run docs:api` - Genera documentación de API
- `bun run docs:swagger` - Genera documentación Swagger
- `bun run docs:types` - Genera documentación de tipos

### User Documentation
- `bun run docs:user` - Genera documentación de usuario
- `bun run docs:guide` - Genera guía de usuario
- `bun run docs:changelog` - Genera changelog

---

## ⚡ Scripts de Performance

### Development
- `bun run dev:fast` - Dev mode con optimizaciones
- `bun run dev:debug` - Dev mode con debugging
- `bun run dev:analyze` - Analiza performance en dev

### Production Analysis
- `bun run analyze:routes` - Analiza rendimiento de rutas
- `bun run analyze:components` - Analiza tamaño de componentes
- `bun run analyze:assets` - Analiza tamaño de assets
