import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * REG-339 — LA NOTA CLÍNICA ENTERA SE ESCRIBÍA EN LA CONSOLA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * En la pantalla de consulta, cuando la IA no lograba estructurar una nota
 * preoperatoria, el aviso de diagnóstico hacía:
 *
 *     console.warn('[procesar] Secciones preop vacías. …', 'Respuesta:', data)
 *
 * `data` es la **nota clínica estructurada completa** — resumen clínico,
 * laboratorios, cirugía propuesta. Dos líneas más arriba el mismo objeto se lee
 * para decidir si las secciones venían vacías, así que no hay duda de qué es.
 *
 * ── POR QUÉ UN REDACTOR NO LO ARREGLA ────────────────────────────────────────
 *
 * `safeLog` caza CURP, RFC, correos, teléfonos, tarjetas y tokens. Aquí el PHI
 * **es la prosa clínica misma**: «varón de 62 años con angina inestable» no
 * coincide con ningún patrón y no lo va a hacer nunca. Contra un cuerpo clínico
 * libre, la única defensa es no mandarlo.
 *
 * La regla del proyecto no distingue consola del navegador de registro de
 * servidor, y con razón: la consola de un consultorio queda en el equipo, se
 * abre en soporte, y viaja en una captura de pantalla.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría WS-13 del Master Completion Loop, buscando PHI en `console.*`.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El aviso quería decir POR QUÉ falló y volcó el objeto entero por comodidad.
 * Lo que hacía falta para diagnosticar era la FORMA de la respuesta —qué tipo se
 * mandó, qué secciones llegaron vacías—, no su contenido.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Un cuerpo de respuesta clínica no entra en `console.*`. Se registra su forma:
 * banderas, longitudes, códigos de estado.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · Vigila las pantallas clínicas de `src/app/(dashboard)`, que es donde vive el
 *   cuerpo de la nota. No recorre el repositorio entero.
 * · Reconoce el vertido por el NOMBRE de la variable (`data`, `json`, `body`,
 *   `respuesta`, `secciones`, `nota`). Un vertido con otro nombre se le escapa:
 *   es un cedazo, no una demostración. Se declara en vez de aparentar cobertura.
 * · No prueba que `safeLog` redacte bien — eso es de `errores-sin-phi`.
 * · No cubre PHI que salga por otras vías (red, almacenamiento, una captura).
 */

const RAIZ = 'src/app/(dashboard)'

/** Nombres que en estas pantallas suelen contener un cuerpo clínico entero. */
const CUERPO = /\b(data|json|body|respuesta|payload|secciones|nota|paciente|patient)\b/

function pantallas(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) pantallas(p, acc)
    else if (/\.tsx?$/.test(e.name)) acc.push(p)
  }
  return acc
}

/**
 * Un `console.*` que pasa una variable de cuerpo como argumento propio.
 *
 * Se exige que el argumento sea la variable SOLA o una propiedad suya
 * (`data._causa`), no cualquier mención: `data.secciones?.x?.trim()` dentro de
 * una expresión booleana es una BANDERA, que es justo lo que sí se puede
 * registrar.
 */
function vertidos(): string[] {
  const malos: string[] = []
  for (const archivo of pantallas(RAIZ)) {
    readFileSync(archivo, 'utf8').split('\n').forEach((linea, i) => {
      const l = linea.trim()
      if (l.startsWith('*') || l.startsWith('//')) return
      const m = l.match(/console\.(log|warn|error|info)\(([^)]*)\)/)
      if (!m) return
      const args = m[2].split(',').map(a => a.trim())
      for (const a of args) {
        // Sólo la variable pelada, o `variable.propiedad` sin llamadas ni operadores.
        if (/^[A-Za-z_$][\w$]*(\.[\w$]+)*$/.test(a) && CUERPO.test(a)) {
          malos.push(`${archivo}:${i + 1} → ${l}`)
        }
      }
    })
  }
  return malos
}

describe('REG-339 · el cuerpo de una nota clínica no entra en la consola', () => {
  it('ninguna pantalla del dashboard vuelca un cuerpo de respuesta', () => {
    expect(vertidos().join('\n')).toBe('')
  })

  it('el aviso de preop sigue diciendo lo que hace falta para diagnosticar', () => {
    // Que no se arregle borrando el aviso: el diagnóstico tenía valor. Lo que
    // cambia es QUÉ se registra — la forma, no el contenido.
    const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    expect(src).toMatch(/Secciones preop vacías/)
    expect(src).toMatch(/Vacías:/)
    expect(src).not.toMatch(/Secciones preop vacías[^\n]*'Respuesta:', data/)
  })

  it('el cedazo sabe fallar, y sabe NO fallar', () => {
    // Probado al revés sin tocar el árbol.
    const vertido = "console.warn('[x] falló', 'Respuesta:', data)"
    const bandera = "console.warn('[x] falló', { vacia: !data.secciones?.resumenClinico?.trim() })"
    const arg = (l: string) => (l.match(/console\.\w+\(([^)]*)\)/)?.[1] ?? '')
      .split(',').map(a => a.trim())
      .some(a => /^[A-Za-z_$][\w$]*(\.[\w$]+)*$/.test(a) && CUERPO.test(a))
    expect(arg(vertido)).toBe(true)
    expect(arg(bandera)).toBe(false)
  })
})
