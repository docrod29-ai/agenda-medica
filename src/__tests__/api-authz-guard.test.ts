import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

/**
 * Guardián ESTÁTICO de la frontera de API (unidad Nexus OS E0-06).
 * Molde: `csp-guard.test.ts` y `firestore-rules-guard.test.ts`.
 *
 * POR QUÉ: `firestore.rules` cierra el expediente con `isMedico`, pero las rutas de
 * API usan el Admin SDK, que IGNORA las reglas. Ahí la autorización es una línea de
 * TypeScript que se puede olvidar — y se olvidó dos veces:
 *   · `/api/telesalud/token` emitía tokens de paciente con `verificarMiembro`
 *     (cerrado en la auditoría maestra 2026-07),
 *   · `/api/portal/link` seguía devolviendo un token de 30 días que abría los
 *     documentos clínicos (cerrado en E0-06).
 *
 * Este archivo convierte «no se nos vuelva a olvidar» en una prueba: si una ruta
 * nueva lee una colección clínica y se conforma con `verificarMiembro`, esto se
 * pone rojo antes de llegar a producción.
 */

const DIR_API = resolve(process.cwd(), 'src/app/api')

/** Colecciones cuyo contenido es secreto médico (mismas que van a `isMedico`). */
const COLECCIONES_CLINICAS = ['notas', 'laboratorios', 'fotos', 'clinico']

function rutasDeApi(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) rutasDeApi(p, out)
    else if (e.name === 'route.ts') out.push(p)
  }
  return out
}

/** El código SIN comentarios: en este repo los comentarios citan a propósito el
 *  nombre del guardián que se cambió («va con verificarMEDICO, no verificarMiembro»). */
function codigo(p: string): string {
  return readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const RUTAS = rutasDeApi(DIR_API)
const rel = (p: string) => relative(process.cwd(), p)

describe('E0-06 · ninguna ruta de API sirve contenido clínico con guarda de miembro', () => {
  it('hay rutas que analizar (control de que el escaneo no está vacío)', () => {
    expect(RUTAS.length).toBeGreaterThan(20)
  })

  it('leer una colección clínica exige más que `verificarMiembro`', () => {
    const infractoras: string[] = []
    for (const p of RUTAS) {
      const src = codigo(p)
      const leeClinico = COLECCIONES_CLINICAS.some(c => src.includes(`collection('${c}')`))
      if (!leeClinico) continue
      // Vías legítimas: rol médico verificado, o el token del PACIENTE (que desde
      // E0-06 lleva alcance y se comprueba en el handler).
      const conGuardaFuerte = src.includes('verificarMedico') || src.includes('verificarTokenPaciente')
      if (src.includes('verificarMiembro') || !conGuardaFuerte) infractoras.push(rel(p))
    }
    expect(infractoras, `rutas con PHI clínico bajo guarda insuficiente: ${infractoras.join(', ')}`).toEqual([])
  })
})

describe('E0-06 · el emisor de magic-links no puede regalar alcance clínico', () => {
  const LINK = resolve(DIR_API, 'portal/link/route.ts')
  const PORTAL = resolve(DIR_API, 'portal/route.ts')
  const TELESALUD = resolve(DIR_API, 'telesalud/token/route.ts')

  it('/api/portal/link emite alcance `agenda` explícito y nunca `clinico`', () => {
    const src = codigo(LINK)
    expect(src).toContain("'agenda'")
    expect(src, 'portal/link NO debe emitir tokens de alcance clínico: lo llama cualquier rol')
      .not.toContain("'clinico'")
  })

  it('/api/portal/link sigue siendo accesible a cualquier miembro (no rompe a la asistente)', () => {
    // Subirla a verificarMedico habría roto el flujo real del mostrador. La
    // corrección es de ALCANCE, no de rol: si alguien la "arregla" cambiando el
    // guardián, este test lo hace visible.
    expect(codigo(LINK)).toContain('verificarMiembro')
  })

  it('/api/portal exige alcance clínico antes de devolver documentos', () => {
    const src = codigo(PORTAL)
    expect(src).toMatch(/alcance\s*!==\s*'clinico'/)
    // Y el gate está ANTES de tocar las notas.
    expect(src.indexOf("alcance !== 'clinico'")).toBeLessThan(src.indexOf("collection('notas')"))
  })

  it('/api/telesalud/token sigue exigiendo médico para emitir alcance clínico', () => {
    const src = codigo(TELESALUD)
    expect(src).toContain('verificarMedico')
    expect(src).toContain("'clinico'")
    expect(src).not.toContain('verificarMiembro')
  })
})
