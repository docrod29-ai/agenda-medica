/**
 * S-006 · Panel de Lujo (S-ciberseguridad) — siete rutas seguían devolviendo el
 * texto del error del Admin SDK al cliente, y ese texto trae rutas de documento
 * con el id del paciente dentro.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `error: e.message` (o `motivo: e.message`) dentro de un `NextResponse.json`
 * en: hospital/mutar, clinic/unirse, clinic/crear, config/imagen,
 * mantenimiento/backfill-contadores (×2) y auditoria/registrar. REG-534 había
 * cerrado 46 sitios y su «Qué NO cubre» afirmaba que no quedaba ninguno: era
 * falso.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor S-ciberseguridad, S-006 (P2); el equipo rojo abrió los siete sitios
 * y los confirmó en la línea citada.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * REG-534 cazó `String(err)` y no la forma `e instanceof Error ? e.message :
 * …`, y no dejó guardián: cuatro rutas nuevas repitieron el patrón.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * El detalle va a `safeLog.error` (redactado) y al cliente le llega
 * `errorAlCliente(mensaje)`. Este guardián recorre `src/app/api/**\/route.ts` y
 * falla ante cualquier `e.message`/`err.message`/`String(e)` que viaje en un
 * `NextResponse.json`. Lo que queda en archivos de otras rebanadas va en
 * `PENDIENTES_DE_OTRA_REBANADA`: la lista sólo puede BAJAR (trinquete).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Mensajes que la propia ruta construye a partir de centinelas propios
 * (`msg === 'CAMA_OCUPADA'`): son texto nuestro, no del proveedor. Mensajes
 * guardados DENTRO de la aplicación (latidos, notas de respaldo), que se acotan
 * con redactarString en vez de suprimirse.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()
const API = join(RAIZ, 'src/app/api')

function rutas(dir: string): string[] {
  const out: string[] = []
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) out.push(...rutas(p))
    else if (n === 'route.ts') out.push(p)
  }
  return out
}

/**
 * Sitios que SÍ mandan el mensaje crudo dentro de un JSON de respuesta.
 * Una línea que hace `error: e instanceof Error ? e.message : 'x'`, o
 * `error: e.message`, `motivo: err.message`, `error: String(e)`.
 */
export function sitiosQueFiltranElError(src: string): number[] {
  const lineas = src.split('\n')
  const patron = /\b(error|motivo|mensaje)\s*:\s*(?:\(?\s*)?(?:(?:e|err|error)\s+instanceof\s+Error\s*\?\s*)?(?:(?:e|err|error)\.message|String\((?:e|err|error)\))/
  const out: number[] = []
  lineas.forEach((l, i) => {
    if (/^\s*(\/\/|\*)/.test(l)) return           // comentarios
    if (patron.test(l)) out.push(i + 1)
  })
  return out
}

/**
 * TRINQUETE. Lo que hoy filtra y está en archivos de OTRA rebanada (handoff a
 * UI-CONFIG y AGENDA-MENSAJERIA). Quitar una entrada cuando se arregle; añadir
 * una es lo que este guardián existe para impedir.
 */
const PENDIENTES_DE_OTRA_REBANADA: Record<string, { lineas: number; quien: string }> = {
  'config/imagen': { lineas: 1, quien: 'UI-CONFIG (S-006)' },
  'mantenimiento/backfill-contadores': { lineas: 2, quien: 'UI-CONFIG (S-006)' },
  // Los cron contestan al planificador, no al navegador; aun así el texto del
  // proveedor no debería salir. AGENDA-MENSAJERIA (S-006, hermano).
  'cron/retencion': { lineas: 1, quien: 'AGENDA-MENSAJERIA' },
  'cron/reminders': { lineas: 1, quien: 'AGENDA-MENSAJERIA' },
  'cron/vigilante': { lineas: 1, quien: 'AGENDA-MENSAJERIA' },
  'cron/limpiar-audio': { lineas: 1, quien: 'AGENDA-MENSAJERIA' },
}

describe('S-006 · ninguna ruta devuelve el error crudo del Admin SDK al cliente', () => {
  const archivos = rutas(API)

  it('el escáner encuentra rutas (si no, pasaría vacío)', () => {
    expect(archivos.length).toBeGreaterThan(80)
  })

  it('el detector sabe fallar (probado al revés)', () => {
    expect(sitiosQueFiltranElError("return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })")).toEqual([1])
    expect(sitiosQueFiltranElError("return NextResponse.json({ ok: false, motivo: e.message })")).toEqual([1])
    expect(sitiosQueFiltranElError("return NextResponse.json({ error: String(err) })")).toEqual([1])
    expect(sitiosQueFiltranElError("// error: e.message en un comentario\nreturn errorAlCliente()")).toEqual([])
    expect(sitiosQueFiltranElError("if (e instanceof Error && e.message === 'DUPLICADO') return NextResponse.json({ ok: false, error: 'DUPLICADO: …' })")).toEqual([])
  })

  it('las siete del hallazgo en archivos de SEGURIDAD ya no filtran', () => {
    for (const r of ['clinic/unirse', 'clinic/crear', 'auditoria/registrar', 'superadmin/paquetes', 'superadmin/accion', 'superadmin/clientes', 'soporte', 'arco/ligar']) {
      const src = readFileSync(join(API, r, 'route.ts'), 'utf8')
      expect(sitiosQueFiltranElError(src), r).toEqual([])
    }
  })

  it('todo lo demás está limpio, o está en la lista de pendientes con dueño — y la lista sólo baja', () => {
    const halladas: Record<string, number> = {}
    for (const f of archivos) {
      const clave = relative(API, f).replace(/[\\/]route\.ts$/, '').split('\\').join('/')
      const n = sitiosQueFiltranElError(readFileSync(f, 'utf8')).length
      if (n > 0) halladas[clave] = n
    }
    const noDeclaradas = Object.entries(halladas).filter(([k, n]) => !(k in PENDIENTES_DE_OTRA_REBANADA) || PENDIENTES_DE_OTRA_REBANADA[k].lineas < n)
    expect(noDeclaradas, `rutas que devuelven el error crudo: ${JSON.stringify(noDeclaradas)}`).toEqual([])
    // Trinquete: una pendiente ya arreglada se quita de la lista (no se deja para siempre).
    const yaLimpias = Object.keys(PENDIENTES_DE_OTRA_REBANADA).filter(k => !(k in halladas))
    expect(yaLimpias, `quitar de PENDIENTES_DE_OTRA_REBANADA (ya no filtran): ${yaLimpias.join(', ')}`).toEqual([])
  })
})
