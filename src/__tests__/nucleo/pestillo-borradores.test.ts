import { describe, it, expect, beforeEach } from 'vitest'
import { limpiarBorradoresLocales, borradoresBloqueados, permitirBorradores } from '@/lib/mobile/local-drafts'

/**
 * El pestillo que impide que el flush tardío del desmonte resucite un borrador
 * clínico DESPUÉS de cerrar sesión (PHI en dispositivo compartido).
 */
describe('pestillo de borradores al cerrar sesión', () => {
  beforeEach(() => { permitirBorradores() })

  it('empieza abierto: durante la sesión se puede respaldar', () => {
    expect(borradoresBloqueados()).toBe(false)
  })

  it('cerrar sesión lo echa: ningún flush posterior puede escribir', () => {
    limpiarBorradoresLocales()
    expect(borradoresBloqueados()).toBe(true)
  })

  it('volver a iniciar sesión lo reabre', () => {
    limpiarBorradoresLocales()
    permitirBorradores()
    expect(borradoresBloqueados()).toBe(false)
  })
})
