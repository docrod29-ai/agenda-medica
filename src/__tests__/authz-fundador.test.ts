/**
 * GOLDEN — fundador ≠ cortesía (P1-4 de la auditoría · Master Loop V3 §BK–BN, §CD).
 *
 * Antes los dos caían en el mismo `paseLibre: boolean` y el mismo
 * `paseLibre !== true` de la contabilidad. Entran sin pagar los dos, y ahí se
 * acaba el parecido.
 */
import { describe, it, expect } from 'vitest'
import {
  esFundador, correosFundador, claseDeCuenta, cuentaComoIngreso, esCogs,
} from '@/lib/authz/fundador'

const ENV = 'docrod29@gmail.com,socia@nexusmed.mx'

describe('Quién es el fundador', () => {
  it('sale de la lista de correos, sin importar mayúsculas ni espacios', () => {
    expect(esFundador('docrod29@gmail.com', ENV)).toBe(true)
    expect(esFundador('  DocRod29@Gmail.com ', ENV)).toBe(true)
    expect(esFundador('socia@nexusmed.mx', ENV)).toBe(true)
  })

  it('cualquier otro médico NO lo es', () => {
    expect(esFundador('otro@hospital.mx', ENV)).toBe(false)
    expect(esFundador('', ENV)).toBe(false)
    expect(esFundador(null, ENV)).toBe(false)
    expect(esFundador(undefined, ENV)).toBe(false)
  })

  it('sin configurar nada, el sistema sigue funcionando', () => {
    expect(correosFundador(null)).toEqual(['docrod29@gmail.com'])
    expect(esFundador('docrod29@gmail.com', null)).toBe(true)
  })

  it('una lista vacía no vuelve fundador a nadie', () => {
    // El respaldo es para cuando la variable NO está; si está y viene vacía, la
    // respuesta correcta es «ninguno», no «el dueño de siempre».
    expect(correosFundador('')).toEqual([])
    expect(esFundador('docrod29@gmail.com', '')).toBe(false)
  })
})

describe('Tres clases de cuenta, no dos', () => {
  const cortesia = { paseLibre: true, plan: 'cortesia' }
  const pagando = { paseLibre: false, plan: 'premium' }

  it('el fundador es fundador aunque su clínica diga cortesía', () => {
    // Es exactamente el estado en que está hoy su cuenta.
    expect(claseDeCuenta(cortesia, true)).toBe('fundador')
  })

  it('la cortesía es cortesía, no fundador', () => {
    expect(claseDeCuenta(cortesia, false)).toBe('cortesia')
    expect(claseDeCuenta({ paseLibre: true }, false)).toBe('cortesia')
    expect(claseDeCuenta({ plan: 'cortesia' }, false)).toBe('cortesia')
  })

  it('el que paga es cliente', () => {
    expect(claseDeCuenta(pagando, false)).toBe('cliente')
    expect(claseDeCuenta(null, false)).toBe('cliente')
  })
})

describe('Ingreso y costo se responden por separado', () => {
  it('sólo el cliente que paga es ingreso', () => {
    expect(cuentaComoIngreso('cliente')).toBe(true)
    expect(cuentaComoIngreso('cortesia')).toBe(false)
    expect(cuentaComoIngreso('fundador')).toBe(false)
  })

  it('pero la cortesía SÍ cuesta servirla', () => {
    /**
     * Aquí es donde las dos preguntas se separan: la cortesía no da ingreso y
     * aun así consume IA que alguien paga. Esconder ese costo haría ver un
     * margen que no existe.
     */
    expect(esCogs('cortesia')).toBe(true)
    expect(esCogs('cliente')).toBe(true)
    expect(esCogs('fundador')).toBe(false)
  })

  it('el gasto del fundador es I+D, no costo de servir a nadie', () => {
    // §CD: si el gasto de PROBAR UCI se le carga al margen de los usuarios de
    // Consulta, las decisiones de precio salen mal.
    expect(cuentaComoIngreso('fundador')).toBe(false)
    expect(esCogs('fundador')).toBe(false)
  })
})
