/**
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * MEDIDO el 1-sep-2026: se preguntó de verdad en el Consultor de Evidencia, sin
 * proveedor detrás, y lo que apareció **en el sitio de la respuesta** fue:
 *
 *     ⚠️ No hay API key de Claude configurada.
 *
 * Contado después en el árbol: **15 rutas** devolvían jerga de proveedor al
 * médico, en **7 redacciones distintas** para el mismo hecho — desde la más
 * completa hasta `OPENAI_API_KEY no configurada` a secas.
 *
 * Y una peor: `/api/telesalud/sala` devolvía `ok: true` con una URL de
 * `meet.example.com` y el aviso «DAILY_API_KEY no configurada — usando URL
 * ficticia». Esa pantalla la abre **el paciente** con su token del portal.
 *
 * ── POR QUÉ NO ES REDACCIÓN ─────────────────────────────────────────────────
 *
 * 1. Nombraba al proveedor —«Claude», «OpenAI», «AssemblyAI», «DAILY»— en la
 *    interfaz de un producto clínico. `security-tenant` ya prohíbe que un error
 *    cuente el interior.
 * 2. Salía **donde iba la respuesta**. En una superficie de evidencia, lo que
 *    ocupa el lugar de la evidencia tiene que ser inconfundiblemente
 *    no-evidencia.
 * 3. No decía **qué NO se perdió**, que es la pregunta real a media consulta:
 *    ¿se fue el audio? ¿se fue lo que llevo escrito?
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Un solo mensaje por capacidad, desde `cuando-la-ia-no-esta`, contestando qué
 * pasó, qué queda y qué hacer. Ninguna ruta de `/api` manda un nombre de
 * proveedor al cliente.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No vigila los mensajes de error de OTRAS causas (red caída, cuota agotada):
 *   sólo el de «la IA no está activada».
 * · No comprueba en navegador que el mensaje se PINTE distinto de una respuesta.
 *   Que salga en el sitio de la respuesta sigue declarado como riesgo abierto.
 * · Las pantallas de CONFIGURACIÓN sí pueden nombrar al proveedor: es donde el
 *   médico pega su llave. Quedan fuera del barrido a propósito.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { iaNoDisponible } from '@/lib/ia/fallo-proveedor'

const API = join(__dirname, '..', 'app', 'api')

function rutas(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) rutas(p, out)
    else if (e === 'route.ts') out.push(p)
  }
  return out
}

describe('cuando la IA no está, el médico entiende qué pasa', () => {
  it('el mensaje no nombra a ningún proveedor', () => {
    for (const cap of ['nota', 'transcripcion', 'diarizacion', 'evidencia', 'vision', 'razonamiento'] as const) {
      const m = iaNoDisponible(cap).mensaje
      expect(m).not.toMatch(/claude|openai|anthropic|assembly|api[ _]?key|gpt|whisper/i)
    }
  })

  it('dice qué NO se perdió, que es la pregunta real a media consulta', () => {
    expect(iaNoDisponible('transcripcion').mensaje).toMatch(/audio.*NO se pierde/i)
    expect(iaNoDisponible('nota').mensaje).toMatch(/se conserva/i)
  })

  it('no ofrece reintentar lo que no se arregla reintentando', () => {
    expect(iaNoDisponible('evidencia').reintentar).toBe(false)
  })

  it('a quien NO puede configurar no se le manda a Configuración', () => {
    const suyo = iaNoDisponible('nota', true).mensaje
    const ajeno = iaNoDisponible('nota', false).mensaje
    expect(suyo).toMatch(/Configuración/)
    expect(ajeno).not.toMatch(/Configuración/)
    expect(ajeno).toMatch(/administra el consultorio/i)
  })

  it('lleva una clase, para poder pintarlo distinto de una respuesta', () => {
    expect(iaNoDisponible('evidencia').clase).toBe('ia_no_disponible')
  })

  /**
   * LA CONEXIÓN, que es lo que fallaba: ninguna ruta manda el nombre del
   * proveedor al cliente. Se barre la FAMILIA (cualquier proveedor, en
   * cualquier redacción), no la ortografía concreta que ya vi — lección de la
   * unidad 92.
   */
  it('ninguna ruta de /api manda un nombre de proveedor al cliente', () => {
    const malos: string[] = []
    for (const f of rutas(API)) {
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
      for (const l of src.split('\n')) {
        /*
         * DOS COSAS QUEDAN FUERA, Y LAS DOS SON CORRECTAS.
         *
         * 1. `safeLog.*` — es el registro del SERVIDOR, no viaja al cliente. La
         *    primera versión de este barrido lo cazaba porque la cadena
         *    `'[antibiograma-vision] Claude error:'` contiene «error:», y habría
         *    obligado a borrar un log útil para pasar una prueba.
         * 2. `avisoAlMedico(...)` — nombra al proveedor A PROPÓSITO. Cuando una
         *    llave DEL CONSULTORIO es rechazada, el médico tiene que saber a
         *    cuál proveedor entrar. Prohibirlo aquí sería romper una decisión
         *    que el producto ya tomó bien.
         *
         * Lo que se vigila es el literal escrito a mano en la respuesta.
         */
        if (/safeLog|avisoAlMedico|console\./.test(l)) continue
        if (/[{,]\s*(error|warning|mensaje)\s*:/.test(l)
            && /['"`][^'"`]*\b(claude|openai|anthropic|assemblyai|daily)\b[^'"`]*['"`]/i.test(l)) {
          malos.push(`${f.slice(f.indexOf('src/'))}: ${l.trim().slice(0, 100)}`)
        }
      }
    }
    expect(malos, `Estas rutas le cuentan al médico de quién es el modelo. Usa `
      + `\`iaNoDisponible\` de \`@/lib/ia/fallo-proveedor\`:\n  ${malos.join('\n  ')}`).toEqual([])
  })
})
