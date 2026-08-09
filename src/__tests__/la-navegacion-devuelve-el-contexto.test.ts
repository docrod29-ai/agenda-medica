/**
 * LA NAVEGACIÓN DEVUELVE EL CONTEXTO — V9 · NAVIGATION-001 · REG-300 a REG-303.
 *
 * ── EL REQUISITO, LITERAL ───────────────────────────────────────────────────
 *
 * La especificación pide que este ciclo devuelva al médico **al contexto exacto
 * anterior**:
 *
 *     Agenda → Paciente → Consulta → Resultados → Consulta
 *
 * y que no se pierdan «patient, encounter, note draft, scroll, filters, form
 * values, audio state, transcript state, AI draft, selected clinical tool».
 *
 * La auditoría encontró que **la pata de «Resultados» ya no costaba nada**:
 * `PanelLaboratorios` se monta DENTRO de la consulta y del expediente, así que
 * verlos no es una navegación. Lo que costaba era la pata de la Agenda.
 *
 * ── LOS CUATRO DEFECTOS QUE ESTA UNIDAD CIERRA ──────────────────────────────
 *
 *   · **REG-300** `proximoSeguimiento` se perdía al navegar — y el volcado de
 *     desmontaje **borraba** la copia que el rebote ya había guardado.
 *   · **REG-301** El atrás de la consulta era un destino FIJO con `push`, así
 *     que quien venía de la agenda nunca volvía a ella.
 *   · **REG-302** Fecha, filtro y búsqueda de la agenda se reiniciaban en cada
 *     vuelta: el médico volvía a poner la fecha después de CADA paciente.
 *   · **REG-303** Navegar dentro de la aplicación terminaba la grabación sin
 *     avisar.
 *
 * ── QUÉ **NO** CUBRE ESTE ARCHIVO ───────────────────────────────────────────
 *
 * Bastante, y conviene saberlo antes de apoyarse en él:
 *
 * - **No monta React ni navega de verdad.** Comprueba que las decisiones estén
 *   escritas donde tienen que estar. Recorrer el ciclo de verdad exige un
 *   navegador, y eso sigue abierto en `NAV-NAVEGADOR-001` — bloqueado por
 *   credenciales de Firebase, no por falta de herramienta.
 * - **No cubre el botón «atrás» del navegador durante una grabación**: es un
 *   `popstate`, no un clic, y cancelarlo exigiría empujar una entrada falsa al
 *   historial. Declarado en el hook y no resuelto.
 * - **No arregla el resto del estado que muere al navegar**: evidencia, panel de
 *   verificación, entidades, roles de hablante. Siguen en el backlog.
 * - **No restaura scroll** fuera de la consulta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const CONSULTA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const CITAS = leer('src', 'app', '(dashboard)', 'citas', 'page.tsx')
const AVISO = leer('src', 'hooks', 'useAvisoAlSalirGrabando.ts')

describe('REG-300 · la fecha de seguimiento sobrevive a la navegación', () => {
  it('viaja en el espejo en memoria Y en el volcado a localStorage', () => {
    /**
     * Ésta es la que muerde. `proximoSeguimiento` estaba en el respaldo con
     * rebote y en la restauración, pero **ausente** del espejo vivo, del espejo
     * en memoria y del volcado. Y como el espejo en memoria manda al restaurar,
     * el campo salía en blanco; peor todavía, el volcado reescribía la clave
     * SIN el campo, borrando lo que el rebote había guardado.
     *
     * Probada al revés: quitando `proximoSeguimiento: e.proximoSeguimiento` de
     * cualquiera de los dos respaldos, falla.
     */
    const enMemoria = /borradorMem\.escribir\(respaldoKey, \{[^}]*\}/.exec(CONSULTA)?.[0] ?? ''
    expect(enMemoria).toContain('proximoSeguimiento: e.proximoSeguimiento')

    // El volcado vive dentro de `flushRespaldo`, que es el que BORRABA el campo
    // al reescribir la clave sin él. Se acota a esa función a propósito: hay
    // otro `localStorage.setItem(respaldoKey…)` antes —el del rebote— que ya lo
    // llevaba, y buscarlo en todo el archivo daría un falso verde.
    const flush = /const flushRespaldo = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[respaldoKey\]\)/.exec(CONSULTA)?.[0] ?? ''
    expect(flush, 'no se localizó flushRespaldo').not.toBe('')
    expect(flush).toContain('proximoSeguimiento: e.proximoSeguimiento')
  })

  it('el espejo vivo lo lleva, que es de donde salen los dos respaldos', () => {
    expect((CONSULTA.match(/estudiosOrden, preop, proximoSeguimiento, transcripcion: voz\.transcripcion, firmada \}/g) ?? []).length).toBe(2)
  })

  it('la regla de «hay contenido» está escrita UNA vez, no tres', () => {
    /**
     * Era la causa raíz. La misma condición estaba copiada palabra por palabra
     * en el espejo, el volcado y el oyente de `nx:guardar-todo` — familia
     * `depende_de_recordar`. Añadir un campo en dos de los tres deja al tercero
     * diciendo que la nota está vacía cuando no lo está, que es justo lo que
     * pasó.
     *
     * Se exige que las tres llamen a la misma función y que ninguna reconstruya
     * la condición a mano.
     */
    expect((CONSULTA.match(/const hay = hayContenido\(e\)/g) ?? []).length).toBe(3)
    expect(CONSULTA).toContain('const hayContenido = (e:')
    // Ni una sola copia de la condición larga sobrevive.
    expect(CONSULTA).not.toMatch(/const hay = e\.resumen\?\.trim\(\)/)
  })

  it('una nota cuyo único contenido es la fecha de seguimiento SÍ se guarda', () => {
    /** Si `hayContenido` no la mirara, el respaldo se saltaría por «vacío» y el
     *  dato se perdería igual, con el arreglo puesto. */
    const fn = /const hayContenido = \(e:[\s\S]*?\n\n/.exec(CONSULTA)?.[0] ?? ''
    expect(fn).toContain('e.proximoSeguimiento?.trim()')
  })
})

describe('REG-301 · el atrás de la consulta vuelve por donde se vino', () => {
  it('usa `useSmartBack`, con el destino fijo sólo de respaldo', () => {
    /**
     * Probada al revés: devolviendo `onClick={() => router.push(volverA)}`,
     * falla.
     */
    expect(CONSULTA).toContain("import { useSmartBack } from '@/hooks/useSmartBack'")
    expect(CONSULTA).toContain('const volverAtras = useSmartBack(volverA)')
    expect(CONSULTA).toContain('<button onClick={volverAtras}')
  })

  it('el botón de atrás ya no apila una entrada nueva', () => {
    /**
     * `push` al «volver» es lo que dejaba al médico oscilando: cada regreso
     * añadía historial en vez de consumirlo. Queda UN `router.push(volverA)`, el
     * de descartar la consulta, que sí es un destino y no un regreso.
     */
    // Sólo CÓDIGO: las líneas de comentario también dicen `router.push(volverA)`
    // al explicar lo que se quitó, y contarlas daría un falso rojo.
    const codigo = CONSULTA.split('\n').filter(l => !/^\s*(\*|\/\/)/.test(l)).join('\n')
    expect((codigo.match(/router\.push\(volverA\)/g) ?? []).length).toBe(1)
  })
})

describe('REG-302 · la agenda recuerda el día que se estaba mirando', () => {
  it('el estado inicial sale de la URL', () => {
    expect(CITAS).toContain("useState(() => paramFecha(params.get('d')))")
    expect(CITAS).toContain("useState<AppointmentStatus | 'todas' | 'por-cobrar'>(() => paramFiltro(params.get('f')))")
    expect(CITAS).toContain("useState(() => params.get('q') ?? '')")
  })

  it('lo que viene de la URL se VALIDA antes de creerlo', () => {
    /**
     * `?d=borrame` dejaría la agenda pidiendo una ventana inexistente y la
     * pantalla en blanco sin decir por qué. Un parámetro de URL es entrada de
     * fuera, aunque lo escriba la propia aplicación.
     */
    expect(CITAS).toMatch(/function paramFecha[\s\S]*?\\d\{4\}-\\d\{2\}-\\d\{2\}/)
    expect(CITAS).toContain('const FILTROS_VALIDOS')
  })

  it('la URL se escribe con `replace`, no con `push`', () => {
    /** Cambiar de día no debe llenar el historial de entradas que el «atrás» del
     *  navegador tenga que deshacer una a una. */
    const efecto = /const id = setTimeout\(\(\) => \{[\s\S]*?\}, 300\)/.exec(CITAS)?.[0] ?? ''
    expect(efecto).toContain('router.replace(destino, { scroll: false })')
    expect(efecto).not.toContain('router.push')
  })

  it('abrir una cita por enlace ya no borra el contexto de la agenda', () => {
    /**
     * Las dos limpiezas del parámetro `id` hacían `router.replace('/citas')`
     * pelado: quitaban el `?id=` **y de paso** el día, el filtro y la búsqueda.
     * Ahora reponen la URL que describe lo que se está mirando.
     */
    expect(CITAS).not.toMatch(/router\.replace\('\/citas', \{ scroll: false \}\)/)
    expect((CITAS.match(/router\.replace\(urlAgendaRef\.current\(\), \{ scroll: false \}\)/g) ?? []).length).toBe(2)
  })
})

describe('REG-303 · avisa antes de que una navegación corte el dictado', () => {
  it('sólo escucha mientras se graba', () => {
    /** Un interceptor de clics permanente es una forma excelente de romper la
     *  navegación de toda la aplicación. El ámbito es el arreglo. */
    expect(AVISO).toContain('if (!grabando) return')
    expect(AVISO).toContain("document.addEventListener('click', alHacerClic, true)")
    expect(AVISO).toContain("document.removeEventListener('click', alHacerClic, true)")
  })

  it('la consulta lo engancha al estado real del dictado', () => {
    expect(CONSULTA).toContain("useAvisoAlSalirGrabando(audio.estado === 'grabando', confirm)")
  })

  it('no se mete donde no desmonta nada', () => {
    /**
     * Modificador, botón secundario, `target` distinto, enlace externo, o enlace
     * a la pantalla en la que ya estamos —el botón central de la barra inferior
     * durante una consulta es exactamente eso—. En ninguno de esos casos se
     * desmonta la consulta, así que preguntar sería ruido. Y un aviso que salta
     * donde no debe se acaba ignorando: REG-245.
     */
    expect(AVISO).toContain('ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey')
    expect(AVISO).toContain("if (!href.startsWith('/')) return")
    expect(AVISO).toContain("if (href.split('?')[0] === pathname) return")
  })

  it('pregunta, no impide', () => {
    /** El audio ya está a salvo (REG-294/271). Bloquear la salida sería peor que
     *  el problema: el médico tiene que poder irse. */
    expect(AVISO).toContain('.then(ok => { if (ok) router.push(href) })')
  })
})
