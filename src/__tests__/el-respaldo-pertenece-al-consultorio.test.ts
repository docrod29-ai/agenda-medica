/** REG-681: cuenta, clínica, paciente y episodio son identidad, no preferencias.
 * Reproduce la adopción del respaldo por el mismo uid en otra clínica.
 * Funciones reales; almacenamiento sintético. No acredita cifrado ni iOS físico.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { claveDeRespaldo, alcanceDelRespaldo, leerRespaldoConAlcance, esClaveBorrador, limpiarBorradoresLocales, permitirBorradores } from '@/lib/mobile/local-drafts'
import { ofuscar } from '@/lib/seguridad/ofuscar-local'
import { encuentroAbierto } from '@/lib/nav/encuentro-abierto'

afterEach(() => vi.unstubAllGlobals())
const uid = 'medico-sintetico'
const claro = JSON.stringify({ resumen: 'ÚLTIMA TECLA SINTÉTICA', notaId: 'nota-1', ts: 100 })
const bytes = ofuscar(claro, uid)

describe('REG-681 — recuperar sólo dentro del alcance original', () => {
  it('la copia sobrevive y se recupera íntegra en su consultorio', () => {
    const clave = claveDeRespaldo(uid, 'clinica-a', 'paciente-1')
    expect(leerRespaldoConAlcance(bytes, clave, uid, 'clinica-a')).toEqual(JSON.parse(claro))
    expect(esClaveBorrador(clave)).toBe(true)
  })
  it.each(['otra-cuenta', 'otra-clinica', 'sin-cuenta', 'sin-clinica'])('no adopta la copia con %s', caso => {
    const clave = claveDeRespaldo(uid, 'clinica-a', 'paciente-1')
    const cuenta = caso === 'otra-cuenta' ? 'medico-b' : caso === 'sin-cuenta' ? null : uid
    const clinic = caso === 'otra-clinica' ? 'clinica-b' : caso === 'sin-clinica' ? null : 'clinica-a'
    expect(leerRespaldoConAlcance(bytes, clave, cuenta, clinic)).toBeNull()
  })
  it('paciente y episodio no colisionan aunque sus ids lleven separadores', () => {
    const clave = claveDeRespaldo('u:a', 'c:b', 'p.h.c', 'e:d')
    expect(alcanceDelRespaldo(clave)).toEqual({ uid: 'u:a', clinicId: 'c:b', patientId: 'p.h.c', internamientoId: 'e:d' })
    expect(clave).not.toBe(claveDeRespaldo('u:a', 'c:b', 'p', 'c.h.e:d'))
  })
  it.each([claro, 'NXO1:corrupto', ofuscar('null', uid), ofuscar('[]', uid)])('no convierte un objeto inválido en nota', raw => {
    expect(leerRespaldoConAlcance(raw, claveDeRespaldo(uid, 'a', 'p'), uid, 'a')).toBeNull()
  })
  it('el encuentro de otra clínica no desplaza al propio aunque sea más reciente', () => {
    const a = claveDeRespaldo(uid, 'a', 'paciente-a'), b = claveDeRespaldo(uid, 'b', 'paciente-b')
    const datos = new Map([[a, bytes], [b, ofuscar(JSON.stringify({ ts: 9000, resumen: 'OTRA CLÍNICA' }), uid)]])
    const almacen = { get length() { return datos.size }, key: (i: number) => [...datos.keys()][i], getItem: (k: string) => datos.get(k) ?? null }
    vi.stubGlobal('window', { localStorage: almacen })
    expect(encuentroAbierto(uid, 'a')).toEqual({ patientId: 'paciente-a', ts: 100 })
    expect(encuentroAbierto(uid, 'b')).toEqual({ patientId: 'paciente-b', ts: 9000 })
    expect(datos.size).toBe(2)
  })
})


describe('REG-681 — sólo se purgan los bytes confirmados por el servidor', () => {
  function almacen() {
    permitirBorradores()
    const a = claveDeRespaldo(uid, 'a', 'p'), b = claveDeRespaldo(uid, 'b', 'p')
    const datos = new Map([[a, bytes], [b, bytes]])
    const local = { get length() { return datos.size }, key: (i: number) => [...datos.keys()][i] ?? null, getItem: (k: string) => datos.get(k) ?? null, removeItem: (k: string) => datos.delete(k) }
    vi.stubGlobal('localStorage', local); vi.stubGlobal('window', { localStorage: local })
    return { a, b, datos }
  }
  it('sin confirmación conserva todas las copias con alcance', () => {
    const e = almacen()
    expect(limpiarBorradoresLocales()).toBe(0)
    expect(e.datos.size).toBe(2)
  })
  it('confirmar A no borra la copia de B aunque tenga los mismos bytes', () => {
    const e = almacen()
    expect(limpiarBorradoresLocales([{ clave: e.a, bytes }])).toBe(1)
    expect(e.datos.has(e.a)).toBe(false)
    expect(e.datos.get(e.b)).toBe(bytes)
  })
  it('una edición posterior a la confirmación sigue recuperable', () => {
    const e = almacen()
    e.datos.set(e.a, bytes + 'edicion-posterior')
    expect(limpiarBorradoresLocales([{ clave: e.a, bytes }])).toBe(0)
    expect(e.datos.size).toBe(2)
  })
})
