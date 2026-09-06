/**
 * INVENTARIO DE ESCRITURAS SIN CLAVE DE INTENCIÓN — `addDoc` que un reintento
 * puede convertir en dos documentos.
 *
 * ── POR QUÉ HACE FALTA EL INSTRUMENTO, Y NO OTRA LISTA A MANO ───────────────
 *
 * El censo de WS-04 decía «falta el resto del inventario de addDoc (25 sitios):
 * tareas clínicas, fotos clínicas, farmacia, ARCO y bloques de agenda siguen sin
 * clave de intención». Esa frase es una lista escrita a mano, y una lista escrita
 * a mano envejece sola: el `addDoc` número 26 no la actualiza, y nadie se entera
 * hasta que un paciente tiene dos dispensaciones del mismo fármaco.
 *
 * Es la familia «depende de recordar», y la respuesta que este árbol ya usó en
 * REG-394 para las lecturas sin cota: un inventario que se mide, y un techo que
 * sólo baja.
 *
 * ── QUÉ ENTRA EN EL INVENTARIO, Y POR QUÉ NO LO DECIDO YO ──────────────────
 *
 * El universo es **el manifiesto del respaldo** (`clinica/respaldo.ts`): las
 * colecciones que pertenecen a un consultorio. No es una lista mía: la regla de
 * aislamiento ya obliga a declarar ahí toda colección nueva, con su guardián.
 *
 * Eso hace el inventario auto-mantenido en el sentido que importa: una colección
 * nueva entra sola, y entra como `sin_clasificar` —o sea, en rojo— hasta que
 * alguien escriba qué cuesta duplicarla.
 *
 * Lo que queda fuera son las colecciones de infraestructura que no son datos del
 * consultorio: tokens de Google, estados de OAuth, el buzón de errores. Un
 * duplicado ahí no toca a ningún paciente.
 *
 * ── POR QUÉ NO TODA ESCRITURA ES UN DEFECTO ────────────────────────────────
 *
 * Duplicar una cama de hospital es una molestia administrativa que se borra.
 * Duplicar una dispensación de farmacia, una observación de signos vitales o una
 * nota clínica **no se borra**: entra en el expediente, cuenta para una
 * tendencia, o sale impresa.
 *
 * Exigirle clave de intención a las 25 enseñaría a ponerla por costumbre, que es
 * peor que no tenerla —parece protegido y no lo está—. Así que se clasifican por
 * **qué pasa si se duplica**, y el techo cuenta sólo las que pesan.
 *
 * ── LA OTRA FORMA DE NOMBRE ALEATORIO, QUE CASI SE ESCAPA ──────────────────
 *
 * `idempotencia.ts` lo dice en su primera línea: *«`addDoc()` **y `doc()` sin
 * id** generan un identificador aleatorio nuevo en cada llamada»*. La primera
 * versión de este inventario sólo buscaba `addDoc`, y por eso daba por buena la
 * escritura más peligrosa de farmacia:
 *
 *     tx.set(doc(COL_MOV(clinicId)), { …movimiento… })
 *
 * Está dentro de una `runTransaction`, que garantiza que la ARITMÉTICA de
 * existencias sea atómica — y no dice nada sobre repetirla. Si el commit sale y
 * la respuesta se pierde, el reintento descuenta el medicamento **otra vez**,
 * con un nombre nuevo. La transacción protege la consistencia, no la identidad.
 *
 * Un inventario que sólo mira `addDoc` da por protegido justo lo que la
 * transacción hace parecer seguro.
 *
 * ── LO QUE ESTE INVENTARIO NO PUEDE VER ────────────────────────────────────
 *
 * Es estático. No sabe si una ruta de servidor ya deduplica por su cuenta, ni si
 * una pantalla bloquea el botón. Por eso `PROTEGIDAS` es explícita y cada entrada
 * dice **por qué** — y por eso una escritura protegida por el botón bloqueado
 * NO cuenta como protegida: el doble clic es el caso fácil, y el que la red
 * provoca sola (el commit sale, la respuesta se pierde, la pantalla pide
 * reintentar) se lo salta entero.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()

/**
 * El universo: las colecciones del consultorio, leídas del manifiesto del
 * respaldo. Si esto devolviera vacío, todo el inventario pasaría por bueno — por
 * eso el guardián comprueba primero que no lo esté.
 */
export function coleccionesDelConsultorio() {
  const src = readFileSync(join(RAIZ, 'src/lib/clinica/respaldo.ts'), 'utf8')
  const i = src.indexOf('export const COLECCIONES')
  const j = src.indexOf('export const EXCLUIDAS')
  const bloque = src.slice(i, j > i ? j : undefined)
  return new Set([...bloque.matchAll(/'([a-z_][a-z0-9_]*)'/gi)].map(m => m[1]))
}

/**
 * QUÉ PASA SI SE DUPLICA. Es el único eje que decide si cuenta.
 *
 * `clinico`   — entra al expediente, a una tendencia o a un impreso. No se borra.
 * `operativo` — molesta y se corrige a mano sin consecuencia clínica.
 */
const PESO = { clinico: 'clinico', operativo: 'operativo' }

/**
 * Las colecciones que este árbol escribe con `addDoc`, con su peso y su razón.
 *
 * Una colección que no esté aquí sale como `sin_clasificar`, y eso pone el
 * guardián en rojo: lo que no se ha pensado no se da por operativo.
 */
const COLECCIONES = {
  // ── Clínicas: un duplicado queda en el expediente ────────────────────────
  notas: [PESO.clinico, 'Una nota clínica duplicada es un documento del expediente que no se puede borrar (NOM-004).'],
  adendas: [PESO.clinico, 'La corrección medicolegal de un documento inmutable. REG-395.'],
  signos: [PESO.clinico, 'Los signos vitales alimentan NEWS2 y las tendencias: un duplicado altera una escala.'],
  icu_observations: [PESO.clinico, 'Observación de UCI: alimenta escalas y tendencias, igual que los signos.'],
  laboratorio: [PESO.clinico, 'Una solicitud de laboratorio duplicada se le toma dos veces al paciente.'],
  fotos: [PESO.clinico, 'Entra al expediente del paciente y sale en el informe.'],
  /**
   * `farmacia` son los ITEMS del catálogo, no las dispensaciones. Un item
   * duplicado es un SKU de más que se borra desde la pantalla de farmacia; la
   * dispensación —el acto clínico— vive en `farmacia_movimientos`.
   */
  farmacia_movimientos: [PESO.clinico, 'Una dispensación duplicada es medicamento entregado dos veces y existencias descontadas dos veces.'],
  tareas_clinicas: [PESO.clinico, 'Un pendiente duplicado se cierra una vez y queda abierto, o se trabaja dos veces.'],
  arco_requests: [PESO.clinico, 'Una solicitud ARCO duplicada abre dos procesos legales sobre el mismo derecho.'],
  cobros: [PESO.clinico, 'Cobrarle dos veces al paciente. REG-395 lo cubrió con clave de intención.'],

  // ── Operativas: se corrigen a mano y no dejan rastro clínico ─────────────
  camas: [PESO.operativo, 'Una cama duplicada se borra desde la configuración.'],
  unidades: [PESO.operativo, 'Una unidad duplicada se borra desde la configuración.'],
  hospital_alertas: [PESO.operativo, 'Una alerta duplicada se lee dos veces y se marca leída; no entra al expediente.'],
  branches: [PESO.operativo, 'Una sucursal duplicada se borra desde la configuración.'],
  farmacia: [PESO.operativo, 'Item duplicado del catálogo: un SKU de más, que se borra desde farmacia. El acto clínico es el MOVIMIENTO, no el item.'],
  time_blocks: [PESO.operativo, 'Un bloque de agenda duplicado se ve en la agenda y se borra desde ahí.'],
  membership_plans: [PESO.operativo, 'Plan duplicado: se corrige en configuración y no toca el expediente.'],
  memberships: [PESO.operativo, 'Membresía duplicada: se corrige en configuración y no toca el expediente.'],
  patients: [PESO.operativo, 'Un paciente duplicado es un problema real de identidad, pero se resuelve con la FUSIÓN de expedientes, que ya existe — no con una clave de intención.'],
  doctors: [PESO.operativo, 'Un médico duplicado se borra desde la configuración.'],
  chat: [PESO.operativo, 'Un mensaje de chat duplicado se ve y no entra al expediente.'],
  clinics: [PESO.operativo, 'Crear el consultorio: lo hace el dueño una vez y lo ve.'],
  /**
   * Una versión duplicada es el MISMO contenido dos veces en un historial que es
   * append-only por diseño (NOM-024 Art. 6.4). No afirma un hecho clínico nuevo
   * ni cambia ninguna escala: hace el historial más largo.
   */
  versions: [PESO.operativo, 'El historial de versiones es append-only: una copia repetida no afirma nada nuevo.'],
}

/** Formas de dar identidad determinista a un documento en este árbol. */
const CON_INTENCION = /\b(idIdempotente|claveDeIntento|idDerivado|origenId)\b/

/** El argumento de una llamada, con paréntesis balanceados. */
function argumento(src, iParen) {
  let n = 0
  for (let j = iParen; j < src.length; j++) {
    if (src[j] === '(') n++
    else if (src[j] === ')') { n--; if (n === 0) return src.slice(iParen + 1, j) }
  }
  return ''
}

/**
 * El PRIMER argumento de una llamada, respetando paréntesis.
 *
 * Partir por la primera coma parece equivalente y no lo es: con
 * `addDoc(collection(db, 'clinics', …), payload)` deja `collection(db`, o sea
 * la llamada cortada por la mitad. Ése fue el segundo fallo de este inventario,
 * y también acababa atribuyendo la escritura a la colección equivocada.
 */
function primerArgumento(args) {
  let n = 0
  for (let j = 0; j < args.length; j++) {
    const c = args[j]
    if (c === '(' || c === '[' || c === '{') n++
    else if (c === ')' || c === ']' || c === '}') n--
    else if (c === ',' && n === 0) return args.slice(0, j)
  }
  return args
}

function archivosDeCodigo(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e !== 'node_modules' && e !== '__tests__') archivosDeCodigo(p, out)
    } else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

/** El bloque de la función que contiene una posición, para no resolver el archivo entero. */
function bloqueQueContiene(src, i) {
  const desde = Math.max(0, src.lastIndexOf('\nexport ', i), src.lastIndexOf('\nasync function', i), src.lastIndexOf('\nfunction', i))
  return src.slice(desde, i + 400)
}

/**
 * A QUÉ COLECCIÓN DE FIRESTORE ESCRIBE UN `addDoc`.
 *
 * ── POR QUÉ SE RESUELVE EL IDENTIFICADOR Y NO SE ADIVINA EL NOMBRE ──────────
 *
 * El primer intento casaba el nombre de la variable (`fotosCol`, `labCol`) y
 * dejó OCHO de veintidós «sin clasificar», porque este árbol las llama `COL`,
 * `COL_MOV`, `PLANES_COL` o `col`. Un inventario que no sabe qué mira no es un
 * inventario.
 *
 * La verdad está en la RUTA: `collection(db, 'clinics', cid, 'farmacia')`. Se
 * busca la definición del identificador en el mismo archivo y se toma el último
 * literal de cadena de su `collection(...)`, que es el nombre real de la
 * colección. Es lo mismo que hace `firestore.rules`, así que las dos hablan del
 * mismo sitio.
 */
function rutaDeColeccion(src, expr) {
  /**
   * LA LLAMADA EN LÍNEA, PRIMERO.
   *
   * `addDoc(collection(db, …, 'notas', notaId, 'versions'), …)` no pasa por
   * ningún helper. La primera versión buscaba `const collection` en el archivo,
   * no lo encontraba, y acababa leyendo la PRIMERA `collection(` del fichero: le
   * atribuía a `notas` una escritura que va a `versions`. Un inventario que
   * confunde la colección acusa al módulo equivocado, que es peor que no contar.
   */
  const iInline = expr.indexOf('collection(')
  if (iInline >= 0) {
    const lits = [...argumento(expr, iInline + 'collection'.length).matchAll(/'([^']+)'/g)].map(m => m[1])
    if (lits.length) return lits[lits.length - 1]
  }
  const id = /([A-Za-z_$][\w$]*)\s*\(/.exec(expr)?.[1] ?? /^\s*([A-Za-z_$][\w$]*)/.exec(expr)?.[1]
  if (!id) return null
  /* La definición del helper: `const X = (…) => collection(db, …)` o `function X(…) { … }`. */
  const iDef = new RegExp(`(const|function)\\s+${id}\\b`).exec(src)?.index
  const trozo = iDef === undefined ? src : src.slice(iDef, iDef + 600)
  const iCol = trozo.indexOf('collection(')
  if (iCol < 0) return null
  const literales = [...argumento(trozo, iCol + 'collection'.length).matchAll(/'([^']+)'/g)].map(m => m[1])
  const ultima = literales.length ? literales[literales.length - 1] : null
  /**
   * `col(clinicId, name)` recibe la subcolección por PARÁMETRO, así que la ruta
   * literal se queda en el contenedor (`clinics`) y no dice nada. Cuando pasa
   * eso, la verdad está en la llamada: `col(clinicId, COLLECTIONS.patients)`.
   */
  if (ultima === 'clinics') {
    const porTabla = /COLLECTIONS\.(\w+)/.exec(expr)?.[1]
    if (porTabla) return porTabla
  }
  return ultima
}

export function inventariar() {
  const DEL_CONSULTORIO = coleccionesDelConsultorio()
  const out = []
  for (const abs of archivosDeCodigo(join(RAIZ, 'src'))) {
    const src = readFileSync(abs, 'utf8')
    const archivo = relative(RAIZ, abs)
    for (const forma of ['addDoc(', 'doc(']) {
    let i = -1
    for (;;) {
      i = src.indexOf(forma, i + 1)
      if (i < 0) break
      /**
       * ── LOS DOS SDK NOMBRAN AL REVÉS, Y CONFUNDIRLOS INFLA EL INVENTARIO ──
       *
       * Modular (cliente): `doc(col)` con UN argumento es aleatorio; `doc(col, id)`
       * está nombrado.
       * Admin (servidor): `.doc()` SIN argumentos es aleatorio; `.doc(uid)` está
       * nombrado.
       *
       * Aplicar la regla del cliente al Admin marcaba como defecto cada
       * `.collection('clinic_members').doc(uid)` del árbol — trece falsos
       * positivos de golpe. Un inventario que exagera manda a rehacer lo que ya
       * estaba bien y le quita crédito a los huecos reales (REG-394).
       */
      if (forma === 'doc(') {
        const anterior = src[i - 1] ?? ''
        if (/[A-Za-z0-9_$]/.test(anterior)) continue          // addDoc(, getDoc(, setDoc(…
        if (anterior === '.') {
          /* Admin SDK: sólo `.doc()` vacío fabrica un nombre. */
          if (argumento(src, i + forma.length - 1).trim() !== '') continue
        }
      }
      /* Sólo llamadas de verdad: en un comentario, `addDoc(` va precedido de texto. */
      const linea = src.slice(src.lastIndexOf('\n', i) + 1, src.indexOf('\n', i))
      if (/^\s*(\*|\/\/)/.test(linea)) continue

      const args = argumento(src, i + forma.length - 1)
      /**
       * `doc(col)` con UN solo argumento es un nombre aleatorio; `doc(col, id)`
       * lo nombra quien escribe y no es este defecto.
       */
      /* Modular: `doc(col, id)` lo nombra quien escribe y no es este defecto. */
      if (forma === 'doc(' && args.trim() !== '' && primerArgumento(args) !== args) continue
      const arg = primerArgumento(args)
      const coleccion = rutaDeColeccion(src, arg)
      if (!coleccion || !DEL_CONSULTORIO.has(coleccion)) continue
      const bloque = bloqueQueContiene(src, i)
      out.push({
        archivo,
        linea: src.slice(0, i).split('\n').length,
        coleccion,
        peso: COLECCIONES[coleccion]?.[0] ?? 'sin_clasificar',
        porQue: COLECCIONES[coleccion]?.[1]
          ?? `Colección «${coleccion ?? '?'}» sin clasificar: di qué pasa si se duplica.`,
        forma: forma === 'doc(' ? 'doc-sin-id' : 'addDoc',
        conIntencion: CON_INTENCION.test(bloque),
      })
    }
    }
  }
  return out
}

/** Las que pesan y NO tienen clave de intención. Es lo que cuenta el techo. */
export const sinIntencion = (inv = inventariar()) =>
  inv.filter(x => x.peso !== 'operativo' && !x.conIntencion)

export const recuento = (inv = inventariar()) => ({
  total: inv.length,
  clinicas: inv.filter(x => x.peso === 'clinico').length,
  operativas: inv.filter(x => x.peso === 'operativo').length,
  sinClasificar: inv.filter(x => x.peso === 'sin_clasificar').length,
  sinIntencion: sinIntencion(inv).length,
})

if (process.argv[1]?.endsWith('escrituras-sin-intencion.mjs')) {
  const inv = inventariar()
  console.log(recuento(inv))
  for (const x of sinIntencion(inv)) {
    console.log(`  ${x.peso.padEnd(14)} ${x.archivo}:${x.linea}  [${x.coleccion ?? '?'}] ${x.porQue}`)
  }
}
