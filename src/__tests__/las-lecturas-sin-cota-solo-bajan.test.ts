/**
 * TRINQUETE — `getDocs` que puede descargar una colección entera.
 *
 * ── QUÉ PROBLEMA RESUELVE ───────────────────────────────────────────────────
 *
 * El censo del programa llevaba meses diciendo «el inventario medido daba 44
 * getDocs sin limit(); falta recontarlo». Un número escrito a mano en un
 * documento: la familia `depende_de_recordar` en su forma más pura. Nadie lo
 * recontó, y mientras tanto no había forma de saber si una lectura nueva sin
 * cota había entrado al árbol.
 *
 * Esto lo convierte en un techo que **sólo baja**.
 *
 * ── POR QUÉ UN INVENTARIO Y NO UNA REGLA DE LINT ────────────────────────────
 *
 * Porque **no toda lectura necesita `limit`**. Las unidades de un hospital, los
 * consultorios de una cuenta, las versiones de UNA nota: son colecciones
 * acotadas por su naturaleza. Exigirles un tope enseñaría a escribir
 * `limit(1000)` por costumbre, que es peor que no tenerlo — parece protegido y no
 * lo está.
 *
 * Lo que hace falta es que **una lectura nueva sin cota no pueda entrar callada**.
 *
 * ── LO QUE COSTÓ MEDIRLO BIEN, Y POR QUÉ SE CUENTA AQUÍ ─────────────────────
 *
 * El primer inventario dijo 55 de 58 sin cota. Era falso por tres motivos, y los
 * tres enseñan algo:
 *
 *  · `limitarA(1)` y `fbLimit(500)` son alias de `limit` y no casaban con la
 *    expresión que los buscaba;
 *  · media docena de llamadas son `getDocs(q)` con la `q` armada tres líneas
 *    antes, o `getDocs(ayudante(...))` con el tope dentro del ayudante;
 *  · resolver los nombres en TODO el archivo marcaba como deuda
 *    `listarPacientesPagina`, que **sí** acota: otra función del mismo archivo
 *    tiene una variable homónima sin cota y la búsqueda se quedaba con la
 *    primera.
 *
 * Un inventario que exagera manda a rehacer lo hecho y le quita crédito a los
 * huecos reales. Por eso los nombres se resuelven dentro de la función que los
 * usa, y por eso este párrafo está aquí: el instrumento tiene un historial.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Es análisis estático.** Una cota que llegue por un parámetro en tiempo de
 *   ejecución no la ve — `getAppointments(clinicId, constraints)` es justo eso, y
 *   por eso figura como sin cota: su techo depende de quien llame, que es
 *   exactamente la queja del censo.
 * · **No dice si una lectura es CARA.** Dice que puede crecer sin techo. Cuánto
 *   crece de verdad lo mide el emulador de WS-03 (REG-383), sobre datos.
 * · **No cubre `onSnapshot`.** `useAppointments` mantiene una suscripción viva
 *   cuya ventana **sólo crece y nunca se encoge**: navegar el calendario a hace
 *   un año deja el resto de la sesión recibiendo todas las citas desde entonces.
 *   Está nombrado en el censo y no se toca aquí — arreglar la agenda a ciegas es
 *   lo que la regla de diseño prohíbe («no se aprueba una interfaz leyendo el
 *   código»).
 */
import { describe, it, expect } from 'vitest'
import { inventariar, sinCota, recuento, esDeHospital } from '../../scripts/escala/lecturas-sin-cota.mjs'

/**
 * EL TECHO. Medido el 30-ago-2026. **Sólo puede bajar.**
 *
 * Si un cambio lo sube, se arregla el cambio — no se sube el techo. Si de verdad
 * la lectura nueva está acotada por su naturaleza, lo que falta es que el
 * inventario sepa reconocer su forma de cota, y eso se arregla en el script.
 */
const TECHO = { consultorio: 29, hospital: 9 }

describe('el inventario mide algo, y lo mide con cuidado', () => {
  it('encuentra las lecturas del árbol (si no, pasaría vacío)', () => {
    /* Sin este caso, un scanner roto que devuelve [] daría un trinquete en
       verde para siempre — que es la forma habitual de que una compuerta deje
       de proteger sin que nadie lo note. */
    expect(inventariar().length).toBeGreaterThan(40)
  })

  it('reconoce las cuatro formas de poner un techo que usa este árbol', () => {
    /**
     * `limit`, `limitarA`, `firestoreLimit` y `fbLimit`. Tres de ellas hicieron
     * contar de más en el primer intento.
     */
    const conCota = inventariar().filter(f => f.cota)
    expect(conCota.length).toBeGreaterThan(10)
  })

  it('y NO marca como deuda una lectura que sí acota', () => {
    /**
     * El caso concreto que enseñó a resolver por función y no por archivo:
     * `listarPacientesPagina` empuja `limitarA(limite + 1)` a sus restricciones.
     * Si vuelve a salir como deuda, el instrumento se rompió.
     */
    const paginaDePacientes = sinCota().filter(
      (f: { archivo: string; linea: number }) => f.archivo === 'src/lib/firestore.ts' && f.linea > 255 && f.linea < 270,
    )
    expect(paginaDePacientes, 'listarPacientesPagina SÍ acota').toEqual([])
  })
})

describe('el trinquete sólo baja', () => {
  it('Consultorio no añade lecturas sin cota', () => {
    const hoy = recuento()
    expect(
      hoy.consultorio,
      'entró una lectura sin cota: arregla el cambio, no subas el techo',
    ).toBeLessThanOrEqual(TECHO.consultorio)
  })

  it('Hospital tampoco — va aparte, no fuera', () => {
    /**
     * Hospital y UCI están en ALPHA y fuera de este carril, pero **se cuentan**:
     * si salieran del inventario, sus lecturas sin cota dejarían de existir para
     * el CI justo hasta el día que se vendan.
     */
    expect(recuento().hospital).toBeLessThanOrEqual(TECHO.hospital)
  })

  it('el techo es el que mide el script hoy, sin holgura escondida', () => {
    /**
     * Un techo con margen no es un trinquete: deja entrar deuda hasta llenarlo y
     * nadie se entera. Si esto baja, se baja el techo en el mismo cambio.
     */
    expect(recuento()).toEqual(TECHO)
  })

  it('y el reparto entre carriles suma el total', () => {
    const hoy = recuento()
    expect(hoy.consultorio + hoy.hospital).toBe(sinCota().length)
  })
})

describe('lo que el inventario deja dicho', () => {
  it('`getAppointments` figura sin cota, que es la queja del censo', () => {
    /**
     * Su techo depende de las restricciones que le pase quien llame:
     * `getAppointments(clinicId, [])` descarga todas las citas que el
     * consultorio haya tenido nunca. No se «arregla» poniéndole un `limit`
     * suelto: sin `orderBy` propio, un tope recortaría por el extremo
     * equivocado y **perdería citas en silencio**, que en una agenda es peor que
     * la lectura cara.
     */
    const citas = sinCota().filter(
      (f: { archivo: string; linea: number }) => f.archivo === 'src/lib/firestore.ts' && f.linea < 80,
    )
    expect(citas.length, 'si ya está acotada, baja el techo y borra este caso').toBe(1)
  })

  it('lo de Hospital se puede separar de lo de Consultorio', () => {
    expect(esDeHospital('src/lib/hospital/firestore.ts')).toBe(true)
    expect(esDeHospital('src/lib/firestore.ts')).toBe(false)
  })
})
