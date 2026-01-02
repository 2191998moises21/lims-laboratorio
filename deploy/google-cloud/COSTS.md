# 💰 Costos de Infraestructura GCP - LIMS Laboratorio

## Resumen Ejecutivo

| Configuración | Costo Mensual | Notas |
|---------------|---------------|-------|
| **Anterior (App Engine)** | ~$256/mes | VPC, Alta disponibilidad, 100GB storage |
| **Optimizada (Cloud Run)** | ~$35-50/mes | Serverless, pay-per-use |
| **Ahorro** | **~$200/mes (80%)** | Ideal para laboratorio pequeño en Venezuela |

---

## Desglose de Costos Optimizados

### 1. Cloud Run (Compute) - ~$5-15/mes

```
Modelo de precios (us-central1):
• CPU: $0.00002400 por vCPU-segundo
• Memoria: $0.00000250 por GB-segundo
• Requests: $0.40 por millón

Free tier mensual:
• 2 millones de requests
• 360,000 vCPU-segundos
• 180,000 GB-segundos

Configuración recomendada:
• Memory: 512Mi
• CPU: 1 vCPU
• Min instances: 0 (scale-to-zero)
• Max instances: 5
• Concurrency: 80
```

**Estimación para laboratorio pequeño (~1,000 requests/día):**
- Sin min-instances: **$5-10/mes**
- Con min-instances=1: **$25-35/mes**

### 2. Cloud SQL (Database) - ~$10-15/mes

```
Configuración económica:
• Tier: db-f1-micro (0.6GB RAM, shared vCPU)
• Storage: 10GB HDD (auto-incrementable)
• Availability: Zonal (no regional)
• Backups: Automáticos diarios

Desglose:
• Instancia: ~$7.67/mes
• Storage 10GB HDD: ~$1.70/mes
• Backups: ~$0.80/mes
```

**Total Cloud SQL: ~$10-12/mes**

### 3. Cloud Storage - ~$1-2/mes

```
Lifecycle policies aplicadas:
• STANDARD (0-30 días): $0.020/GB
• NEARLINE (31-90 días): $0.010/GB
• COLDLINE (91-365 días): $0.004/GB
• ARCHIVE (>365 días): $0.0012/GB

Ejemplo 100GB:
• Sin lifecycle: $2.00/mes
• Con lifecycle: ~$0.90/mes
```

**Total Storage: ~$1-2/mes**

### 4. Cloud Build - ~$5-10/mes

```
Configuración optimizada:
• Máquina: E2_MEDIUM (2 vCPU)
• Disco: 30GB (mínimo necesario)
• Timeout: 15 min (antes 30 min)

Precios:
• Build time: $0.003/minuto (E2_MEDIUM)
• 2 deploys/día × 10 min = 600 min/mes
• Costo: ~$1.80/mes

Free tier:
• 120 min/día de build time
```

**Total Build: ~$2-5/mes**

### 5. Otros - ~$5-10/mes

```
• Container Registry: ~$0.10/GB/mes
• Cloud Logging: ~$0.50/GB
• API calls: Generalmente en free tier
• Networking (egress): ~$0.12/GB
```

---

## Comparación Detallada

### Configuración Anterior (App Engine + VPC)

| Servicio | Configuración | Costo/mes |
|----------|---------------|-----------|
| App Engine | F2 Flexible, min 1 inst | $80-120 |
| Cloud SQL | Regional, VPC, 100GB | $35-45 |
| VPC + Networking | Custom VPC, Firewall | $10-15 |
| Cloud Storage | 100GB STANDARD | $2-3 |
| Cloud Build | E2_HIGHCPU_8, 100GB | $60-75 |
| Otros | Logging, APIs | $20-30 |
| **TOTAL** | | **$207-288** |

### Configuración Optimizada (Cloud Run)

| Servicio | Configuración | Costo/mes |
|----------|---------------|-----------|
| Cloud Run | 512Mi, scale-to-zero | $5-15 |
| Cloud SQL | db-f1-micro, 10GB, zonal | $10-12 |
| Cloud Storage | Tiered lifecycle | $1-2 |
| Cloud Build | E2_MEDIUM, 30GB | $2-5 |
| Otros | Minimal | $5-10 |
| **TOTAL** | | **$23-44** |

---

## Recomendaciones por Escenario

### Laboratorio Pequeño (< 50 muestras/día)

```
• Cloud Run: min-instances=0
• Cloud SQL: db-f1-micro
• Costo estimado: $25-35/mes
```

### Laboratorio Mediano (50-200 muestras/día)

```
• Cloud Run: min-instances=1
• Cloud SQL: db-g1-small
• Costo estimado: $50-80/mes
```

### Laboratorio Grande (> 200 muestras/día)

```
• Cloud Run: min-instances=2-3
• Cloud SQL: db-custom-2-4096
• Costo estimado: $100-150/mes
```

---

## Comandos de Monitoreo de Costos

```bash
# Ver costos actuales
gcloud billing accounts list
gcloud billing projects describe $PROJECT_ID

# Ver uso de Cloud Run
gcloud run services describe lims-app --region us-central1

# Ver uso de Cloud SQL
gcloud sql instances describe lims-db

# Ver storage
gsutil du -s gs://$PROJECT_ID-lims-storage

# Configurar alertas de presupuesto
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="LIMS Monthly Budget" \
  --budget-amount=50USD
```

---

## Optimizaciones Adicionales (Si es necesario)

### Para reducir aún más (~$15-20/mes)

1. **Firebase Realtime DB** en lugar de Cloud SQL para datos no críticos
2. **Cloud Functions** para tareas puntuales
3. **Artifact Registry** en lugar de Container Registry

### Para Venezuela específicamente

- Región us-central1 tiene buenos precios
- Free tier de Cloud Run cubre uso básico
- Considerar backups menos frecuentes

---

## Resumen Final

```
Inversión inicial: $0 (pay-as-you-go)
Costo mensual estimado: $35-50 USD
Equivalente en VES: ~1,400-2,000 VES (a tasa actual)
ROI: Inmediato vs software propietario ($500+/mes)
```

**Nota:** Estos costos son estimaciones basadas en precios de enero 2025. Consultar la [calculadora de GCP](https://cloud.google.com/products/calculator) para precios actualizados.
