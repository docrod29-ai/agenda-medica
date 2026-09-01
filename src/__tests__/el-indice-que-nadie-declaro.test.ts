/**
 * GUARDIÁN — una consulta compuesta sin índice declarado rompe la pantalla el día
 * que se despliega, no el día que se escribe.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Preparando el despliegue de índices —uno de los pendientes del
 * `FINAL-READINESS`, y de los que sólo el dueño puede ejecutar— se contaron las
 * consultas del árbol que Firestore **no puede servir sin un índice compuesto**:
 * una igualdad (o un `in`) sobre un campo y un `orderBy` sobre **otro**.
 *
 * Salieron cuatro, y `firestore.indexes.json` declaraba **cero** de las cuatro:
 *
 *   · `arco_requests`  estado in […]  → orderBy fechaSolicitud   (derechos ARCO)
 *   · `farmacia`       activo ==      → orderBy nombre           (lista de farmacia)
 *   · `farmacia_movimientos` itemId == → orderBy fecha           (rastro de controlados)
 *   · `reviews`        estado ==      → orderBy publicadaEn      (página PÚBLICA del médico)
 *
 * ── POR QUÉ IMPORTA ─────────────────────────────────────────────────────────
 *
 * Firestore no degrada una consulta así: **la rechaza** con `FAILED_PRECONDITION`.
 * Y el fallo no aparece al escribir el código ni en ninguna prueba —una tienda en
 * memoria no exige índices— sino en el navegador de quien la usa. Una de las
 * cuatro es la página pública del médico, que ve cualquiera.
 *
 * ── LO QUE ESTE ARCHIVO **NO** AFIRMA ───────────────────────────────────────
 *
 * **No dice que esas cuatro estén rotas en producción hoy.** Firestore crea
 * índices a mano desde la consola cuando alguien sigue el enlace del error, y un
 * `deploy --only firestore:indexes` **no borra** los que no estén en el archivo.
 * O sea: el proyecto vivo puede tenerlos aunque el repositorio no los declarara.
 *
 * Lo que sí afirma es que **la declaración estaba incompleta**, y eso basta para
 * romper: un consultorio nuevo, un proyecto restaurado o una recreación desde
 * este repositorio se quedaría sin ellos. Saber cuáles existen de verdad en el
 * proyecto vivo se mira del otro lado —regla «el dato tiene que LLEGAR»— y no
 * puede vivir aquí.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Sólo ve el SDK de cliente** (`query(collection(...), where, orderBy)`). Lo
 *   que corre por el SDK admin en las rutas de servidor no lo lee este guardián:
 *   está declarado aquí y sigue siendo trabajo pendiente, no un hueco tapado.
 * · **Sí comprueba el orden de los campos desde REG-417** — igualdades primero,
 *   `orderBy` después y en su orden exacto, sin campos de más. Lo que NO mira es
 *   el `queryScope`: un índice de `COLLECTION` no sirve para un
 *   `collectionGroup`, y eso pasaría este guardián.
 * · **No sabe si el índice está construido**: declararlo y desplegarlo son dos
 *   actos, y el segundo es del dueño.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

interface Compuesta {
  archivo: string
  coleccion: string
  igualdades: string[]
  orden: { campo: string; dir: 'asc' | 'desc' }[]
}

/**
 * Recorta cada `query(...)` por sus paréntesis, no por una expresión regular.
 *
 * La primera versión buscaba `query\(([\s\S]*?)\)` y se paraba en el primer
 * paréntesis de cierre —el de `collection(...)`, que va dentro— así que no
 * encontraba **ni una sola** consulta compuesta y daba todo por bueno. Un
 * guardián que no encuentra nada siempre pasa; por eso más abajo hay un caso que
 * comprueba que este lector sí lee.
 */
function bloquesDeQuery(fuente: string): string[] {
  const bloques: string[] = []
  for (let i = fuente.indexOf('query('); i !== -1; i = fuente.indexOf('query(', i + 1)) {
    if (/[A-Za-z0-9_$.]/.test(fuente[i - 1] ?? '')) continue   // `subQuery(`, `.query(`
    let profundidad = 0
    let j = i + 5
    for (; j < fuente.length; j += 1) {
      if (fuente[j] === '(') profundidad += 1
      else if (fuente[j] === ')') { profundidad -= 1; if (profundidad === 0) break }
    }
    bloques.push(fuente.slice(i + 6, j))
  }
  return bloques
}

/**
 * QUÉ COLECCIÓN LEE ESTA CONSULTA — Y POR QUÉ ESTO ES LA MITAD DEL GUARDIÁN.
 *
 * La versión anterior resolvía dos formas: `collection(db, …, 'literal')` escrito
 * dentro del `query(...)`, y un alias `const X = (…) => collection(…, 'literal')`.
 * Cualquier otra cosa la **saltaba en silencio** con un `continue`.
 *
 * Y así es como se le escapó `getWaitlist` (REG-417), que llama a un ayudante
 * declarado con `function` y recibe el nombre por PARÁMETRO:
 *
 *   function col(clinicId, name) { return collection(db, 'clinics', clinicId, name) }
 *   query(col(clinicId, COLLECTIONS.waitlist), where('estado','=='), orderBy('createdAt'))
 *
 * Dos capas de silencio, no una: el guardián no la leía, y aunque la hubiera
 * leído, comparaba sólo la PRESENCIA de los campos. Un guardián que salta lo que
 * no entiende no dice «no lo sé»: dice «está bien».
 *
 * Ahora resuelve tres formas —literal, ayudante de nombre fijo, ayudante con el
 * nombre por parámetro (incluido `COLLECTIONS.x`)— y lo que sigue sin poder
 * resolver **lo declara y falla**, que es lo contrario de saltárselo.
 */
interface Ayudante {
  /** Nombre literal de la colección, si el ayudante siempre lee la misma. */
  fijo?: string
  /** Posición del parámetro que trae el nombre, si lo recibe de fuera. */
  desdeParametro?: number
}

/** Corta por comas de PRIMER nivel: `f(a, g(b, c), 'd')` → tres trozos. */
function argumentos(texto: string): string[] {
  const partes: string[] = []
  let profundidad = 0
  let actual = ''
  for (const ch of texto) {
    if (ch === '(' || ch === '[' || ch === '{') profundidad += 1
    else if (ch === ')' || ch === ']' || ch === '}') profundidad -= 1
    if (ch === ',' && profundidad === 0) { partes.push(actual); actual = ''; continue }
    actual += ch
  }
  if (actual.trim()) partes.push(actual)
  return partes.map(x => x.trim())
}

function ayudantesDe(fuente: string): Record<string, Ayudante> {
  const salida: Record<string, Ayudante> = {}
  const patron = new RegExp(
    String.raw`(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>\s*|function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{\s*return\s+)collection\(([^)]*)\)`,
    'g',
  )
  for (const m of fuente.matchAll(patron)) {
    const nombre = m[1] ?? m[3]
    const params = argumentos(m[2] ?? m[4] ?? '').map(p => p.split(':')[0].trim())
    const args = argumentos(m[5])
    const ultimo = args[args.length - 1] ?? ''
    const literal = ultimo.match(/^'([^']+)'$/)
    if (literal) { salida[nombre] = { fijo: literal[1] }; continue }
    const posicion = params.indexOf(ultimo)
    if (posicion !== -1) salida[nombre] = { desdeParametro: posicion }
  }
  return salida
}

/**
 * Las dos formas de nombrar una colección con una constante:
 * `const COL = 'clinic_invitations'` y `const COLLECTIONS = { waitlist: '…' }`.
 *
 * La primera apareció al encender este guardián: `listarInvitaciones` usaba
 * `collection(db, COL)` y era la segunda consulta compuesta sin declarar.
 */
function constantesDe(fuente: string): Record<string, string> {
  const salida: Record<string, string> = {}
  for (const m of fuente.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']+)'/g)) {
    salida[m[1]] = m[2]
  }
  for (const m of fuente.matchAll(/const\s+([A-Z][\w$]*)\s*=\s*\{([^}]*)\}/g)) {
    for (const par of m[2].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*'([^']+)'/g)) {
      salida[`${m[1]}.${par[1]}`] = par[2]
    }
  }
  return salida
}

function compuestasDelArbol(): { compuestas: Compuesta[]; ilegibles: string[] } {
  const archivos = execSync(
    "grep -rl 'orderBy(' src --include=*.ts --include=*.tsx | grep -v __tests__",
    { encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean)

  const salida: Compuesta[] = []
  const ilegibles: string[] = []
  for (const archivo of archivos) {
    const fuente = readFileSync(archivo, 'utf8')
    const ayudantes = ayudantesDe(fuente)
    const constantes = constantesDe(fuente)

    for (const cuerpo of bloquesDeQuery(fuente)) {
      const donde = [...cuerpo.matchAll(/where\(\s*'([^']+)'\s*,\s*'([^']+)'/g)]
        .map(x => ({ campo: x[1], op: x[2] }))
      const orden = [...cuerpo.matchAll(/orderBy\(\s*'([^']+)'\s*(?:,\s*'(asc|desc)')?/g)]
        .map(x => ({ campo: x[1], dir: (x[2] ?? 'asc') as 'asc' | 'desc' }))
      if (donde.length === 0 || orden.length === 0) continue

      /**
       * Cuándo hace falta un índice compuesto, y cuándo NO.
       *
       * Filtrar y ordenar por el MISMO campo lo sirve el índice de un solo campo
       * que Firestore crea solo — incluido un rango (`>=`, `<`) con su `orderBy`
       * encima, que es el caso de los cobros por fecha. Marcar esos sería llenar
       * el archivo de índices que nadie necesita, y un guardián que grita donde
       * no hay nada acaba ignorándose.
       */
      const filtrados = new Set(donde.map(w => w.campo))
      const haceFalta =
        orden.some(o => !filtrados.has(o.campo)) ||
        donde.some(w => w.op !== '==' && !orden.some(o => o.campo === w.campo))
      if (!haceFalta) continue

      const primero = argumentos(cuerpo)[0] ?? ''
      let coleccion: string | null = null

      const directa = primero.match(/^collection\(([\s\S]*)\)$/)
      if (directa) {
        const literales = [...directa[1].matchAll(/'([^']+)'/g)].map(x => x[1])
        const ultimo = argumentos(directa[1]).slice(-1)[0] ?? ''
        coleccion = literales[literales.length - 1] ?? constantes[ultimo] ?? null
      } else {
        const llamada = primero.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/)
        const ayudante = llamada ? ayudantes[llamada[1]] : undefined
        if (ayudante?.fijo) {
          coleccion = ayudante.fijo
        } else if (ayudante?.desdeParametro !== undefined && llamada) {
          const arg = argumentos(llamada[2])[ayudante.desdeParametro] ?? ''
          coleccion = arg.match(/^'([^']+)'$/)?.[1] ?? constantes[arg] ?? null
        }
      }

      if (!coleccion) {
        ilegibles.push(`${archivo}: where ${[...filtrados].join('+')} → orderBy `
          + `${orden.map(o => o.campo).join(',')} — no se pudo resolver la colección de \`${primero.slice(0, 60)}\``)
        continue
      }
      salida.push({ archivo, coleccion, igualdades: donde.map(w => w.campo), orden })
    }
  }
  return { compuestas: salida, ilegibles }
}

const DECLARADOS = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes as {
  collectionGroup: string
  fields: { fieldPath: string; order?: string }[]
}[]

/**
 * CUÁNDO UN ÍNDICE SIRVE DE VERDAD PARA UNA CONSULTA (REG-417).
 *
 * La primera versión de este guardián comprobaba que los campos **estuvieran**,
 * en cualquier orden y en cualquier índice de la colección. Su propio encabezado
 * lo declaraba como limitación —«no comprueba el ORDEN de los campos, que a
 * Firestore le importa»— y esa limitación tapó un hueco real: `getWaitlist`
 * (`estado ==` → `orderBy createdAt`) daba por declarada porque existía
 * `waitlist(estado, prioridad, createdAt)`, que tiene los dos campos… y NO sirve
 * para esa consulta. Es la pantalla de lista de espera, y en un proyecto nuevo
 * habría salido con `FAILED_PRECONDITION`.
 *
 * Las reglas que Firestore aplica de verdad, y que esto comprueba:
 *
 * 1. Los campos de igualdad van PRIMERO, en cualquier orden entre ellos.
 * 2. Después van los `orderBy`, en el orden EXACTO de la consulta.
 * 3. El índice no puede llevar campos de más: Firestore exige coincidencia
 *    completa, no un prefijo. `(estado, prioridad, createdAt)` no sirve para
 *    `estado ==` + `orderBy createdAt`; hace falta `(estado, createdAt)`.
 * 4. Las direcciones sirven si coinciden todas o si están todas invertidas — un
 *    índice se puede recorrer al revés, pero entero, no campo por campo.
 */
function sirve(d: { fields: { fieldPath: string; order?: string }[] }, c: Compuesta): boolean {
  const campos = d.fields.map(f => f.fieldPath)
  if (campos.length !== c.igualdades.length + c.orden.length) return false

  const cabeza = campos.slice(0, c.igualdades.length)
  if ([...cabeza].sort().join('|') !== [...c.igualdades].sort().join('|')) return false

  const cola = d.fields.slice(c.igualdades.length)
  if (cola.some((f, i) => f.fieldPath !== c.orden[i].campo)) return false

  const iguales = cola.every((f, i) =>
    (f.order === 'DESCENDING' ? 'desc' : 'asc') === c.orden[i].dir)
  const invertidas = cola.every((f, i) =>
    (f.order === 'DESCENDING' ? 'desc' : 'asc') !== c.orden[i].dir)
  return iguales || invertidas
}

const estaDeclarado = (c: Compuesta) =>
  DECLARADOS.some(d => d.collectionGroup === c.coleccion && sirve(d, c))

describe('ninguna consulta compuesta se queda sin su índice declarado', () => {
  const { compuestas, ilegibles } = compuestasDelArbol()

  it('el lector encuentra consultas de verdad (si no, pasaría vacío)', () => {
    /* El modo de fallo de este archivo es no encontrar nada y dar todo por
       bueno. Ya pasó una vez con la expresión regular ingenua. */
    expect(compuestas.length).toBeGreaterThanOrEqual(4)
    expect(compuestas.map(c => c.coleccion)).toContain('reviews')
  })

  it('y ninguna consulta compuesta se queda sin leer', () => {
    /**
     * EL MODO DE FALLO QUE DE VERDAD TUVO ESTE ARCHIVO.
     *
     * No fue equivocarse: fue **saltarse** lo que no entendía. `getWaitlist`
     * pasaba por un ayudante con el nombre por parámetro, el lector no supo qué
     * colección era, hizo `continue`, y el resultado se leyó como «todo
     * declarado» durante toda la vida del guardián.
     *
     * Por eso lo ilegible ya no se salta: se acumula y falla aquí. Si mañana
     * alguien escribe una consulta con una forma nueva, este caso se pone rojo y
     * pide que se enseñe a leerla — no la da por buena.
     */
    expect(
      ilegibles,
      'consultas compuestas cuya colección este guardián no supo resolver — '
      + 'no son «seguras»: son DESCONOCIDAS, y hay que enseñarle la forma nueva',
    ).toEqual([])
  })

  it('todas están en firestore.indexes.json', () => {
    const huerfanas = compuestas.filter(c => !estaDeclarado(c))
    expect(
      huerfanas.map(c => `${c.coleccion}: where ${c.igualdades.join('+')} → orderBy ${c.orden.map(o => `${o.campo} ${o.dir}`).join(',')} (${c.archivo})`),
      'consultas compuestas sin índice declarado — Firestore las RECHAZA en producción',
    ).toEqual([])
  })

  it('al revés: quitar un índice del archivo deja huérfana su consulta', () => {
    /**
     * La prueba del guardián. Se le quita a mano el índice de `reviews` —la
     * página pública del médico— y se comprueba que su consulta queda detectada.
     * Sin esto, `estaDeclarado` podría estar devolviendo `true` siempre y los dos
     * casos de arriba pasarían por la razón equivocada.
     */
    const sinReviews = DECLARADOS.filter(d => d.collectionGroup !== 'reviews')
    const reseñas = compuestas.find(c => c.coleccion === 'reviews')
    expect(reseñas, 'la consulta de reseñas publicadas dejó de existir').toBeDefined()

    const seguiriaDeclarada = sinReviews.some(d => d.collectionGroup === reseñas!.coleccion && sirve(d, reseñas!))
    expect(seguiriaDeclarada).toBe(false)
  })

  it('y el archivo distingue los índices ANTICIPADOS de los que ya hacen falta', () => {
    /**
     * LAS DOS MITADES DE ESTE ARCHIVO NO SON LA MISMA COSA.
     *
     * `docs/ops/INDICES-DE-FIRESTORE.md` declara cuatro índices **por
     * adelantado**: son para consultas que el código todavía NO hace. La regla de
     * ese documento es explícita —«ninguna consulta nueva puede depender de un
     * índice de este archivo hasta que esté desplegado»— así que mientras tanto
     * cada módulo escribe la versión peor que sí funciona y **declara el
     * sacrificio** (el worklist devuelve 200 tareas arbitrarias, la lista de
     * espera se lee sin prioridad…).
     *
     * Los otros cuatro son lo contrario, y por eso son el hallazgo: consultas que
     * el código **ya hace hoy** y cuyo índice nunca se declaró. La regla del
     * documento se estaba cumpliendo hacia adelante y se había incumplido hacia
     * atrás.
     *
     * Este caso guarda esa distinción. Un índice que no sirve a una consulta de
     * hoy tiene que estar en la lista de anticipados, con su fila en el documento
     * de operación: si no, es un índice que nadie pide, y un índice de más cuesta
     * escrituras y almacenamiento en cada documento de esa colección, para
     * siempre.
     */
    /* Cada anticipado, con el módulo que el documento de operación nombra como
       el que hoy paga el sacrificio. */
    const ANTICIPADOS: Record<string, string> = {
      tareas_clinicas: 'tareas-clinicas/firestore.ts',
      waitlist: 'whatsapp/ofrecer-hueco.ts',
      appointments: 'hooks/useAppointments.ts',
      notas: 'expediente/firestore.ts',
    }
    const doc = readFileSync('docs/ops/INDICES-DE-FIRESTORE.md', 'utf8')

    const pedidos = new Set(compuestas.map(c => c.coleccion))
    const sinExplicar = DECLARADOS
      .map(d => d.collectionGroup)
      .filter(c => !pedidos.has(c) && !(c in ANTICIPADOS))
    expect(sinExplicar, 'índices que ninguna consulta pide y que nadie declaró como anticipados').toEqual([])

    /* Y que «anticipado» no se vuelva un cajón donde meter cualquier índice: el
       documento tiene que nombrar el módulo que paga el sacrificio mientras
       tanto. Sin esta comprobación bastaría con añadir un nombre a la lista de
       arriba para silenciar el caso anterior. */
    for (const [coleccion, modulo] of Object.entries(ANTICIPADOS)) {
      expect(doc, `${coleccion} se declaró anticipado y el documento no nombra su módulo`).toContain(modulo)
    }
  })
})
