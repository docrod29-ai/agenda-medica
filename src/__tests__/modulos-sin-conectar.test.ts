/**
 * GUARDIÁN — lo que se escribe tiene que USARSE.
 *
 * ── POR QUÉ EXISTE ESTE ARCHIVO ──────────────────────────────────────────────
 *
 * El 31-jul-2026 el mismo fallo apareció CUATRO veces en un día, y ninguna lo
 * habría detectado un test normal, porque el código estaba bien:
 *
 *   1. `procesarTranscript` — el pipeline de voz de nueve etapas, probado contra
 *      6 000 frases, **no aparecía en un solo archivo de producción**. La
 *      consulta corría sólo la etapa 1.
 *   2. `lib/asr/lexicon.ts` — el constructor de vocabulario por paciente, lo
 *      único que cambia lo que el reconocedor OYE: no lo llamaba nadie.
 *   3. `AvisoPrivacidadModal` — con `medioInicial: 'presencial'` de fábrica, o
 *      sea escrito para el alta en el consultorio, y sin montar en ninguna
 *      pantalla. Un incumplimiento de la LFPDPPP invisible.
 *   4. Los límites del motor de antimicrobianos, sin una pantalla donde
 *      cargarlos.
 *
 * Un módulo huérfano no rompe nada: los tests pasan, el build pasa, y el
 * trabajo simplemente no le llega al médico. Es la forma más cara de fallar,
 * porque se paga entera y no se nota.
 *
 * ── POR QUÉ ES UN TRINQUETE Y NO UNA LISTA VACÍA ─────────────────────────────
 *
 * Quedan huérfanos legítimos —trabajo empezado que todavía no tiene pantalla— y
 * exigir cero los borraría o forzaría a conectar algo a medias. Así que se
 * CONGELAN con su nombre: uno nuevo pone el CI en rojo, y quitar uno obliga a
 * bajar la lista. La deuda queda declarada, no escondida.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Huérfanos conocidos, con la razón por la que se quedan.
 *
 * Para quitar uno de aquí: conéctalo. Para añadir uno: que sea a conciencia,
 * porque es trabajo que no le llega a nadie.
 */
const HUERFANOS_ACEPTADOS: Record<string, string> = {
  // ── Infraestructura de los propios gates: la usan los tests POR DISEÑO ────
  'src/lib/clinical/safety-gate.ts': 'ES el gate del sello clínico: lo ejecuta el CI, no una pantalla. Su sitio es ése.',
  'src/lib/clinical/adr-cobertura.ts': 'Gate de cobertura documental de los motores. Vive en el CI por definición.',
  'src/lib/authz/analisis-estatico.ts': 'Analizador de la frontera de API que usa el guardián de rutas. Herramienta, no función.',
  'src/lib/security/rutas-privadas.ts': 'Inventario de rutas privadas que consume su propio invariante.',

  // ── Motores clínicos con golden pero SIN pantalla que los muestre ─────────
  // Éstos son los que de verdad duelen: trabajo clínico terminado y probado
  // que todavía no le llega al médico.
  'src/lib/clinical/news2-set.ts': 'NEWS2 sobre conjunto contemporáneo: probado, pero ninguna pantalla lo usa todavía.',
  'src/lib/uci/dosificacion-critica.ts': 'Dosificación en el adulto crítico (algoritmo del Dr.): sin pantalla que la exponga.',
  'src/lib/ia/evaluacion.ts': 'Arnés de validación de la IA clínica: se corre a mano, sin tablero que lo enseñe.',
  'src/lib/mobile/consulta-cierre.ts': 'Núcleo del cierre de consulta: dos funciones puras esperando su interfaz.',

  // ── Trabajo empezado, pendiente de su fase ───────────────────────────────
  'src/lib/clinical-fact/schema.ts': 'Nexus OS E1-01: validación de ClinicalFact. La fase que lo consume no ha llegado.',
  'src/lib/clinical-fact/vocabulario.ts': 'Vocabulario de ClinicalFact, del mismo bloque pendiente.',
  'src/lib/evidencia/buscar-con-pico.ts': 'Puente PICO → PubMed (E2-02): el extractor existe, falta engancharlo al Consultor.',
  'src/lib/evidencia/desde-pubmed.ts': 'Del mismo bloque de evidencia estructurada.',
  'src/lib/compliance/policy.ts': 'Capa de política por país: escrita para LATAM, sin país distinto de México activo.',
  'src/lib/i18n.ts': 'Internacionalización ligera: base para LATAM, sin segundo idioma en uso.',
  'src/lib/permissions.ts': 'Permisos por rol en aplicación. La autorización REAL está en Firestore rules.',
  'src/components/DoctorOnboarding.tsx': 'Alta guiada del médico: escrita, sin pantalla que la monte todavía.',
  'src/lib/branches.ts': 'Multi-sucursal: el modelo existe, la interfaz y el motor de agenda no. Desde v847 la API TAMPOCO acepta `branchId`: aceptar un campo que se ignora es prometer una función que no existe.',
  'src/lib/curp.ts': 'Validación de CURP: el campo salió del formulario corto y quedó sin consumidor.',
  'src/lib/whatsapp/adapter.ts': 'Adaptador de proveedor de WhatsApp: hoy se usa 360dialog directo.',
}

const raiz = 'src'
const CODIGO = ['.ts', '.tsx']

function archivos(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== '__tests__') out.push(...archivos(p)); continue }
    if (CODIGO.some(x => e.endsWith(x)) && !e.endsWith('.d.ts')) out.push(p)
  }
  return out
}

const todos = archivos(raiz)
/** Todo el código que puede importar, incluidos los scripts. */
const fuentes = [...todos, ...archivos('scripts').filter(f => CODIGO.some(x => f.endsWith(x)))]
  .map(f => ({ f, src: readFileSync(f, 'utf8') }))

/** Un módulo de `lib/` o `components/` que nadie menciona. */
function huerfanos(): string[] {
  const out: string[] = []
  for (const f of todos) {
    const rel = relative('.', f)
    if (!rel.includes('/lib/') && !rel.includes('/components/')) continue
    const base = rel.split('/').pop()!.replace(/\.tsx?$/, '')
    if (['index', 'layout', 'page', 'route'].includes(base)) continue
    const alias = rel.replace(/^src\//, '@/').replace(/\.tsx?$/, '')
    const mencionado = fuentes.some(({ f: otro, src }) =>
      otro !== f && (src.includes(alias) || src.includes(`/${base}'`) || src.includes(`/${base}"`)))
    if (!mencionado) out.push(rel)
  }
  return out.sort()
}

describe('Nada se queda escrito y sin conectar', () => {
  const actuales = huerfanos()

  it('el guardián recorre el código de verdad (si no, pasaría vacío)', () => {
    expect(todos.length).toBeGreaterThan(200)
  })

  it('no hay ningún módulo huérfano NUEVO', () => {
    /**
     * Si esto se pone rojo: o lo conectas, o lo añades a `HUERFANOS_ACEPTADOS`
     * con la razón. Lo segundo es una decisión, no un trámite — un módulo que
     * nadie usa es trabajo que no le llega al médico.
     */
    const nuevos = actuales.filter(f => !(f in HUERFANOS_ACEPTADOS))
    expect(nuevos, `sin conectar a nada: ${nuevos.join(', ')}`).toEqual([])
  })

  it('y la lista de aceptados no guarda fantasmas', () => {
    // Un aceptado que ya se conectó (o que se borró) deja la lista mintiendo.
    const fantasmas = Object.keys(HUERFANOS_ACEPTADOS).filter(f => !actuales.includes(f))
    expect(fantasmas, `ya no son huérfanos, quítalos de la lista: ${fantasmas.join(', ')}`).toEqual([])
  })

  it('cada aceptado dice POR QUÉ sigue ahí', () => {
    for (const [f, razon] of Object.entries(HUERFANOS_ACEPTADOS)) {
      expect(razon.length, f).toBeGreaterThan(25)
    }
  })
})
