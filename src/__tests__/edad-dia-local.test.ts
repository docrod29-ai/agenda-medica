/**
 * UN NIÑO NACIDO EL 15 CUMPLÍA AÑOS EL 14.
 *
 * `new Date('2020-03-15')` no es el 15 de marzo. El estándar obliga a leer una
 * fecha suelta como medianoche **UTC**, y en México (UTC−6) eso cae el **14 de
 * marzo a las 18:00** hora local. Como `getDate()` devuelve el día local, la
 * fecha de nacimiento se corría un día hacia atrás — todos los años, para todos
 * los pacientes.
 *
 * No es cosmético: de esa edad comen la dosis pediátrica por bandas, las
 * contraindicaciones por edad y el calendario de vacunación. Cruzar un umbral un
 * día antes es cruzarlo mal, y nadie lo iba a notar porque la cifra se ve
 * perfectamente razonable.
 *
 * ── POR QUÉ LA ZONA SE FIJA EN `vitest.config.ts` Y NO AQUÍ ─────────────────
 *
 * El fallo SÓLO aparece al oeste de Greenwich: en UTC no existe. La primera
 * versión de este archivo ponía `process.env.TZ` en un `beforeAll`… y no servía
 * de nada, porque V8 lee la zona UNA vez al inicializar. Comprobado: con el
 * arreglo revertido, estas pruebas pasaban en verde en un proceso arrancado en
 * UTC — que es como corre el CI.
 *
 * Una prueba que cree estar comprobando husos horarios sin haberlos cambiado es
 * peor que no tenerla: da por defendido algo que no lo está. Ahora la zona se
 * fija antes de arrancar vitest, para toda la suite.
 */
import { describe, it, expect } from 'vitest'
import { edadEnAnios, edadEnMeses, fechaLocalDesdeISO } from '@/lib/expediente/pediatria'

it('la suite corre en la hora del consultorio, no en la del servidor', () => {
  // Si esto cae, el resto del archivo deja de comprobar nada — y en silencio.
  expect(new Date(2020, 0, 15).getTimezoneOffset()).toBeGreaterThan(0)
})

describe('la fecha suelta se lee como día LOCAL', () => {
  it('el día no se corre hacia atrás', () => {
    const d = fechaLocalDesdeISO('2020-03-15')
    expect(d.getFullYear()).toBe(2020)
    expect(d.getMonth()).toBe(2)      // marzo
    expect(d.getDate()).toBe(15)      // ← antes daba 14
  })

  it('una marca de tiempo COMPLETA se respeta tal cual', () => {
    // Lleva su propia hora: no hay nada que corregir.
    const d = fechaLocalDesdeISO('2020-03-15T12:00:00')
    expect(d.getDate()).toBe(15)
  })

  it('una fecha inválida sigue siendo inválida, no se inventa', () => {
    expect(isNaN(fechaLocalDesdeISO('no es fecha').getTime())).toBe(true)
  })
})

describe('EL CUMPLEAÑOS CAE EL DÍA QUE ES', () => {
  const NACIMIENTO = '2020-03-15'

  it('la víspera todavía NO ha cumplido', () => {
    // Éste era el fallo: el 14 ya decía 2 años.
    expect(edadEnAnios(NACIMIENTO, '2022-03-14T12:00:00')).toBe(1)
  })

  it('el día del cumpleaños, sí', () => {
    expect(edadEnAnios(NACIMIENTO, '2022-03-15T12:00:00')).toBe(2)
  })

  it('y al día siguiente sigue teniendo los mismos', () => {
    expect(edadEnAnios(NACIMIENTO, '2022-03-16T12:00:00')).toBe(2)
  })
})

describe('los meses, que es lo que ordena el calendario de vacunación', () => {
  it('el día que cumple 2 meses, cuenta 2', () => {
    expect(edadEnMeses('2026-01-15', '2026-03-15')).toBe(2)
  })

  it('la víspera todavía cuenta 1', () => {
    // Un día de más en la cuenta adelanta una vacuna entera de casilla.
    expect(edadEnMeses('2026-01-15', '2026-03-14')).toBe(1)
  })

  it('el recién nacido cuenta 0, no un negativo', () => {
    expect(edadEnMeses('2026-03-15', '2026-03-15')).toBe(0)
  })
})

describe('lo que no debe romperse', () => {
  it('sin fecha de nacimiento no hay edad, y no es cero', () => {
    // Un 0 se leería como «recién nacido» y dispararía dosis neonatales.
    expect(edadEnAnios(null)).toBeNull()
    expect(edadEnAnios(undefined)).toBeNull()
    expect(edadEnAnios('')).toBeNull()
  })

  it('una fecha absurda tampoco produce una edad', () => {
    expect(edadEnAnios('mañana')).toBeNull()
    expect(edadEnAnios('1800-01-01')).toBeNull()   // fuera de rango humano
  })
})
