/**
 * GOLDEN — una agenda se acota por TIEMPO, y la ventana no se puede omitir.
 *
 * ── QUÉ HABÍA ───────────────────────────────────────────────────────────────
 *
 * `getAppointments(clinicId, constraints: QueryConstraint[] = [])`. Con ese valor
 * por omisión, `getAppointments(clinicId)` descarga **todas las citas que el
 * consultorio haya tenido nunca**, y quien lo escriba no tiene que hacer nada
 * raro: le basta con no pensar en la ventana.
 *
 * ── LO QUE EL CENSO DECÍA, Y LO QUE RESULTÓ AL MIRARLO ──────────────────────
 *
 * El censo lo daba por una lectura cara en producción. No lo es: **los cinco
 * llamadores de hoy pasan todos un `where('fechaHora', '>=', …)`**. Lo que había
 * era la puerta abierta para que el sexto no lo hiciera — y ésa se cierra con el
 * tipo, no con un aviso.
 *
 * La corrección importa: el defecto no era «se lee la agenda entera», era «nada
 * impide leerla entera». Se arreglan distinto y sólo uno de los dos existía.
 *
 * ── POR QUÉ NO SE ARREGLA CON UN `limit` ────────────────────────────────────
 *
 * La consulta ordena por `fechaHora` **ascendente**. `limit(N)` se queda con las
 * N citas MÁS ANTIGUAS del consultorio y tira las de esta semana. En una agenda,
 * recortar por el extremo equivocado no es una lectura barata: es perder citas en
 * silencio, y eso es peor que la lectura cara.
 *
 * Es el mismo razonamiento que `lecturas-sin-cota.mjs` lleva escrito en su
 * cabecera —«exigirles un tope sólo enseñaría a poner `limit(1000)` por
 * costumbre, que es peor que no tenerlo: parece protegido y no lo está»— aplicado
 * a la colección donde más se nota.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **La ventana sigue pudiendo ser enorme.** `{ desde: '2020-01-01 00:00' }` es
 *   una ventana válida y descarga cinco años. Lo que se cierra es que se lea sin
 *   NINGUNA; elegirla bien es de cada pantalla, y ahora está a la vista en la
 *   llamada en vez de escondida en un valor por omisión.
 * · **No toca `useAppointments`**, el `onSnapshot` cuya ventana sólo crece:
 *   navegar el calendario a hace un año deja el resto de la sesión recibiendo en
 *   vivo todas las citas desde entonces. Eso es rediseñar la ventana de la
 *   agenda y no se hace a ciegas — la regla de diseño dice que una interfaz no se
 *   aprueba leyendo el código.
 * · **No mide.** Cuánto cuesta la lectura con N citas sigue sin medirse en el
 *   emulador, como sí se midieron lista, búsqueda e historial (REG-383).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const FIRESTORE = readFileSync('src/lib/firestore.ts', 'utf8')
const LLAMADORES = [
  'src/app/(dashboard)/corte-caja/page.tsx',
  'src/app/(dashboard)/crm/page.tsx',
  'src/app/(dashboard)/reactivacion/page.tsx',
  'src/app/(dashboard)/operaciones/page.tsx',
]

/** La firma de `getAppointments`, acotada para no confundirla con otra cosa. */
const FIRMA = FIRESTORE.slice(
  FIRESTORE.indexOf('export async function getAppointments('),
  FIRESTORE.indexOf('export async function getAppointmentsByDate('),
)

describe('la ventana no se puede omitir', () => {
  it('AL REVÉS: ya no hay valor por omisión que la haga opcional', () => {
    /**
     * El defecto, escrito como la firma que lo permitía. Con
     * `constraints: QueryConstraint[] = []`, leer la agenda entera era la ruta
     * MÁS CORTA — no hacía falta equivocarse, bastaba con no pensarlo.
     */
    expect(FIRMA).not.toMatch(/constraints: QueryConstraint\[\] = \[\]/)
    expect(FIRMA).toMatch(/ventana: VentanaDeAgenda,/)
  })

  it('y la ventana entra en la consulta, no se queda en el argumento', () => {
    /* «El dato tiene que LLEGAR»: un parámetro obligatorio que nadie usa al
       construir la query es una firma más honesta y una lectura igual de cara. */
    expect(FIRMA).toMatch(/where\('fechaHora', '>=', ventana\.desde\)/)
    expect(FIRMA).toMatch(/ventana\.hasta \? \[where\('fechaHora', '<=', ventana\.hasta\)\] : \[\]/)
  })

  it('`hasta` es opcional y `desde` no, que es la asimetría correcta', () => {
    /**
     * Una agenda se lee «desde tal día en adelante» muchas veces —las próximas
     * citas, las de reactivación— y casi nunca «hasta tal día desde el
     * principio de los tiempos». Exigir el borde que acota y no el que no,
     * es lo que hace que el tipo sirva de algo.
     */
    const iface = FIRESTORE.slice(
      FIRESTORE.indexOf('export interface VentanaDeAgenda'),
      FIRESTORE.indexOf('export async function getAppointments('),
    )
    expect(iface).toMatch(/readonly desde: string/)
    expect(iface).toMatch(/readonly hasta\?: string/)
  })

  it('la razón de no usar `limit` está escrita donde se va a leer', () => {
    /* Sin ella, el próximo que vea esta lectura en el inventario le pondrá un
       `limit(500)` y romperá la agenda creyendo que la arregla. */
    expect(FIRMA.length).toBeGreaterThan(0)
    const cabecera = FIRESTORE.slice(
      FIRESTORE.indexOf('LA VENTANA ES OBLIGATORIA'),
      FIRESTORE.indexOf('export interface VentanaDeAgenda'),
    )
    expect(cabecera).toMatch(/MÁS ANTIGUAS/)
    expect(cabecera).toMatch(/perder citas en silencio/)
  })
})

describe('los llamadores declaran su ventana en la llamada', () => {
  it('los cuatro la pasan, y se ve sin abrir otro archivo', () => {
    for (const f of LLAMADORES) {
      const src = readFileSync(f, 'utf8')
      const i = src.indexOf('getAppointments(clinicId,')
      expect(i, `${f} ya no llama a getAppointments`).toBeGreaterThan(-1)
      expect(src.slice(i, i + 120), `${f} sin ventana visible`).toMatch(/\{ desde:/)
    }
  })

  it('ninguno pasa la lista de constraints a pelo', () => {
    /* El que evita la recaída: volver a `getAppointments(clinicId, [where(…)])`
       compila si `extra` es el segundo argumento — no lo es. */
    for (const f of LLAMADORES) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/getAppointments\(clinicId, \[/)
    }
  })

  it('y la lectura de UN día sigue acotada por los dos bordes', () => {
    const porFecha = FIRESTORE.slice(FIRESTORE.indexOf('export async function getAppointmentsByDate('))
    expect(porFecha).toMatch(/desde: fecha \+ ' 00:00', hasta: fecha \+ ' 23:59'/)
  })
})
