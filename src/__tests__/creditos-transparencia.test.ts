import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PLANES, TOPE_ECONOMICO, MOTORES, RECARGA, estadoCreditos } from '@/lib/planes-ia'

/**
 * Transparencia de créditos de IA (AI_CREDITS): el copy público debe coincidir
 * EXACTAMENTE con el comportamiento real del gate (procesar/route.ts):
 * tras agotar créditos, ⚡ Rápida sigue gratis pero SOLO hasta TOPE_ECONOMICO
 * notas/mes; pasado ese punto la IA se PAUSA (HTTP 402). Nada de "nunca te
 * quedas sin IA".
 */
const leer = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('creditos-transparencia', () => {
  it('las notas gratis por motor coinciden con los créditos del plan (matemática honesta)', () => {
    // Clínica: 160 créditos ÷ 3 (Estándar) ≈ 50 notas
    expect(Math.floor(PLANES.clinica.creditos / MOTORES.estandar.creditos)).toBe(53)
    // Pro: 450 ÷ 10 (Máxima) = 45 notas
    expect(PLANES.premium.creditos / MOTORES.maxima.creditos).toBe(45)
  })

  it('los bullets de cada plan declaran el tope económico real (no "nunca sin IA")', () => {
    const bulletsClinica = PLANES.clinica.incluye.join(' ')
    const bulletsPro = PLANES.premium.incluye.join(' ')
    // Menciona el tope correcto y que "se pausa"
    expect(bulletsClinica).toContain(String(TOPE_ECONOMICO.pro))
    expect(bulletsClinica).toMatch(/se pausa/i)
    expect(bulletsPro).toContain(String(TOPE_ECONOMICO.premium))
    expect(bulletsPro).toMatch(/se pausa/i)
  })

  it('ningún plan promete IA ilimitada gratis', () => {
    for (const plan of Object.values(PLANES)) {
      const txt = plan.incluye.join(' ').toLowerCase()
      expect(txt).not.toContain('nunca te quedas sin ia')
      expect(txt).not.toContain('nunca se detiene')
    }
  })

  it('la página de precios muestra el tope y el precio de recarga reales', () => {
    const precios = leer('src/app/precios/page.tsx')
    // Usa las constantes, no números mágicos desincronizados
    expect(precios).toContain('TOPE_ECONOMICO.pro')
    expect(precios).toContain('TOPE_ECONOMICO.premium')
    expect(precios).toContain('RECARGA.precioMXN')
    // No reaparece el absoluto
    expect(precios.toLowerCase()).not.toContain('nunca te quedas sin ia')
  })

  it('la recarga es un paquete real con precio', () => {
    expect(RECARGA.creditos).toBeGreaterThan(0)
    expect(RECARGA.precioMXN).toBeGreaterThan(0)
  })

  it('estadoCreditos marca "agotado" al llegar a 0 y "cerca" al 80%', () => {
    expect(estadoCreditos(160, 160).alerta).toBe('agotado')
    expect(estadoCreditos(130, 160).alerta).toBe('cerca')
    expect(estadoCreditos(10, 160).alerta).toBe('ok')
  })
})
