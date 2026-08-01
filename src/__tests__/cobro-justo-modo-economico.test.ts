/**
 * LA PROMESA DE LA PÁGINA DE PRECIOS NO SE CUMPLÍA.
 *
 * Dice, con estas palabras: «Al agotarlos sigue en ⚡ Rápida sin costo hasta 120
 * notas más/mes; luego se pausa y recargas o subes de plan».
 *
 * El respaldo estaba implementado en la ruta de la nota. Nunca se alcanzaba: el
 * portero de créditos cortaba con un 402 al principio, y la decisión de bajar a
 * modo económico ocurría cincuenta líneas después. El médico que agotaba sus
 * créditos —PAGANDO— recibía «se acabaron tus créditos» con un paciente
 * enfrente, cuando el producto tenía ciento veinte notas más esperándolo.
 *
 * Y el mensaje tampoco ayudaba: mandaba a recargar sin decir que la agenda, el
 * expediente y el dictado seguían funcionando.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { debeCortarCreditos } from '@/lib/ai-keys'

describe('a quién se le corta', () => {
  it('al consultorio que usa la llave de la plataforma y agotó sus créditos', () => {
    expect(debeCortarCreditos('prueba', 'clinica-x', true)).toBe(true)
  })

  it('NUNCA a quien pone su propia llave: paga su propia API', () => {
    // Cortarle sería quitarle algo que ya compró por su cuenta.
    expect(debeCortarCreditos('clinica', 'clinica-x', true)).toBe(false)
  })

  it('ni al dueño de la plataforma', () => {
    expect(debeCortarCreditos('fundador', 'clinica-x', true)).toBe(false)
  })

  it('ni a nadie con créditos disponibles', () => {
    expect(debeCortarCreditos('prueba', 'clinica-x', false)).toBe(false)
  })

  it('sin consultorio identificado no se corta: ante la duda, no se bloquea', () => {
    expect(debeCortarCreditos('prueba', null, true)).toBe(false)
  })
})

/**
 * El orden de las dos comprobaciones ES el fallo, así que se fija leyendo el
 * código: una prueba de comportamiento exigiría levantar la ruta entera con
 * Firestore, y lo que hay que impedir es que alguien vuelva a poner el corte
 * antes del respaldo.
 */
describe('el orden que hacía inalcanzable el respaldo', () => {
  const src = readFileSync('src/app/api/expediente/procesar/route.ts', 'utf8')

  it('la ruta de la nota DECLARA que sabe seguir sin créditos', () => {
    expect(
      src,
      'La nota volvió a cortar con 402 antes de poder bajar a modo económico: ' +
      'el médico que paga se queda sin IA con un paciente enfrente, y la página ' +
      'de precios le promete 120 notas más.',
    ).toMatch(/permiteEconomico:\s*true/)
  })

  it('y el respaldo económico sigue existiendo', () => {
    expect(src).toMatch(/modoEconomico/)
  })
})

describe('lo que se le dice al médico', () => {
  const src = readFileSync('src/lib/ai-keys.ts', 'utf8')

  it('el mensaje dice lo que SÍ puede hacer, no sólo lo que se acabó', () => {
    // «Se acabaron tus créditos» a secas se lee como «la aplicación se detuvo»,
    // y lo que se detuvo es una función: la consulta se puede seguir escribiendo.
    expect(src).toMatch(/seguir dictando/)
  })

  it('y ofrece las TRES salidas, no sólo comprar', () => {
    expect(src).toMatch(/recarga/i)
    expect(src).toMatch(/sube de plan/i)
    expect(src).toMatch(/tu propia llave/i)
  })

  it('el de la PRUEBA no manda a recargar créditos que no existen', () => {
    // En prueba no hay bolsa que recargar: la salida es activar un plan.
    expect(src).toMatch(/Activa un plan/)
    expect(src).toMatch(/expedientes no se tocan/)
  })
})
