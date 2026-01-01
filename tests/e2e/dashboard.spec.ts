import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login')
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should display dashboard for authenticated users', async ({ page }) => {
    await page.fill('input[name="email"]', 'admin@laboratorio.com')
    await page.fill('input[name="password"]', 'Admin123!')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 5000 })
    await expect(page.locator('h1:has-text("Sistema de Gestión Laboratorial")')).toBeVisible()
  })

  test('should display quick action cards', async ({ page }) => {
    await page.fill('input[name="email"]', 'admin@laboratorio.com')
    await page.fill('input[name="password"]', 'Admin123!')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/')
    await expect(page.locator('text=Registrar Muestra')).toBeVisible()
    await expect(page.locator('text=Panel de Control')).toBeVisible()
    await expect(page.locator('text=Resultados')).toBeVisible()
    await expect(page.locator('text=Inventario')).toBeVisible()
    await expect(page.locator('text=Equipos')).toBeVisible()
    await expect(page.locator('text=Auditoría')).toBeVisible()
    await expect(page.locator('text=Configuración')).toBeVisible()
  })

  test('should logout successfully', async ({ page }) => {
    await page.fill('input[name="email"]', 'admin@laboratorio.com')
    await page.fill('input[name="password"]', 'Admin123!')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/')
    await page.click('button:has-text("Cerrar Sesión")')
    await page.waitForURL(/.*login/, { timeout: 5000 })
    await expect(page.locator('text=Iniciar Sesión')).toBeVisible()
  })
})
