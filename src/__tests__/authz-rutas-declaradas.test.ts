import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join, relative, sep } from 'node:path'
import {
  REGISTRO_RUTAS, TIPOS_CON_MOTIVO, capacidadesDeRuta,
  capacidadEsperada, pendienteDe, activaEnCodigoMetodo, resumenActivacion,
  type ExigenciaRuta, type Metodo,
} from '@/lib/authz/registro-rutas'
import { rolesCon, ROLES_NO_CLINICOS } from '@/lib/authz/capabilities'
import { analizarRuta, type LlamadaGuardia } from '@/lib/authz/analisis-estatico'

/**
 * GUARDIÁN DEL REGISTRO DE RUTAS (unidad Nexus OS E0-07).
 * Molde: `api-authz-guard.test.ts` de E0-06, incluida su limpieza de comentarios
 * —obligatoria aquí: los comentarios de este repo CITAN a propósito el nombre del
 * guardián que se cambió («va con verificarMEDICO, no verificarMiembro»), y sin
 * limpiarlos el escaneo produce falsos positivos.
 *
 * ESTE ARCHIVO ES EL CRITERIO DE ACEPTACIÓN de la unidad: «cada ruta declara la
 * capacidad que exige; no hay any-member implícito». Convierte el registro en algo
 * que no se puede dejar viejo:
 *  · una ruta nueva sin declarar → rojo,
 *  · una clave declarada que ya no existe en disco → rojo,
 *  · una exención sin motivo escrito → rojo,
 *  · un registro que dice una cosa y un archivo que hace otra → rojo.
 */

const DIR_API = resolve(process.cwd(), 'src/app/api')

/**
 * Colecciones cuyo contenido es secreto médico (las mismas que van a `isMedico`).
 *
 * `internamientos` se añadió en el lote de cierre (P3-2 de la verificación
 * adversarial: la señal era demasiado estrecha). `laboratorios`, `fotos` y `clinico`
 * hoy no aparecen en ninguna ruta y se conservan A PROPÓSITO, para que el día que
 * aparezcan ya estén vigiladas sin que nadie se acuerde de añadirlas.
 */
const COLECCIONES_CLINICAS = ['notas', 'laboratorios', 'fotos', 'clinico', 'internamientos']

/**
 * ¿Esta fuente lee PHI clínico?
 *
 * ── DOS SEÑALES, PORQUE UNA SOLA SE APAGA CON UN REFACTOR ────────────────────
 *
 * 1. `collection('notas')` — el acceso literal de siempre.
 * 2. La colección declarada como hija en un MANIFIESTO (`hijas: ['notas', …]`).
 *
 * La segunda hizo falta al llegar el respaldo del consultorio: recorre las
 * subcolecciones con `collection(hija)` —dinámico, sin literal— porque la lista
 * vive en `lib/clinica/respaldo.ts`. Con la señal vieja, la ruta que se lleva
 * TODOS los expedientes del consultorio no contaba como lectora de PHI.
 *
 * Es la misma lección de la ruta que sacó su armado a una librería: **un
 * guardián textual se apaga con el refactor correcto, y se apaga en silencio**.
 * Cada vez que eso pase, la respuesta es añadir la señal, no bajar el listón.
 */
function leePhiClinico(src: string): boolean {
  return COLECCIONES_CLINICAS.some(c =>
    src.includes(`collection('${c}')`) || new RegExp(`hijas: \\[[^\\]]*'${c}'`).test(src))
}

/**
 * Segundo nivel: identidad del paciente, no secreto clínico. No se convierte en
 * regla de capacidad porque dos de las rutas que la tocan son deliberadamente sin
 * sesión (`public/booking`, `whatsapp/webhook`) y una regla ciega daría rojo por lo
 * correcto. Lo que sí se hace es CONGELAR la lista: una ruta nueva que lea `patients`
 * obliga a justificarla a mano.
 */
const COLECCIONES_PACIENTE = ['patients']

function archivosDeRuta(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) archivosDeRuta(p, out)
    else if (e.name === 'route.ts') out.push(p)
  }
  return out
}

/** El código SIN comentarios (ver la nota de cabecera). */
function codigo(p: string): string {
  return readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

/** `src/app/api/hospital/mutar/route.ts` → `hospital/mutar` (clave del registro). */
function claveDe(p: string): string {
  return relative(DIR_API, p).split(sep).slice(0, -1).join('/')
}

const ARCHIVOS = archivosDeRuta(DIR_API)
const CLAVES_DISCO = ARCHIVOS.map(claveDe).sort()

/**
 * La fuente de cada ruta, MÁS la de los módulos de `lib/` que importa.
 *
 * ── POR QUÉ NO BASTA CON EL ARCHIVO DE LA RUTA ───────────────────────────────
 *
 * El detector de PHI busca `collection('notas')` en el cuerpo de la ruta. Eso
 * funcionó mientras cada ruta leía Firestore a mano — y dejó de funcionar en
 * cuanto una sacó el armado a una librería compartida: la ruta que entrega el
 * expediente COMPLETO se volvió invisible para el guardián justo al mejorarla.
 *
 * Es la trampa clásica de un guardián textual: **el refactor correcto lo apaga**.
 * Y lo apaga en silencio, que es lo peor — la lista de rutas con PHI se acorta y
 * parece una buena noticia.
 *
 * Se sigue un nivel de indirección: lo que la ruta importa de `@/lib/…` cuenta
 * como suyo. Un segundo nivel exigiría un grafo completo; con uno se cubren los
 * casos reales de este repositorio y el guardián sigue siendo legible.
 */
function fuenteConLibrerias(p: string): string {
  const propio = codigo(p)
  const libs = [...propio.matchAll(/from '@\/(lib\/[\w/-]+)'/g)].map(m => m[1])
  let extra = ''
  for (const l of libs) {
    for (const ext of ['.ts', '.tsx']) {
      const ruta = join(process.cwd(), 'src', l + ext)
      if (existsSync(ruta)) { extra += '\n' + codigo(ruta); break }
    }
  }
  return propio + extra
}

/** El archivo de la ruta y nada más: es donde tiene que estar su guardián. */
const FUENTE = new Map(ARCHIVOS.map(p => [claveDe(p), codigo(p)]))
/**
 * La ruta MÁS sus librerías, sólo para detectar qué PHI toca.
 *
 * Va aparte a propósito: mezclarla con `FUENTE` haría que una ruta «llame a
 * `verificarMedico`» porque lo menciona una librería que importa, y el guardián
 * de guardianes empezaría a dar por buenas rutas sin candado propio.
 */
const FUENTE_CON_LIBS = new Map(ARCHIVOS.map(p => [claveDe(p), fuenteConLibrerias(p)]))
const entrada = (clave: string): ExigenciaRuta | undefined => REGISTRO_RUTAS[clave]

/**
 * El análisis estático de cada ruta: qué guardián se llama, con qué literales y
 * dentro de qué handler HTTP. Se le pasa la fuente CRUDA porque `analizarRuta`
 * limpia los comentarios con un recorrido que respeta cadenas (mejor que el
 * `codigo()` de arriba, que se conserva para las comprobaciones textuales).
 */
const ANALISIS = new Map(ARCHIVOS.map(p => [claveDe(p), analizarRuta(readFileSync(p, 'utf8'))]))

/** Métodos HTTP que exporta cada ruta, observados del código. */
const METODOS_POR_RUTA: Record<string, readonly Metodo[]> = Object.fromEntries(
  [...ANALISIS].map(([c, a]) => [c, a.metodosExportados]),
)

/** Las llamadas a guardián del cuerpo de ESE handler. */
function segmento(clave: string, m: Metodo): readonly LlamadaGuardia[] {
  return ANALISIS.get(clave)?.porMetodo[m] ?? []
}

/** Todos los pares (ruta, método) que declaran una capacidad, con su entrada. */
function paresConCapacidad(): { clave: string; metodo: Metodo; e: ExigenciaRuta }[] {
  const out: { clave: string; metodo: Metodo; e: ExigenciaRuta }[] = []
  for (const [clave, metodos] of Object.entries(METODOS_POR_RUTA)) {
    const e = entrada(clave)
    if (!e) continue
    for (const m of metodos) {
      if (capacidadEsperada(e, m) !== null) out.push({ clave, metodo: m, e })
    }
  }
  return out
}

describe('E0-07 · el escaneo encuentra rutas de verdad', () => {
  it('hay 81 rutas en disco (un guardián que no encuentra archivos pasa vacío y no protege nada)', () => {
    // Si este número cambia es porque se añadió o quitó una ruta: hay que declararla
    // en REGISTRO_RUTAS y ajustar el conteo, a propósito y a mano.
    //
    // 76 → 77 al añadir `superadmin/csp` (la observación de la política de
    // seguridad). Una ruta, un método, un `verificarSuperadmin`.
    // 81 → 82 al añadir `arco/cancelar` (la «C» de ARCO, que no tenía camino técnico).
    // 98 → 99 el 2026-08-09: `expediente/paquete-visita` (V9 · POSTVISIT-001). Es
    // el acto que faltaba para que el paquete de la visita llegue al paciente:
    // compone del expediente firmado y lo libera. `porAccion`, con el mapa en el
    // registro.
    expect(CLAVES_DISCO.length).toBe(99)   // +1 el 2026-08-04: `arco/oponerse` (la «O» de ARCO, que se «resolvía» con un prompt() y no apagaba el contacto); +1 el 2026-08-04: `superadmin/incidentes` (la franja que le avisa al dueño de una caída de IA donde esté, sin tener que abrir su tablero); +1 el 2026-08-03: `cron/asientos` (concilia el cobro por médico, que dependía de un botón); +1 `clinic/exportar-excel` (el libro con una pestaña por dominio); +1 el 2026-08-02: `calendar/ocupado` (freebusy de Google); +1 `seguridad/csp-estado` (¿se puede pasar la CSP a bloquear?); +1 el 2026-08-03: `cron/limpiar-audio` (el audio de consulta que quedaba en Storage)
  })
})

describe('E0-07 · toda ruta de API declara qué exige', () => {
  it('ninguna ruta en disco se queda sin entrada en REGISTRO_RUTAS', () => {
    const sinDeclarar = CLAVES_DISCO.filter(c => !entrada(c))
    expect(sinDeclarar, `rutas sin declarar: ${sinDeclarar.join(', ')}`).toEqual([])
  })

  it('no hay entradas zombis (declarar una ruta que ya no existe esconde el borrado)', () => {
    const enDisco = new Set(CLAVES_DISCO)
    const zombis = Object.keys(REGISTRO_RUTAS).filter(c => !enDisco.has(c))
    expect(zombis, `claves declaradas sin archivo: ${zombis.join(', ')}`).toEqual([])
  })

  it('toda exención trae MOTIVO no vacío: se puede eximir una ruta, pero no en silencio', () => {
    const mudas: string[] = []
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      if (!(TIPOS_CON_MOTIVO as readonly string[]).includes(e.tipo)) continue
      const motivo = (e as { motivo?: string }).motivo ?? ''
      if (motivo.trim().length < 20) mudas.push(`${clave} (${e.tipo})`)
    }
    expect(mudas, `exenciones sin motivo escrito: ${mudas.join(', ')}`).toEqual([])
  })

  it('toda ruta que espera una decisión del dueño dice QUÉ decisión espera', () => {
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      // Pendiente a nivel de ruta (tipos de un solo gate).
      const pendiente = (e as { activacionPendiente?: string }).activacionPendiente
      if (pendiente !== undefined) {
        expect(pendiente.trim().length, `${clave}: activacionPendiente vacío`).toBeGreaterThan(20)
        // Una espera solo tiene sentido si HAY una capacidad esperando.
        expect(capacidadesDeRuta(e).length, `${clave}: pendiente sin capacidad declarada`).toBeGreaterThan(0)
      }
      // Pendiente POR MÉTODO (rutas `porMetodo`): el método pendiente tiene que
      // existir en el mapa de capacidades, o el pendiente no gobierna nada.
      if (e.tipo !== 'porMetodo') continue
      for (const [m, texto] of Object.entries(e.pendientePorMetodo ?? {})) {
        expect(texto.trim().length, `${clave}#${m}: pendientePorMetodo vacío`).toBeGreaterThan(20)
        expect(e.metodos[m as Metodo], `${clave}#${m}: pendiente de un método que no declara capacidad`).toBeTruthy()
      }
    }
  })
})

describe('E0-07 · `verificarMedico` ya no existe bajo src/app/api', () => {
  it('CERO llamadas: el gate binario de rol quedó sustituido por capacidades', () => {
    const supervivientes = [...FUENTE].filter(([, src]) => /verificarMedico\s*\(/.test(src)).map(([c]) => c)
    expect(supervivientes, `rutas que siguen llamando a verificarMedico: ${supervivientes.join(', ')}`).toEqual([])
  })
})

describe('E0-07 · `verificarMiembro` solo donde está DECLARADO que sigue', () => {
  /**
   * `verificarMiembro` es el «any-member» de la unidad. No se puede borrar de golpe:
   * las rutas que lo conservan estrecharían el acceso de usuarios reales al migrar
   * (regla 5 de la carta operativa). Lo que este test impide es que siga siendo
   * IMPLÍCITO: cada llamada superviviente tiene que caer en un MÉTODO declarado como
   * pendiente (esperando una decisión del médico dueño) o en una ruta `porAccion`
   * (donde la membresía es solo el primer paso y la capacidad la impone
   * `exigeCapacidad`). Una ruta NUEVA con `verificarMiembro` y sin declarar → rojo.
   *
   * Se comprueba POR MÉTODO desde el lote de cierre: antes bastaba con que la RUTA
   * tuviera un pendiente, así que en `clinic/ai-keys` y `stripe/asientos` el
   * pendiente del GET cubría también al POST ya migrado (P1-3).
   */
  const CON_MIEMBRO = [...FUENTE].filter(([, src]) => /verificarMiembro\s*\(/.test(src)).map(([c]) => c).sort()

  it('cada llamada superviviente cae en un método pendiente o en el gateway porAccion', () => {
    const indebidos: string[] = []
    for (const clave of CON_MIEMBRO) {
      const e = entrada(clave)
      if (!e) { indebidos.push(`${clave}: sin declarar`); continue }
      if (e.tipo === 'porAccion') continue
      const a = ANALISIS.get(clave)!
      for (const m of a.metodosExportados) {
        const tieneMiembro = segmento(clave, m).some(l => l.guardia === 'verificarMiembro')
        if (!tieneMiembro) continue
        if (pendienteDe(e, m) === null) indebidos.push(`${clave}#${m}`)
      }
    }
    expect(indebidos, `any-member NO declarado: ${indebidos.join(', ')}`).toEqual([])
  })

  it('la lista de supervivientes está CONGELADA (bajar una ruta a any-member se ve)', () => {
    expect(CON_MIEMBRO).toEqual([
      'appointments',
      'calendar/sync',
      'clinic/ai-keys',
      'clinic/miembros',
      // `facturacion/descargar` SALIÓ el 2026-08-01: su capacidad `facturar` ya
      // estaba declarada y sólo esperaba la respuesta del dueño a «¿la asistente
      // descarga CFDI o sólo cobra?». Respondida (sí factura), se activó el
      // guard: enfermería, farmacia y laboratorio dejan de poder bajarse las
      // facturas del consultorio. Otro ESTRECHAMIENTO.
      /**
       * V9 · POSTVISIT-001. Gateway `porAccion`, igual que `hospital/mutar`: la
       * membresía es sólo el primer paso y la capacidad la impone
       * `exigeCapacidad` con el mapa del registro (`clinico.leer` para
       * previsualizar, `firmar` para liberar). Aparece aquí porque llama a
       * `verificarMiembro`, no porque sea any-member.
       */
      'expediente/paquete-visita',
      'facturacion/pagos',
      'hl7/convertir',
      'hospital/mutar',
      'portal/link',
      'stripe/asientos',
      // `telesalud/sala` SALIÓ de esta lista el 2026-08-01: el dueño confirmó que
      // el mostrador NO entra a la sala de video, así que la rama del equipo pasó
      // de `verificarMiembro` (cualquier miembro) a `clinico.leer`. Es un
      // ESTRECHAMIENTO, que es la dirección que esta prueba quiere proteger.
      'whatsapp/entregas',
      'whatsapp/waitlist-notify',
    ])
  })
})

describe('E0-07 · el registro no puede MENTIR sobre el código (por MÉTODO y por ARGUMENTO)', () => {
  /**
   * ESTE BLOQUE ES EL CIERRE DE LA UNIDAD. La primera versión comprobaba que la ruta
   * LLAMARA a `verificarCapacidad(`, nunca CON QUÉ capacidad, y la verificación
   * adversarial lo rompió con cinco sabotajes que dejaban 2663 tests en verde:
   *   · `stripe/portal` 'administrar' → 'auditoria.registrar' (la tienen los 8 roles:
   *     un `laboratorio` abría el portal de facturación),
   *   · `telesalud/token` y `fhir/paciente/[patientId]` 'clinico.escribir' →
   *     'clinico.leer' (staff hospitalario emitiendo tokens de alcance clínico y
   *     exportando el expediente íntegro),
   *   · el POST de `clinic/ai-keys` y de `stripe/asientos` de vuelta a
   *     `verificarMiembro` (escalada sobre las llaves de IA del tenant), invisible
   *     porque el pendiente vivía a nivel de RUTA y apagaba los dos métodos.
   * Ahora la comprobación es: para cada par (ruta, método), la capacidad que corre en
   * el código tiene que ser EXACTAMENTE la declarada.
   */

  it('la capacidad del CÓDIGO es la DECLARADA, método por método', () => {
    const divergentes: string[] = []
    for (const { clave, metodo, e } of paresConCapacidad()) {
      if (!activaEnCodigoMetodo(e, metodo)) continue
      const esperada = capacidadEsperada(e, metodo)!
      const seg = segmento(clave, metodo)
      const exigen = seg.filter(l => l.guardia === 'verificarCapacidad' || l.guardia === 'verificarModuloYCapacidad')
      if (exigen.length === 0) {
        divergentes.push(`${clave}#${metodo}: declara '${esperada}' y no llama a verificarCapacidad`)
        continue
      }
      const coincide = exigen.some(l => l.literales.includes(esperada))
      if (!coincide) {
        const vistos = exigen.flatMap(l => l.literales).join('|') || '(ninguno)'
        divergentes.push(`${clave}#${metodo}: declara '${esperada}' pero el código exige '${vistos}'`)
      }
    }
    expect(divergentes, `el código no exige lo que el registro declara:\n${divergentes.join('\n')}`).toEqual([])
  })

  it('un método ya migrado NO puede caer a any-member', () => {
    // Cierra P1-3: el POST de `clinic/ai-keys` (que ESCRIBE las llaves de IA del
    // consultorio) y el de `stripe/asientos` podían volver a `verificarMiembro` en
    // verde porque el pendiente del GET apagaba la comprobación de los dos.
    const degradados: string[] = []
    for (const { clave, metodo, e } of paresConCapacidad()) {
      if (!activaEnCodigoMetodo(e, metodo)) continue
      const debiles = segmento(clave, metodo)
        .filter(l => l.guardia === 'verificarMiembro' || l.guardia === 'verificarMedico')
        .map(l => l.guardia)
      if (debiles.length) degradados.push(`${clave}#${metodo}: ${debiles.join('/')}`)
    }
    expect(degradados, `métodos migrados que volvieron al gate binario: ${degradados.join(', ')}`).toEqual([])
  })

  it('un método PENDIENTE conserva de verdad el guardián viejo, y dice qué decisión espera', () => {
    // Impide que el pendiente sea una escotilla para dejar un método sin guardia
    // alguna «hasta que el Dr. decida».
    const huecos: string[] = []
    for (const { clave, metodo, e } of paresConCapacidad()) {
      const pendiente = pendienteDe(e, metodo)
      if (pendiente === null) continue
      if (pendiente.trim().length < 20) huecos.push(`${clave}#${metodo}: motivo del pendiente demasiado corto`)
      const seg = segmento(clave, metodo)
      const conViejo = seg.some(l => l.guardia === 'verificarMiembro' || l.guardia === 'verificarModuloIA')
      if (!conViejo) huecos.push(`${clave}#${metodo}: pendiente SIN guardián (${seg.map(l => l.guardia).join('/') || 'ninguno'})`)
    }
    expect(huecos, `pendientes mal declarados:\n${huecos.join('\n')}`).toEqual([])
  })

  it('`entitlementIA` exige el MÓDULO declarado, no otro', () => {
    // Una ruta de UCI que declarara el módulo `expediente` (o al revés) se pone roja:
    // el entitlement de plan y la ruta tienen que hablar del mismo módulo.
    const desajustes: string[] = []
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      if (e.tipo !== 'entitlementIA') continue
      const llamadas = (ANALISIS.get(clave)?.llamadas ?? [])
        .filter(l => l.guardia === 'verificarModuloIA' || l.guardia === 'verificarModuloYCapacidad')
      if (llamadas.length === 0) { desajustes.push(`${clave}: sin entitlement de módulo`); continue }
      for (const l of llamadas) {
        if (!l.literales.includes(e.modulo)) {
          desajustes.push(`${clave}: declara módulo '${e.modulo}' y el código pide '${l.literales.join('|') || '(no literal)'}'`)
        }
      }
    }
    expect(desajustes, `módulo declarado ≠ módulo exigido:\n${desajustes.join('\n')}`).toEqual([])
  })

  it('sin literal no pasa: la única capacidad dinámica es la del gateway `porAccion`', () => {
    const opacas: string[] = []
    for (const [clave, a] of ANALISIS) {
      const e = entrada(clave)
      for (const l of a.llamadas) {
        if (!l.argumentoNoLiteral) continue
        // Exención NOMBRADA: en `hospital/mutar` la capacidad TIENE que ser dinámica
        // (depende de la acción del body). Ahí la garantía es otra, y más fuerte: el
        // mapa acción→capacidad vive en el registro, no en la ruta.
        if (l.guardia === 'exigeCapacidad' && e?.tipo === 'porAccion') continue
        opacas.push(`${clave}: ${l.guardia} con capacidad/módulo no literal`)
      }
    }
    expect(opacas, `capacidades imposibles de auditar:\n${opacas.join('\n')}`).toEqual([])
  })

  it('el gateway `porAccion` impone la capacidad por acción con exigeCapacidad, y NO tiene mapa propio', () => {
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      if (e.tipo !== 'porAccion') continue
      const src = FUENTE.get(clave) ?? ''
      expect(src, clave).toMatch(/exigeCapacidad\s*\(/)
      // La regresión concreta a impedir: que el mapa acción→rol vuelva al archivo de
      // la ruta y se separe del registro, que es de donde E0-07 lo sacó.
      /**
       * El mapa acción→capacidad se IMPORTA del registro. Antes se exigía por
       * nombre (`ACCIONES_HOSPITAL_MUTAR`), que valía mientras hubo un solo
       * gateway; con el segundo (`expediente/paquete-visita`) el nombre concreto
       * dejaba fuera al nuevo. Se exige la propiedad, que es la que importa:
       * un `ACCIONES_*` que venga del registro y ningún mapa local.
       */
      expect(src, `${clave} importa el mapa del registro`)
        .toMatch(/import\s*\{[^}]*ACCIONES_[A-Z_]+[^}]*\}\s*from\s*'@\/lib\/authz\/registro-rutas'/)
      expect(src, `${clave}: reapareció un mapa de gates propio en la ruta`).not.toMatch(/const\s+GATES\b/)
    }
  })

  it('ninguna llamada a guardián vive fuera de un handler exportado', () => {
    // Si alguien mueve el guardián a un helper compartido del archivo, la atribución
    // por método deja de ser fiable: se decide a mano, no se descubre con un falso
    // verde. Hoy son 0 de 74 llamadas.
    const fuera = [...ANALISIS]
      .filter(([, a]) => a.compartidas.length > 0)
      .map(([c, a]) => `${c}: ${a.compartidas.map(l => l.guardia).join('/')}`)
    expect(fuera, `guardianes fuera del handler: ${fuera.join(', ')}`).toEqual([])
  })

  it('el ANALIZADOR no pasa por vacío (si se rompe, todo lo de arriba pasaría sin comprobar nada)', () => {
    const llamadas = [...ANALISIS].flatMap(([, a]) => a.llamadas)
    const rutasConGuardia = [...ANALISIS].filter(([, a]) => a.llamadas.length > 0).length
    const conVocabulario = llamadas.filter(l =>
      l.guardia === 'verificarCapacidad' || l.guardia === 'verificarModuloIA' ||
      l.guardia === 'verificarModuloYCapacidad' || l.guardia === 'exigeCapacidad').length
    // Cifras observadas hoy sobre las 75 rutas. Si cambian es porque se añadió o
    // quitó una guardia: hay que revisarlo a mano, no ajustar el número a ciegas.
    //
    // 74 → 76 llamadas al añadir `uci/estancia`: son DOS, una por método (GET con
    // `clinico.leer`, POST con `clinico.escribir`), no una ruta sin guardia.
    //
    // 76 → 77 y 62 → 63 al añadir `superadmin/costos`: UNA ruta con UNA llamada
    // (`verificarSuperadmin` en su GET). Las dos cifras suben en uno, que es lo
    // que tenía que pasar; si sólo hubiera subido la de llamadas, querría decir
    // que una ruta se quedó sin guardián.
    // 77 → 78 y 63 → 64 al añadir `superadmin/csp`: igual que `superadmin/costos`,
    // UNA ruta con UNA llamada. Las dos cifras suben en uno — si sólo subiera la
    // de llamadas, querría decir que una ruta se quedó sin guardián.
    //
    // 78 → 79 al añadir `planes` (el catálogo público de precios).
    //
    // 78 → 80 y 64 → 65 al añadir `superadmin/planes`: aquí las llamadas suben
    // DOS y las rutas UNA, y está bien — la ruta tiene GET y PUT, y cada método
    // lleva su `verificarSuperadmin`. Lo que sería alarmante es lo contrario:
    // una ruta con dos métodos y un solo guardián significa que uno de los dos
    // entra sin comprobar nada.
    // 80 → 81 y 65 → 66 al añadir `superadmin/onboarding`: una ruta, un GET.
    // 81 → 83 y 66 → 67 al añadir `superadmin/simulador`: GET y PUT, cada uno
    // con su guardián.
    // 83 → 84: `arco/cancelar` con su único POST y su guardián.
    // 93 → 94 el 2026-08-03: `superadmin/costos` estrenó POST (registrar el
    // abono a un proveedor de IA) y trae SU PROPIO `verificarSuperadmin`. Las
    // rutas con guardián NO suben porque la ruta ya estaba contada — el par
    // correcto es exactamente éste. Si hubiera subido la ruta y no la llamada,
    // o hubiera entrado el POST sin llamada, el POST que mueve dinero estaría
    // abierto.
    // 96 → 98 y 79 → 80 el 2026-08-09 al añadir `expediente/paquete-visita`: UNA
    // ruta con DOS llamadas (`verificarMiembro` para la membresía y
    // `exigeCapacidad` para la capacidad por acción), que es la forma del
    // gateway `porAccion` — la misma que `hospital/mutar`.
    expect(llamadas.length).toBe(98)   // +1 el 2026-08-04: `arco/oponerse`   // +1 el 2026-08-04: `superadmin/incidentes`   // +1 el 2026-08-03: `clinic/exportar-excel`; +1 el 2026-08-02: `calendar/ocupado`; +1 `seguridad/csp-estado`
    expect(rutasConGuardia).toBe(80)   // +1 el 2026-08-04: `arco/oponerse`   // +1 el 2026-08-04: `superadmin/incidentes`   // +1 el 2026-08-03: `clinic/exportar-excel`; +1 el 2026-08-02: `calendar/ocupado`; +1 `seguridad/csp-estado`
    // 40 → 42 el 2026-08-01: `telesalud/sala` y `facturacion/descargar` pasaron
    // de `verificarMiembro` a `verificarCapacidad`, así que ahora usan el
    // vocabulario de capacidades. Dos activaciones que ESTRECHAN.
    expect(conVocabulario).toBe(54)   // +1 el 2026-08-09 `expediente/paquete-visita` (exigeCapacidad); +1 el 2026-08-04: `arco/oponerse`; +1 el 2026-08-03: `clinic/exportar-excel`; +1 el 2026-08-02: `calendar/ocupado`; +1 `seguridad/csp-estado`
  })

  it('el avance se cuenta DEL REGISTRO, no de la prosa del expediente', () => {
    // El expediente llegó a decir «26 rutas pendientes» cuando eran 28 (P3-1). Este
    // número se calcula: pares (ruta, método) que declaran capacidad.
    // `uci/estancia` suma 2 declarados y 2 ACTIVOS: nace llamando a
    // `verificarCapacidad` en el código, no en la cola de activación pendiente.
    // 2026-08-01: dos activaciones (telesalud/sala y facturacion/descargar) al
    // resolver el dueño quién entra a la sala y quién descarga CFDI.
    expect(resumenActivacion(METODOS_POR_RUTA)).toEqual({
      declarados: 62, activos: 35, pendientes: 27,   // +1 el 2026-08-04 `arco/oponerse`: nace ACTIVA (verificarCapacidad 'administrar', sin pendiente). +1 el 2026-08-03 `clinic/exportar-excel`: nace ACTIVA (verificarCapacidad, sin pendiente). +1 `calendar/ocupado` y +1 `seguridad/csp-estado`: los dos nacen ACTIVOS (verificarCapacidad, sin pendiente)
    })
    // 29 PARES = 28 RUTAS distintas: `expediente/transcribir-diarizado` exporta GET y
    // POST y los dos siguen en `verificarModuloIA`. Ésa es la cifra del verificador.
    const rutasPendientes = new Set(
      paresConCapacidad().filter(({ e, metodo }) => !activaEnCodigoMetodo(e, metodo)).map(p => p.clave),
    )
    expect(rutasPendientes.size).toBe(26)
  })

  it('cada tipo de exención se corresponde con el guardián que dice usar', () => {
    const desajustes: string[] = []
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      const src = FUENTE.get(clave) ?? ''
      if (e.tipo === 'superadmin' && !/verificarSuperadmin\s*\(/.test(src)) desajustes.push(`${clave}: sin verificarSuperadmin`)
      if (e.tipo === 'sesion' && !/verificarUsuario\s*\(/.test(src)) desajustes.push(`${clave}: sin verificarUsuario`)
      if (e.tipo === 'tokenPaciente' && !/verificarTokenPaciente\s*\(/.test(src)) desajustes.push(`${clave}: sin verificarTokenPaciente`)
      if (e.tipo === 'entitlementIA' && !/verificarModulo(IA|YCapacidad)\s*\(/.test(src)) desajustes.push(`${clave}: sin entitlement de módulo`)
    }
    expect(desajustes).toEqual([])
  })

  it('las rutas SIN guardián de sesión son exactamente las 14 declaradas públicas/webhook/cron', () => {
    const GUARDIANES = /verificar(Usuario|Miembro|Medico|Capacidad|ModuloIA|ModuloYCapacidad|Superadmin|TokenPaciente)\s*\(/
    const sinGuardia = [...FUENTE].filter(([, src]) => !GUARDIANES.test(src)).map(([c]) => c).sort()
    const exentas = new Set(['publica', 'webhook', 'cron'])
    for (const c of sinGuardia) {
      const e = entrada(c)
      expect(e, `${c} no está declarada`).toBeTruthy()
      expect(exentas, `${c} no tiene guardián y NO está declarada como exenta (${e!.tipo})`).toContain(e!.tipo)
    }
    /**
     * Congelado: si aparece una 15.ª ruta sin guardián, hay que justificarla a mano.
     *
     * 13 → 14 al añadir `planes`: el catálogo de precios vigente. Es público
     * porque un precio de lista no es un secreto —está impreso en /precios y se
     * le dice a quien pregunte— y porque la página pública y el gate de pago lo
     * necesitan sin sesión. Sólo devuelve nombre, precio y créditos; nada de
     * `modulos` ni `nivelIA`, que son permisos.
     */
    /**
     * 14 → 15 al añadir `cron/limpiar-audio`. No lleva guardián de SESIÓN porque
     * no hay usuario: lo dispara Vercel. Su candado es el mismo `CRON_SECRET`
     * fail-closed del otro cron — sin él, en producción, no corre. Y es un
     * endpoint que BORRA, así que quedarse abierto no era una opción.
     */
    expect(sinGuardia).toEqual([
      'calendar/callback',
      /**
       * Concilia el cobro por asiento de todos los consultorios. Mismo
       * `CRON_SECRET` fail-closed, y por una razón más fuerte todavía: un
       * endpoint que MUEVE DINERO no puede quedar abierto.
       */
      'cron/asientos',
      'cron/limpiar-audio',
      'cron/reminders',
      /**
       * Barre las colecciones OPERATIVAS de plataforma que crecen sin techo.
       * Nada clínico —eso lo fija la NOM-004 y el abogado, no un cron— y con el
       * mismo `CRON_SECRET` fail-closed: un endpoint que BORRA no queda abierto.
       */
      'cron/retencion',

      /**
       * 15 → 16 al añadir `cron/vigilante`: mira los latidos de los otros crons
       * y avisa. No lleva guardián de SESIÓN porque no hay usuario —lo dispara
       * Vercel— y su candado es el mismo `CRON_SECRET` fail-closed.
       */
      'cron/vigilante',
      'csp-report',
      'demo/evidencia',
      /**
       * 16 → 17 con `health`: el estado del sistema para un monitor externo.
       * Sin sesión A PROPÓSITO —un endpoint de salud detrás de login no lo mira
       * nadie a las 3am— y sólo devuelve booleanos, latencias y la versión.
       */
      'health',
      'planes',
      'public/availability/[clinicId]',
      'public/booking',
      'public/clinic/[clinicId]',
      'public/resena',
      'receta/diseno',
      'stripe/webhook',
      'whatsapp/360dialog-callback',
      'whatsapp/360dialog-webhook',
      'whatsapp/webhook',
    ])
  })
})

describe('E0-07 · propiedad heredada de E0-06, ahora expresada en capacidades', () => {
  /**
   * E0-06 exigía que ninguna ruta que lea una colección clínica se conformara con
   * `verificarMiembro`, y lo comprobaba buscando la CADENA `verificarMedico` en el
   * archivo. Esa señal desaparece al migrar a capacidades, así que la propiedad se
   * re-expresa —y queda MÁS FUERTE—: la ruta tiene que DECLARAR una capacidad cuyo
   * conjunto de roles no incluya a ningún rol no clínico, y el test de arriba
   * comprueba además que el código coincide con la declaración.
   */
  it('leer PHI clínico exige una capacidad que excluye a los roles no clínicos', () => {
    const infractoras: string[] = []
    for (const [clave, src] of FUENTE_CON_LIBS) {
      const leeClinico = leePhiClinico(src)
      if (!leeClinico) continue
      const e = entrada(clave)
      if (!e) { infractoras.push(`${clave}: sin declarar`); continue }
      // El token del PACIENTE es vía legítima: desde E0-06 lleva alcance y la ruta
      // lo comprueba en el handler.
      if (e.tipo === 'tokenPaciente') continue
      const caps = capacidadesDeRuta(e)
      if (caps.length === 0) { infractoras.push(`${clave}: sin capacidad`); continue }
      for (const cap of caps) {
        const fuga = rolesCon(cap).filter(r => ROLES_NO_CLINICOS.includes(r))
        if (fuga.length) infractoras.push(`${clave}: ${cap} alcanza a ${fuga.join('/')}`)
      }
    }
    expect(infractoras, `PHI clínico bajo capacidad insuficiente: ${infractoras.join(', ')}`).toEqual([])
  })

  it('el control de que la comprobación anterior NO pasa por vacío', () => {
    // Si el walker o el filtro se rompen, la lista de rutas que leen PHI clínico
    // queda vacía y el test de arriba pasa sin comprobar nada. Con `internamientos`
    // en la señal (P3-2) son 3, no 2; `uci/estancia` es la cuarta — lee y escribe
    // la estancia bajo `internamientos`, y está bajo capacidad clínica.
    const conPHI = [...FUENTE_CON_LIBS].filter(([, src]) => leePhiClinico(src)).map(([c]) => c).sort()
    // `arco/cancelar` entra a la lista: para decidir si un expediente se suprime
    // o sólo se bloquea tiene que CONTAR las notas firmadas. Es lectura de PHI
    // clínico, y está bajo `administrar`.
    // `expediente/paquete-visita` entra: lee la nota FIRMADA para componer lo que
    // el paciente va a leer, y la nota anterior para saber qué cambió de su
    // medicación. Es lectura de PHI clínico, y va bajo `clinico.leer` para
    // previsualizar y `firmar` para liberar.
    expect(conPHI).toEqual(['arco/acceso', 'arco/cancelar', 'clinic/exportar', 'clinic/importar', 'expediente/exportar/[patientId]', 'expediente/paquete-visita', 'fhir/paciente/[patientId]', 'hospital/mutar', 'portal', 'uci/estancia'])
  })

  it('las rutas que tocan la IDENTIDAD del paciente están congeladas (segundo nivel de PHI)', () => {
    // No es una regla de capacidad: `public/booking` y `whatsapp/webhook` son sin
    // sesión por diseño y una regla ciega daría rojo por lo correcto. Lo que impide
    // este congelado es que una ruta NUEVA empiece a leer `patients` sin que nadie
    // lo mire.
    const conPaciente = [...FUENTE_CON_LIBS].filter(([, src]) =>
      COLECCIONES_PACIENTE.some(c => src.includes(`collection('${c}')`))).map(([c]) => c).sort()
    expect(conPaciente).toEqual([
      /**
       * Entrega el expediente al TITULAR que lo pidió (LFPDPPP Art. 28-32).
       * Toca su identidad por definición, y va bajo `administrar`: entregar
       * datos a un tercero —aunque sea su dueño— es una decisión del
       * responsable del tratamiento, no un acto clínico.
       */
      'arco/acceso',
      // Toca la identidad porque la SUPRIME o la bloquea: es su razón de ser.
      'arco/cancelar',
      /**
       * La «O» de ARCO: lee el teléfono del titular para darlo de baja del
       * contacto proactivo. Toca identidad, y va bajo `administrar` como sus
       * hermanas — decidir para qué dejan de usarse los datos de alguien es del
       * responsable del tratamiento, no del mostrador.
       */
      'arco/oponerse',
      /**
       * Restaura el consultorio entero desde un respaldo: reescribe pacientes
       * por definición. Es la operación más destructiva después de la supresión
       * ARCO, y por eso va bajo `administrar` con doble candado (consultorio
       * vacío, o `sobrescribir` pedido a propósito).
       */
      /**
       * Vuelca diagnósticos y medicamentos de TODOS los pacientes en CSV, para
       * que el médico pueda leerlos, contarlos o llevárselos. Va con
       * `clinico.escribir`: el permiso de mostrador no alcanza ni para «sólo
       * exportar».
       */
      'clinic/exportar-csv',
      /**
       * El mismo volcado, en un libro de Excel con una pestaña por dominio.
       * Comparte capacidad con el CSV a propósito.
       */
      'clinic/exportar-excel',
      'clinic/importar',
      /**
       * Entrega el expediente COMPLETO a quien tiene derecho a él: por
       * definición toca la identidad y todo lo clínico. Va con
       * `clinico.escribir` —no con el permiso de mostrador— porque baja
       * diagnósticos, medicamentos y alergias, que NOM-004 reserva al médico.
       */
      'expediente/exportar/[patientId]',
      /**
       * Compone el paquete que el paciente leerá y lo libera. Toca `patients`
       * porque de ahí cuelgan sus notas firmadas y sus paquetes; no lee ni
       * escribe su identidad —ni nombre, ni teléfono, ni CURP—, sólo baja por
       * la ruta del documento hasta las subcolecciones clínicas.
       */
      'expediente/paquete-visita',
      'fhir/paciente/[patientId]',
      'mantenimiento/backfill-contadores',
      'portal',
      // +1 el 2026-08-02: emite el enlace con la VERSIÓN del paciente, para que
      // una revocación posterior lo tumbe. Lee `portalTokenVersion` y nada más
      // — ni nombre, ni teléfono, ni un solo dato clínico.
      'portal/link',
      'public/booking',
      'telesalud/token',
      'whatsapp/webhook',
    ])
  })
})
