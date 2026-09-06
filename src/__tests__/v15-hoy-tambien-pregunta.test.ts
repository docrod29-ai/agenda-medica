/**
 * V15 §21 EN HOY — la fila de continuidad dejó de ser muda, y las cuatro
 * respuestas se escriben UNA vez para las dos superficies.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * No salió de leer código: salió de medir
 * (`scripts/design/medir-porque-en-hoy-v15.mjs`, acta
 * `docs/design/capturas/v15-porque-en-hoy/acta-antes.json`, 1440 y 390, build
 * de producción + emuladores + siembra, 0 errores de consola):
 *
 *   ALCANCE §21   2 de 6 superficies podían inspeccionar la fuente de un
 *                 hecho al abrir la ruta: /pendientes y /consulta.
 *   HOY           la zona CONTINUITY pintaba **5 filas y 0 podían preguntar**.
 *   LA FORMA      las 5 eran un `<a>` ENTERO. O sea que la mudez no era un
 *                 botón olvidado: era la forma de la fila. Un `<button>`
 *                 dentro de un `<a>` es `nested-interactive` (axe) y dos
 *                 destinos para el mismo gesto.
 *   EL COSTE      para llegar a las cuatro respuestas de §10 desde Hoy había
 *                 que IRSE a /pendientes. En el teléfono, **171px de
 *                 desplazamiento que no vuelven**: al regresar, Hoy arranca
 *                 arriba.
 *
 * `tareasVivas()` es UNA fuente de verdad con DOS lectores —la cola de cierre
 * y la zona CONTINUITY de §6—, y sólo uno podía preguntarle nada. Y Hoy es
 * donde el médico ve el pendiente por PRIMERA vez, a las nueve de la mañana.
 *
 * §21 pide «fact → inspect → source → return exactly where you were». Desde Hoy
 * no había «inspect»: había navegar, que es justo la pérdida de contexto que
 * §21 existe para evitar.
 *
 * ── LA CAUSA RAÍZ DEL SEGUNDO DEFECTO, EL QUE NO SE VE ──────────────────────
 *
 * Llevar la pregunta a Hoy tenía una salida barata: copiar el bloque de la
 * lente de `/pendientes`. Es exactamente la trampa de **REG-318**, y es
 * reciente: el sello de procedencia tenía TRES listas independientes de «qué es
 * una nota para el sello», sólo una completa, y el resultado fueron dos sellos
 * que contaban distinto sobre el mismo documento — el corto siendo el único que
 * un humano llegaba a ver.
 *
 * Dos plantillas para las cuatro respuestas de §10 sobre la MISMA entidad
 * clínica empiezan idénticas y divergen a la tercera edición. Por eso el
 * disparador, la lente, los cuatro bloques y la traza viven en
 * `src/components/tareas/PorQueEstaAqui.tsx` y las dos superficies los
 * consumen.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Los cuatro rótulos se escriben una vez.** Si aparecen en una pantalla,
 *    hay una segunda plantilla y el guardián se pone rojo.
 * 2. **El motor se llama desde la pieza, no desde las pantallas.**
 * 3. **La fila es la composición que Hoy YA usa** (`.cita-fila` +
 *    `.cita-principal` + `.cita-acciones`, la de `AppointmentRow` dos metros
 *    más arriba en la misma pantalla), no un patrón nuevo. Y por eso deja de
 *    ser un `<a>` entero: sin eso, el control no cabe sin `nested-interactive`.
 * 4. **El estado de la lente vive en el PANEL, no en la fila.** La lista se
 *    reordena por urgencia en cada `setAhora`; una fila que se guardara si está
 *    abierta perdería la lente al reordenarse. Es el mismo defecto que la
 *    corrida anterior ya pagó en `/pendientes` y que sólo cazó el navegador.
 * 5. **Hoy INSPECCIONA, no trabaja.** Mover de estado, cancelar con motivo y
 *    cerrar siguen siendo de `/pendientes`. Duplicar la transición de estado
 *    sería dos fuentes de verdad para el ciclo de vida de una tarea clínica.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Contra el árbol previo fallan los casos 1, 2, 3, 4, 5 y 8 (la pieza no
 * existe y la fila sigue siendo un `<a>` entero). Reversiones quirúrgicas sobre
 * el árbol nuevo, comprobadas en rojo una a una — están anotadas en el estado.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Es un guardián de FUENTE (este repo no usa @testing-library/react). Que la
 *   lente se abra de verdad desde Hoy, que Escape la cierre, que el foco
 *   vuelva y que Hoy no crezca bajo el dedo se mide en navegador real con
 *   `medir-porque-en-hoy-v15.mjs`, fase «despues».
 * · No sube el alcance de §21 a 6 de 6: sube a 3. `/pacientes` y
 *   `/operaciones` siguen declarados y sin hacer, y `/expediente` enseña su
 *   sello sólo tras abrir una nota firmada — no al abrir la ruta.
 * · No dice nada de si el TEXTO de las respuestas es clínicamente bueno. Eso
 *   es del motor, y tiene su propio guardián.
 * · No puntúa §29: quien implementa no puede ser el juez.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const PIEZA = leer('src/components/tareas/PorQueEstaAqui.tsx')
const HOY = leer('src/components/ContinuidadPanel.tsx')
const COLA = leer('src/app/(dashboard)/pendientes/page.tsx')

/** El cuerpo, sin la cabecera que lo explica: un guardián que busca una cadena
    en el fichero entero acaba cazándose a sí mismo leyendo la prosa que dice
    por qué esa cadena NO debe estar. La ceguera de `grafo-de-dependencias`,
    cazada ya seis veces en esta iteración. */
const cuerpo = (f: string) => f.slice(f.indexOf('import '))
const CODIGO_HOY = cuerpo(HOY)
const CODIGO_PIEZA = cuerpo(PIEZA)

const LOS_CUATRO = ['Por qué está aquí', 'Quién responde', 'Qué ha pasado', 'Qué sigue']

describe('§21 en Hoy — la zona de continuidad también pregunta', () => {
  it('1 · la fila de continuidad ya NO es un <a> entero: el control cabe sin anidarse', () => {
    /* LA MEDICIÓN QUE LO ORDENÓ: «filas que son un <a> entero: 5». Mientras la
       fila fuera un enlace, cualquier botón dentro era nested-interactive. */
    const i = CODIGO_HOY.indexOf('function ContinuidadFila')
    expect(i, 'ContinuidadFila no es un componente de módulo').toBeGreaterThan(-1)
    const fila = CODIGO_HOY.slice(i)

    // El contenedor es un <div>, y el enlace es la zona principal — la misma
    // composición que AppointmentRow usa en esta misma pantalla.
    expect(fila).toMatch(/<div\s+className="cita-fila"/)
    expect(fila).not.toMatch(/<Link[^>]*className="cita-fila"/)
    expect(fila).toMatch(/className="cita-principal"/)
    expect(fila).toMatch(/<div className="cita-acciones">/)

    // Y el disparador vive en la zona de acciones, FUERA del enlace: si el
    // <Link> se cerrara después del botón, volvería el anidado.
    const finDelEnlace = fila.indexOf('</Link>')
    expect(finDelEnlace).toBeGreaterThan(-1)
    expect(fila.indexOf('<DisparadorPorQue')).toBeGreaterThan(finDelEnlace)
  })

  it('2 · Hoy monta el disparador y la lente de §10 — y no los re-escribe', () => {
    expect(CODIGO_HOY).toMatch(
      /import \{[^}]*DisparadorPorQue[^}]*\} from '@\/components\/tareas\/PorQueEstaAqui'/)
    expect(CODIGO_HOY).toContain('<DisparadorPorQue')
    expect(CODIGO_HOY).toContain('<LentePorQue')
    // Ni la Capa 4 a mano, ni el motor por su cuenta.
    expect(CODIGO_HOY).not.toContain('<Lente ')
    expect(CODIGO_HOY).not.toMatch(/responderPorElPendiente\(/)
  })

  it('3 · los cuatro rótulos de §10 se escriben UNA vez (la lección de REG-318)', () => {
    for (const rotulo of LOS_CUATRO) {
      expect(CODIGO_PIEZA, `«${rotulo}» no lo escribe la pieza`).toContain(`titulo="${rotulo}"`)
      expect(CODIGO_HOY, `«${rotulo}» se volvió a escribir en Hoy`).not.toContain(`titulo="${rotulo}"`)
      expect(cuerpo(COLA), `«${rotulo}» se volvió a escribir en la cola`).not.toContain(`titulo="${rotulo}"`)
    }
    // Y el único que llama al motor es la pieza.
    expect(CODIGO_PIEZA).toMatch(/responderPorElPendiente\(/)
  })

  it('4 · el estado de la lente vive en el PANEL, no en la fila', () => {
    /* La lista se reordena por urgencia en cada `setAhora`. Una fila que se
       guardara si está abierta perdería la lente al reordenarse — el defecto
       que la corrida anterior pagó en /pendientes y que sólo vio el navegador:
       aria-expanded que no cambiaba, el disparador «moviéndose» 400px y el
       foco que no volvía. */
    const iPanel = CODIGO_HOY.indexOf('export function ContinuidadPanel')
    const iFila = CODIGO_HOY.indexOf('function ContinuidadFila')
    expect(iPanel).toBeGreaterThan(-1)
    expect(iFila).toBeGreaterThan(iPanel)

    const panel = CODIGO_HOY.slice(iPanel, iFila)
    const fila = CODIGO_HOY.slice(iFila)
    expect(panel).toMatch(/usePorQue\(\)/)
    expect(fila).not.toMatch(/usePorQue\(|useState\(/)
    // La fila recibe el estado; no lo tiene.
    expect(fila).toMatch(/porQueId/)
    // Y el panel es un componente de MÓDULO, no declarado en el render.
    expect(CODIGO_HOY).toMatch(/^function ContinuidadFila\(/m)
  })

  it('5 · la lente lee la tarea de AHORA: se busca por id, no se guarda una copia', () => {
    /* Una copia enseñaría la foto de un dato clínico en vez del dato: si el
       pendiente cambia debajo mientras la lente está abierta, lo que se lee
       tiene que ser el de ahora. Y si desaparece de la lista, la lente se
       queda sin sujeto — mejor eso que la ficha de algo que ya no está. */
    expect(CODIGO_HOY).toMatch(/porQueId \? \(ordenadas\.find\(t => t\.id === porQueId\) \?\? null\) : null/)
    // La pieza acepta `null` y no monta nada: es su contrato, no una
    // casualidad del consumidor.
    expect(CODIGO_PIEZA).toMatch(/tarea: TareaClinica \| null/)
    expect(CODIGO_PIEZA).toMatch(/if \(!tarea\) return null/)
  })

  it('6 · la vuelta del foco (§21) le llega a la lente desde las dos superficies', () => {
    expect(CODIGO_PIEZA).toMatch(/invocador=\{invocador\}/)
    expect(CODIGO_HOY).toMatch(/invocador=\{disparador\}/)
    expect(cuerpo(COLA)).toMatch(/invocador=\{disparadorPorQue\}/)
    // Y el hook que recuerda a quién volver es el mismo para las dos: si cada
    // pantalla se escribe el suyo, la siguiente puede olvidarse de la vuelta
    // sin que nada se ponga rojo.
    expect(CODIGO_PIEZA).toMatch(/export function usePorQue\(\)/)
    expect(CODIGO_PIEZA).toMatch(/disparador\.current = control/)
    expect(CODIGO_HOY).toMatch(/usePorQue\(\)/)
    expect(cuerpo(COLA)).toMatch(/usePorQue\(\)/)
  })

  it('7 · el disparador dice que abre algo, y con el estado REAL', () => {
    expect(CODIGO_PIEZA).toMatch(/aria-expanded=\{abierta\}/)
    // Los dos lados del enlace: comprobar sólo el botón dejaría pasar un
    // `aria-expanded` cableado a `false` constante.
    expect(CODIGO_HOY).toMatch(/abierta=\{porQueId === tarea\.id\}/)
    expect(cuerpo(COLA)).toMatch(/abierta=\{porQueId === t\.id\}/)
    // Y es un <button> de verdad (§24), no un div con onClick.
    expect(CODIGO_PIEZA).toMatch(/<Button\b/)
  })

  it('8 · Hoy INSPECCIONA, no trabaja: la transición de estado sigue siendo de la cola', () => {
    /* Dos fuentes de verdad para el ciclo de vida de una tarea clínica es la
       regla cardinal de este repositorio rota en el sitio más caro. Hoy no
       mueve, no cancela y no cierra. */
    for (const prohibido of ['cambiarEstado', 'siguientePaso']) {
      expect(CODIGO_HOY, `Hoy importó ${prohibido}`).not.toContain(prohibido)
    }
    // Y sigue apuntando a la cola para el trabajo.
    expect(CODIGO_HOY).toContain('href="/pendientes"')
  })

  it('9 · el formato de fecha se mudó TAL CUAL: una extracción no redondea una conducta', () => {
    /* `/pendientes` formateaba los hitos con día Y HORA, y su razón estaba
       escrita: en la línea de tiempo de un pendiente el día solo no basta para
       saber si el resultado se marcó antes o después de la consulta. Una
       extracción que «simplifica» ese formato al mudarlo es un cambio de
       conducta disfrazado de refactor, y ninguna prueba de la cola lo vería
       porque la cola ya no tiene el código. */
    /* ZC-019 añadió `timeZone: zonaActiva()` a esta llamada —la fecha del hito
       se leía en la zona del NAVEGADOR, no en la del consultorio— y con ello el
       `timeZone` quedó delante de `hour`. El patrón se afloja para que siga
       midiendo lo suyo, que es que la HORA no desapareció. */
    expect(CODIGO_PIEZA).toMatch(/toLocaleString\('es-MX'[^}]*hour: '2-digit'[^}]*minute: '2-digit'/)
    expect(CODIGO_PIEZA, 'y ahora también en la zona del consultorio (ZC-019)')
      .toMatch(/timeZone: zonaActiva\(\)/)
    // Y la cola ya no lo tiene duplicado.
    expect(cuerpo(COLA)).not.toMatch(/function fechaLarga/)
  })

  it('10 · la pieza no inventa datos: recibe la tarea, no la lee', () => {
    // §1 congela la lógica. Esto es «component extraction», no una fuente
    // nueva: ni Firestore, ni reloj propio para decidir qué enseñar.
    expect(CODIGO_PIEZA).not.toMatch(/^\s*import .*(firebase|firestore)/mi)
    expect(CODIGO_PIEZA).not.toMatch(/\b(getDocs|getDoc|setDoc|updateDoc|collection)\s*\(/)
    expect(CODIGO_PIEZA).not.toMatch(/tareasVivas\(/)
  })
})
