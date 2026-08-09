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
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'

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
  // Lo cazó ESTE guardián en cuanto se escribió, que es exactamente su trabajo.
  'src/lib/guardia/campos-conectados.ts': 'Guardián hermano de éste: vigila CAMPOS de contrato que nadie lee, no archivos. Vive en el CI por definición — una pantalla que lo muestre sería una pantalla que alguien apaga.',
  /**
   * Este guardián cazó, en cuanto se escribió, el módulo que documenta que
   * «escrito y sin conectar» es la familia de defecto MÁS GRANDE del ledger
   * (9 de 53). No es una ironía: es la prueba de que sigue mirando.
   */
  'src/lib/arquitectura/grafo-de-dependencias.ts':
    'Lee los imports del repo y mide la dirección de las dependencias y los ciclos. Herramienta de CI, no función de producto: su sitio es el PR que rompe la regla, no una pantalla.',
  'src/lib/calidad/familias-de-defecto.ts':
    'Taxonomía de causas raíz derivada del regression-ledger. Su consumidor es el guardián que compara la clasificación contra el ledger y falla si un REG se queda sin familia: vive en el CI por definición. Una pantalla que la muestre no protegería nada — lo que protege es que NO SE PUEDA cerrar un REG sin clasificarlo.',

  /**
   * ── LOS CUATRO QUE TAPABA UN `import type` (v1019) ────────────────────────
   *
   * TypeScript borra los imports de tipo al compilar. Los cuatro pasaban en
   * verde porque alguien importaba **un tipo** suyo: ni una línea de su código
   * llega al bundle.
   *
   * El caro es el primero, y por eso este guardián existe.
   */
  'src/lib/clinical/infusion-library.ts':
    'MOTOR CLÍNICO COMPLETO —tres capas de preparación, con golden, registrado en el registro clínico con sus entryPoints y su ADR— y NINGUNA pantalla llama a sus funciones. Sólo `uci/infusion-registro` importa un TIPO suyo. Conectarlo es una decisión de producto con implicaciones clínicas (qué preparaciones tiene la unidad, quién las autoriza): NO se conecta a medias para vaciar una lista.',
  'src/lib/evidencia/pico.ts':
    'Extractor PICO de la pregunta clínica. Lo consumen su golden y su prueba de tipos; ninguna pantalla lo llama todavía. Trabajo terminado esperando dónde enseñarse.',
  'src/lib/ia/evaluacion.ts':
    'El arnés de validación de la IA. Su sitio ES el CI —lo corren `ia-evaluacion` y el corpus oro—, igual que los demás gates. Un arnés con pantalla sería un arnés que alguien ajusta para que pase.',
  'src/lib/whatsapp/connection.ts':
    'Máquina de estados de la conexión de WhatsApp por consultorio. Probada y sin pantalla que la muestre; hoy el estado se lee de otro sitio. Declarado hasta que exista el panel de conexión.',

  // ── Motores clínicos con golden pero SIN pantalla que los muestre ─────────
  // Éstos son los que de verdad duelen: trabajo clínico terminado y probado
  // que todavía no le llega al médico.
  // (`news2-set.ts` salió de esta lista en v903: la ficha del episodio ya lo usa
  //  para decidir qué NEWS2 enseñar y con qué nombre.)
  'src/lib/mobile/consulta-cierre.ts': 'Núcleo del cierre de consulta: dos funciones puras esperando su interfaz.',
  'src/lib/ia/casos-oro.ts': 'Corpus oro de alucinación: lo consume su prueba en el CI, que es donde le toca. Un corpus con pantalla sería un corpus que alguien edita para que pase.',
  'src/lib/uci/benchmark.ts': 'Arnés de estrés de los motores de UCI (icu-014): lo corre su propia prueba en el CI, que es donde le toca. No necesita pantalla.',

  // ── Los que el guardián roto NO veía (v935) ──────────────────────────────
  // Salieron al resolver los `import` de verdad en vez de buscar el nombre del
  // archivo. Van declarados, no escondidos.
  // (`dosing/motor.ts` era el caro de los tres y salió de esta lista en v936:
  //  la pestaña «Consultar dosis» de /uci/dosificacion ya lo llama.)
  'src/lib/agenda/prompts.ts': 'Prompts operativos de la agenda (parseo de lenguaje natural a operaciones, tono de recordatorios). Lo tapaba `@/lib/expediente/prompts`, que sí se usa. Sin llamador desde que existe.',

  // ── Trabajo empezado, pendiente de su fase ───────────────────────────────
  'src/lib/clinical-fact/schema.ts': 'Nexus OS E1-01: validación de ClinicalFact. La fase que lo consume no ha llegado.',
  'src/lib/clinical-fact/vocabulario.ts': 'Vocabulario de ClinicalFact, del mismo bloque pendiente.',
  'src/lib/evidencia/buscar-con-pico.ts': 'Puente PICO → PubMed (E2-02): el extractor existe, falta engancharlo al Consultor.',
  'src/lib/evidencia/desde-pubmed.ts': 'Del mismo bloque de evidencia estructurada.',
  'src/lib/compliance/policy.ts': 'Capa de política por país: escrita para LATAM, sin país distinto de México activo.',
  'src/lib/i18n.ts': 'Internacionalización ligera: base para LATAM, sin segundo idioma en uso.',
  /**
   * NO es código de producto que se quedó sin conectar: es el MOTOR DE UNA
   * COMPUERTA. Lo usa `el-contraste-esta-medido.test.ts` para ejecutar en cada CI
   * la aritmética WCAG que hasta V9 sólo estaba escrita a mano en los
   * comentarios de `globals.css` — y que, al ejecutarla, destapó dos tokens del
   * tema claro por debajo de AA (REG-292).
   *
   * Que sólo lo importe una prueba es lo correcto aquí, y por eso se declara en
   * vez de conectarse a la fuerza.
   */
  'src/lib/design/contraste.ts': 'Motor WCAG de la compuerta de contraste (REG-292). Lo consume el guardián, no una pantalla: es instrumento, no producto.',
  'src/lib/permissions.ts': 'Permisos por rol en aplicación. La autorización REAL está en Firestore rules.',
  'src/components/DoctorOnboarding.tsx': 'Alta guiada del médico: escrita, sin pantalla que la monte todavía.',
  'src/lib/branches.ts': 'Multi-sucursal: el modelo existe, la interfaz y el motor de agenda no. Desde v847 la API TAMPOCO acepta `branchId`: aceptar un campo que se ignora es prometer una función que no existe.',
  'src/lib/curp.ts': 'Validación de CURP: el campo salió del formulario corto y quedó sin consumidor.',
  'src/lib/whatsapp/adapter.ts': 'Adaptador de proveedor de WhatsApp: hoy se usa 360dialog directo.',
}

const raiz = 'src'
const CODIGO = ['.ts', '.tsx']
/** Los scripts pueden importar código, y algunos están en JavaScript suelto. */
const IMPORTADORES = ['.ts', '.tsx', '.mjs', '.js']

function archivos(dir: string, exts: readonly string[] = CODIGO): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== '__tests__') out.push(...archivos(p, exts)); continue }
    if (exts.some(x => e.endsWith(x)) && !e.endsWith('.d.ts')) out.push(p)
  }
  return out
}

const todos = archivos(raiz)
/** Todo el código que puede importar, incluidos los scripts. */
const fuentes = [...todos, ...archivos('scripts', IMPORTADORES)]
  .map(f => ({ f: relative('.', f), src: readFileSync(f, 'utf8') }))

/**
 * Los especificadores de un `import`, un `export … from` o un `import()`.
 *
 * ── POR QUÉ NO BASTA CON BUSCAR EL NOMBRE DEL ARCHIVO ────────────────────────
 *
 * La primera versión de este guardián daba por «mencionado» cualquier módulo
 * cuyo NOMBRE DE ARCHIVO apareciera en otro archivo (`src.includes("/prompts'")`).
 * Con eso, `@/lib/expediente/prompts` —que sí se usa— **tapaba**
 * `src/lib/agenda/prompts.ts`, que no lo usa nadie. El guardián pasaba en verde
 * con el huérfano dentro.
 *
 * Un guardián que da un falso negativo es peor que no tenerlo: no sólo no avisa,
 * sino que **certifica** que no hay nada que avisar. Aquí salió por el nombre
 * `prompts`, pero `motor`, `index`, `utils` o `tipos` habrían hecho lo mismo.
 *
 * Ahora se lee el especificador real y se RESUELVE a un archivo del disco, que
 * es lo que hace el empaquetador.
 */
const ESPECIFICADOR = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g

/**
 * ── EL SEGUNDO FALSO NEGATIVO: `import type` NO CONECTA NADA ────────────────
 *
 * TypeScript **borra** los imports de tipo al compilar: no queda una sola línea
 * de ese módulo en el bundle. Un `import type { X } from '@/lib/motor'` es
 * documentación, no una llamada.
 *
 * Y con eso se colaba justo lo que este guardián existe para cazar:
 * `clinical/infusion-library.ts` —motor de tres capas, con golden, registrado en
 * el registro clínico con sus `entryPoints` y su ADR— pasaba en verde porque
 * `uci/infusion-registro.ts` importaba **un tipo** suyo. Ninguna de sus
 * funciones se llama en producción.
 *
 * Es el mismo modo de fallo que el del nombre de archivo (arriba), un escalón
 * más arriba: **el guardián no sólo no avisa, sino que certifica que no hay nada
 * que avisar.**
 */
const IMPORT_DE_TIPO = /^\s*(?:export|import)\s+type\s/

/** `@/lib/x` o `./x` → la ruta del archivo que de verdad se carga. */
function resolverEspecificador(espec: string, desde: string): string | null {
  let base: string
  if (espec.startsWith('@/')) base = join('src', espec.slice(2))
  else if (espec.startsWith('.')) base = relative('.', resolve(dirname(desde), espec))
  else return null  // paquete de node_modules
  const candidatos = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
  return candidatos.find(c => existsSync(c)) ?? base
}

/** Todo archivo al que apunta al menos un `import` de OTRO archivo. */
function importados(): Set<string> {
  const usados = new Set<string>()
  for (const { f, src } of fuentes) {
    for (const linea of src.split('\n')) {
      // Un `import type` se borra al compilar: no conecta nada.
      if (IMPORT_DE_TIPO.test(linea)) continue
      ESPECIFICADOR.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = ESPECIFICADOR.exec(linea))) {
        const destino = resolverEspecificador(m[1], f)
        // Un módulo que sólo se importa a sí mismo sigue siendo huérfano.
        if (destino && destino !== f) usados.add(destino)
      }
    }
  }
  return usados
}

/** Un módulo de `lib/` o `components/` que nadie importa. */
function huerfanos(): string[] {
  const usados = importados()
  const out: string[] = []
  for (const f of todos) {
    const rel = relative('.', f)
    if (!rel.includes('/lib/') && !rel.includes('/components/')) continue
    const base = rel.split('/').pop()!.replace(/\.tsx?$/, '')
    if (['index', 'layout', 'page', 'route'].includes(base)) continue
    if (!usados.has(rel)) out.push(rel)
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

/**
 * EL GUARDIÁN SE VIGILA A SÍ MISMO.
 *
 * Estas pruebas no miran el código de la aplicación: miran que el detector siga
 * resolviendo rutas y no vuelva a emparejar por nombre de archivo. Es la parte
 * que falló, y falló en silencio.
 */
describe('el detector resuelve rutas, no nombres de archivo', () => {
  it('un módulo con nombre repetido NO queda tapado por su homónimo', () => {
    /**
     * El caso real: `@/lib/expediente/prompts` se importa en varios sitios y
     * `src/lib/agenda/prompts.ts` en ninguno. Con la comparación por nombre,
     * el segundo se daba por usado.
     */
    const usados = importados()
    expect(usados.has('src/lib/expediente/prompts.ts')).toBe(true)
    expect(usados.has('src/lib/agenda/prompts.ts')).toBe(false)
  })

  it('resuelve el alias `@/` a un archivo que existe', () => {
    expect(resolverEspecificador('@/lib/expediente/prompts', 'src/app/x/page.tsx'))
      .toBe('src/lib/expediente/prompts.ts')
  })

  it('y las rutas relativas contra la carpeta de QUIEN importa', () => {
    // `./ventilacion` desde `src/lib/uci/benchmark.ts` es `src/lib/uci/…`, no
    // cualquier `ventilacion.ts` del árbol.
    expect(resolverEspecificador('./ventilacion', 'src/lib/uci/benchmark.ts'))
      .toBe('src/lib/uci/ventilacion.ts')
  })

  it('ignora los paquetes de node_modules', () => {
    expect(resolverEspecificador('react', 'src/app/x/page.tsx')).toBeNull()
    expect(resolverEspecificador('lucide-react', 'src/app/x/page.tsx')).toBeNull()
  })

  it('un módulo que sólo se importa A SÍ MISMO sigue siendo huérfano', () => {
    // Un `import` interno no es un consumidor.
    const usados = importados()
    for (const f of Object.keys(HUERFANOS_ACEPTADOS)) expect(usados.has(f), f).toBe(false)
  })

  it('lee `export … from` y los `import()` dinámicos, no sólo `import`', () => {
    // Un componente cargado con `next/dynamic` o un barril de re-exportación
    // son consumidores reales; tratarlos como huérfanos sería el error opuesto.
    expect(ESPECIFICADOR.source).toContain('import\\s*\\(')
    expect(ESPECIFICADOR.source).toContain('from')
  })
})
