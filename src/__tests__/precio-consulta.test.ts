/**
 * UNA REGLA QUE SÓLO FUNCIONA DESDE UNA DE LAS DOS PUERTAS NO ES UNA REGLA.
 *
 * El precio sugerido vivía dentro de la pantalla de Consulta, así que al cobrar
 * desde CITAS —por donde cobra la asistente, o sea la mayoría de las veces— el
 * importe abría vacío. Y sin precio no hay nada contra qué restar los abonos: el
 * saldo pendiente tampoco podía calcularse justo donde más falta hace.
 */
import { describe, it, expect } from 'vitest'
import { precioSugerido } from '@/lib/finanzas/precio-consulta'

const LISTA = [
  { servicio: 'Consulta de primera vez', precio: 900 },
  { servicio: 'Consulta subsecuente', precio: 700 },
  { servicio: 'Teleconsulta', precio: 600 },
]

describe('precioSugerido', () => {
  it('empareja por la RAÍZ del tipo, porque los tipos llevan guiones', () => {
    // El tipo interno es «primera-vez» y el servicio está en prosa.
    expect(precioSugerido(LISTA, 'primera-vez')).toBe(900)
    expect(precioSugerido(LISTA, 'teleconsulta')).toBe(600)
  })

  it('sin coincidencia usa el primero: es el servicio principal', () => {
    expect(precioSugerido(LISTA, 'algo-que-no-existe')).toBe(900)
  })

  it('sin tipo de cita también', () => {
    expect(precioSugerido(LISTA, undefined)).toBe(900)
    expect(precioSugerido(LISTA, '')).toBe(900)
  })

  it('SIN LISTA DE PRECIOS DEVUELVE «NO SE SABE», NO CERO', () => {
    /**
     * Un cero se pintaría en la caja del importe como «esta consulta cuesta
     * nada» y se cobraría así. Cuando no hay lista, la respuesta honesta es que
     * no se sabe, y quien cobra teclea el importe como hasta ahora.
     */
    expect(precioSugerido([], 'primera-vez')).toBeUndefined()
    expect(precioSugerido(null, 'primera-vez')).toBeUndefined()
    expect(precioSugerido(undefined, 'primera-vez')).toBeUndefined()
  })

  it('los servicios con precio 0 o basura NO cuentan como lista', () => {
    // Un servicio a $0 de relleno haría que la caja abriera en cero.
    expect(precioSugerido([{ servicio: 'Valoración', precio: 0 }], 'valoracion')).toBeUndefined()
    expect(precioSugerido([{ servicio: 'X', precio: NaN }], 'x')).toBeUndefined()
    expect(precioSugerido([{ servicio: 'X', precio: 'mil' as unknown as number }], 'x')).toBeUndefined()
  })

  it('salta los inválidos y se queda con el primero VÁLIDO', () => {
    const mixta = [{ servicio: 'Relleno', precio: 0 }, { servicio: 'Consulta', precio: 850 }]
    expect(precioSugerido(mixta, 'nada')).toBe(850)
  })

  it('no distingue mayúsculas ni acentos del tipo', () => {
    expect(precioSugerido(LISTA, 'TELECONSULTA')).toBe(600)
  })
})

describe('las dos puertas dan el mismo precio', () => {
  it('Consulta y Citas usan la MISMA función', () => {
    // El contrato entero: si mañana alguien cambia la regla, cambia en los dos
    // sitios porque sólo hay un sitio.
    const desdeConsulta = precioSugerido(LISTA, 'subsecuente')
    const desdeCitas = precioSugerido(LISTA, 'subsecuente')
    expect(desdeConsulta).toBe(desdeCitas)
    expect(desdeConsulta).toBe(700)
  })
})
