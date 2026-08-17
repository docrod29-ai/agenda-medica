/**
 * GOLDEN — el expediente ya contestaba las cinco preguntas; esto impide que
 * deje de hacerlo.
 *
 * ── QUÉ SE FUE A BUSCAR, Y QUÉ SE ENCONTRÓ ─────────────────────────────────
 *
 * La re-auditoría independiente dejó `/expediente` en 1.0–1.5 y el diagnóstico
 * de §29 escribió por qué: «es el más cercano; **su hueco era de evidencia**».
 * No estaba dicho que la pantalla estuviera mal: estaba dicho que nadie había
 * demostrado que estuviera bien.
 *
 * El encargo de esta rebanada pide, en este orden: primero comprobar si el HEAD
 * actual ya expresa estado actual + cambio longitudinal + trabajo sin resolver +
 * procedencia + siguiente continuación, y **sólo si hay hueco real** rediseñar.
 *
 * Se comprobó en navegador real el 15-ago sobre `pac-aurelio-dominguez` —un
 * paciente longitudinal de verdad: 2 consultas firmadas desde el 1-jul, 2
 * diagnósticos crónicos, 2 pendientes vivos— a 1440×900 y 390×844, 0 errores de
 * consola. Capturas y acta en `docs/design/capturas/v15-encuentro-v29/`.
 *
 * Las cinco estaban:
 *
 *  1. **Estado actual** — `ResumenPaciente`: últimos signos (TA 132/84 · FC 74 ·
 *     … · IMC 28.1), diagnósticos activos, actividad.
 *  2. **Cambio longitudinal** — «2 consultas · última visita 03 ago 2026», la
 *     línea de tiempo de encuentros con sus fechas, y «Problemas / Toma» que se
 *     calculan sobre lo último dicho de cada uno.
 *  3. **Trabajo sin resolver** — `CabosSueltosDelPaciente`: «1 sin leer · 1 en
 *     plazo», cada uno con su nombre, su dueño («Dra. Elena Sandoval Rivas» /
 *     «sin dueño») y su estado.
 *  4. **Procedencia** — «Último cambio: Nota de Seguimiento · hace 12 días» en
 *     alergias; «De lo último que se dijo de cada uno en sus notas **firmadas**»
 *     bajo Problemas; el sello «Firmada» en cada nota de la historia.
 *  5. **Siguiente continuación** — «Nueva consulta» como acción primaria, y
 *     «Resolverlos en Pendientes →» para los cabos sueltos.
 *
 * **Veredicto: sin hueco estructural.** No se rediseñó. Lo que faltaba era
 * esto: la prueba.
 *
 * ── LA REGLA QUE LO HACE SEGURO ────────────────────────────────────────────
 *
 * La quinta es la que más fácil se rompe «mejorando»: los cabos sueltos se
 * CIERRAN en `/pendientes`, no aquí. `/pendientes` separa a propósito «Ya se
 * hizo» de «Lo revisé — cerrar», y entre esas dos vive el daño que el worklist
 * existe para evitar. Poner un botón de cerrar en un expediente donde el
 * detalle de la tarea no está en pantalla permitiría cerrar un resultado sin
 * haberlo mirado. El expediente **inspecciona y continúa**; no muta.
 *
 * ── CÓMO SE PROBÓ AL REVÉS ─────────────────────────────────────────────────
 *
 * Cada caso se comprobó en rojo quitando su pieza del árbol (comentando el
 * componente o el `cargar=`), una a una, y cada reversión muerde exactamente su
 * caso. Ninguna mutación quedó en el árbol.
 *
 * ── QUÉ NO CUBRE ───────────────────────────────────────────────────────────
 *
 *  · Análisis estático del cableado: no monta React. Lo que se ve vive en las
 *    capturas.
 *  · No prueba el CONTENIDO de los signos ni de las fechas: eso es de los
 *    motores que los calculan y de sus propias pruebas.
 *  · No cubre el expediente VACÍO (RTC-30, ya cerrado aparte) ni el
 *    hospitalario.
 *  · No juzga §29. El score lo pone el revisor independiente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PAGE = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
const RESUMEN = leer('src/components/expediente/ResumenPaciente.tsx')
const CABOS = leer('src/components/CabosSueltosDelPaciente.tsx')
const ANCLA = leer('src/components/expediente/PatientAnchor.tsx')

describe('§29 · el expediente contesta las cinco preguntas de continuidad', () => {
  it('1 · ESTADO ACTUAL — signos, diagnósticos activos y actividad, del dato real', () => {
    expect(PAGE).toContain('<ResumenPaciente patient={patient} notas={notas} />')
    expect(RESUMEN).toContain('Últimos signos:')
    expect(RESUMEN).toContain('Diagnósticos activos:')
    // Sale de las notas que recibe, no de un texto fijo.
    expect(RESUMEN).toContain('notas')
  })

  it('2 · CAMBIO LONGITUDINAL — cuántas consultas y cuándo fue la última', () => {
    expect(RESUMEN).toContain('Actividad:')
    expect(RESUMEN).toContain('última visita')
    // Y la historia se pinta como serie, con su ancla.
    expect(PAGE).toContain('id="spine-encuentros"')
    expect(PAGE).toContain('Historia clínica')
  })

  it('3 · TRABAJO SIN RESOLVER — con su dueño, en la propia pantalla', () => {
    expect(PAGE).toContain('<CabosSueltosDelPaciente')
    expect(PAGE).toContain('cargar={tareasDePaciente}')
    expect(CABOS).toContain("'sin dueño'")
    expect(CABOS).toContain('ownerNombre')
  })

  it('4 · PROCEDENCIA — lo que se afirma dice de qué nota salió', () => {
    // Problemas/Toma declaran su fuente, y la declaran FIRMADA: un borrador no
    // es historia clínica.
    expect(PAGE).toContain('De lo último que se dijo de cada uno en sus notas')
    expect(PAGE).toContain('<b>firmadas</b>')
    // Y el ancla del paciente fecha el último cambio de las alergias, diciendo
    // DE QUÉ NOTA salió — no sólo cuándo.
    expect(ANCLA).toContain('Último cambio:')
    expect(ANCLA).toContain('ultimoCambio.tipo')
  })

  it('5 · SIGUIENTE CONTINUACIÓN — abrir el encuentro, o ir a resolver', () => {
    expect(PAGE).toContain('Nueva consulta')
    expect(CABOS).toContain('Resolverlos en Pendientes')
    expect(PAGE).toContain("alAbrirPendientes={() => router.push('/pendientes')}")
  })

  it('6 · lo clínico va ANTES de las utilidades — identidad → estado → pendientes → historia', () => {
    const anclas = ['<PatientAnchor', '<ResumenPaciente', 'id="spine-pendientes"', 'id="spine-encuentros"']
    const posiciones = anclas.map(a => {
      const i = PAGE.indexOf(a)
      expect(i, `no se encontró ${a}`).toBeGreaterThan(-1)
      return i
    })
    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b))
    // Y el catálogo de herramientas queda DESPUÉS de la historia, no delante.
    expect(PAGE.indexOf('<Herramientas')).toBeGreaterThan(PAGE.indexOf('id="spine-encuentros"'))
  })

  it('7 · el expediente NO cierra pendientes: inspecciona y continúa', () => {
    // Si alguien trae aquí el avance de estado del worklist, este caso se cae.
    // El motivo está en la cabecera: entre «ya se hizo» y «alguien lo leyó»
    // vive el daño que `/pendientes` existe para evitar.
    expect(PAGE).not.toContain('cambiarEstado')
    expect(CABOS).not.toContain('cambiarEstado')
  })
})
