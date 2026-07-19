import { describe, it, expect, beforeEach } from 'vitest'
import { ofuscar, desofuscar, secretoLocal } from '@/lib/seguridad/ofuscar-local'

/**
 * Regresión del bug del Núcleo: la nota sin firmar se volvía ILEGIBLE al cerrar
 * sesión. El flush del desmonte escribía con `auth.currentUser?.uid ?? 'nx'`
 * cuando el uid ya era null, y al volver a entrar se leía con el uid real.
 */
describe('borrador local: la clave no cambia a media sesión', () => {
  beforeEach(() => { secretoLocal('uid-del-medico') })

  it('reproduce el bug con el patrón viejo: se escribe con "nx" y no se puede leer', () => {
    const uidVivo: string | null = null                    // como tras signOut()
    const guardado = ofuscar('{"resumen":"nota"}', uidVivo ?? 'nx')
    const leido = desofuscar(guardado, 'uid-del-medico')
    // Devuelve texto, NO null: por eso el `?? raw` no salvaba y JSON.parse reventaba.
    expect(leido).not.toBeNull()
    expect(leido).not.toBe('{"resumen":"nota"}')
    expect(() => JSON.parse(leido!)).toThrow()
  })

  it('con el secreto pegajoso, el borrador sobrevive a que el uid se vuelva null', () => {
    const guardado = ofuscar('{"resumen":"nota"}', secretoLocal(null))
    expect(JSON.parse(desofuscar(guardado, secretoLocal(undefined))!)).toEqual({ resumen: 'nota' })
  })

  it('el secreto se actualiza cuando entra otro médico en el mismo navegador', () => {
    secretoLocal('otro-medico')
    expect(secretoLocal(null)).toBe('otro-medico')
  })
})
