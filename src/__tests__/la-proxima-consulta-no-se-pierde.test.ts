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
 * ── POR QUÉ ESTE GUARDIÁN CAMBIÓ EN REG-392 ─────────────────────────────────
 *
 * Estaba escrito contra el TEXTO de la pantalla: buscaba `proximoSeguimiento,`
 * dentro de un literal y `proximoSeguimiento.trim()` cerca de cada condición.
 * Funcionaba mientras la regla viviera copiada ahí — y era esa misma copia la
 * que causó REG-193 y REG-300.
 *
 * REG-392 llevó la regla y el cuerpo del respaldo a
 * `expediente/el-borrador-no-se-pierde.ts`. Los casos que se podían comprobar
 * de verdad —sobre la función, no sobre el texto— se comprueban ahí; los que
 * siguen siendo de la pantalla (que le pase el campo, que lo reponga al
 * restaurar, que lo escriba al firmar) siguen aquí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAMPOS_DEL_BORRADOR, cuerpoDelRespaldo, hayAlgoQuePerder,
} from '@/lib/expediente/el-borrador-no-se-pierde'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
)

describe('sobrevive a una recarga', () => {
  it('viaja en el respaldo local', () => {
    /* Ya no se busca el literal en la pantalla: se comprueba sobre el cuerpo que
       de verdad se persiste. Un campo declarado que no viajara caería aquí. */
    expect(CAMPOS_DEL_BORRADOR.map(c => c.nombre)).toContain('proximoSeguimiento')
    expect(cuerpoDelRespaldo({ proximoSeguimiento: '2026-09-15' }, { notaId: null, ts: 0 }))
      .toMatchObject({ proximoSeguimiento: '2026-09-15' })
  })

  it('y está en las dependencias, o el respaldo se queda en la versión anterior', () => {
    // Es el mismo fallo que ya costó una reparación con `estudiosOrden` y
    // `preop`: sin la dependencia, el debounce no se re-arma y lo tecleado no
    // llega nunca al respaldo. Esto SÍ sigue siendo de la pantalla: una lista de
    // dependencias de React no se puede comprobar de otra forma.
    expect(page).toContain('preop, proximoSeguimiento, voz.transcripcion, respaldoKey, toast]')
  })

  it('y se repone al restaurar', () => {
    // Guardarla sin reponerla sería peor que no guardarla: parecería que se
    // conserva y al abrir estaría vacía.
    expect(page).toContain("if (typeof b.proximoSeguimiento === 'string') setProximoSeguimiento(b.proximoSeguimiento)")
  })
})

describe('cuenta como «hay algo que guardar»', () => {
  it('en el autoguardado al servidor', () => {
    /* La pantalla ya no reconstruye la condición; lo que sí es suyo es PASARLE
       el campo. Si lo omitiera del objeto, la regla no podría verlo. */
    const i = page.indexOf('})) guardarBorrador(true)')
    expect(i, 'no se encontró el autoguardado al servidor').toBeGreaterThan(0)
    expect(page.slice(Math.max(0, i - 400), i)).toContain('proximoSeguimiento')
  })

  it('y en el respaldo local', () => {
    const i = page.indexOf('const vivo: EstadoDelBorrador = {')
    expect(i, 'no se encontró el estado vivo del respaldo local').toBeGreaterThan(0)
    expect(page.slice(i, i + 400)).toContain('proximoSeguimiento')
  })

  it('las dos redes, no una — y la misma regla en las dos', () => {
    /**
     * Una consulta de control puede resolverse tecleando sólo la fecha. Si sólo
     * una de las dos redes la reconociera, se perdería por el otro camino — que
     * es exactamente lo que pasaba cuando cada una tenía su copia.
     */
    expect(hayAlgoQuePerder({ proximoSeguimiento: '2026-09-15' })).toBe(true)
    expect((page.match(/hayAlgoQuePerder\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
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
