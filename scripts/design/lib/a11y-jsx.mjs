/**
 * ANALIZADOR DE ACCESIBILIDAD SOBRE EL ÁRBOL REAL DEL TSX — A11Y-GATE-001.
 *
 * ── POR QUÉ EL COMPILADOR Y NO UNA EXPRESIÓN REGULAR ────────────────────────
 *
 * `trinquete-de-diseno.mjs` cuenta con expresiones regulares y le sirve: un
 * `#hex` es un `#hex` viva donde viva. La accesibilidad no se deja contar así,
 * porque las preguntas son **estructurales**: «¿este botón tiene texto DENTRO,
 * en cualquier descendiente?», «¿el `id` de este campo lo referencia un
 * `htmlFor` de este archivo?». Una expresión regular contesta eso mal en los
 * dos sentidos, y un guardián que grita de más se desactiva en una tarde
 * (REG-245).
 *
 * Se usa la API del compilador de TypeScript, que **ya es dependencia de
 * desarrollo** de este repositorio (`typescript`, Apache-2.0). Cero paquetes
 * nuevos, cero servicios externos, cero binarios que descargar en CI.
 *
 * ── QUÉ **NO** VE ESTE ANALIZADOR ───────────────────────────────────────────
 *
 * Es análisis estático de UNA superficie a la vez. No ejecuta React. Por tanto:
 *
 * - **No cruza el límite del componente.** Si `<Boton>` envuelve un `<button>`
 *   en otro archivo, aquí se ve `<Boton>` y no se juzga. Las reglas sólo miran
 *   elementos del DOM en minúscula, que son los que sí sabe leer.
 * - **No sabe qué se pinta de verdad.** Una rama muerta cuenta igual que una
 *   viva.
 * - **No mide contraste pintado, ni orden del foco, ni si el lector de
 *   pantalla lee algo con sentido.** Eso sigue siendo trabajo de `axe-*.mjs`
 *   con navegador, y de mirar la pantalla (regla de diseño: «no se aprueba una
 *   interfaz leyendo el código»).
 * - **No prueba el teclado.** Comprueba la CONDICIÓN NECESARIA —que lo que se
 *   pulsa sea un elemento enfocable— no que el recorrido tenga sentido.
 * - **`estadoAsincronoSinRegionViva` cuenta por ARCHIVO, no por estado.** Una
 *   sola región viva en cualquier parte del archivo lo apaga. Esto NO es
 *   teórico: al reparar `/mi/[token]` la regla se puso en verde arreglando el
 *   formulario previo a la consulta, mientras el cartel de «tu enlace ya no
 *   vale» —el que de verdad importa— seguía mudo. Se encontró mirando, no
 *   midiendo. La regla dice «esta pantalla no tiene NINGUNA región viva», que
 *   es un suelo, no un techo; el reparto correcto entre estados hay que
 *   comprobarlo a mano.
 *
 * Dicho de otro modo: esto es la red que impide que una regresión conocida
 * vuelva a entrar sin que nadie se entere. No es el certificado de que la
 * pantalla sea accesible.
 */
import ts from 'typescript'

/** Elementos del DOM que ya son interactivos y enfocables por sí solos. */
const INTERACTIVOS = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary', 'details', 'label'])

/** Campos de formulario que necesitan nombre accesible. */
const CAMPOS = new Set(['input', 'select', 'textarea'])

/** Atributos que dan nombre accesible a un elemento sin texto visible. */
const NOMBRES = ['aria-label', 'aria-labelledby', 'title']

/**
 * Nombres de estado que delatan una operación asíncrona en curso.
 *
 * El gerundio castellano (`-ando` / `-iendo`) es la forma que usa este
 * repositorio para nombrar «esto está ocurriendo ahora»: `enviando`, `pagando`,
 * `reagendando`, `cargandoSlots`. Se acompaña de los términos ingleses que
 * también aparecen.
 *
 * **Es vocabulario, no criterio** (regla de seguridad clínica n.º 5): un estado
 * que se llame `accion` o `paso` NO lo caza este nombre. Por eso la regla del
 * `aria-busy` tiene una SEGUNDA señal, estructural y bastante más difícil de
 * esquivar: que el botón pinte un indicador de carga entre sus hijos.
 */
const RE_OCUPADO = /([a-z](?:ando|iendo)\b|enviando|loading|busy|saving|submitting|pending|inflight)/i

/** Nombres de estado que delatan un error o aviso que el usuario debe percibir. */
const RE_AVISO = /(error|fallo|aviso|alerta|mensaje|warn|problema)/i

function texto(nodo, fuente) {
  return nodo ? nodo.getText(fuente) : ''
}

function etiquetaDe(nodo) {
  const abre = ts.isJsxElement(nodo) ? nodo.openingElement : nodo
  return abre.tagName.getText()
}

/** Los atributos de un elemento JSX: nombre → texto fuente del valor (`null` si es booleano). */
function atributosDe(nodo, fuente) {
  const abre = ts.isJsxElement(nodo) ? nodo.openingElement : nodo
  const out = new Map()
  for (const a of abre.attributes.properties) {
    if (!ts.isJsxAttribute(a)) continue
    const nombre = a.name.getText(fuente)
    if (!a.initializer) { out.set(nombre, null); continue }
    if (ts.isStringLiteral(a.initializer)) { out.set(nombre, a.initializer.text); continue }
    out.set(nombre, texto(a.initializer, fuente))
  }
  return out
}

/** Valor literal de un atributo, o `null` si es una expresión. */
function literal(nodo, fuente, nombre) {
  const abre = ts.isJsxElement(nodo) ? nodo.openingElement : nodo
  for (const a of abre.attributes.properties) {
    if (!ts.isJsxAttribute(a) || a.name.getText(fuente) !== nombre) continue
    if (a.initializer && ts.isStringLiteral(a.initializer)) return a.initializer.text
    return null
  }
  return null
}

/**
 * ¿Este subárbol aporta un nombre accesible?
 *
 * Sí si hay texto literal, una expresión que pueda evaluar a texto, o un
 * descendiente con `aria-label`. Es **deliberadamente permisivo**: prefiere
 * callarse ante la duda antes que marcar un botón que sí tiene nombre. El coste
 * de un falso positivo aquí es que alguien desactive el guardián.
 */
function aportaNombre(nodo, fuente) {
  if (ts.isJsxText(nodo)) return nodo.text.trim().length > 0
  if (ts.isJsxExpression(nodo)) {
    // `{' '}` y `{/* comentario */}` no son nombre; cualquier otra expresión sí puede serlo.
    if (!nodo.expression) return false
    const t = texto(nodo.expression, fuente).trim()
    return t.length > 0
  }
  if (ts.isJsxElement(nodo) || ts.isJsxSelfClosingElement(nodo) || ts.isJsxFragment(nodo)) {
    if (ts.isJsxElement(nodo) || ts.isJsxSelfClosingElement(nodo)) {
      const attrs = atributosDe(nodo, fuente)
      if (NOMBRES.some(n => attrs.has(n))) return true
      // Un componente propio (mayúscula) puede pintar texto: no se juzga.
      if (/^[A-Z]/.test(etiquetaDe(nodo)) && !/^(Icon|Loader|Spinner)/.test(etiquetaDe(nodo))) {
        // Los iconos de `lucide-react` se importan con mayúscula y NO pintan texto.
        // Se distinguen por no tener hijos y por traer `size`.
        if (!attrs.has('size')) return true
      }
    }
    const hijos = ts.isJsxElement(nodo) ? nodo.children : ts.isJsxFragment(nodo) ? nodo.children : []
    return hijos.some(h => aportaNombre(h, fuente))
  }
  return false
}

/**
 * ¿El botón pinta una ruedecita mientras trabaja?
 *
 * Es la señal ESTRUCTURAL de «ocupado», y no depende de cómo alguien decidiera
 * llamar a su variable de estado. Si el botón enseña un `<Loader2>` o algo que
 * gira, está diciéndole visualmente al que ve que espere — y callándoselo a
 * quien no ve.
 */
function pintaIndicadorDeCarga(nodo, fuente) {
  let encontrado = false
  const bajar = n => {
    if (encontrado) return
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      if (/^(Loader|Spinner|Cargando)/i.test(etiquetaDe(n))) { encontrado = true; return }
      const a = atributosDe(n, fuente)
      if (/animation\s*:\s*['"`]?spin/.test(a.get('style') ?? '')) { encontrado = true; return }
      if (/\b(spin|spinner|cargando|loading)\b/i.test(a.get('className') ?? '')) { encontrado = true; return }
    }
    n.forEachChild(bajar)
  }
  nodo.forEachChild(bajar)
  return encontrado
}

function linea(nodo, fuente) {
  return fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente)).line + 1
}

/**
 * Analiza UN archivo `.tsx` y devuelve sus hallazgos.
 *
 * @param {string} ruta   ruta relativa, sólo para el informe
 * @param {string} codigo contenido del archivo
 * @returns {{regla: string, linea: number, detalle: string}[]}
 */
export function analizarTsx(ruta, codigo) {
  const fuente = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const hallazgos = []
  const anota = (regla, nodo, detalle) => hallazgos.push({ regla, linea: linea(nodo, fuente), detalle })

  // ── Primera pasada: censo del archivo ────────────────────────────────────
  const htmlFor = new Set()          // valores de `htmlFor`, literales o fuente de la expresión
  const encabezados = []             // { nivel, nodo }
  const idsDeLabelEnvolvente = new Set()
  let hayRegionViva = false
  let hayEscape = false
  const dialogos = []
  const elementos = []

  const recorre = nodo => {
    if (ts.isJsxElement(nodo) || ts.isJsxSelfClosingElement(nodo)) {
      elementos.push(nodo)
      const etiqueta = etiquetaDe(nodo)
      const attrs = atributosDe(nodo, fuente)

      /**
       * `htmlFor` se recoge de CUALQUIER elemento que lo declare, no sólo de un
       * `<label>` en minúscula.
       *
       * El motivo: el patrón normal de un formulario es un envoltorio del mismo
       * archivo —`<Campo htmlFor="x" label="…">`— que lo reenvía a su `<label>`.
       * Exigir que el `<label>` literal esté en el mismo árbol que el `<input>`
       * marcaría en rojo un formulario correcto, y un guardián que grita de más
       * se desactiva en una tarde (REG-245).
       *
       * **Lo que esto NO comprueba**, y hay que decirlo: que el envoltorio de
       * verdad se lo pase a un `<label>`. Es la regla «el dato tiene que
       * LLEGAR» — aquí se ve la declaración, no la llegada. La defensa es que
       * el envoltorio viva en el MISMO archivo (se lee de un vistazo) y que
       * exista un `<label>` con ese identificador; comprobarlo de verdad
       * necesita pintar, y eso es axe con navegador.
       */
      if (attrs.has('htmlFor')) {
        const f = attrs.get('htmlFor')
        if (f !== undefined && f !== null) htmlFor.add(f)
      }

      if (etiqueta === 'label') {
        // Un campo ANIDADO dentro del label ya está etiquetado, sin `htmlFor`.
        if (ts.isJsxElement(nodo)) {
          const anidados = []
          const bajar = n => {
            if ((ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && CAMPOS.has(etiquetaDe(n))) anidados.push(n)
            n.forEachChild(bajar)
          }
          nodo.forEachChild(bajar)
          for (const a of anidados) idsDeLabelEnvolvente.add(a.getStart(fuente))
        }
      }

      const m = etiqueta.match(/^h([1-6])$/)
      if (m) encabezados.push({ nivel: Number(m[1]), nodo })

      if (attrs.has('aria-live')) hayRegionViva = true
      const rol = attrs.get('role')
      if (rol === 'alert' || rol === 'status') hayRegionViva = true
      if (rol === 'dialog' || rol === 'alertdialog') dialogos.push(nodo)
    }
    nodo.forEachChild(recorre)
  }
  recorre(fuente)

  if (/['"`]Escape['"`]/.test(codigo)) hayEscape = true

  // ── Segunda pasada: las reglas ───────────────────────────────────────────
  for (const nodo of elementos) {
    const etiqueta = etiquetaDe(nodo)
    const attrs = atributosDe(nodo, fuente)
    const rol = attrs.get('role')
    const tieneNombreExplicito = NOMBRES.some(n => attrs.has(n))
    const hijos = ts.isJsxElement(nodo) ? nodo.children : []
    const tieneNombrePorContenido = hijos.some(h => aportaNombre(h, fuente))

    // R1 — botón sólo icono sin nombre accesible.
    if ((etiqueta === 'button' || rol === 'button') && !tieneNombreExplicito && !tieneNombrePorContenido) {
      anota('botonSoloIconoSinNombre', nodo,
        `<${etiqueta}> sin texto dentro y sin aria-label: el lector de pantalla lo anuncia como «botón» y nada más`)
    }

    // R2 — enlace sólo icono sin nombre accesible.
    if ((etiqueta === 'a' || etiqueta === 'Link') && !tieneNombreExplicito && !tieneNombrePorContenido) {
      anota('enlaceSinNombreAccesible', nodo, `<${etiqueta}> sin texto ni aria-label`)
    }

    // R3 — campo de formulario sin etiqueta.
    if (CAMPOS.has(etiqueta)) {
      const tipo = literal(nodo, fuente, 'type')
      const oculto = tipo === 'hidden'
      const id = attrs.get('id')
      const etiquetadoPorHtmlFor = id !== undefined && id !== null && htmlFor.has(id)
      const envuelto = idsDeLabelEnvolvente.has(nodo.getStart(fuente))
      if (!oculto && !tieneNombreExplicito && !etiquetadoPorHtmlFor && !envuelto) {
        const conPlaceholder = attrs.has('placeholder')
        anota('campoSinEtiqueta', nodo,
          `<${etiqueta}> sin <label htmlFor>, sin aria-label y sin label envolvente` +
          (conPlaceholder ? ' — el `placeholder` NO es etiqueta: desaparece al escribir' : ''))
      }
    }

    // R4 — se pulsa algo que el teclado no alcanza.
    if (attrs.has('onClick') && !INTERACTIVOS.has(etiqueta) && /^[a-z]/.test(etiqueta)) {
      const enfocable = attrs.has('tabIndex')
      const conTeclado = attrs.has('onKeyDown') || attrs.has('onKeyUp') || attrs.has('onKeyPress')
      if (!rol || !enfocable || !conTeclado) {
        anota('interactivoSinTeclado', nodo,
          `<${etiqueta} onClick> no es un elemento interactivo` +
          `${rol ? '' : ', sin role'}${enfocable ? '' : ', sin tabIndex'}${conTeclado ? '' : ', sin manejador de teclado'}` +
          ' — con teclado o con lector de pantalla esa acción no existe')
      }
    }

    // R5 — el foco se apaga a mano.
    const estilo = attrs.get('style') ?? ''
    if (/outline\s*:\s*(['"]?(none|0(px)?)['"]?)/.test(estilo)) {
      anota('focoInvisible', nodo,
        'apaga `outline` en línea: quien navega con teclado deja de saber dónde está')
    }

    // R6 — botón ocupado que no lo dice.
    //
    // Dos señales independientes, porque una sola se escapa: el NOMBRE del
    // estado que lo deshabilita, y el INDICADOR de carga que pinta dentro.
    if (etiqueta === 'button' && !attrs.has('aria-busy')) {
      const porNombre = RE_OCUPADO.test(attrs.get('disabled') ?? '')
      const porSpinner = pintaIndicadorDeCarga(nodo, fuente)
      if (porNombre || porSpinner) {
        anota('botonOcupadoSinAriaBusy', nodo,
          (porSpinner
            ? 'pinta una ruedecita de carga mientras trabaja'
            : 'se deshabilita mientras trabaja') +
          ' pero no declara `aria-busy`: el lector de pantalla anuncia «no disponible», no «trabajando»')
      }
    }

    // R7 — ancho fijo que rompe el reflujo a 320 px / zoom 400 %.
    const ancho = estilo.match(/(?<![a-zA-Z])width\s*:\s*'?(\d+)(?:px)?'?/)
    if (ancho && Number(ancho[1]) >= 480 && !/minWidth\s*:\s*0/.test(estilo)) {
      anota('anchoFijoRompeReflujo', nodo,
        `width: ${ancho[1]}px fijo — a 320 px de ancho (WCAG 1.4.10) obliga a desplazamiento horizontal`)
    }

    // R8 — imagen sin alternativa textual.
    if ((etiqueta === 'img' || etiqueta === 'Image') && !attrs.has('alt')) {
      anota('imagenSinAlt', nodo, `<${etiqueta}> sin \`alt\` (usa alt="" si es decorativa, pero declárala)`)
    }

    // R9 — iframe sin título.
    if (etiqueta === 'iframe' && !attrs.has('title')) {
      anota('iframeSinTitulo', nodo, '<iframe> sin `title`: el lector de pantalla lo anuncia como «marco» sin decir de qué')
    }
  }

  // R10 — diálogos.
  for (const d of dialogos) {
    const attrs = atributosDe(d, fuente)
    if (!attrs.has('aria-modal')) anota('dialogoSinAriaModal', d, 'role="dialog" sin `aria-modal`')
    if (!NOMBRES.some(n => attrs.has(n))) anota('dialogoSinNombre', d, 'role="dialog" sin nombre accesible')
    if (!hayEscape) anota('dialogoSinEscape', d, 'role="dialog" y el archivo no maneja la tecla Escape')
  }

  // R11 — encabezados.
  if (encabezados.length === 0) {
    hallazgos.push({ regla: 'sinEncabezadoPrincipal', linea: 1, detalle: 'la superficie no pinta ningún encabezado: no hay dónde saltar con el lector de pantalla' })
  } else {
    const conH1 = encabezados.some(e => e.nivel === 1)
    if (!conH1) {
      anota('sinEncabezadoPrincipal', encabezados[0].nodo, `el encabezado más alto es <h${encabezados[0].nivel}>, no hay <h1>`)
    }
    let previo = 0
    for (const e of encabezados) {
      if (previo && e.nivel > previo + 1) {
        anota('saltoDeNivelDeEncabezado', e.nodo, `<h${previo}> → <h${e.nivel}>: el esquema salta un nivel`)
      }
      previo = e.nivel
    }
  }

  // R12 — estado asíncrono sin región viva.
  const estados = [...codigo.matchAll(/useState[^(]*\(\s*\)|const\s*\[\s*([A-Za-z0-9_]+)\s*,\s*set[A-Za-z0-9_]+\s*\]\s*=\s*useState/g)]
    .map(m => m[1]).filter(Boolean)
  const hayAsincrono = estados.some(n => RE_AVISO.test(n) || RE_OCUPADO.test(n))
  if (hayAsincrono && !hayRegionViva) {
    const cuales = estados.filter(n => RE_AVISO.test(n) || RE_OCUPADO.test(n)).join(', ')
    hallazgos.push({
      regla: 'estadoAsincronoSinRegionViva',
      linea: 1,
      detalle: `estado asíncrono (${cuales}) y ni un solo \`aria-live\`/role="alert"/role="status": el error aparece en pantalla y el lector de pantalla no dice nada`,
    })
  }

  return hallazgos
}

/** Los identificadores de todas las reglas, para que el techo no pueda olvidarse de una. */
export const REGLAS = [
  'botonSoloIconoSinNombre',
  'enlaceSinNombreAccesible',
  'campoSinEtiqueta',
  'interactivoSinTeclado',
  'focoInvisible',
  'botonOcupadoSinAriaBusy',
  'anchoFijoRompeReflujo',
  'imagenSinAlt',
  'iframeSinTitulo',
  'dialogoSinAriaModal',
  'dialogoSinNombre',
  'dialogoSinEscape',
  'sinEncabezadoPrincipal',
  'saltoDeNivelDeEncabezado',
  'estadoAsincronoSinRegionViva',
]
