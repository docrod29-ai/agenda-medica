/**
 * GOLDEN — el eslabón que faltaba entre el calendario y el médico.
 *
 * El token de Google vive en `googleTokens/{uid}` y la agenda razona con
 * `medicoId` (el id del documento en `doctors`). No existía relación entre los
 * dos, y por eso el portal público, el bot y el reagendado del paciente no
 * consultan el freebusy: un paciente puede reservar encima de algo que el médico
 * ya tiene apuntado en su calendario.
 *
 * Ligarlo MAL sería peor que no ligarlo: enseñarle a un médico las horas
 * ocupadas de otro es una fuga, y bloquearle huecos que tiene libres, un error
 * de agenda. Por eso sólo se liga cuando es inequívoco.
 */
import { describe, it, expect } from 'vitest'
import { vincularMedico, NINGUNO, VARIOS, SIN_CORREO } from '@/lib/calendario/vinculo-medico'

describe('vincularMedico', () => {
  it('liga por correo exacto cuando hay uno solo', () => {
    const v = vincularMedico('uid-1', 'dra@clinica.mx', [
      { id: 'doc-a', email: 'dra@clinica.mx' },
      { id: 'doc-b', email: 'otro@clinica.mx' },
    ])
    expect(v).toEqual({ medicoId: 'doc-a', como: 'por-correo', motivo: '' })
  })

  it('no distingue mayúsculas ni espacios sobrantes', () => {
    const v = vincularMedico('uid-1', '  DRA@Clinica.MX ', [{ id: 'doc-a', email: 'dra@clinica.mx' }])
    expect(v.medicoId).toBe('doc-a')
  })

  it('con DOS médicos del mismo correo NO liga a ninguno', () => {
    const v = vincularMedico('uid-1', 'compartido@clinica.mx', [
      { id: 'doc-a', email: 'compartido@clinica.mx' },
      { id: 'doc-b', email: 'compartido@clinica.mx' },
    ])
    expect(v.medicoId).toBeUndefined()
    expect(v.motivo).toBe(VARIOS)
  })

  it('si nadie coincide, lo dice — el calendario igual queda conectado', () => {
    const v = vincularMedico('uid-1', 'nuevo@gmail.com', [{ id: 'doc-a', email: 'dra@clinica.mx' }])
    expect(v.como).toBe('sin-vinculo')
    expect(v.motivo).toBe(NINGUNO)
  })

  it('sin correo en la sesión no hay forma de saberlo', () => {
    expect(vincularMedico('uid-1', undefined, [{ id: 'doc-a', email: 'dra@clinica.mx' }]).motivo).toBe(SIN_CORREO)
  })

  it('un vínculo ya hecho se respeta y no se rehace', () => {
    const v = vincularMedico('uid-1', 'dra@clinica.mx', [
      { id: 'doc-a', email: 'otro@clinica.mx', uid: 'uid-1' },
    ])
    expect(v).toEqual({ medicoId: 'doc-a', como: 'ya-estaba', motivo: '' })
  })

  it('NO se le roba el vínculo a otro médico', () => {
    // Mismo correo en la ficha, pero ya es de otra persona: no se pisa.
    const v = vincularMedico('uid-nuevo', 'dra@clinica.mx', [
      { id: 'doc-a', email: 'dra@clinica.mx', uid: 'uid-viejo' },
    ])
    expect(v.medicoId).toBeUndefined()
    expect(v.motivo).toBe(NINGUNO)
  })
})
