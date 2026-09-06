import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { limpiarComentarios } from '@/lib/authz/analisis-estatico'
import { errorAlCliente, MENSAJE_GENERICO } from '@/lib/security/error-al-cliente'

/**
 * EL ERROR CRUDO NO SALE AL CLIENTE — REG-534.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Cuarenta rutas de `src/app/api` (46 sitios) cerraban su `catch` con
 * `NextResponse.json({ error: String(err) }, { status: 500 })` — una lo
 * mandaba en la URL de un redirect y dos lo metían en un aviso de la
 * respuesta. El `grep` de la auditoría contó 25: el `\b` tras el paréntesis
 * se comía los `String(e).slice(…)`. El guardián de abajo no usa `grep`.
 *
 * `String(err)` de un error del Admin SDK trae nombres de colecciones, rutas de documentos con el id del paciente,
 * mensajes del proveedor y a veces el dato que provocó el fallo. Para quien
 * sondea la API es reconocimiento gratis; para el médico, ruido.
 *
 * `public/booking` ya lo había arreglado a mano (mensaje genérico, detalle al
 * log). Las otras, no, y nada impedía que la siguiente ruta naciera igual.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría de seguridad del 5-sep-2026 («`String(err)` hacia el cliente en
 * ~25 rutas y en un redirect»). Verificado con `grep` sobre `src/app/api`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `errorAlCliente(mensaje?, status?)` NO recibe el error: no puede filtrarlo.
 * El detalle sigue yendo a `safeLog`, redactado. Lo que se queda dentro de la
 * aplicación (una nota de respaldo, un latido) pasa por `redactarString` y se
 * acota. Y el guardián de abajo recorre TODAS las rutas: `String(err)` o
 * `String(e)` sólo pueden aparecer en una línea que logue o redacte.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con las rutas como estaban (`git stash` de `src/app/api`), el caso 3 lista
 * los 46 sitios y el 5 cae. El detector se prueba además contra un fixture
 * con el patrón viejo (caso 4).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Otras formas de filtrar el error (`err.message`, `err.stack` en la
 *   respuesta): se buscó y hoy no hay ninguna en un `NextResponse.json`, pero
 *   el guardián sólo vigila `String(…)`. Se declara.
 * - No ejecuta las rutas: es de fuente, con los comentarios quitados.
 */

const RAIZ = join(process.cwd(), 'src/app/api')

function rutas(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) rutas(p, acc)
    else if (n === 'route.ts') acc.push(p)
  }
  return acc
}

/** Líneas que convierten el error en texto sin loguearlo ni redactarlo. */
export function lineasQueFiltranElError(fuente: string): string[] {
  return limpiarComentarios(fuente).split('\n')
    .filter(l => /String\((err|e)\)/.test(l))
    .filter(l => !/safeLog|console\.|redactarString\(/.test(l))
    .map(l => l.trim())
}

describe('REG-534 · errorAlCliente', () => {
  it('1 · devuelve ok:false con el mensaje genérico y 500, y no acepta el error', async () => {
    const r = errorAlCliente()
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ ok: false, error: MENSAJE_GENERICO })
    expect(errorAlCliente.length).toBeLessThanOrEqual(2)   // (mensaje, status): ningún parámetro para el error
  })

  it('2 · el mensaje genérico dice qué hacer y no menciona nada interno', () => {
    expect(MENSAJE_GENERICO).toMatch(/Intenta de nuevo/)
    expect(MENSAJE_GENERICO).not.toMatch(/Firestore|Firebase|Error:|stack/i)
    const r = errorAlCliente('No se pudo procesar la imagen.', 502)
    expect(r.status).toBe(502)
  })
})

describe('REG-534 · ninguna ruta convierte el error en texto para el cliente', () => {
  const todas = rutas(RAIZ)

  it('3 · EL CASO: en las rutas de src/app/api, String(err) sólo vive en líneas que loguean o redactan', () => {
    expect(todas.length).toBeGreaterThan(90)
    const culpables: string[] = []
    for (const p of todas) {
      for (const l of lineasQueFiltranElError(readFileSync(p, 'utf8'))) culpables.push(`${p.replace(process.cwd() + '/', '')}: ${l}`)
    }
    // Antes del arreglo: 46 sitios en 40 rutas aquí.
    expect(culpables).toEqual([])
  })

  it('4 · el detector caza el patrón viejo y deja pasar el bueno', () => {
    expect(lineasQueFiltranElError(`
      } catch (err) {
        safeLog.error('[x]', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
      }`)).toEqual(["return NextResponse.json({ error: String(err) }, { status: 500 })"])
    expect(lineasQueFiltranElError(`return NextResponse.redirect(\`/c?msg=\${encodeURIComponent(String(err))}\`)`)).toHaveLength(1)
    expect(lineasQueFiltranElError(`
      } catch (err) {
        safeLog.error('[x]', err)
        // antes: String(err)
        return errorAlCliente()
      }`)).toEqual([])
    expect(lineasQueFiltranElError("ultimoError = redactarString(String(err)).slice(0, 300)")).toEqual([])
  })

  it('5 · las rutas que respondían el error crudo usan el helper', () => {
    const usan = todas.filter(p => readFileSync(p, 'utf8').includes('errorAlCliente('))
    expect(usan.length).toBeGreaterThanOrEqual(20)
  })
})
