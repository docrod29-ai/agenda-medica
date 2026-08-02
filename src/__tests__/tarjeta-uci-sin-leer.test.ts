/**
 * GOLDEN — la tarjeta de UCI afirmaba lo que no había podido leer.
 *
 * La pantalla leía las tomas con `.catch(() => [])` y la estancia con
 * `.catch(() => null)`: un fallo de permisos o de red entraba disfrazado de
 * dato y la tarjeta decía «sin ninguna toma registrada» y «no consta ningún
 * soporte activo» de un paciente monitorizado y ventilado. Un fallo de lectura
 * no puede leerse como un hecho clínico.
 */
import { describe, it, expect } from 'vitest'
import {
  construirTarjeta, SIN_TOMAS, SIN_SOPORTES, TOMAS_NO_LEIDAS, ESTANCIA_NO_LEIDA,
} from '@/lib/uci/tarjetas'

const AHORA = '2026-08-02T12:00:00.000Z'
const base = {
  internamientoId: 'i1',
  pacienteNombre: 'Paciente de prueba',
  cama: 'UCI-3',
  ingresoEn: '2026-08-01T06:00:00.000Z',
  unitTimezone: 'America/Mexico_City',
}

describe('construirTarjeta con secciones no leídas', () => {
  it('sin tomas de verdad dice «sin ninguna toma»', () => {
    const t = construirTarjeta({ ...base, soportes: ['vm_invasiva'] }, AHORA)
    expect(t.avisos).toContain(SIN_TOMAS)
    expect(t.avisos).not.toContain(TOMAS_NO_LEIDAS)
  })

  it('si la lectura FALLÓ no se afirma que no haya tomas', () => {
    const t = construirTarjeta({ ...base, soportes: ['vm_invasiva'], sinLeer: ['tomas'] }, AHORA)
    expect(t.avisos).toContain(TOMAS_NO_LEIDAS)
    expect(t.avisos).not.toContain(SIN_TOMAS)
  })

  it('si falló la estancia, tampoco se afirma que no tenga soportes', () => {
    // Los soportes SALEN de la estancia: si no se leyó, «no consta ninguno» es
    // una afirmación sobre un dato que nadie llegó a mirar.
    const t = construirTarjeta({ ...base, ingresoEn: '', soportes: [], sinLeer: ['estancia'] }, AHORA)
    expect(t.avisos).toContain(ESTANCIA_NO_LEIDA)
    expect(t.avisos).not.toContain(SIN_SOPORTES)
    expect(t.estancia).toBeNull()
  })

  it('el paciente NO desaparece de la lista por un fallo de lectura', () => {
    // Esconderlo sería peor que enseñarlo con el hueco declarado.
    const t = construirTarjeta({ ...base, sinLeer: ['tomas', 'estancia'] }, AHORA)
    expect(t.pacienteNombre).toBe('Paciente de prueba')
    expect(t.cama).toBe('UCI-3')
    expect(t.avisos.length).toBeGreaterThan(0)
  })
})
