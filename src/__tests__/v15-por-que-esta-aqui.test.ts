/**
 * V15 §10 — LA COLA DE CIERRE CONTESTA LAS CUATRO PREGUNTAS, Y LA TRAZA LLEGA.
 *
 * ── QUÉ FALTABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * §10 exige que cada entrada de la cola conteste cuatro preguntas: WHY IS THIS
 * HERE · WHO OWNS IT · WHAT HAPPENED · WHAT IS NEXT. La primera rebanada de
 * `V15-FOLLOWUP-WORK-001` agrupó `/pendientes` por estado de acción y dejó dos
 * contestadas (dueño y siguiente paso). Las otras dos no estaban en la pantalla
 * de ninguna forma.
 *
 * Buscando con qué contestarlas apareció el hallazgo de verdad, y no es de
 * interfaz: **`TareaClinica.notaId` estaba guardado y no llegaba a nadie.** El
 * modelo lo declara con todas las letras —«de qué consulta salió. Es la traza
 * hacia atrás»—, `derivar.ts:81` lo escribe en cada tarea derivada de una nota
 * firmada, y un barrido del repositorio devuelve UN solo consumidor:
 * `firestore.ts`, que lo usa para componer un id derivado y no duplicar al
 * repetir la acción. Ninguna pantalla lo lee. Ningún ojo lo ve.
 *
 * Es «el dato tiene que LLEGAR» en su forma más silenciosa: el campo existe, se
 * escribe, las pruebas de contrato pasan, y del otro lado no hay quien lo lea.
 * REG-160/167/170 son la misma familia.
 *
 * Y un segundo hueco, del mismo tipo, en el otro extremo: **ninguna tarea
 * sembrada traía `notaId`**, así que aunque la pantalla lo leyera, la medición
 * en navegador habría fotografiado «no consta de qué consulta salió» en las
 * siete y lo habría dado por correcto. Quinto hueco de siembra de esta familia
 * en la iteración.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **AUSENCIA DE DATO NO ES DATO DE AUSENCIA** (regla 4 de seguridad
 *    clínica). Una tarea sin `completadaEn` no produce el hito «no se ha
 *    hecho»: produce la ausencia del hito. Que no conste que el trabajo se hizo
 *    no es constancia de que no se hiciera.
 * 2. **`origen` es una cadena libre**, no una unión de tipos. Lo que no se
 *    reconoce se declara sin explicar, no se reparte entre los tres valores
 *    documentados — regla 5 de seguridad clínica aplicada a los datos.
 * 3. **`cerradaPor` es un uid**: se dice «tú» cuando coincide con quien mira, y
 *    en cualquier otro caso el hito conserva la fecha y CALLA el autor. Un uid
 *    crudo en pantalla no informa a nadie; un nombre inventado miente.
 * 4. **Completada ≠ cerrada.** El hito del trabajo hecho sin revisar se marca
 *    en el modelo, no en la pantalla, para que ninguna vista futura pueda
 *    pintarlo como «listo».
 * 5. **Una sola definición del siguiente paso legal.** `siguientePaso` vive en
 *    el módulo y la pantalla lo importa: dos copias del paso siguiente de una
 *    tarea clínica acaban ofreciendo un botón que `cambiarEstado` rechaza.
 * 6. **La lente es UNA, vive en la página, y las tarjetas NO se declaran dentro
 *    del render.** Esto último lo encontró el navegador, no el código: React ve
 *    un componente declarado en el render como un tipo nuevo cada vez y remonta
 *    su subárbol, así que el disparador que se acababa de pulsar quedaba
 *    desconectado del documento. Síntomas medidos en el acta «antes»:
 *    `aria-expanded` false → false, el disparador «moviéndose» 357-455px, y el
 *    foco sin volver al cerrar con Escape — que es §21 incumplido, o sea, la
 *    interacción que esta rebanada entrega.
 *
 * ── LO QUE LA CAPTURA CAMBIÓ, ADEMÁS DEL DEFECTO ────────────────────────────
 *
 * La frase de «por qué está aquí» incrustaba `ETIQUETA_TIPO` y salió impresa
 * como «el plan dejó este reconciliar abierto». Las etiquetas de tipo no son
 * sustantivos; el tipo salió de la frase (caso 3b). Dos veces en una corrida
 * que mirar el producto cambia lo escrito.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Contra el árbol previo el fichero entero no carga (el módulo no existe).
 * Devolviendo sólo el cableado al estado previo —módulo presente, pantalla y
 * siembra sin tocar— fallan los casos 10, 11, 12, 13 y 14, comprobado.
 * Reversiones quirúrgicas sobre el árbol nuevo, en rojo una a una:
 *   · el `default` de `porQueEstaAqui` cayendo en 'nota'        → rompe el 3
 *   · el hito de completada emitido sin `completadaEn`          → rompe el 5
 *   · `sinRevisar` cableado a false                             → rompe el 6
 *   · `cerradaPor` impreso crudo cuando no es de quien mira     → rompe el 8
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No dice que la lente se VEA bien: eso se mide en navegador real con
 *   `scripts/design/medir-por-que-esta-aqui-v15.mjs`. Este guardián es de
 *   fuente y de módulo puro (el repo no usa @testing-library/react).
 * · No cubre `/expediente` ni la agenda: el alcance de §21 sube de 1 a 2 de 6
 *   superficies con esta rebanada, no a 6. Las otras cuatro siguen declaradas
 *   y sin hacer.
 * · No puntúa §29: quien implementa no puede ser el juez.
 * · No comprueba que `derivar.ts` escriba `notaId` en producción — eso ya lo
 *   cubren las pruebas de derivación. Comprueba que alguien lo LEA.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  responderPorElPendiente,
  siguientePaso,
  POR_QUE_LA_TRAZA_IMPORTA,
} from '@/lib/tareas-clinicas/por-que-esta-aqui'
import type { TareaClinica } from '@/lib/tareas-clinicas/modelo'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const PAGINA = leer('src/app/(dashboard)/pendientes/page.tsx')
/** La pieza compartida: desde que Hoy contesta lo mismo, las cuatro respuestas
    se escriben aquí y en ningún otro sitio. */
const PIEZA = leer('src/components/tareas/PorQueEstaAqui.tsx')
/** El segundo lector de `tareasVivas()`: la zona CONTINUITY de Hoy. */
const HOY = leer('src/components/ContinuidadPanel.tsx')
const MODULO = leer('src/lib/tareas-clinicas/por-que-esta-aqui.ts')
const SIEMBRA = leer('scripts/design/sembrar-capturas.mjs')

/** El cuerpo, sin la cabecera que lo explica: un guardián que busca una cadena
    en el fichero entero acaba cazándose a sí mismo leyendo la prosa que dice
    por qué esa cadena NO debe estar (la ceguera cazada cinco veces ya). */
const CODIGO_MODULO = MODULO.slice(MODULO.indexOf('import {'))

const BASE: TareaClinica = {
  clinicId: 'c1',
  patientId: 'pac-1',
  patientNombre: 'Aurelio Domínguez Peña',
  tipo: 'resultado_por_revisar',
  titulo: 'Perfil lipídico',
  prioridad: 'normal',
  estado: 'solicitada',
  creadaEn: '2026-08-01T10:00:00.000Z',
  origen: 'laboratorio',
}

describe('§10 — las cuatro preguntas de la cola de cierre', () => {
  it('1 · contesta las cuatro, ninguna vacía', () => {
    const r = responderPorElPendiente(BASE)
    expect(r.porQue.length).toBeGreaterThan(10)
    expect(r.quienResponde.length).toBeGreaterThan(0)
    expect(r.queHaPasado.length).toBeGreaterThan(0)
    expect(r.queSigue.length).toBeGreaterThan(10)
  })

  it('2 · «por qué está aquí» distingue los tres orígenes documentados', () => {
    expect(responderPorElPendiente({ ...BASE, origen: 'nota' }).porQue).toMatch(/consulta/i)
    expect(responderPorElPendiente({ ...BASE, origen: 'laboratorio' }).porQue).toMatch(/laboratorio/i)
    expect(responderPorElPendiente({ ...BASE, origen: 'manual' }).porQue).toMatch(/a mano/i)
  })

  it('3 · un origen que no se reconoce NO se reparte entre los conocidos', () => {
    // Regla 5 de seguridad clínica: que falte un valor del vocabulario
    // significa que ese caso no se explica, no que se dé por bueno el más
    // parecido. `origen` es `string` en el modelo: esto pasa de verdad.
    const raro = responderPorElPendiente({ ...BASE, origen: 'importacion-hl7' })
    expect(raro.porQue).toContain('importacion-hl7')
    expect(raro.porQue).toMatch(/no sabe explicar/i)
    expect(raro.porQue).not.toMatch(/consulta|laboratorio|a mano/i)

    const vacio = responderPorElPendiente({ ...BASE, origen: '' })
    expect(vacio.porQue).toMatch(/no consta cómo se abrió/i)
  })

  it('3b · el TIPO no se incrusta en la frase — lo cazó la captura, no el diseño', () => {
    /**
     * La primera versión componía «el plan dejó este ${ETIQUETA_TIPO} abierto»
     * y la captura del navegador lo enseñó impreso como «el plan dejó este
     * reconciliar abierto». `ETIQUETA_TIPO` no es un vocabulario de
     * sustantivos: «Reconciliar» es un verbo y «Pendiente» un adjetivo
     * sustantivado. Meterlo en una ranura de sustantivo rompe el texto en
     * cuanto alguien añada una etiqueta nueva, y no rompe ninguna prueba.
     *
     * La frase no cambia con el tipo. Se comprueba con los seis.
     */
    const tipos = [
      'estudio_pendiente', 'resultado_por_revisar', 'seguimiento',
      'receta_por_entregar', 'reconciliacion_medicamento', 'otra',
    ] as const
    const frases = new Set(tipos.map(tipo => responderPorElPendiente({ ...BASE, tipo, origen: 'nota' }).porQue))
    expect(frases.size, 'la frase todavía depende del tipo').toBe(1)
    for (const tipo of tipos) {
      const f = responderPorElPendiente({ ...BASE, tipo, origen: 'nota' }).porQue
      expect(f, `«${tipo}» produce una etiqueta pegada en la frase`)
        .not.toMatch(/este (reconciliar|pendiente|receta|seguimiento|resultado|estudio)/i)
    }
  })

  it('4 · sin dueño se DICE que no lo tiene, no se disimula con un hueco', () => {
    expect(responderPorElPendiente({ ...BASE, ownerNombre: '' }).quienResponde)
      .toMatch(/nadie/i)
    // Y un nombre de sólo espacios es lo mismo que no tener nombre.
    expect(responderPorElPendiente({ ...BASE, ownerNombre: '   ' }).quienResponde)
      .toMatch(/nadie/i)
    expect(responderPorElPendiente({ ...BASE, ownerNombre: 'Dra. Ruiz' }).quienResponde)
      .toBe('Dra. Ruiz')
  })

  it('5 · ausencia de dato no es dato de ausencia: sin fecha, no hay hito', () => {
    const r = responderPorElPendiente(BASE)
    // No hay `completadaEn` ni `cerradaEn`: la línea de tiempo tiene UN hito,
    // el de creación. No inventa «no se ha hecho» ni «sin cerrar».
    expect(r.queHaPasado).toHaveLength(1)
    expect(r.queHaPasado[0].cuando).toBe(BASE.creadaEn)
    expect(r.queHaPasado.some(h => /no se ha hecho|sin hacer/i.test(h.que))).toBe(false)
  })

  it('6 · completada sin cerrar se marca: es el hueco por el que se pierde un resultado', () => {
    const r = responderPorElPendiente({
      ...BASE, estado: 'completada', completadaEn: '2026-08-05T10:00:00.000Z',
    })
    const hecho = r.queHaPasado.find(h => h.cuando === '2026-08-05T10:00:00.000Z')
    expect(hecho?.sinRevisar).toBe(true)
    // Y «qué sigue» no puede leerse como «listo».
    expect(r.queSigue).toMatch(/revise|revisar/i)
    expect(r.queSigue).toMatch(/no está cerrado/i)
  })

  it('7 · una vez cerrada, el mismo hito ya NO está sin revisar', () => {
    const r = responderPorElPendiente({
      ...BASE,
      estado: 'cerrada',
      completadaEn: '2026-08-05T10:00:00.000Z',
      cerradaEn: '2026-08-06T10:00:00.000Z',
    })
    expect(r.queHaPasado.find(h => h.cuando === '2026-08-05T10:00:00.000Z')?.sinRevisar).toBe(false)
    expect(r.queSigue).toMatch(/no se reabre/i)
  })

  it('8 · `cerradaPor` es un uid: se dice «tú» sólo si coincide, y nunca se inventa un autor', () => {
    const t: TareaClinica = { ...BASE, estado: 'cerrada', cerradaEn: '2026-08-06T10:00:00.000Z', cerradaPor: 'uid-mio' }
    expect(responderPorElPendiente(t, 'uid-mio').queHaPasado.at(-1)?.que).toMatch(/cerraste/i)
    const ajeno = responderPorElPendiente(t, 'uid-otro').queHaPasado.at(-1)!
    expect(ajeno.que).toMatch(/alguien/i)
    // Lo que NO puede pasar: que el uid crudo salga a pantalla.
    expect(ajeno.que).not.toContain('uid-mio')
    expect(ajeno.cuando).toBe('2026-08-06T10:00:00.000Z')
  })

  it('9 · la traza sólo existe si consta, y apunta a la nota exacta', () => {
    expect(responderPorElPendiente(BASE).traza).toBeNull()
    const r = responderPorElPendiente({ ...BASE, notaId: 'nota-aurelio-2' })
    expect(r.traza?.href).toBe('/consulta/pac-1?nota=nota-aurelio-2')
    // La ruta es la MISMA que `/consulta/[patientId]` ya lee — si alguien
    // cambia el nombre del parámetro aquí, el enlace abre una consulta sin
    // nota y nadie se entera.
    expect(leer('src/app/(dashboard)/consulta/[patientId]/page.tsx'))
      .toContain("searchParams.get('nota')")
  })

  it('10 · el siguiente paso legal se define UNA sola vez', () => {
    expect(siguientePaso({ estado: 'solicitada' })?.estado).toBe('en_curso')
    expect(siguientePaso({ estado: 'en_curso' })?.estado).toBe('completada')
    expect(siguientePaso({ estado: 'completada' })?.estado).toBe('cerrada')
    expect(siguientePaso({ estado: 'cerrada' })).toBeNull()
    // La pantalla lo IMPORTA y no lo redeclara.
    expect(PAGINA).toMatch(/import \{[^}]*siguientePaso[^}]*\} from '@\/lib\/tareas-clinicas\/por-que-esta-aqui'/)
    expect(PAGINA, 'la pantalla volvió a declarar su propia copia')
      .not.toMatch(/function siguientePaso/)
  })

  it('11 · la siembra trae la traza: sin ella la medición fotografía un hueco', () => {
    // El hallazgo del otro extremo. Que la pantalla sepa leer `notaId` no
    // sirve de nada si ninguna tarea sembrada lo trae — la captura saldría
    // diciendo «no consta» en las siete y se daría por buena.
    const bloque = SIEMBRA.slice(SIEMBRA.indexOf('const tareas = ['), SIEMBRA.indexOf('for (const t of tareas)'))
    const conTraza = bloque.match(/notaId: '/g) ?? []
    expect(conTraza.length).toBeGreaterThanOrEqual(2)
    // Y apuntan a notas que EXISTEN en la misma siembra: una traza a una nota
    // inventada es un enlace roto que la captura enseñaría como si fuera bueno.
    for (const m of bloque.matchAll(/notaId: '([^']+)'/g)) {
      expect(SIEMBRA, `la siembra referencia ${m[1]} y no la crea`)
        .toContain(`id: '${m[1]}'`)
    }
    // Y NO todas la traen: la rama «no consta de qué consulta salió» también
    // tiene que poder verse en el navegador.
    expect((bloque.match(/patientId: 'pac-/g) ?? []).length).toBeGreaterThan(conTraza.length)
  })

  it('12 · la pantalla abre las cuatro respuestas en la Capa 4, no en línea', () => {
    /* La vara se mudó con la pieza. Antes exigía que ESTA pantalla montara la
       `<Lente>`; desde que Hoy contesta lo mismo sobre el mismo pendiente, lo
       que hay que exigir es que las dos consuman la MISMA — si cada una monta
       la suya, la divergencia vuelve a ser posible y la prueba no la vería. */
    expect(PIEZA).toMatch(/import \{ Lente \} from '@\/components\/LenteContextual'/)
    expect(PIEZA).toContain('<Lente')
    expect(PIEZA).toMatch(/responderPorElPendiente\(/)
    // Y la pantalla la consume en vez de re-escribirla.
    expect(PAGINA).toMatch(/import \{[^}]*LentePorQue[^}]*\} from '@\/components\/tareas\/PorQueEstaAqui'/)
    expect(PAGINA).toContain('<LentePorQue')
    // Nadie vuelve a montar la Capa 4 a mano desde esta pantalla.
    expect(PAGINA).not.toContain('<Lente ')
    // La vuelta del foco necesita saber a quién vuelve (§21).
    expect(PAGINA).toMatch(/invocador=\{disparadorPorQue\}/)
    expect(PIEZA).toMatch(/invocador=\{invocador\}/)
    // Y el disparador dice que abre algo. Los dos lados del enlace, no uno:
    // el botón declara `aria-expanded` con lo que le llega, y las dos tarjetas
    // le pasan el estado REAL de la lente. Comprobar sólo el primero dejaría
    // pasar un `aria-expanded` cableado a `false` constante.
    expect(PIEZA).toMatch(/aria-expanded=\{abierta\}/)
    expect((PAGINA.match(/abierta=\{porQueId === t\.id\}/g) ?? []).length).toBe(2)
  })

  it('12b · las cuatro respuestas se escriben UNA vez, y las dos superficies las leen', () => {
    /* EL CASO QUE NACE DE REG-318, y por eso está aquí y no en el guardián de
       Hoy: el sello de procedencia tenía TRES listas independientes de «qué es
       una nota para el sello», sólo una completa, y acabaron siendo dos sellos
       que contaban distinto sobre el mismo documento. `tareasVivas()` es una
       fuente con DOS lectores; los cuatro rótulos de §10 sólo pueden estar
       escritos en un sitio. */
    for (const rotulo of ['Por qué está aquí', 'Quién responde', 'Qué ha pasado', 'Qué sigue']) {
      expect(PIEZA, `«${rotulo}» no lo escribe la pieza`).toContain(`titulo="${rotulo}"`)
      expect(PAGINA, `«${rotulo}» se volvió a escribir en /pendientes`).not.toContain(`titulo="${rotulo}"`)
      expect(HOY, `«${rotulo}» se volvió a escribir en Hoy`).not.toContain(`titulo="${rotulo}"`)
    }
    // Y ninguna de las dos vuelve a llamar al motor por su cuenta: la única
    // llamada viva a `responderPorElPendiente` es la de la pieza.
    expect(PAGINA).not.toMatch(/responderPorElPendiente\(/)
    expect(HOY).not.toMatch(/responderPorElPendiente\(/)
  })

  it('13 · las tarjetas NO se declaran dentro del render — lo cazó el navegador', () => {
    /**
     * ÉSTE ES EL CASO QUE VALE, y no salió de leer código: salió de medir.
     *
     * `Tarjeta` y `TarjetaCerrada` se declaraban DENTRO de `PendientesPage`.
     * React ve un componente declarado en el render como un tipo nuevo cada
     * vez, así que remontaba las siete tarjetas en cada `setState`. Sin estado
     * dentro no se notaba; al abrir la lente sí, y el acta «antes» de
     * `medir-por-que-esta-aqui-v15.mjs` lo registró como tres síntomas que
     * parecían de CSS:
     *
     *   aria-expanded  false → false  (nunca cambia)
     *   el disparador «se movió» -357 / -455 / -420px
     *   ESCAPE → foco en el disparador: false
     *
     * Los tres son el mismo hecho: el nodo que la sonda tenía en la mano ya
     * estaba desconectado del documento. Y el tercero es §21 —«return exactly
     * where you were»—, o sea, la interacción que esta rebanada entrega.
     *
     * Ninguna prueba de fuente lo habría visto. Por eso §40 existe.
     */
    for (const nombre of ['Tarjeta', 'TarjetaCerrada'] as const) {
      // Declaradas a nivel de módulo: sin indentación delante.
      expect(PAGINA, `${nombre} no es un componente de módulo`)
        .toMatch(new RegExp(`^function ${nombre}\\(`, 'm'))
      // Y ANTES de la página, que es lo que garantiza que no estén dentro.
      expect(PAGINA.indexOf(`function ${nombre}(`))
        .toBeLessThan(PAGINA.indexOf('export default function PendientesPage'))
    }
    // La forma que las devolvía a la trampa: una arrow declarada en el render.
    expect(PAGINA, 'una tarjeta volvió a declararse dentro del render')
      .not.toMatch(/^\s+const Tarjeta(Cerrada)? = /m)
    // La lente vive en la página, y guarda el ID y no una copia de la tarea:
    // con una copia, recargar la lista con la lente abierta enseñaría el
    // estado viejo — la foto de un dato clínico en vez del dato.
    expect(PIEZA).toMatch(/useState<string \| null>\(null\)/)
    expect(PAGINA.indexOf('<LentePorQue'))
      .toBeGreaterThan(PAGINA.indexOf('export default function PendientesPage'))
    // Y el estado se pide con el hook COMPARTIDO: si cada pantalla se escribe
    // el suyo, la próxima puede olvidarse de la vuelta del foco sin que nada
    // se ponga rojo.
    expect(PAGINA).toMatch(/usePorQue\(\)/)
  })

  it('14 · la pregunta se puede hacer también sobre lo ya cerrado', () => {
    // «¿Qué ha pasado?» es justamente lo que se le pregunta a algo cerrado.
    // Una cerrada sin su historia vuelve a ser un documento al que nadie va.
    const i = PAGINA.indexOf('function TarjetaCerrada')
    const cerrada = PAGINA.slice(i, PAGINA.indexOf('export default function PendientesPage'))
    expect(i).toBeGreaterThan(-1)
    expect(cerrada).toContain('<DisparadorPorQue')
  })

  it('15 · el módulo es PURO: ni Firestore, ni reloj propio, ni JSX', () => {
    /* La vara mide la DEPENDENCIA, no la palabra — y esto lo enseñó el propio
       guardián al ponerse rojo contra el módulo correcto: buscar /firestore/i
       en el cuerpo cazaba el comentario que explica que el único lector de
       `notaId` era el compositor de ids de Firestore. Es la ceguera de
       `grafo-de-dependencias` otra vez, ahora en su versión más fina: el
       recorte de la cabecera no basta si la prosa también vive abajo.
       Lo que de verdad rompería la pureza es un import o una llamada. */
    expect(CODIGO_MODULO).not.toMatch(/^\s*import .*(firebase|firestore|@\/lib\/firebase)/mi)
    expect(CODIGO_MODULO).not.toMatch(/\b(getDocs|getDoc|setDoc|updateDoc|collection|query)\s*\(/)
    // Nada de `Date.now()` dentro: dos renders del mismo segundo no pueden
    // discrepar sobre la misma tarea (la razón por la que `ahora` se fija al
    // cargar en la pantalla).
    expect(CODIGO_MODULO).not.toMatch(/Date\.now\(\)|new Date\(\)/)
    expect(CODIGO_MODULO).not.toMatch(/<[a-z]+[ >]/)
    expect(POR_QUE_LA_TRAZA_IMPORTA).toMatch(/notaId/)
  })
})
