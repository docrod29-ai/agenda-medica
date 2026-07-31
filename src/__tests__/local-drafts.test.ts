import { describe, it, expect } from 'vitest'
import { esClaveBorrador, clavesABorrar, PREFIJO_BORRADOR } from '@/lib/mobile/local-drafts'

describe('local-drafts (limpieza de PHI al cerrar sesión)', () => {
  it('reconoce las claves de borrador clínico', () => {
    expect(esClaveBorrador('nx.consulta.bkp.pac_123')).toBe(true)
    expect(esClaveBorrador('nx.consulta.bkp.pac_123.h.int_9')).toBe(true)
    expect(esClaveBorrador(PREFIJO_BORRADOR + 'x')).toBe(true)
  })

  it('L3: también reconoce las claves de PHI del Panel UCI (lecturas + semilla de nota)', () => {
    expect(esClaveBorrador('nx.uci.lecturas.int_9')).toBe(true)
    expect(esClaveBorrador('nx.uci.lecturas')).toBe(true)
    expect(esClaveBorrador('nx.uci.seed.int_9')).toBe(true)
  })

  it('NO toca preferencias ni otras claves (tema, etc.)', () => {
    for (const k of ['nx.theme', 'theme', 'nx.onboarding', 'firebase:authUser', 'nx.consultaX', 'consulta.bkp.x', 'nx.ucix']) {
      expect(esClaveBorrador(k), k).toBe(false)
    }
  })

  it('clavesABorrar filtra los borradores de consulta Y las lecturas de UCI', () => {
    const todas = ['nx.theme', 'nx.consulta.bkp.a', 'nx.uci.lecturas.int_1', 'firebase:x', 'random']
    expect(clavesABorrar(todas)).toEqual(['nx.consulta.bkp.a', 'nx.uci.lecturas.int_1'])
  })

  it('lista sin borradores → nada que borrar', () => {
    expect(clavesABorrar(['nx.theme', 'x', 'y'])).toEqual([])
  })
})
