/**
 * GOLDEN — el mismo médico con dos identificadores parte la comisión en dos.
 *
 * Cobrando desde Citas va el id del documento de `doctors`; cobrando al cerrar
 * la Consulta va el `uid` de la sesión. El reparto agrupa por `medicoId`, así
 * que la doctora aparece DOS VECES: el dueño pone el porcentaje en la fila que
 * reconoce y la otra mitad de su trabajo se comisiona al 0 %.
 *
 * La regla que se protege: ante ambigüedad NO se elige. Un cobro atribuido al
 * médico equivocado se paga en silencio a quien no era; uno sin atribuir se ve.
 *
 * Cifras y correos: inventados.
 */
import { describe, it, expect } from 'vitest'
import { elegirMedicoCanonico } from '@/lib/finanzas/medico-del-cobro'

const DOCTORES = [
  { id: 'doc-ruiz', nombre: 'Dra. Ruiz', email: 'ruiz@ejemplo.mx' },
  { id: 'doc-luna', nombre: 'Dr. Luna', email: 'luna@ejemplo.mx' },
]

describe('elegirMedicoCanonico', () => {
  it('si ya viene el id del consultorio, no hay nada que resolver', () => {
    const r = elegirMedicoCanonico({ medicoIdEntrante: 'doc-ruiz', uid: 'uid-9f1', email: 'ruiz@ejemplo.mx', doctores: DOCTORES })
    expect(r).toEqual({ medicoId: 'doc-ruiz', medicoNombre: 'Dra. Ruiz', como: 'directo' })
  })

  it('un UID se traduce al id del consultorio por correo', () => {
    // Éste es el caso que partía la comisión en dos.
    const r = elegirMedicoCanonico({ medicoIdEntrante: 'uid-9f1', uid: 'uid-9f1', email: 'ruiz@ejemplo.mx', doctores: DOCTORES })
    expect(r.medicoId).toBe('doc-ruiz')
    expect(r.como).toBe('por-correo')
  })

  it('sin `medicoId` entrante, se resuelve por la sesión', () => {
    const r = elegirMedicoCanonico({ uid: 'uid-9f1', email: 'luna@ejemplo.mx', doctores: DOCTORES })
    expect(r.medicoId).toBe('doc-luna')
  })

  it('el `uid` declarado en el documento gana sobre el correo', () => {
    const conUid = [{ id: 'doc-ruiz', nombre: 'Dra. Ruiz', email: 'compartido@ejemplo.mx', uid: 'uid-9f1' },
                    { id: 'doc-luna', nombre: 'Dr. Luna', email: 'compartido@ejemplo.mx' }]
    const r = elegirMedicoCanonico({ medicoIdEntrante: 'uid-9f1', uid: 'uid-9f1', email: 'compartido@ejemplo.mx', doctores: conUid })
    expect(r).toEqual({ medicoId: 'doc-ruiz', medicoNombre: 'Dra. Ruiz', como: 'por-uid' })
  })

  it('DOS médicos con el mismo correo NO se desempatan solos', () => {
    // Preferir no atribuir a atribuir mal: el cobro queda visible en «sin
    // atribuir» en vez de pagarse en silencio a quien no era.
    const ambiguos = [
      { id: 'doc-a', nombre: 'A', email: 'mostrador@ejemplo.mx' },
      { id: 'doc-b', nombre: 'B', email: 'mostrador@ejemplo.mx' },
    ]
    const r = elegirMedicoCanonico({ medicoIdEntrante: 'uid-9f1', uid: 'uid-9f1', email: 'mostrador@ejemplo.mx', doctores: ambiguos })
    expect(r.como).toBe('sin-resolver')
    expect(r.medicoId).toBe('uid-9f1')   // se conserva lo que venía, no se inventa
  })

  it('sin médicos cargados conserva lo que venía y lo declara', () => {
    const r = elegirMedicoCanonico({ medicoIdEntrante: 'uid-9f1', uid: 'uid-9f1', email: 'ruiz@ejemplo.mx', doctores: [] })
    expect(r).toEqual({ medicoId: 'uid-9f1', como: 'sin-resolver' })
  })

  it('un cobro de mostrador sin médico ni sesión sigue sin médico', () => {
    const r = elegirMedicoCanonico({ doctores: DOCTORES })
    expect(r.medicoId).toBeUndefined()
    expect(r.como).toBe('sin-resolver')
  })

  it('el correo se compara sin importar mayúsculas ni espacios', () => {
    const r = elegirMedicoCanonico({ uid: 'uid-9f1', email: '  RUIZ@Ejemplo.MX ', doctores: DOCTORES })
    expect(r.medicoId).toBe('doc-ruiz')
  })
})
