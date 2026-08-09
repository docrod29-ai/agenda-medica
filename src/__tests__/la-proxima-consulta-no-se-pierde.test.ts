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
 *
 * ── ACTUALIZADO EL 9-ago-2026 (REG-294) ──────────────────────────────────────
 *
 * Este guardián comprobaba la FORMA del código: que la cadena
 * `proximoSeguimiento.trim()` apareciera junto a cada condición y que
 * `proximoSeguimiento,` estuviera dentro del objeto del respaldo.
 *
 * Y aun así el campo se seguía perdiendo, porque el defecto real era otro:
 * había **tres caminos de escritura** con su lista copiada a mano, y este
 * guardián sólo miraba uno. REG-294 los unificó en
 * `src/lib/expediente/borrador-de-consulta.ts`.
 *
 * Al unificarlos, las comprobaciones de forma se pusieron rojas **por el
 * arreglo**: el `proximoSeguimiento.trim()` que buscaban ya no está en la
 * pantalla, está en el módulo compartido. Es la misma trampa de REG-291 — un
 * guardián acoplado a la sintaxis de ayer castiga la mejora de hoy.
 *
 * Así que ahora se comprueba el INVARIANTE donde vive: que el campo esté en la
 * lista única y que la condición única lo cuente. Lo que se pierde en literalidad
 * se gana en que ya no hay tres sitios donde equivocarse.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAMPOS_DEL_BORRADOR,
  hayQueGuardar,
  instantaneaDeBorrador,
} from '@/lib/expediente/borrador-de-consulta'

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
  it('viaja en el respaldo local — y ahora por los TRES caminos', () => {
    expect(CAMPOS_DEL_BORRADOR).toContain('proximoSeguimiento')
    expect(instantaneaDeBorrador({ proximoSeguimiento: '2026-09-01' }, null).proximoSeguimiento)
      .toBe('2026-09-01')
    // Y el respaldo local sigue escribiéndose por esa única instantánea.
    expect(bloqueDelRespaldo()).toContain('instantaneaDeBorrador')
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
  it('la fecha sola YA es contenido', () => {
    // Una consulta de control puede resolverse tecleando sólo la fecha.
    expect(hayQueGuardar({ proximoSeguimiento: '2026-09-01' }, () => false)).toBe(true)
  })

  it('el espejo en memoria —el camino que la perdía— también la lleva', () => {
    /**
     * Éste es el que rompía el ciclo: `BorradorContext` es lo que hace que
     * volver de la agenda no parpadee, y su lista de campos no tenía la fecha.
     * Al volver, la nota aparecía «exactamente como la dejaste» menos este campo.
     */
    const i = page.indexOf('borradorMem.escribir(respaldoKey')
    expect(i, 'no se encontró el espejo en memoria').toBeGreaterThan(0)
    expect(page.slice(i, i + 200)).toContain('instantaneaDeBorrador')
  })

  it('y esa condición es UNA, no una por camino', () => {
    /**
     * Eran cinco copias, y no coincidían: el autoguardado al servidor y el
     * respaldo con rebote contaban la fecha; el espejo en memoria, el volcado de
     * despedida y el guardado previo al cierre de sesión, no.
     *
     * La firma de una copia suelta es `.medicamentos?.length` escrito en la
     * pantalla. Cero, y se queda en cero.
     */
    expect(page.split('.medicamentos?.length').length - 1).toBe(0)
    expect(page.split('hayQueGuardar(').length - 1).toBeGreaterThanOrEqual(5)
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
