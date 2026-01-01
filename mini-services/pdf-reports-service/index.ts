import { serve } from 'bun'
import { Skill } from 'z-ai-web-dev-sdk'

const PORT = 3004

// Interfaces para los datos del informe
interface PatientInfo {
  fullName: string
  cedula: string
  dateOfBirth: string
  gender: string
}

interface DoctorInfo {
  fullName: string
  specialty?: string
  healthCenter?: string
}

interface TestResult {
  testName: string
  testCode: string
  parameterName: string
  parameterCode: string
  resultType: 'QUANTITATIVE' | 'QUALITATIVE' | 'TEXT'
  resultValue: string
  unit?: string
  referenceRange?: string
  isAbnormal: boolean
  isCritical: boolean
  notes?: string
}

interface ReportData {
  sampleCode: string
  patient: PatientInfo
  doctor: DoctorInfo
  sampleInfo: {
    sampleType: string
    collectionDate: string
    collectionMethod: string
    priority: string
  }
  testResults: TestResult[]
  technique?: string
  interpretation?: string
  validationInfo: {
    validatedBy: string
    validatedAt: string
  }
  reportInfo: {
    title: string
    subtitle: string
    logo?: string
    laboratoryName: string
    laboratoryAddress: string
    laboratoryPhone: string
    laboratoryEmail: string
  }
}

// Invocar el skill PDF
const pdfSkill = new Skill('pdf')

// Endpoint para generar PDF
async function generatePDF(request: Request): Promise<Response> {
  try {
    const body = await request.json() as ReportData

    // Generar contenido HTML del informe
    const htmlContent = generateReportHTML(body)

    // Llamar al skill PDF para generar el documento
    const pdfResult = await pdfSkill.execute({
      operation: 'generate',
      format: 'pdf',
      content: htmlContent,
      options: {
        pageSize: 'A4',
        margins: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm'
        },
        header: generateHeader(body),
        footer: generateFooter(body),
        watermark: body.testResults.some(r => r.isCritical) 
          ? { text: 'CRÍTICO', opacity: 0.1, angle: 45 } 
          : undefined
      }
    })

    return new Response(JSON.stringify({
      success: true,
      pdfUrl: pdfResult.output?.url || '',
      pdfData: pdfResult.output?.data || null
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al generar PDF'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function generateReportHTML(data: ReportData): string {
  const { sampleCode, patient, doctor, sampleInfo, testResults, technique, interpretation, reportInfo } = data

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe de Bacteriología - ${sampleCode}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #333;
      background: #fff;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #0066cc;
    }
    .logo {
      max-width: 100px;
      height: auto;
      margin-bottom: 10px;
    }
    .laboratory-name {
      font-size: 18pt;
      font-weight: bold;
      color: #0066cc;
      margin-bottom: 5px;
    }
    .laboratory-info {
      font-size: 9pt;
      color: #666;
    }
    .report-title {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      margin: 20px 0;
      color: #333;
    }
    .sample-info {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 13pt;
      font-weight: bold;
      color: #0066cc;
      margin: 20px 0 10px 0;
      padding-bottom: 5px;
      border-bottom: 1px solid #ddd;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .label {
      font-weight: bold;
      color: #555;
    }
    .value {
      color: #333;
    }
    .results-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .results-table th,
    .results-table td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    .results-table th {
      background: #0066cc;
      color: white;
      font-weight: bold;
    }
    .results-table tr:nth-child(even) {
      background: #f9f9f9;
    }
    .abnormal {
      background: #fff3cd !important;
      color: #856404;
      font-weight: bold;
    }
    .critical {
      background: #fee !important;
      color: #dc2626;
      font-weight: bold;
    }
    .interpretation {
      background: #f0f9ff;
      border: 1px solid #0066cc;
      border-radius: 5px;
      padding: 15px;
      margin: 20px 0;
    }
    .validation {
      font-size: 9pt;
      color: #666;
      text-align: right;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #0066cc;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      ${reportInfo.logo ? `<img src="${reportInfo.logo}" class="logo" alt="Logo" />` : ''}
      <div class="laboratory-name">${reportInfo.laboratoryName}</div>
      <div class="laboratory-info">
        ${reportInfo.laboratoryAddress}<br/>
        Tel: ${reportInfo.laboratoryPhone} | Email: ${reportInfo.laboratoryEmail}
      </div>
    </div>

    <!-- Report Title -->
    <div class="report-title">
      ${reportInfo.title}<br/>
      <span style="font-size: 12pt; font-weight: normal;">${reportInfo.subtitle}</span>
    </div>

    <!-- Sample Information -->
    <div class="sample-info">
      <div class="info-row">
        <span class="label">Código de Muestra:</span>
        <span class="value">${sampleCode}</span>
      </div>
      <div class="info-grid">
        <div class="info-row">
          <span class="label">Paciente:</span>
          <span class="value">${patient.fullName}</span>
        </div>
        <div class="info-row">
          <span class="label">Cédula:</span>
          <span class="value">${patient.cedula}</span>
        </div>
        <div class="info-row">
          <span class="label">Fecha Nacimiento:</span>
          <span class="value">${new Date(patient.dateOfBirth).toLocaleDateString('es-VE')}</span>
        </div>
        <div class="info-row">
          <span class="label">Sexo:</span>
          <span class="value">${patient.gender}</span>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-row">
          <span class="label">Médico Solicitante:</span>
          <span class="value">${doctor.fullName}</span>
        </div>
        <div class="info-row">
          <span class="label">Especialidad:</span>
          <span class="value">${doctor.specialty || '-'}</span>
        </div>
        <div class="info-row">
          <span class="label">Centro de Salud:</span>
          <span class="value">${doctor.healthCenter || '-'}</span>
        </div>
        <div class="info-row">
          <span class="label">Prioridad:</span>
          <span class="value">${sampleInfo.priority}</span>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-row">
          <span class="label">Tipo de Muestra:</span>
          <span class="value">${sampleInfo.sampleType}</span>
        </div>
        <div class="info-row">
          <span class="label">Fecha Recolección:</span>
          <span class="value">${new Date(sampleInfo.collectionDate).toLocaleDateString('es-VE')}</span>
        </div>
        <div class="info-row">
          <span class="label">Método Recolección:</span>
          <span class="value">${sampleInfo.collectionMethod}</span>
        </div>
      </div>
    </div>

    ${testResults.length > 0 ? `
    <!-- Results Table -->
    <div class="section-title">Resultados de Bacteriología</div>
    <table class="results-table">
      <thead>
        <tr>
          <th>Prueba</th>
          <th>Parámetro</th>
          <th>Resultado</th>
          <th>Unidad</th>
          <th>Referencia</th>
        </tr>
      </thead>
      <tbody>
        ${testResults.map(result => `
          <tr class="${result.isCritical ? 'critical' : result.isAbnormal ? 'abnormal' : ''}">
            <td><strong>${result.testName}</strong><br/><span style="font-size: 9pt;">${result.testCode}</span></td>
            <td>${result.parameterName}<br/><span style="font-size: 9pt;">${result.parameterCode}</span></td>
            <td><strong>${result.resultValue}</strong></td>
            <td>${result.unit || '-'}</td>
            <td>${result.referenceRange || '-'}</td>
          </tr>
          ${result.notes ? `
          <tr>
            <td colspan="6" style="padding: 5px 10px; background: #f9f9f9; font-style: italic; font-size: 9pt;">
              <strong>Notas:</strong> ${result.notes}
            </td>
          </tr>
          ` : ''}
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    ${technique ? `
    <div class="section-title">Técnica Utilizada</div>
    <p>${technique}</p>
    ` : ''}

    ${interpretation ? `
    <div class="section-title">Interpretación</div>
    <div class="interpretation">
      ${interpretation}
    </div>
    ` : ''}

    <!-- Validation Info -->
    <div class="validation">
      <p><strong>Validado por:</strong> ${data.validationInfo.validatedBy}</p>
      <p><strong>Fecha de Validación:</strong> ${new Date(data.validationInfo.validatedAt).toLocaleString('es-VE')}</p>
      <p style="margin-top: 10px; font-size: 8pt;">Este informe es válido solo con firma del Bioanalista responsable</p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong>${reportInfo.laboratoryName}</strong></p>
      <p>${reportInfo.laboratoryAddress}</p>
      <p style="margin-top: 10px;">${new Date().toLocaleString('es-VE')}</p>
    </div>
  </div>
</body>
</html>
  `
}

function generateHeader(data: ReportData): string {
  return `
<div style="padding: 20px; border-bottom: 2px solid #0066cc; text-align: center;">
  <div style="font-size: 16pt; font-weight: bold; color: #0066cc;">
    ${data.reportInfo.laboratoryName}
  </div>
  <div style="font-size: 10pt; color: #666;">
    Informe de Bacteriología
  </div>
</div>
  `
}

function generateFooter(data: ReportData): string {
  return `
<div style="padding: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #666;">
  <p><strong>${data.reportInfo.laboratoryName}</strong> | ${data.reportInfo.laboratoryAddress}</p>
  <p>Generado: ${new Date().toLocaleString('es-VE')}</p>
</div>
  `
}

// Health check
async function healthCheck(): Promise<Response> {
  return new Response(JSON.stringify({
    service: 'PDF Reports Service',
    status: 'running',
    version: '1.0.0'
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

// Servidor
const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Routes
    if (url.pathname === '/health') {
      return healthCheck()
    }

    if (url.pathname === '/generate' && req.method === 'POST') {
      return generatePDF(req)
    }

    // 404
    return new Response(JSON.stringify({
      error: 'Endpoint not found'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  },
})

console.log(`📄 PDF Reports Service running on port ${PORT}`)
console.log(`Health check: http://localhost:${PORT}/health`)
console.log(`Generate PDF: http://localhost:${PORT}/generate`)
