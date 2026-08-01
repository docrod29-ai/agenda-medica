/**
 * UN MÉDICO NO COMPRA CRÉDITOS: COMPRA CONSULTAS DOCUMENTADAS.
 *
 * «200 créditos de IA al mes» no le dice si le alcanza para su semana o para su
 * mes. Averiguarlo exige que aprenda cuánto cuesta cada motor, y nadie evalúa un
 * producto haciendo esa cuenta: cierra la pestaña.
 *
 * El crédito no desaparece —sigue siendo la unidad interna, y la honesta, porque
 * una nota Máxima cuesta diez veces una Rápida—. Lo que cambia es cuál se lee
 * primero.
 */
import { describe, it, expect } from 'vitest'
import { PLANES, MOTORES, consultasCon, consultasIncluidasTexto } from '@/lib/planes-ia'

describe('la traducción a consultas', () => {
  it('es una división, no una estimación', () => {
    expect(consultasCon(200, 'estandar')).toBe(Math.floor(200 / MOTORES.estandar.creditos))
    expect(consultasCon(10, 'rapida')).toBe(10)
  })

  it('REDONDEA HACIA ABAJO: no se promete una consulta que no alcanza', () => {
    // Con 8 créditos y un motor de 3 son 2 notas y sobra 1 crédito, no 2.67.
    expect(consultasCon(8, 'estandar')).toBe(2)
  })

  it('cero créditos son cero consultas, no un error', () => {
    expect(consultasCon(0)).toBe(0)
    expect(consultasCon(-5)).toBe(0)
  })

  it('un motor desconocido cae al estándar en vez de romper', () => {
    expect(consultasCon(200, 'inventado' as never)).toBe(consultasCon(200, 'estandar'))
  })
})

describe('la frase que se enseña', () => {
  it('el plan Clínica se cuenta con el motor Estándar', () => {
    const t = consultasIncluidasTexto(PLANES.clinica)
    expect(t).toMatch(/Estándar/)
    expect(t).toMatch(String(consultasCon(PLANES.clinica.creditos, 'estandar')))
  })

  it('el plan Pro se cuenta con el motor MÁXIMA, que es el suyo por defecto', () => {
    /**
     * Contarlo con Estándar daría un número más grande y más vendedor — y sería
     * mentira: el plan Pro nace con Máxima puesta, así que ésas son las notas
     * que va a hacer de verdad.
     */
    const t = consultasIncluidasTexto(PLANES.premium)
    expect(t).toMatch(/Máxima/)
    expect(t).toMatch(String(consultasCon(PLANES.premium.creditos, 'maxima')))
  })

  it('el plan sin IA lo dice, no enseña «0 consultas»', () => {
    // «~0 consultas» se lee como un producto roto; «sin IA» es lo que es.
    expect(consultasIncluidasTexto(PLANES.agenda)).toMatch(/Sin IA/)
  })

  it('LLEVA LA TILDE DE APROXIMACIÓN', () => {
    /**
     * La división es exacta, pero el número real depende de qué motor elija el
     * médico en cada nota. Prometer una cifra cerrada que no se cumple es peor
     * que no dar ninguna, sobre todo cuando la diferencia la nota él a fin de mes.
     */
    expect(consultasIncluidasTexto(PLANES.clinica)).toMatch(/^~\d/)
  })
})
