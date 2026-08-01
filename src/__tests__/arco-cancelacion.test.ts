import { describe, it, expect } from 'vitest'
import { caminoDeCancelacion, marcaDeBloqueo, estaBloqueadoArco } from '@/lib/arco/cancelacion'

describe('ARCO · qué significa «cancelar» según lo que hay en el expediente', () => {
  it('sin notas firmadas → se puede SUPRIMIR de verdad', () => {
    const v = caminoDeCancelacion(0)
    expect(v.camino).toBe('supresion')
    expect(v.porQueNoSeBorra).toBe('')
    // El aviso de irreversibilidad va ANTES de confirmar, no después.
    expect(v.queOcurre).toMatch(/no se puede deshacer/i)
  })

  it('con una nota firmada → sólo BLOQUEO, y se dice por qué', () => {
    const v = caminoDeCancelacion(1)
    expect(v.camino).toBe('bloqueo')
    expect(v.porQueNoSeBorra).toMatch(/1 nota firmada/)
    expect(v.porQueNoSeBorra).toMatch(/NOM-004/)
  })

  it('el plural se conjuga: nadie confía en un sistema que dice «3 nota firmada»', () => {
    expect(caminoDeCancelacion(3).porQueNoSeBorra).toMatch(/3 notas firmadas/)
  })

  it('un número basura no abre la puerta al borrado', () => {
    // Defensivo: la cuenta viene de una consulta, y una consulta puede fallar.
    // Lo peligroso sería que un NaN se leyera como «cero notas firmadas».
    expect(caminoDeCancelacion(-5).camino).toBe('supresion')   // negativo = ninguna, es coherente
    expect(caminoDeCancelacion(1.7).camino).toBe('bloqueo')    // 1.7 → 1 nota: NO se borra
  })

  it('el bloqueo explica qué deja de pasar, no sólo que «se bloqueó»', () => {
    const v = caminoDeCancelacion(2)
    expect(v.queOcurre).toMatch(/recordatorios/)
    expect(v.queOcurre).toMatch(/reactivación/)
    expect(v.queOcurre).toMatch(/CRM/)
  })
})

describe('ARCO · la marca de bloqueo', () => {
  it('guarda quién, cuándo y por qué', () => {
    const m = marcaDeBloqueo({ ahoraMs: 1_800_000_000_000, uid: 'u1', solicitudId: 's1', motivo: 'Ya no quiero recibir mensajes' })
    expect(m.bloqueadoPor).toBe('u1')
    expect(m.solicitudId).toBe('s1')
    expect(m.motivo).toBe('Ya no quiero recibir mensajes')
    expect(m.bloqueadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('recorta un motivo desbordado en vez de guardar un documento enorme', () => {
    const m = marcaDeBloqueo({ ahoraMs: 0, uid: 'u', solicitudId: 's', motivo: 'x'.repeat(1000) })
    expect(m.motivo.length).toBe(300)
  })
})

describe('ARCO · quién queda fuera de todo contacto', () => {
  it('un expediente bloqueado se reconoce', () => {
    expect(estaBloqueadoArco({ arcoBloqueo: { bloqueadoEn: '2026-08-01T00:00:00.000Z', bloqueadoPor: 'u', solicitudId: 's', motivo: '' } })).toBe(true)
  })

  it('sin marca, no está bloqueado — y un expediente inexistente tampoco revienta', () => {
    expect(estaBloqueadoArco({})).toBe(false)
    expect(estaBloqueadoArco(null)).toBe(false)
    expect(estaBloqueadoArco(undefined)).toBe(false)
  })

  it('una marca a medias NO cuenta como bloqueo', () => {
    // Si un guardado quedó incompleto, la respuesta honesta es «no está
    // bloqueado» y que se vuelva a intentar — no dar por hecho algo que no se
    // puede demostrar.
    expect(estaBloqueadoArco({ arcoBloqueo: { bloqueadoEn: '', bloqueadoPor: 'u', solicitudId: 's', motivo: '' } })).toBe(false)
  })
})
