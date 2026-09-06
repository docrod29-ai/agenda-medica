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
 * · **Es análisis estático, y sólo reconoce `limit`.** Una cota que llegue por un
 *   parámetro en tiempo de ejecución no la ve. `getAppointments` es justo eso:
 *   desde REG-563 exige una VENTANA DE TIEMPO —`{ desde, hasta? }`, obligatoria
 *   por tipo— y sigue figurando aquí, porque el instrumento no sabe leer eso.
 *
 *   Y está bien que siga figurando: una ventana acota por FECHA, no por número.
 *   `{ desde: '2020-01-01 00:00' }` es válida y descarga cinco años. Lo que se
 *   cerró es que se lea sin ninguna; cuánto pesa la que se elija es otra cosa.
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
import { readFileSync } from 'node:fs'
import { inventariar, sinCota, recuento, esDeHospital } from '../../scripts/escala/lecturas-sin-cota.mjs'

/**
 * EL TECHO. Medido el 30-ago-2026. **Sólo puede bajar.**
 *
 * Si un cambio lo sube, se arregla el cambio — no se sube el techo. Si de verdad
 * la lectura nueva está acotada por su naturaleza, lo que falta es que el
 * inventario sepa reconocer su forma de cota, y eso se arregla en el script.
 */
const TECHO = { consultorio: 28, hospital: 9 }

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
  it('`getAppointments` sigue figurando sin cota, y ahora por la razón correcta', () => {
    /**
     * ── POR QUÉ ESTE CASO CAMBIÓ DE FORMA (REG-563) ────────────────────────
     *
     * Localizaba la lectura por NÚMERO DE LÍNEA (`linea < 80`). Documentar la
     * función —cuarenta líneas de cabecera explicando por qué un `limit` la
     * rompería— la empujó hacia abajo y el caso se cayó sin que nada de lo que
     * vigila hubiera cambiado. Un guardián anclado a un número de línea vigila
     * el tamaño del archivo.
     *
     * Y lo que dice también cambió. Antes: «su techo depende de quien llame», y
     * `getAppointments(clinicId, [])` descargaba todas las citas del
     * consultorio. Eso ya no se puede escribir: la ventana es obligatoria por
     * tipo.
     *
     * Sigue contando aquí, y es correcto: el instrumento sólo reconoce `limit`,
     * y una ventana acota por FECHA, no por número. Ponerle un `limit` suelto
     * sería peor —la consulta ordena ascendente, así que se quedaría con las
     * citas más ANTIGUAS y tiraría las de esta semana—, que es exactamente lo
     * que la cabecera de este archivo dice de los topes por costumbre.
     */
    const FIRESTORE = readFileSync('src/lib/firestore.ts', 'utf8')
    const linea = FIRESTORE.slice(0, FIRESTORE.indexOf('export async function getAppointments(')).split('\n').length
    const citas = sinCota().filter(
      (f: { archivo: string; linea: number }) =>
        f.archivo === 'src/lib/firestore.ts' && f.linea >= linea && f.linea < linea + 20,
    )
    expect(citas.length, 'si ya está acotada por número, baja el techo y borra este caso').toBe(1)
    /**
     * Y la ventana obligatoria sigue ahí: si alguien la vuelve opcional, esto cae.
     *
     * Se mira la FIRMA y no el archivo entero: la cabecera de la función cita la
     * forma prohibida para explicar por qué se quitó, y buscarla en todo el
     * fichero la encuentra ahí. Es la tercera vez en esta tanda que una
     * comprobación negativa choca con el comentario que explica lo prohibido.
     */
    const firma = FIRESTORE.slice(
      FIRESTORE.indexOf('export async function getAppointments('),
      FIRESTORE.indexOf('export async function getAppointmentsByDate('),
    )
    expect(firma).toMatch(/ventana: VentanaDeAgenda,/)
    expect(firma).not.toMatch(/constraints: QueryConstraint\[\] = \[\]/)
  })

  it('lo de Hospital se puede separar de lo de Consultorio', () => {
    expect(esDeHospital('src/lib/hospital/firestore.ts')).toBe(true)
    expect(esDeHospital('src/lib/firestore.ts')).toBe(false)
  })
})
