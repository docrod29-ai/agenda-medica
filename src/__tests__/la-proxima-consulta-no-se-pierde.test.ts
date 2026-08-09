/**
 * LA FECHA DE PRÓXIMA CONSULTA SE PERDÍA AL RECARGAR — REG-193.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * `proximoSeguimiento` sólo se persistía **al firmar**. No estaba:
 *
 *   · en el respaldo local (el que sobrevive a un crash o a una recarga),
 *   · en las dependencias de ese respaldo,
 *   · en la condición que decide «¿hay algo que guardar?» — ni la del
 *     autoguardado al servidor ni la del respaldo local.
 *
 * Consecuencias reales: teclear la fecha y recargar la borraba. Y si era lo
 * ÚNICO que se había escrito —el caso de una consulta de control que se resuelve
 * en dos minutos— el sistema consideraba que no había nada que guardar.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ─────────────────────────────────────
 *
 * Alimenta dos cosas que existían **esperando este dato**: la tarea «agendar el
 * seguimiento» del worklist y el contador de seguimientos vencidos del CRM. Un
 * paciente al que se le pierde la fecha no reaparece en ninguna lista: no hay
 * error, no hay aviso, simplemente no vuelve.
 *
 * Y el médico dueño es especialmente sensible a la pérdida de datos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
)

/** El bloque del respaldo local, acotado para no confundirlo con otros usos. */
function bloqueDelRespaldo(): string {
  const i = page.indexOf('localStorage.setItem(respaldoKey')
  expect(i, 'no se encontró el respaldo local').toBeGreaterThan(0)
  return page.slice(i, i + 1600)
}

describe('sobrevive a una recarga', () => {
  it('viaja en el respaldo local', () => {
    expect(bloqueDelRespaldo()).toContain('proximoSeguimiento,')
  })

  it('y está en las dependencias, o el respaldo se queda en la versión anterior', () => {
    // Es el mismo fallo que ya costó una reparación con `estudiosOrden` y
    // `preop`: sin la dependencia, el debounce no se re-arma y lo tecleado no
    // llega nunca al respaldo.
    expect(page).toContain('preop, proximoSeguimiento, voz.transcripcion, respaldoKey]')
  })

  it('y se repone al restaurar', () => {
    // Guardarla sin reponerla sería peor que no guardarla: parecería que se
    // conserva y al abrir estaría vacía.
    expect(page).toContain("if (typeof b.proximoSeguimiento === 'string') setProximoSeguimiento(b.proximoSeguimiento)")
  })
})

describe('cuenta como «hay algo que guardar»', () => {
  it('en el autoguardado al servidor', () => {
    const i = page.indexOf('if (hayContenido) guardarBorrador(true)')
    expect(i).toBeGreaterThan(0)
    expect(page.slice(Math.max(0, i - 500), i)).toContain('proximoSeguimiento.trim()')
  })

  it('y en el respaldo local', () => {
    const i = page.indexOf('localStorage.setItem(respaldoKey')
    const antes = page.slice(Math.max(0, i - 900), i)
    expect(antes).toContain('proximoSeguimiento.trim()')
  })

  it('las dos redes, no una', () => {
    // Una consulta de control puede resolverse tecleando sólo la fecha. Si sólo
    // una de las dos redes la reconoce, se pierde por el otro camino.
    expect(page.split('proximoSeguimiento.trim()').length - 1).toBeGreaterThanOrEqual(2)
  })
})

describe('lo que ya funcionaba sigue funcionando', () => {
  it('al firmar se escribe en el expediente del paciente', () => {
    expect(page).toContain('updatePatient(clinicId, patientId, { proximoSeguimiento })')
  })

  it('y sigue alimentando la tarea del worklist', () => {
    expect(page).toContain('proximoSeguimiento: proximoSeguimiento || undefined')
  })
})
