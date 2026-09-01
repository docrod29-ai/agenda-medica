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
 * · **No comprueba el ORDEN de los campos del índice**, que a Firestore le
 *   importa: comprueba que el índice exista con esos campos. Un índice con los
 *   campos correctos en el orden incorrecto pasaría este guardián y fallaría en
 *   producción.
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
  orden: string[]
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

function compuestasDelArbol(): Compuesta[] {
  const archivos = execSync(
    "grep -rl 'orderBy(' src --include=*.ts --include=*.tsx | grep -v __tests__",
    { encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean)

  const salida: Compuesta[] = []
  for (const archivo of archivos) {
    const fuente = readFileSync(archivo, 'utf8')

    /* `const COL = (clinicId) => collection(db, 'clinics', clinicId, 'farmacia')` */
    const alias: Record<string, string> = {}
    for (const m of fuente.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>\s*collection\(([^)]*)\)/g)) {
      const literales = [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1])
      if (literales.length) alias[m[1]] = literales[literales.length - 1]
    }

    for (const cuerpo of bloquesDeQuery(fuente)) {
      let coleccion: string | null = null
      const directa = cuerpo.match(/collection\(([^)]*)\)/)
      if (directa) {
        const literales = [...directa[1].matchAll(/'([^']+)'/g)].map(x => x[1])
        coleccion = literales[literales.length - 1] ?? null
      }
      if (!coleccion) {
        const porAlias = cuerpo.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/)
        if (porAlias && alias[porAlias[1]]) coleccion = alias[porAlias[1]]
      }
      if (!coleccion) continue

      const donde = [...cuerpo.matchAll(/where\(\s*'([^']+)'\s*,\s*'([^']+)'/g)]
        .map(x => ({ campo: x[1], op: x[2] }))
      const orden = [...cuerpo.matchAll(/orderBy\(\s*'([^']+)'/g)].map(x => x[1])
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
        orden.some(o => !filtrados.has(o)) ||
        donde.some(w => w.op !== '==' && !orden.includes(w.campo))
      if (haceFalta) {
        salida.push({ archivo, coleccion, igualdades: donde.map(w => w.campo), orden })
      }
    }
  }
  return salida
}

const DECLARADOS = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes as {
  collectionGroup: string
  fields: { fieldPath: string }[]
}[]

const estaDeclarado = (c: Compuesta) =>
  DECLARADOS.some(d =>
    d.collectionGroup === c.coleccion &&
    [...c.igualdades, ...c.orden].every(campo => d.fields.some(f => f.fieldPath === campo)))

describe('ninguna consulta compuesta se queda sin su índice declarado', () => {
  const compuestas = compuestasDelArbol()

  it('el lector encuentra consultas de verdad (si no, pasaría vacío)', () => {
    /* El modo de fallo de este archivo es no encontrar nada y dar todo por
       bueno. Ya pasó una vez con la expresión regular ingenua. */
    expect(compuestas.length).toBeGreaterThanOrEqual(4)
    expect(compuestas.map(c => c.coleccion)).toContain('reviews')
  })

  it('todas están en firestore.indexes.json', () => {
    const huerfanas = compuestas.filter(c => !estaDeclarado(c))
    expect(
      huerfanas.map(c => `${c.coleccion}: where ${c.igualdades.join('+')} → orderBy ${c.orden.join(',')} (${c.archivo})`),
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

    const seguiriaDeclarada = sinReviews.some(d =>
      d.collectionGroup === reseñas!.coleccion &&
      [...reseñas!.igualdades, ...reseñas!.orden].every(campo => d.fields.some(f => f.fieldPath === campo)))
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
