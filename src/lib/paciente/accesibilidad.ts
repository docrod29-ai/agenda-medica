/**
 * ¿TIENE NOMBRE ESTE CONTROL? — V9 · A11Y-GATE-001.
 *
 * ── QUÉ MIDE Y POR QUÉ ──────────────────────────────────────────────────────
 *
 * La auditoría de V9 encontró que la red de accesibilidad era **una** prueba
 * entre 540, y era una expresión regular sobre `layout.tsx`. Sin instrumento,
 * el objetivo declarado —WCAG 2.2 AA— no es un objetivo: es una intención.
 *
 * Este módulo detecta, leyendo el código fuente, los dos fallos que más pesan
 * en un formulario y que se pueden ver sin abrir un navegador:
 *
 *  1. **Un campo sin nombre accesible** (WCAG 1.3.1 y 3.3.2). La etiqueta que
 *     se ve al lado no sirve si no está ATADA: quien usa lector de pantalla oye
 *     «cuadro de edición, en blanco». Vale cualquiera de las tres formas
 *     legítimas: `aria-label`, `aria-labelledby`, `id` emparejado con un
 *     `htmlFor`, o estar envuelto por un `<label>`.
 *  2. **Un botón que sólo lleva un icono y no se llama de ninguna manera**
 *     (WCAG 4.1.2). Cinco estrellas sin `aria-label` son cinco «botón».
 *
 * ── LO QUE ESTE MÓDULO NO PUEDE HACER ───────────────────────────────────────
 *
 * Lee TEXTO, no un árbol de accesibilidad. No sabe de contraste real, ni de
 * orden de foco, ni de si un modal atrapa el foco, ni de si el objetivo táctil
 * mide 44×44. Para eso hace falta `axe` sobre la aplicación corriendo, y eso
 * exige credenciales que no están en este entorno (`BLOCKERS.md`).
 *
 * Es un suelo, no un techo — y por eso el que falta se declara en vez de
 * callarse: *señalar de menos, nunca de más*.
 */

export interface HallazgoA11y {
  archivo: string
  linea: number
  regla: 'campo-sin-nombre' | 'boton-sin-nombre'
  fragmento: string
}

/** Etiquetas de formulario que necesitan nombre accesible. */
const CONTROLES = ['input', 'textarea', 'select']

/**
 * Un `<input type="hidden">` no lo ve nadie, ni con los ojos ni con un lector.
 * Y los `checkbox`/`radio` de esta aplicación viven dentro de su `<label>`, que
 * es asociación implícita válida — el detector lo comprueba igual, esto sólo
 * documenta por qué no se excluyen.
 */
const SIN_NOMBRE_NECESARIO = /type\s*=\s*["']hidden["']/

/** Extrae las etiquetas de apertura de un tipo, con su línea. */
function etiquetas(fuente: string, nombre: string): { texto: string; linea: number; fin: number }[] {
  const salida: { texto: string; linea: number; fin: number }[] = []
  const re = new RegExp(`<${nombre}(?=[\\s/>])`, 'g')
  for (const m of fuente.matchAll(re)) {
    const inicio = m.index ?? 0
    // Cierre de la etiqueta de apertura, respetando las llaves de JSX.
    let i = inicio
    let profundidad = 0
    let comilla: string | null = null
    for (; i < fuente.length; i++) {
      const c = fuente[i]
      if (comilla) { if (c === comilla) comilla = null; continue }
      if (c === '"' || c === "'" || c === '`') { comilla = c; continue }
      if (c === '{') profundidad++
      else if (c === '}') profundidad--
      else if (c === '>' && profundidad === 0) break
    }
    salida.push({
      texto: fuente.slice(inicio, i + 1),
      linea: fuente.slice(0, inicio).split('\n').length,
      fin: i + 1,
    })
  }
  return salida
}

/** ¿Este control está DENTRO de un `<label>` que aún no se ha cerrado? */
function envueltoPorLabel(fuente: string, posicion: number): boolean {
  const antes = fuente.slice(0, posicion)
  const abre = (antes.match(/<label(?=[\s/>])/g) ?? []).length
  const cierra = (antes.match(/<\/label>/g) ?? []).length
  return abre > cierra
}

/**
 * ¿El `id` de este control tiene un `htmlFor` que lo nombre?
 *
 * Se compara el TEXTO de la expresión, no su valor: `id={`fp-${c.clave}`}` y
 * `htmlFor={`fp-${c.clave}`}` son la misma cadena escrita dos veces, y eso es
 * exactamente lo que hay que comprobar sin ejecutar el componente.
 */
function tieneHtmlForPareja(fuente: string, etiqueta: string): boolean {
  const id = /\bid\s*=\s*(\{[^}]*\}|["'][^"']*["'])/.exec(etiqueta)?.[1]
  if (!id) return false
  return fuente.includes(`htmlFor=${id}`)
}

/**
 * IDS QUE UN COMPONENTE DE ESTE ARCHIVO CONVIERTE EN `htmlFor`.
 *
 * `<FormField id="reserva-nombre" label="Nombre completo">` y, dentro,
 * `<label htmlFor={id}>`. La atadura existe y es la correcta, pero el `htmlFor`
 * lleva una variable: buscar el literal no la encuentra.
 *
 * Se acepta sólo cuando se cumplen las dos cosas: que el archivo **tenga** un
 * componente que parametrice la etiqueta (`htmlFor={`), y que el id salga de un
 * atributo `id` puesto sobre una etiqueta con mayúscula —o sea, un componente,
 * no un elemento HTML—. Un `id` suelto sobre un `<div>` no vale.
 *
 * Es una concesión medida: sin ella, la forma correcta de escribir un campo
 * daría rojo, y un guardián que castiga lo correcto se acaba desactivando.
 */
function idsDelegadosAComponentes(fuente: string): Set<string> {
  const salida = new Set<string>()
  if (!/htmlFor=\{/.test(fuente)) return salida
  for (const m of fuente.matchAll(/<[A-Z]\w*\s[^>]*?\bid\s*=\s*["']([^"']+)["']/g)) salida.add(m[1])
  return salida
}

/** Los hallazgos de accesibilidad de UN archivo. */
export function revisar(archivo: string, fuente: string): HallazgoA11y[] {
  const hallazgos: HallazgoA11y[] = []
  const delegados = idsDelegadosAComponentes(fuente)

  for (const nombre of CONTROLES) {
    for (const e of etiquetas(fuente, nombre)) {
      if (SIN_NOMBRE_NECESARIO.test(e.texto)) continue
      const idLiteral = /\bid\s*=\s*["']([^"']+)["']/.exec(e.texto)?.[1]
      const nombrado =
        /\baria-label\s*=/.test(e.texto) ||
        /\baria-labelledby\s*=/.test(e.texto) ||
        tieneHtmlForPareja(fuente, e.texto) ||
        (idLiteral !== undefined && delegados.has(idLiteral)) ||
        envueltoPorLabel(fuente, e.fin - e.texto.length)
      if (!nombrado) {
        hallazgos.push({ archivo, linea: e.linea, regla: 'campo-sin-nombre', fragmento: resumen(e.texto) })
      }
    }
  }

  for (const e of etiquetas(fuente, 'button')) {
    if (/\baria-label\s*=/.test(e.texto) || /\baria-labelledby\s*=/.test(e.texto)) continue
    const cuerpo = cuerpoDe(fuente, e.fin)
    if (cuerpo === null) continue // no se pudo delimitar: no se inventa un hallazgo
    if (soloIcono(cuerpo)) {
      hallazgos.push({ archivo, linea: e.linea, regla: 'boton-sin-nombre', fragmento: resumen(cuerpo) })
    }
  }

  return hallazgos
}

/** Contenido entre `>` y el `</button>` que le corresponde. */
function cuerpoDe(fuente: string, desde: number): string | null {
  let i = desde
  let abiertos = 1
  while (i < fuente.length) {
    const abre = fuente.indexOf('<button', i)
    const cierra = fuente.indexOf('</button>', i)
    if (cierra === -1) return null
    if (abre !== -1 && abre < cierra) { abiertos++; i = abre + 7; continue }
    abiertos--
    if (abiertos === 0) return fuente.slice(desde, cierra)
    i = cierra + 9
  }
  return null
}

/**
 * ¿El botón sólo lleva iconos?
 *
 * Se quitan las etiquetas JSX —el icono es una de ellas— y se mira si queda
 * alguna letra. Lo que va dentro de una expresión `{…}` **cuenta como texto**:
 * `{enviando ? <Loader2/> : 'Enviar'}` tiene nombre, y `{s}` puede ser la hora
 * que se lee en el botón.
 *
 * Eso hace que un `{icono}` a secas se dé por bueno, y está decidido a
 * propósito: **señalar de menos, nunca de más**. Un guardián que grita de más
 * enseña a ignorarlo, igual que un aviso clínico — y lo que este detector deja
 * fuera está declarado en la cabecera del módulo, no callado.
 */
function soloIcono(cuerpo: string): boolean {
  const conIcono = /<(?:[A-Z]\w*|svg|img)/.test(cuerpo)
  if (!conIcono) return false
  const sinEtiquetas = cuerpo.replace(/<[^>]*>/g, ' ').replace(/[{}]/g, ' ')
  return !/\p{L}/u.test(sinEtiquetas)
}

function resumen(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().slice(0, 90)
}
