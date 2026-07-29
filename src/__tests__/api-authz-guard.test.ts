import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import { REGISTRO_RUTAS, capacidadesDeRuta } from '@/lib/authz/registro-rutas'
import { rolesCon, ROLES_NO_CLINICOS } from '@/lib/authz/capabilities'

/**
 * Guardián ESTÁTICO de la frontera de API (unidad Nexus OS E0-06,
 * REESCRITO en E0-07).
 *
 * POR QUÉ EXISTE: `firestore.rules` cierra el expediente con `isMedico`, pero las
 * rutas de API usan el Admin SDK, que IGNORA las reglas. Ahí la autorización es una
 * línea de TypeScript que se puede olvidar — y se olvidó dos veces:
 *   · `/api/telesalud/token` emitía tokens de paciente con `verificarMiembro`
 *     (cerrado en la auditoría maestra 2026-07),
 *   · `/api/portal/link` seguía devolviendo un token de 30 días que abría los
 *     documentos clínicos (cerrado en E0-06).
 *
 * POR QUÉ SE REESCRIBIÓ: la versión de E0-06 razonaba sobre el TEXTO de los
 * archivos y usaba el nombre del helper como señal («¿aparece la cadena
 * `verificarMedico`?»). E0-07 sustituye ese helper por capacidades, así que la señal
 * desaparecía y el guardián se habría puesto rojo por un cambio correcto — o peor,
 * habría seguido verde comprobando una cadena que ya no significa nada.
 *
 * Las TRES propiedades de E0-06 se conservan una por una, re-expresadas contra la
 * capacidad DECLARADA (que es más fuerte: `authz-rutas-declaradas.test.ts` verifica
 * además que el código coincide con la declaración):
 *   1. `portal/link` sigue accesible a la asistente del mostrador y emite alcance
 *      `agenda`, nunca `clinico`.
 *   2. `telesalud/token` sigue exigiendo {medico, admin} para emitir alcance
 *      `clinico`.
 *   3. `/api/portal` sigue exigiendo `alcance === 'clinico'` ANTES de leer notas.
 * La cuarta —«ninguna ruta sirve PHI clínico con guarda de miembro»— vive ahora en
 * `authz-rutas-declaradas.test.ts`, expresada como conjuntos de roles.
 */

const DIR_API = resolve(process.cwd(), 'src/app/api')

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

/** Roles que satisfacen la exigencia declarada de una ruta (unión de capacidades). */
function rolesQuePasan(clave: string): readonly string[] {
  const e = REGISTRO_RUTAS[clave]
  expect(e, `${clave} no está declarada en REGISTRO_RUTAS`).toBeTruthy()
  const caps = capacidadesDeRuta(e)
  expect(caps.length, `${clave} no declara ninguna capacidad`).toBeGreaterThan(0)
  return [...new Set(caps.flatMap(c => [...rolesCon(c)]))]
}

describe('E0-06/E0-07 · el escaneo de la frontera de API no pasa vacío', () => {
  it('hay rutas que analizar', () => {
    expect(RUTAS.length).toBeGreaterThan(20)
  })

  it('todas las rutas de disco están declaradas (aquí y en el guardián del registro)', () => {
    const sinDeclarar = RUTAS
      .map(p => relative(DIR_API, p).replace(/[\\/]route\.ts$/, '').replace(/\\/g, '/'))
      .filter(c => !REGISTRO_RUTAS[c])
    expect(sinDeclarar, `sin declarar: ${sinDeclarar.map(rel).join(', ')}`).toEqual([])
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

  it('/api/portal/link sigue accesible a la asistente del mostrador (no rompe el flujo real)', () => {
    // Propiedad de E0-06 re-expresada: antes se comprobaba que el archivo contuviera
    // la cadena `verificarMiembro`; ahora se comprueba lo que de verdad importaba,
    // que la capacidad declarada INCLUYA a `secretaria`. Subirla a una capacidad de
    // médico habría roto el mostrador, y esto lo hace visible.
    expect(rolesQuePasan('portal/link')).toContain('secretaria')
  })

  it('/api/portal/link no se gatea con una capacidad CLÍNICA', () => {
    // Control en el otro sentido: la corrección de E0-06 fue de ALCANCE, no de rol.
    // Si alguien "endurece" el emisor de magic-links poniéndole `clinico.leer`, el
    // gate deja de decir la verdad (el emisor no lee PHI) y arrastra al staff clínico
    // hospitalario a una ruta del mostrador. Con las dos asserts, mover esta ruta
    // hacia arriba o hacia abajo pone el guardián rojo.
    const caps = capacidadesDeRuta(REGISTRO_RUTAS['portal/link'])
    expect(caps).not.toContain('clinico.leer')
    expect(caps).not.toContain('clinico.escribir')
  })

  it('/api/portal exige alcance clínico antes de devolver documentos', () => {
    const src = codigo(PORTAL)
    expect(src).toMatch(/alcance\s*!==\s*'clinico'/)
    // Y el gate está ANTES de tocar las notas.
    expect(src.indexOf("alcance !== 'clinico'")).toBeLessThan(src.indexOf("collection('notas')"))
  })

  it('/api/telesalud/token sigue exigiendo médico para emitir alcance clínico', () => {
    const src = codigo(TELESALUD)
    expect(src).toContain("'clinico'")
    // Propiedad de E0-06 re-expresada como conjunto de roles: la capacidad que
    // declara la ruta tiene que ser exactamente {medico, admin}. Ni la asistente ni
    // el staff clínico hospitalario pueden emitir un token de alcance clínico.
    const roles = [...rolesQuePasan('telesalud/token')].sort()
    expect(roles).toEqual(['admin', 'medico'])
    for (const r of ROLES_NO_CLINICOS) expect(roles).not.toContain(r)
  })
})
