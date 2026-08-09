/**
 * ¿TIENE NOMBRE ESTE CONTROL? — analizador para `A11Y-GATE-001` (V9).
 *
 * Un control sin nombre accesible no es un control con un defecto estético: es
 * un control que **no existe** para quien navega con lector de pantalla. Se
 * anuncia «cuadro de edición», en blanco, y no hay forma de saber qué va ahí.
 *
 * ── POR QUÉ CON EL PARSEADOR DE TYPESCRIPT Y NO CON EXPRESIONES REGULARES ────
 *
 * Se intentó primero con `grep`, y dio falsos en las DOS direcciones sobre las
 * mismas nueve pantallas:
 *
 * · `<button ... onMouseEnter={() => setHover(n)}>` — el `>` de la flecha corta
 *   la lista de atributos. El botón de estrella, que **sí** carece de nombre,
 *   no se detectaba.
 * · `<button>{enviando ? 'Enviando…' : 'Enviar solicitud'}</button>` — al
 *   descartar las expresiones, el texto desaparecía y el botón salía marcado.
 *   Tres falsas alarmas de tres.
 *
 * Un instrumento que se equivoca en las dos direcciones no mide: opina. Y la
 * lección de REG-245 es que **un guardián que grita de más se acaba
 * silenciando**, igual que una alerta clínica.
 *
 * ── QUÉ CUENTA COMO NOMBRE ──────────────────────────────────────────────────
 *
 * · **Botón**: `aria-label`, `aria-labelledby`, `title`, o texto entre sus
 *   etiquetas — literal, dentro de una expresión, o de una plantilla.
 * · **Campo** (`input`/`textarea`/`select`): `aria-label`, `aria-labelledby`,
 *   un `<label>` que lo envuelve, o un `id` al que apunte un `htmlFor` **del
 *   mismo archivo**. Se comparan los TEXTOS de las expresiones, así que
 *   `htmlFor={`fp-${c.clave}`}` casa con `id={`fp-${c.clave}`}`.
 * · **Imagen**: `alt` presente (vacío vale: declara que es decorativa).
 *
 * Un `placeholder` **no** cuenta. Desaparece al escribir, no lo anuncian todos
 * los lectores, y la WCAG no lo acepta como nombre único. Es justo la trampa de
 * esta base de código: el campo se ve etiquetado y no lo está.
 *
 * ── QUÉ **NO** MIRA ─────────────────────────────────────────────────────────
 *
 * · Un `<label htmlFor>` que viva en OTRO archivo. Se cuenta como sin nombre —
 *   señalar de menos aquí sería peor que una falsa alarma.
 * · Que el nombre sea BUENO. «Botón» como `aria-label` pasa y no sirve.
 * · Contraste, orden de foco, trampa de foco, `aria-live`. Eso exige navegador.
 */
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()

/**
 * Las nueve rutas que llegan a un PACIENTE.
 *
 * Es una lista a mano, no una heurística, por lo mismo que la del inventario de
 * pantallas: una lista se queda corta de forma visible y una heurística falla
 * en silencio. La fuente es `docs/patient/PATIENT_COMPANION_BASELINE.md` §1 y
 * `src/lib/security/rutas-privadas.ts`.
 */
export const RUTAS_DEL_PACIENTE = [
  'mi', 'reservar', 'resena', 'verificar', 'teleconsulta', 'privacidad', 'dr', 'pago',
]

export function esDelPaciente(archivo) {
  const rel = relative(RAIZ, archivo).replaceAll('\\', '/')
  return RUTAS_DEL_PACIENTE.some((r) => rel.startsWith(`src/app/${r}/`))
}

export function pantallas(dir = join(RAIZ, 'src'), acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === 'node_modules') continue
      pantallas(p, acc)
    } else if (e.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

const CAMPOS = new Set(['input', 'textarea', 'select'])

function nombreDeEtiqueta(nodo) {
  const n = ts.isJsxSelfClosingElement(nodo) ? nodo.tagName : nodo.openingElement.tagName
  return ts.isIdentifier(n) ? n.text : n.getText()
}

function atributos(nodo) {
  const props = (ts.isJsxSelfClosingElement(nodo) ? nodo : nodo.openingElement).attributes.properties
  const mapa = new Map()
  for (const p of props) {
    if (!ts.isJsxAttribute(p) || !ts.isIdentifier(p.name)) continue
    const v = p.initializer
    mapa.set(
      p.name.text,
      v == null ? '' : ts.isStringLiteral(v) ? v.text : v.getText(),
    )
  }
  return mapa
}

/**
 * ¿Este elemento pinta texto?
 *
 * Costó dos vueltas, y las dos merecen quedar escritas porque son la misma
 * lección —**un guardián que se equivoca no mide, opina**— por los dos lados:
 *
 * 1. Buscar cualquier cadena bajo el nodo daba por nombrado al botón de
 *    estrella de `/resena`: `<button><Star fill={… ? '#fbbf24' : 'none'}/></button>`.
 *    `'#fbbf24'` es una cadena de un COLOR, dentro de un ATRIBUTO, que no se
 *    pinta. El único botón realmente sin nombre se escapaba por ahí.
 * 2. Exigir una cadena **literal** marcó cinco botones que sí tienen texto,
 *    porque su texto viene de una variable: `{s}` (la hora), `{m.nombre}` (el
 *    médico), `{ARCO_TIPO_LABEL[t]}` (el derecho ARCO). Cinco falsas alarmas de
 *    seis: exactamente el guardián que se acaba silenciando.
 *
 * Así que se recorren **sólo los hijos**, nunca los atributos, y una expresión
 * hija cuenta como texto salvo que sea JSX puro sin texto dentro. La duda se
 * resuelve a favor de «tiene nombre»: señalar de menos deja pasar un defecto;
 * señalar de más mata el guardián.
 */
function tieneTexto(nodo) {
  const hijos = ts.isJsxElement(nodo) || ts.isJsxFragment(nodo) ? nodo.children : []
  return hijos.some((h) => {
    if (ts.isJsxText(h)) return h.text.trim().length > 0
    if (ts.isJsxElement(h) || ts.isJsxSelfClosingElement(h) || ts.isJsxFragment(h)) return tieneTexto(h)
    if (ts.isJsxExpression(h)) return h.expression != null && rindeTexto(h.expression)
    return false
  })
}

/** ¿Esta expresión, puesta como hijo de un elemento, pinta algo legible? */
function rindeTexto(e) {
  if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return tieneTexto(e)
  if (ts.isParenthesizedExpression(e)) return rindeTexto(e.expression)
  if (ts.isConditionalExpression(e)) return rindeTexto(e.whenTrue) || rindeTexto(e.whenFalse)
  if (ts.isBinaryExpression(e)) return rindeTexto(e.left) || rindeTexto(e.right)
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text.trim().length > 0
  // Identificador, acceso a propiedad, llamada, plantilla, número: texto.
  return true
}

/**
 * Un control puede llevar nombre porque un `<label>` lo ENVUELVE. Es la
 * asociación implícita del HTML y es perfectamente válida — la usan las dos
 * casillas de consentimiento de `/reservar`.
 */
function envueltoEnLabel(nodo) {
  for (let p = nodo.parent; p; p = p.parent) {
    if (ts.isJsxElement(p) && nombreDeEtiqueta(p) === 'label') return true
  }
  return false
}

/**
 * Un campo cuyo valor no lo teclea nadie no necesita nombre visible:
 * `hidden` no se anuncia, y `submit`/`button`/`reset` toman su nombre del
 * atributo `value`.
 */
function campoExento(attrs) {
  const tipo = attrs.get('type') ?? 'text'
  if (/hidden/.test(tipo)) return true
  if (/submit|button|reset/.test(tipo) && attrs.has('value')) return true
  return false
}

/**
 * Nombre del componente en cuyo cuerpo vive este nodo, si es una función con
 * nombre en mayúscula (que es lo que React considera componente).
 */
function componenteQueContiene(nodo) {
  for (let p = nodo.parent; p; p = p.parent) {
    let nombre = null
    if (ts.isFunctionDeclaration(p) && p.name) nombre = p.name.text
    else if (
      (ts.isArrowFunction(p) || ts.isFunctionExpression(p))
      && p.parent && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)
    ) nombre = p.parent.name.text
    if (nombre && /^[A-Z]/.test(nombre)) return nombre
  }
  return null
}

/**
 * Analiza un archivo y devuelve sus hallazgos, ya con línea y fragmento.
 *
 * `fuente` permite analizar un texto **sin tocar el disco**. Lo usa la prueba
 * al revés: para comprobar que el guardián caza el defecto hay que meterle el
 * defecto, y hacerlo escribiendo en el archivo real deja el repositorio roto si
 * la prueba se interrumpe entre la escritura y la restauración.
 */
export function analizar(archivo, fuente) {
  const texto = fuente ?? readFileSync(archivo, 'utf8')
  const sf = ts.createSourceFile(archivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  /** Todos los `htmlFor` del archivo, por el TEXTO de su expresión. */
  const objetivos = new Set()
  /** Componentes locales que ceden su `htmlFor` a una prop: `Campo → 'id'`. */
  const cedenEtiqueta = new Map()

  const recogeFor = (n) => {
    if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name) && n.name.text === 'htmlFor') {
      const v = n.initializer
      if (v) objetivos.add(ts.isStringLiteral(v) ? v.text : v.getText())
      /**
       * LA ETIQUETA CRUZA UNA FRONTERA DE COMPONENTE, Y HAY QUE SEGUIRLA.
       *
       * El patrón de esta base de código es un envoltorio local —`FormField`,
       * `Field`, `Campo`— que pinta el `<label>` y recibe el control como hijo:
       *
       *     function FormField({ id, label, children }) {
       *       return <div><label htmlFor={id}>{label}</label>{children}</div>
       *     }
       *     <FormField id="rsv-nombre" …><input id="rsv-nombre" … /></FormField>
       *
       * Mirando sólo el archivo plano, `htmlFor={id}` apunta a la cadena «id» y
       * el campo parece huérfano. Se anota entonces que ese componente cede su
       * etiqueta a la prop `id`, y cada vez que se le pase un valor, ese valor
       * cuenta como destino. Se verifican **las dos puntas**, que es lo que hay
       * que hacer cuando un dato cruza una frontera.
       */
      if (v && ts.isJsxExpression(v) && v.expression && ts.isIdentifier(v.expression)) {
        const comp = componenteQueContiene(n)
        if (comp) cedenEtiqueta.set(comp, v.expression.text)
      }
    }
    ts.forEachChild(n, recogeFor)
  }
  recogeFor(sf)

  /** Segunda pasada: los valores que se le pasan a esos componentes. */
  const recogeCesiones = (n) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const prop = cedenEtiqueta.get(nombreDeEtiqueta(n))
      if (prop) {
        const v = atributos(n).get(prop)
        if (v) objetivos.add(v)
      }
    }
    ts.forEachChild(n, recogeCesiones)
  }
  if (cedenEtiqueta.size > 0) recogeCesiones(sf)

  const hallazgos = []
  const anota = (nodo, clase, detalle) => {
    const { line } = sf.getLineAndCharacterOfPosition(nodo.getStart(sf))
    hallazgos.push({
      archivo: relative(RAIZ, archivo).replaceAll('\\', '/'),
      linea: line + 1,
      clase,
      detalle,
    })
  }

  const visita = (n) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const etiqueta = nombreDeEtiqueta(n)
      const attrs = atributos(n)
      const conNombre = attrs.has('aria-label') || attrs.has('aria-labelledby')

      if (etiqueta === 'button') {
        if (!conNombre && !tieneTexto(n)) {
          /**
           * `title` **sí** da nombre accesible según HTML-AAM, así que marcarlo
           * como «sin nombre» sería gritar de más. Pero es el peor de los
           * nombres: no se ve en pantalla táctil, no todos los lectores lo
           * anuncian y desaparece con el ratón. La auditoría ya citó el caso
           * (`title="Quitar"` sobre un `<Trash2/>` pelado). Va aparte: se
           * cuenta y baja con el trinquete, sin ser un fallo duro.
           */
          anota(
            n,
            attrs.has('title') ? 'boton-nombrado-solo-por-title' : 'boton-sin-nombre',
            attrs.has('title')
              ? 'sólo icono con title — es nombre, pero el peor: no se ve al tocar'
              : 'sólo icono, sin aria-label ni texto',
          )
        }
      } else if (CAMPOS.has(etiqueta)) {
        const id = attrs.get('id')
        const señalado = id != null && objetivos.has(id)
        if (!conNombre && !señalado && !envueltoEnLabel(n) && !campoExento(attrs)) {
          anota(
            n,
            'campo-sin-etiqueta',
            attrs.has('placeholder')
              ? 'sólo placeholder — desaparece al escribir y no es nombre'
              : 'sin aria-label, sin id señalado por htmlFor y sin <label> que lo envuelva',
          )
        }
      } else if (etiqueta === 'img') {
        if (!attrs.has('alt')) anota(n, 'imagen-sin-alt', 'sin atributo alt')
      }
    }
    ts.forEachChild(n, visita)
  }
  visita(sf)
  return hallazgos
}

/** Recorre toda la aplicación y separa la superficie del paciente del resto. */
export function medir() {
  const paciente = []
  const resto = []
  for (const f of pantallas()) {
    const h = analizar(f)
    if (h.length === 0) continue
    ;(esDelPaciente(f) ? paciente : resto).push(...h)
  }
  return { paciente, resto }
}

export const porClase = (hs) =>
  hs.reduce((acc, h) => ({ ...acc, [h.clase]: (acc[h.clase] ?? 0) + 1 }), {})

export const TECHO = 'docs/audit/a11y-techo.json'

/**
 * Trinquete, igual que el de lint: la deuda se congela y **sólo puede bajar**.
 *
 * Se falla también cuando baja sin apretar el techo, y no es capricho: si el
 * techo no se baja al arreglar algo, el margen ganado se lo come el siguiente
 * descuido sin que nadie se entere. Un trinquete que no se aprieta es un tope.
 *
 * La superficie del paciente NO tiene techo: tiene cero. Es lo que V9 gobierna
 * y es donde el lector de pantalla es de un paciente, no de un profesional que
 * conoce la pantalla de memoria.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync, existsSync } = await import('node:fs')
  const { paciente, resto } = medir()
  const actual = porClase(resto)

  console.log('\n  SUPERFICIE DEL PACIENTE — la que V9 gobierna\n')
  if (paciente.length === 0) console.log('     sin hallazgos.')
  for (const h of paciente) console.log(`     ${h.archivo}:${h.linea}  ${h.clase}  — ${h.detalle}`)
  console.log(`\n  RESTO DE LA APLICACIÓN — ${resto.length} hallazgos`)
  console.log('    ', JSON.stringify(actual))

  const ruta = join(RAIZ, TECHO)
  if (process.argv.includes('--actualizar') || !existsSync(ruta)) {
    writeFileSync(ruta, JSON.stringify({ resto: actual }, null, 2) + '\n')
    console.log(`\n  Techo fijado en ${JSON.stringify(actual)}.\n`)
    process.exit(0)
  }

  const techo = JSON.parse(readFileSync(ruta, 'utf8')).resto
  const clases = [...new Set([...Object.keys(techo), ...Object.keys(actual)])]
  const subieron = clases.filter((c) => (actual[c] ?? 0) > (techo[c] ?? 0))
  const bajaron = clases.filter((c) => (actual[c] ?? 0) < (techo[c] ?? 0))

  if (paciente.length > 0) {
    console.error('\n  A11Y: la superficie del paciente no admite techo. Arriba están los hallazgos.\n')
    process.exit(1)
  }
  if (subieron.length > 0) {
    for (const c of subieron) console.error(`  ${c}: ${techo[c] ?? 0} → ${actual[c] ?? 0}`)
    console.error('\n  A11Y: deuda nueva. Arréglala.\n')
    process.exit(1)
  }
  if (bajaron.length > 0) {
    for (const c of bajaron) console.error(`  ${c}: ${techo[c]} → ${actual[c]}`)
    console.error('\n  A11Y: bajaste. APRIETA EL TRINQUETE:\n     node scripts/a11y/nombres-accesibles.mjs --actualizar\n')
    process.exit(1)
  }
  console.log('\n  A11Y: paciente en cero, resto igual que el techo. Sin deuda nueva.\n')
}
