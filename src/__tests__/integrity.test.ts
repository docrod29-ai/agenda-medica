import { describe, it, expect } from 'vitest'
import { generarHashIntegridad, verificarIntegridadEstado, HASH_VERSION } from '@/lib/expediente/integrity'
import type { NotaMedica } from '@/types/expediente'

// Nota mínima (solo los campos que el sello lee). El resto no afecta al hash.
function nota(over: Partial<NotaMedica> = {}, meta: Record<string, unknown> = {}): NotaMedica {
  return {
    tipo: 'valoracion_inmuno',
    pacienteId: 'p1',
    fechaConsulta: '2026-07-04T10:00:00.000Z',
    metadata: { id: 'n1', medicoId: 'm1', hashIntegridad: '', hashVersion: HASH_VERSION, ...meta },
    secciones: [{ key: 'motivoHuesped', label: 'Motivo', value: 'SOT renal' }],
    diagnosticos: [{ descripcion: 'Inmunocompromiso', tipo: 'definitivo', estado: 'activo', codigoCIE10: 'Z94' }],
    medicamentos: [{ nombre: 'TMP-SMX', dosis: '', via: 'oral', frecuencia: '', duracion: '', indicacion: 'PJP' }],
    alergias: [],
    signosVitales: { fc: 80, ta: '120/80' },
    ...over,
  } as unknown as NotaMedica
}

describe('integridad — canonicalización estable (fix del falso positivo)', () => {
  it('reordenar las llaves de los objetos NO cambia el hash', async () => {
    const a = nota()
    // Simula lo que hace Firestore al recargar: mismas llaves, distinto orden.
    const b = nota({
      diagnosticos: [{ estado: 'activo', codigoCIE10: 'Z94', tipo: 'definitivo', descripcion: 'Inmunocompromiso' } as never],
      medicamentos: [{ indicacion: 'PJP', duracion: '', frecuencia: '', via: 'oral', dosis: '', nombre: 'TMP-SMX' } as never],
      signosVitales: { ta: '120/80', fc: 80 } as never,
    })
    expect(await generarHashIntegridad(a)).toBe(await generarHashIntegridad(b))
  })

  it('cambiar el contenido SÍ cambia el hash', async () => {
    const a = nota()
    const b = nota({ secciones: [{ key: 'motivoHuesped', label: 'Motivo', value: 'SOT hepático' }] as never })
    expect(await generarHashIntegridad(a)).not.toBe(await generarHashIntegridad(b))
  })

  it('nota estable con hash coincidente → "verificada"', async () => {
    const base = nota()
    const hashIntegridad = await generarHashIntegridad(base)
    const firmada = nota({}, { hashIntegridad, hashVersion: HASH_VERSION })
    expect(await verificarIntegridadEstado(firmada)).toBe('verificada')
  })

  it('nota alterada (hash estable no coincide) → "alterada"', async () => {
    const firmada = nota({}, { hashIntegridad: 'deadbeef', hashVersion: HASH_VERSION })
    expect(await verificarIntegridadEstado(firmada)).toBe('alterada')
  })

  it('nota con sello de formato anterior (sin hashVersion) → "legado", NO alarma', async () => {
    const legado = nota({}, { hashIntegridad: 'loquesea', hashVersion: undefined })
    expect(await verificarIntegridadEstado(legado)).toBe('legado')
  })

  it('nota sin sello → "sin-sello"', async () => {
    const sin = nota({}, { hashIntegridad: '', hashVersion: undefined })
    expect(await verificarIntegridadEstado(sin)).toBe('sin-sello')
  })
})
