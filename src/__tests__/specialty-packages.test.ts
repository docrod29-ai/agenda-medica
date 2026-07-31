import { describe, it, expect } from 'vitest'
import { PAQUETES, HERRAMIENTAS, incluyeDe } from '@/lib/specialty-packages'
import { herramientasDeTronco, troncoDe } from '@/lib/herramientas-por-especialidad'

describe('specialty packages', () => {
  it('cada herramienta declarada tiene nombre y descripción', () => {
    for (const [id, h] of Object.entries(HERRAMIENTAS)) {
      expect(h.nombre, id).toBeTruthy()
      expect(h.que.length, id).toBeGreaterThan(10)
    }
  })

  it('incluyeDe NO puede divergir de lo que la consulta muestra (misma fuente)', () => {
    for (const p of PAQUETES) {
      const idsCatalogo = incluyeDe(p.tronco).map(h => h.id)
      const idsConsulta = herramientasDeTronco(p.tronco)
      expect(idsCatalogo, p.nombre).toEqual(idsConsulta)
    }
  })

  it('el copiloto de seguridad está en TODOS los paquetes', () => {
    for (const p of PAQUETES) {
      expect(incluyeDe(p.tronco).some(h => h.id === 'copiloto'), p.nombre).toBe(true)
    }
  })

  it('pediatría trae dosis por peso; NO trae riesgo cardiometabólico de adulto', () => {
    const peds = incluyeDe('pediatria').map(h => h.id)
    expect(peds).toContain('pediatria')
    expect(peds).not.toContain('cardiometabolico')
  })

  it('el paquete quirúrgico trae la valoración perioperatoria', () => {
    expect(incluyeDe('cirugia').map(h => h.id)).toContain('cirugia')
  })

  it('cada paquete apunta a un tronco real y coherente con troncoDe', () => {
    // Un nombre representativo de cada tronco debe resolver a ese mismo tronco.
    expect(troncoDe('Medicina interna')).toBe('medicina-interna')
    expect(troncoDe('Pediatría')).toBe('pediatria')
    expect(troncoDe('Ginecología y obstetricia')).toBe('gineco-obstetricia')
    expect(troncoDe('Cirugía general')).toBe('cirugia')
    for (const p of PAQUETES) {
      expect(incluyeDe(p.tronco).length).toBeGreaterThan(0)
    }
  })
})
