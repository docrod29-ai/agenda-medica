/**
 * GOLDEN — lo que mueve al paciente y lo que desaparece del episodio deja rastro.
 *
 * ── DOS HUECOS EN LA MISMA RUTA ──────────────────────────────────────────────
 *
 * 1. `hosp_traslado` estaba **declarado en el tipo** y permitido en la ruta de
 *    auditoría… y **no lo escribía nadie**. El movimiento sí quedaba dentro del
 *    episodio (`movimientos[]`), pero la bitácora de cumplimiento —la que se
 *    consulta para saber quién tocó a un paciente— no se enteraba de que alguien
 *    lo cambió de servicio, de cama o de médico tratante.
 *
 * 2. Borrar una indicación médica o una interconsulta **desaparecía sin dejar
 *    nada**. La ruta ya lo impide en cuanto hay administración o respuesta —eso
 *    estaba bien—, pero una orden *suspendida* sigue viéndose en el expediente y
 *    una *borrada* se esfuma entera.
 *
 *    Es el mismo criterio que el propio tipo escribió para `laboratorio_borrado`
 *    y `foto_clinica_borrada`: «no se prohíbe —a veces hay que quitar una foto
 *    subida al expediente equivocado— pero tiene que quedar quién y cuándo».
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EVENTO_LABEL } from '@/lib/expediente/audit-log'

const ruta = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'hospital', 'mutar', 'route.ts'), 'utf8')

describe('los eventos existen y se leen como español', () => {
  it('traslado y los dos borrados tienen etiqueta', () => {
    expect(EVENTO_LABEL.hosp_traslado).toBe('Traslado de cama o tratante')
    expect(EVENTO_LABEL.hosp_indicacion_borrada).toBe('Borró indicación médica')
    expect(EVENTO_LABEL.hosp_interconsulta_borrada).toBe('Borró interconsulta')
  })
})

describe('la ruta escribe la bitácora', () => {
  it('traslado y cambio de tratante caen en hosp_traslado', () => {
    expect(ruta).toContain("trasladar: 'hosp_traslado'")
    expect(ruta).toContain("cambiar_tratante: 'hosp_traslado'")
  })

  it('los borrados dejan su propio evento', () => {
    expect(ruta).toContain("indicacion_borrar: 'hosp_indicacion_borrada'")
    expect(ruta).toContain("interconsulta_borrar: 'hosp_interconsulta_borrada'")
  })

  it('sólo se registra lo que mueve o destruye, no cada pulsación', () => {
    /**
     * Una bitácora que registra todo no se lee, y una que no registra un borrado
     * no sirve. Estas acciones NO entran: dejan su propio rastro dentro del
     * episodio y son de operación diaria.
     */
    for (const a of ['indicacion_agregar', 'indicacion_suspender', 'balance', 'escala', 'sbar']) {
      expect(ruta, a).not.toContain(`${a}: 'hosp_`)
    }
  })

  it('el autor sale de la sesión verificada', () => {
    expect(ruta).toContain('medicoUid: acc.uid')
    expect(ruta).toContain('medicoEmail: acc.email')
  })

  it('el paciente sale del EPISODIO, no del cuerpo de la petición', () => {
    // Si saliera del body, un llamador podría colgar el asiento del expediente
    // de otro paciente.
    expect(ruta).toContain("pacienteIdDelEpisodio = String((inter as Any).pacienteId ?? '')")
    expect(ruta).toContain('patientId: pacienteIdDelEpisodio')
  })

  it('no revierte un cambio clínico ya aplicado', () => {
    expect(ruta).toContain('void adminDb.collection')
    expect(ruta).toContain('la bitácora no revierte un cambio clínico ya aplicado')
  })
})

describe('sin PHI de más en meta', () => {
  it('sólo ubicación e identificadores, nunca diagnóstico ni descripción', () => {
    const i = ruta.indexOf('const EVENTO_DE')
    const bloque = ruta.slice(i, i + 1800)
    for (const campo of ['descripcion', 'motivo', 'diagnostico', 'pacienteNombre', 'nota']) {
      expect(bloque, `«${campo}» no debe viajar en la bitácora`).not.toContain(`${campo}:`)
    }
    // Servicio y cama son ubicación, no condición clínica.
    expect(bloque).toContain('servicio: payload.servicio')
  })
})
