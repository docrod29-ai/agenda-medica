import { describe, it, expect } from 'vitest'
import { esClaveBorrador, clavesABorrar, PREFIJO_BORRADOR } from '@/lib/mobile/local-drafts'

describe('local-drafts (limpieza de PHI al cerrar sesión)', () => {
  it('reconoce las claves de borrador clínico', () => {
    expect(esClaveBorrador('nx.consulta.bkp.pac_123')).toBe(true)
    expect(esClaveBorrador('nx.consulta.bkp.pac_123.h.int_9')).toBe(true)
    expect(esClaveBorrador(PREFIJO_BORRADOR + 'x')).toBe(true)
  })

  it('NO toca preferencias ni otras claves (tema, etc.)', () => {
    for (const k of ['nx.theme', 'theme', 'nx.onboarding', 'firebase:authUser', 'nx.consultaX', 'consulta.bkp.x']) {
      expect(esClaveBorrador(k), k).toBe(false)
    }
  })

  it('clavesABorrar filtra solo los borradores de una lista mixta', () => {
    const todas = ['nx.theme', 'nx.consulta.bkp.a', 'nx.consulta.bkp.b', 'firebase:x', 'random']
    expect(clavesABorrar(todas)).toEqual(['nx.consulta.bkp.a', 'nx.consulta.bkp.b'])
  })

  it('lista sin borradores → nada que borrar', () => {
    expect(clavesABorrar(['nx.theme', 'x', 'y'])).toEqual([])
  })
})
