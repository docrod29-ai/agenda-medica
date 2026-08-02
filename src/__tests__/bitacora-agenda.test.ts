/**
 * GOLDEN — dar de alta o mover una cita desde el consultorio deja rastro.
 *
 * ── EL CANAL MÁS VIEJO ERA EL ÚNICO SIN BITÁCORA ─────────────────────────────
 *
 * El portal escribe `cita_solicitada_portal`, `cita_cancelada_portal` y
 * `cita_reagendada_portal`. El bot escribe `cita_cancelada_whatsapp`. Cambiar el
 * estado escribe `cita_estado_cambiado` y borrar escribe `cita_borrada`.
 *
 * Y **dar de alta o mover una cita desde el consultorio no escribía nada**. Es
 * la vía por la que pasa la mayor parte de la agenda, y mover una cita cambia la
 * fecha, la hora y hasta el médico que la atiende: en una discusión —«me la
 * cambiaron y nadie me avisó»— no había a qué acudir.
 *
 * Es el reverso del fallo que se estuvo reparando todo el día: no un canal nuevo
 * que se salta el guardián del viejo, sino el canal viejo que nunca lo tuvo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EVENTO_LABEL } from '@/lib/expediente/audit-log'

const ruta = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'appointments', 'route.ts'), 'utf8')

describe('los eventos existen y se llaman por su nombre', () => {
  it('están en el tipo y tienen etiqueta', () => {
    // El guardián de v908 ya lo exigiría, pero conviene decirlo aquí también:
    // este archivo es el que los introduce.
    expect(EVENTO_LABEL.cita_creada).toBe('Agendó cita')
    expect(EVENTO_LABEL.cita_reagendada).toBe('Movió cita')
  })
})

describe('la ruta escribe la bitácora', () => {
  it('distingue alta de movimiento', () => {
    expect(ruta).toContain("evento: reagendarId ? 'cita_reagendada' : 'cita_creada'")
  })

  it('el autor sale de la SESIÓN, nunca del cuerpo', () => {
    // Si saliera del body, cualquiera podría firmar una cita a nombre de otro:
    // es el mismo criterio que ya aplican los cobros.
    expect(ruta).toContain('medicoUid: acc.uid')
    expect(ruta).toContain('medicoEmail: acc.email')
  })

  it('no puede tumbar una cita ya dada de alta', () => {
    // Se escribe DESPUÉS de la transacción, sin await bloqueante y con catch.
    expect(ruta).toContain('void adminDb.collection')
    expect(ruta).toContain('la bitácora no puede tumbar una cita ya dada de alta')
  })
})

describe('qué cambió, sin PHI de más', () => {
  it('guarda el ANTES y el DESPUÉS de los campos que importan', () => {
    expect(ruta).toContain("const CAMPOS_QUE_IMPORTAN = ['fechaHora', 'medicoId', 'tipo', 'estado', 'duracion']")
    expect(ruta).toContain('cambios[k] = { de: de ?? null, a }')
  })

  it('lee el estado previo DENTRO de la transacción', () => {
    // Fuera de ella podría leer una versión que otro acaba de pisar, y la
    // bitácora diría que cambió algo que no cambió.
    const i = ruta.indexOf('runTransaction')
    const j = ruta.indexOf('const previa = await tx.get(ref)')
    expect(j).toBeGreaterThan(i)
  })

  it('en `meta` NO viaja nada identificable', () => {
    /**
     * El paciente ya está en `patientId`, que es el hilo del expediente.
     * Repetir su nombre, su teléfono o el motivo de la consulta aquí sería PHI
     * de más en una colección que se consulta entera desde la pantalla de
     * cumplimiento.
     */
    const i = ruta.indexOf('evento: reagendarId')
    const bloque = ruta.slice(i - 600, i + 700)
    for (const campo of ['pacienteNombre', 'pacienteTelefono', 'motivo', 'notasInternas']) {
      expect(bloque, `«${campo}» no debe viajar en la bitácora`).not.toContain(campo)
    }
  })

  it('una sobreagenda queda marcada también aquí', () => {
    expect(ruta).toContain('sobreagendada: true')
  })
})
