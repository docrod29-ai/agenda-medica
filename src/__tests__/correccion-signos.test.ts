/**
 * GOLDEN — corregir un signo vital deja constancia de POR QUÉ y de CUÁNDO.
 *
 * `RegistroSignos` declara dos campos con su decisión escrita detrás:
 *
 *  · `motivoCorreccion` — «por qué se corrigió. Su obligatoriedad es política
 *    del expediente → E0-09/Q4»;
 *  · `fechaEfectiva` — «cuándo OCURRIÓ la medición. Una corrección **hereda la
 *    del original**», añadido por ICU-002b con este ejemplo literal: «una
 *    corrección hecha a las 08:03 de un signo tomado a las 08:00 se guardaba con
 *    `fecha: 08:03`; el NEWS2 retrospectivo de las 08:00 debe usar 92».
 *
 * El formulario de la ficha **no escribía ninguno de los dos**. Los campos se
 * añadieron al tipo, se documentaron, y el único sitio que crea correcciones
 * siguió sin usarlos: el expediente registraba que un signo cambió y nunca por
 * qué, y la corrección quedaba fuera de la hora a la que pertenece.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { encuadrarNews2 } from '@/lib/hospital/news2-encuadre'
import { proyectarSignos } from '@/lib/hospital/eventos'
import type { RegistroSignos } from '@/types/hospital'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ficha = leer('src', 'app', '(dashboard)', 'hospitalizacion', '[internamientoId]', 'page.tsx')

describe('la corrección guarda por qué', () => {
  it('el formulario pide el motivo, y sólo al corregir', () => {
    expect(ficha).toContain('¿Por qué se corrige?')
    expect(ficha).toContain('motivoCorreccion: motivoCorr.trim() || undefined')
    // Al CAPTURAR no se pregunta: no hay nada que justificar.
    expect(ficha).toContain('{corrigiendoId && (')
  })

  it('NO bloquea el guardado si se deja vacío', () => {
    /**
     * Si el motivo es obligatorio o no es política del expediente (E0-09/Q4), y
     * eso lo decide el médico dueño, no esta pantalla. Lo que sí se hace es no
     * callarlo.
     */
    expect(ficha).not.toMatch(/disabled=\{[^}]*motivoCorr/)
    expect(ficha).toContain('sin motivo declarado')
  })

  it('y la tabla lo enseña, incluida su ausencia', () => {
    // Un valor corregido sin justificación es justo lo que se pregunta en una
    // revisión del expediente: callarlo lo vuelve invisible.
    expect(ficha).toContain('corrección{s.motivoCorreccion ?')
    expect(ficha).toContain("'var(--amber)'")
  })
})

describe('la corrección hereda la hora de la medición', () => {
  it('se guarda con la del original, no con la de ahora', () => {
    expect(ficha).toContain('setMedidoOriginal(s.fechaEfectiva ?? s.fecha)')
    expect(ficha).toContain('fechaEfectiva: medidoOriginal ?? datos.fecha')
    // Y `fecha` sigue siendo la de captura de ESTE documento, como declara el tipo.
    expect(ficha).toContain('fechaRegistro: datos.fecha')
  })

  it('la tabla ordena por la hora de MEDICIÓN', () => {
    expect(ficha).toContain('new Date(s.fechaEfectiva ?? s.fecha)')
  })

  it('y se le dice al clínico antes de guardar', () => {
    expect(ficha).toContain('Se guardará con la hora de la medición original')
  })
})

/**
 * EL EFECTO QUE SE VENÍA A CONSEGUIR: el ejemplo literal de la decisión.
 *
 * Signo de las 08:00 con SpO₂ 99 mal tecleada, corregido a las 08:03 a 92. El
 * NEWS2 de esa toma tiene que usar 92 — y la toma tiene que seguir siendo la de
 * las 08:00, no partirse en dos.
 */
describe('el NEWS2 de las 08:00 usa 92', () => {
  const signos: RegistroSignos[] = [
    { id: 's1', fecha: '2026-08-02T08:00:00.000Z', fr: 18, spo2: 99, ta: '120/80', fc: 72, temp: 36.5, conciencia: 'A', oxigeno: false },
    {
      id: 's2', fecha: '2026-08-02T08:03:00.000Z',
      fechaEfectiva: '2026-08-02T08:00:00.000Z', fechaRegistro: '2026-08-02T08:03:00.000Z',
      spo2: 92, corrigeA: 's1', motivoCorreccion: 'dedazo al capturar',
    },
  ]

  it('la toma sigue siendo una sola, y completa', () => {
    const r = encuadrarNews2(signos, '2026-08-02T12:00:00.000Z')
    expect(r.encuadre).toBe('actual')
    expect(r.registro?.spo2).toBe(92)
    // Corregir un valor NO tira los otros cinco de esa misma toma.
    expect(r.registro?.fr).toBe(18)
    expect(r.registro?.fc).toBe(72)
  })

  it('y el original se conserva, marcado como corregido', () => {
    const p = proyectarSignos(signos)
    const original = p.registros.find(x => x.registro.id === 's1')
    expect(original?.estado).toBe('corregido')
    // Nada se borra: el expediente conserva lo capturado Y lo corregido.
    expect(p.registros).toHaveLength(2)
  })
})
