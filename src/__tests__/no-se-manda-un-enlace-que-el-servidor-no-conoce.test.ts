/**
 * GOLDEN — no se le manda a un paciente un enlace que el servidor no conoce.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * «Pedir reseña» hace tres cosas seguidas: crea la solicitud, coge el token que
 * devuelve y abre WhatsApp con un enlace que lo lleva dentro.
 *
 * `crearSolicitudResena` escribe con `setDoc`, y **una escritura del SDK sin red
 * resuelve en local**: la promesa cumple, la función devuelve el token, y el
 * mensaje sale. El servidor no ha visto ese token nunca.
 *
 * El paciente lo abre y lee **«Enlace no válido»** — comprobado en
 * `app/resena/[token]`, que es exactamente lo que contesta cuando el documento
 * no existe. El médico cree que pidió la reseña; el paciente recibe un enlace
 * roto de su consultorio.
 *
 * ── CÓMO SE LLEGÓ AQUÍ ──────────────────────────────────────────────────────
 *
 * Buscando otra cosa. Este camino era el último candidato del barrido de la
 * unidad 38 —«¿se cuelga sin red?»— y la respuesta es **no**: es una escritura,
 * y las escrituras resuelven en local. Justo esa respuesta es la que destapa
 * el defecto de verdad: **resolver en local es precisamente el problema**
 * cuando lo siguiente que se hace es mandarle algo a una persona.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * `el-dato-tiene-que-LLEGAR.md`, en su forma más literal: cuando algo cruza una
 * frontera, hay que mirar del otro lado antes de dar nada por entregado. Aquí
 * la frontera es un mensaje a una persona real, y **no se puede deshacer**.
 *
 * Una escritura local no es una escritura entregada. Si de ella cuelga un acto
 * hacia fuera —un WhatsApp, un correo, una receta—, hay que confirmar antes.
 *
 * ── LO QUE ESTO NO ES ───────────────────────────────────────────────────────
 *
 * No es «bloquear la pantalla sin red». Lo demás del modal sigue funcionando:
 * lo único que se detiene es el acto que sale hacia el paciente.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando la comprobación, cae. Poniéndola DESPUÉS de crear la solicitud,
 * cae el caso del orden — crear el documento y no mandarlo dejaría basura
 * sincronizándose sin motivo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · `navigator.onLine` sabe si hay interfaz de red, no si el servidor
 *   responde. Un wifi de hotel que engancha y no enruta pasaría el filtro.
 *   Cierra el caso frecuente, no todos.
 * · No barre los demás actos hacia fuera de la aplicación (recordatorios,
 *   recetas, portal). Este carril sólo ha mirado éste, y **no declara buenos
 *   los otros**.
 * · No prueba el envío real de WhatsApp, que sale de la aplicación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/components/AppointmentModal.tsx', 'utf8')
const cuerpo = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')

/** El cuerpo de `handlePedirResena`, hasta su cierre. */
function handler(): string {
  const i = cuerpo.indexOf('const handlePedirResena')
  expect(i, 'el handler existe').toBeGreaterThan(-1)
  const j = cuerpo.indexOf('if (!open) return null', i)
  return cuerpo.slice(i, j > i ? j : i + 1800)
}

describe('no se manda un enlace que el servidor no conoce', () => {
  it('sin red, el acto hacia el paciente no ocurre', () => {
    const h = handler()
    expect(h).toContain('navigator.onLine')
    expect(h).toMatch(/Sin conexión/)
  })

  it('la comprobación va ANTES de crear la solicitud', () => {
    // Crear el documento y no mandarlo dejaría basura sincronizándose.
    const h = handler()
    const iRed = h.indexOf('navigator.onLine')
    const iCrear = h.indexOf('crearSolicitudResena')
    expect(iRed).toBeGreaterThan(-1)
    expect(iCrear).toBeGreaterThan(-1)
    expect(iRed, 'se pregunta por la red antes de escribir nada').toBeLessThan(iCrear)
  })

  it('y sale del handler: no sigue hasta WhatsApp', () => {
    const h = handler()
    const iRed = h.indexOf('navigator.onLine')
    const trozo = h.slice(iRed, iRed + 400)
    expect(trozo).toContain('return')
    // El `return` va antes de abrir WhatsApp.
    const iWa = h.indexOf('openWhatsApp')
    expect(h.slice(iRed, iWa)).toContain('return')
  })

  it('el otro lado sigue contestando «no válido» a un token que no existe', () => {
    // Si esto cambiara, la premisa del arreglo dejaría de sostenerse y habría
    // que volver a mirarlo — no borrarlo en silencio.
    const paciente = readFileSync('src/app/resena/[token]/page.tsx', 'utf8')
    expect(paciente).toContain("if (!r) setError('Enlace no válido')")
  })

  it('la solicitud se sigue creando con setDoc: la premisa está viva', () => {
    // El defecto nace de que una escritura del SDK resuelve en local. Si algún
    // día pasa por una ruta de API, esta guarda sobra — y hay que quitarla a
    // conciencia, no dejarla como superstición.
    const rev = readFileSync('src/lib/reviews.ts', 'utf8')
    const i = rev.indexOf('export async function crearSolicitudResena')
    expect(rev.slice(i, i + 900)).toContain('setDoc(')
  })
})
