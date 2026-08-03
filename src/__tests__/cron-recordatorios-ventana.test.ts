/**
 * GOLDEN — el cron de recordatorios sólo lee las citas que le importan.
 *
 * ── EL FALLO, DE LA AUDITORÍA MAYOR ──────────────────────────────────────────
 *
 * La consulta filtraba por estado **y nada más**: sin cota de fecha, sin
 * `limit`. Cada ejecución descargaba **todas las citas que ha tenido esa clínica
 * desde que existe** — 24 veces al día — para mirar las de hoy y mañana.
 *
 * Y las clínicas se recorren **en serie**. Cuando el tiempo de la función se
 * acaba, dejan de recibir recordatorios **siempre las mismas**: las del final de
 * la lista. Sin un solo error visible — el cron responde 200 y el consultorio se
 * entera porque sus pacientes no llegan.
 *
 * Ya estaba confirmado en la auditoría del 26 de julio y no se había reparado.
 *
 * ── Y EL PATRÓN CORRECTO YA ESTABA EN ESTE MISMO ARCHIVO ─────────────────────
 *
 * 130 líneas más abajo, la consulta de auto-reseña acota por `fechaHora`. Estaba
 * escrito, en el mismo archivo, y esta consulta no lo usaba.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const s = readFileSync(
  join(process.cwd(), 'src', 'app', 'api', 'cron', 'reminders', 'route.ts'), 'utf8')

describe('la consulta está acotada', () => {
  it('tiene ventana de fecha por los dos lados', () => {
    expect(s).toContain("where('fechaHora', '>=', desdeVentana)")
    expect(s).toContain("where('fechaHora', '<=', hastaVentana)")
  })

  it('la ventana es hoy y mañana, que es lo que el cron necesita', () => {
    // 24 h de anticipación + mismo día: nada anterior a hoy puede recordarse.
    expect(s).toContain('const desdeVentana = `${hoyISO(tzClinica)} 00:00`')
    expect(s).toContain('const hastaVentana = `${sumarDiasISO(hoyISO(tzClinica), 1)} 23:59`')
  })

  it('la ventana usa la zona de LA CLÍNICA, no la del servidor', () => {
    // Un consultorio en Tijuana y otro en Cancún no comparten «hoy».
    const i = s.indexOf('const desdeVentana')
    expect(s.slice(i - 200, i + 200)).toContain('tzClinica')
  })

  it('ya no queda la consulta sin cota', () => {
    expect(s).not.toContain(
      ".where('estado', 'in', ['confirmada', 'pendiente-confirmar', 'solicitada', 'recordatorio-enviado'])")
  })
})

describe('el estado se filtra en memoria, y a propósito', () => {
  it('el rango va sobre UN solo campo', () => {
    /**
     * Combinar el rango de `fechaHora` con el `in` de estado exigiría un índice
     * compuesto, y desplegar índices es una operación aparte que puede borrar
     * los que no estén declarados en el archivo. Sobre un solo campo basta el
     * índice automático.
     */
    const i = s.indexOf("where('fechaHora', '>=', desdeVentana)")
    const bloque = s.slice(i, i + 300)
    expect(bloque).not.toContain("where('estado'")
  })

  it('sigue incluyendo `recordatorio-enviado`', () => {
    // Al mandar el aviso de 24 h la cita pasa a ese estado; sin él, salía del
    // conjunto y nunca recibía el recordatorio del mismo día.
    expect(s).toContain("const ESTADOS_RECORDABLES = ['confirmada', 'pendiente-confirmar', 'solicitada', 'recordatorio-enviado']")
    expect(s).toContain('ESTADOS_RECORDABLES.includes(a.estado)')
  })
})

describe('el patrón es el que ya existía en el archivo', () => {
  it('la consulta de auto-reseña sigue acotada igual', () => {
    // Si alguien la desacota, este archivo vuelve a tener dos criterios para lo
    // mismo — que es como empezó esto.
    expect(s).toContain("where('fechaHora', '>=', desdeStr)")
  })
})
