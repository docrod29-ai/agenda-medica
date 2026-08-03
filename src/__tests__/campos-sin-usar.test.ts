/**
 * GUARDIÁN — un campo declarado y que nadie usa es una promesa del modelo.
 *
 * ── POR QUÉ EXISTE ESTE ARCHIVO ──────────────────────────────────────────────
 *
 * El guardián de módulos huérfanos (`modulos-sin-conectar.test.ts`) vigila el
 * código escrito y sin conectar. Éste vigila lo mismo **un nivel más abajo**: el
 * campo declarado en un tipo que nadie escribe ni lee.
 *
 * No es documentación inofensiva. Un tipo es lo que la aplicación dice de sí
 * misma, y quien lo lee actúa en consecuencia:
 *
 *  · `AuditLog.oldValue` / `newValue` prometían una bitácora con el ANTES y el
 *    DESPUÉS de cada cambio. La bitácora real no guarda nada de eso, y
 *    `createAuditLog` —lo único que usaba ese tipo— se había borrado. Ante una
 *    revisión, «el expediente registra el valor anterior» es una afirmación
 *    falsa que estaba escrita en el modelo.
 *  · `NotaMedica.hospital` llevaba SELLADO en el hash de integridad desde que
 *    existe el módulo de hospitalización y nadie lo escribía: se sellaba un
 *    hueco (reparado en v941).
 *  · `ClinicConfig.whatsappProveedor` era un segundo sitio donde declarar el
 *    proveedor. Dos campos para lo mismo es una invitación a que uno diga
 *    «meta» y el otro «360dialog» sin que nadie sepa cuál manda.
 *
 * ── POR QUÉ ES UN TRINQUETE ──────────────────────────────────────────────────
 *
 * Quedan campos legítimos: trabajo por fases cuyo consumidor todavía no llegó, y
 * datos que el modelo declara para un tercero. Se CONGELAN con su nombre y su
 * razón: uno nuevo pone el CI en rojo, y quitar uno obliga a bajar la lista. La
 * deuda queda declarada, no escondida.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Campos declarados que hoy no usa nadie, con la razón por la que se quedan.
 *
 * Para quitar uno de aquí: úsalo, o bórralo del tipo. Para añadir uno: que sea a
 * conciencia, porque el modelo estará prometiendo algo que la aplicación no hace.
 */
const CAMPOS_ACEPTADOS: Record<string, string> = {
  // ── Bloque de UCI del loop icu-002 (DATA_MODEL), fase por fase ───────────
  // El modelo se escribió entero en su iteración; las fases que lo consumen
  // (icu-003 en adelante) no han llegado. Es trabajo por fases DECLARADO, no
  // olvidado: la bitácora del loop de UCI lo dice y el Dr. lo pidió así.
  'ICUObservation.encounterId': 'Modelo de observación de UCI (icu-002). La fase que lo consume, icu-003 VOICE_CAPTURE, no ha llegado.',
  'ICUObservation.conceptCode': 'Del mismo bloque icu-002: el código estándar de la observación.',
  'ICUObservation.normalizedUnit': 'Del mismo bloque icu-002: la unidad normalizada de la observación.',
  'ICUObservation.effectiveAt': 'Del mismo bloque icu-002: cuándo fue cierta la observación, que no es cuándo se dictó.',
  'ICUObservation.sourceTranscriptRange': 'Del mismo bloque icu-002: el trozo de dictado del que salió, para poder comprobarlo.',
  'ICUObservation.confirmedByPhysician': 'Del mismo bloque icu-002: el visto bueno humano, que el motor NUNCA pone solo.',
  'TranscriptRange.startMs': 'Del mismo bloque icu-002: dónde empieza la cita dentro del audio.',
  'TranscriptRange.endMs': 'Del mismo bloque icu-002: dónde termina.',

  // ── Campos del expediente sin captura todavía ────────────────────────────
  'Diagnostico.fechaDiagnostico': 'Cuándo se hizo el diagnóstico. Ninguna pantalla lo pregunta y el impreso no lo enseña; ponerlo por defecto a la fecha de la nota sería inventar la fecha de un diagnóstico que puede ser de hace años.',
  'Medicamento.instruccionesEspeciales': 'Indicaciones adicionales de un medicamento. Ninguna pantalla lo captura, así que la receta no puede imprimir lo que nadie escribe. Pendiente de una casilla en el recetario.',

  // ── Modelo de evidencia, escrito para más fuentes de las que hay ─────────
  'Poblacion.criteriosInclusion': 'Estructura PICO completa: el extractor de hoy no separa criterios de inclusión del resumen.',
  'Poblacion.criteriosExclusion': 'Ídem: los criterios de exclusión del estudio, que el extractor de hoy tampoco separa.',

  // ── Metadato de un catálogo ──────────────────────────────────────────────
  'FactorMolar.usadoTambienEn': 'Metadato del catálogo de factores molares: dice en qué otros analitos aplica el mismo factor. Documental, para quien mantenga la tabla.',
  'FactorMolar.factorMgDlAMicromolL': 'La conversión en micromoles del mismo catálogo. Su prueba la comprueba analito por analito; ninguna pantalla convierte todavía a esa unidad.',

  // ── Modelos cuyo consumidor de hoy es el arnés, no una pantalla ──────────
  // Son contratos: se escribieron enteros y sus pruebas los ejercitan campo por
  // campo. Eso NO los convierte en usados —una prueba no es un consumidor—,
  // pero tampoco son un descuido. Van aquí para que se vea la diferencia.
  'Claim.apoyos': 'Modelo de evidencia (E2): los pasajes que sostienen una afirmación. El Consultor todavía no arma sus respuestas con esta estructura.',
  'Passage.sourceId': 'Del mismo modelo de evidencia: de qué fuente salió el pasaje, para poder comprobar la cita.',
  'Efecto.citaLiteral': 'Del mismo modelo: la cifra TAL CUAL aparece en el texto, que es lo que permite rechazar una cifra no literal.',
  'Efecto.ic95': 'Del mismo modelo: el intervalo de confianza del efecto.',
  'ICUObservation.normalizedValue': 'Del bloque icu-002: el valor normalizado, lo único que un motor puede usar para calcular.',
  'ResumenClinicoPaciente.notasClinicas': 'Documento de PHI separada (E0-06). El expediente todavía guarda estos campos en `patients/{id}`, que recepción lee; la migración es la que falta, y el propio tipo lo dice.',
}

const CODIGO = ['.ts', '.tsx']

function archivos(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { out.push(...archivos(p)); continue }
    if (CODIGO.some(x => e.endsWith(x)) && !e.endsWith('.d.ts')) out.push(p)
  }
  return out
}

/**
 * Sólo `export interface X {`.
 *
 * La primera versión aceptaba también `export type`, y entonces el `Record` que
 * venía después —`SOPORTE_LABEL`, con una clave por modalidad de soporte
 * vital— se leía como si sus claves fueran campos del tipo anterior: seis
 * falsos positivos que decían que la UCI no podía registrar ventilación no
 * invasiva. Un guardián que grita donde no hay nada acaba ignorándose.
 */
const CABECERA = /^export interface ([A-Za-z0-9_]+)[^=]*\{\s*$/
const CAMPO = /^\s{2}(?:readonly\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\??:\s/

interface Declarado { campo: string; tipo: string; archivo: string; linea: number }

function declarados(): Declarado[] {
  const out: Declarado[] = []
  for (const t of archivos('src/types')) {
    const rel = relative('.', t)
    let dentro: string | null = null
    readFileSync(t, 'utf8').split('\n').forEach((l, i) => {
      const m = CABECERA.exec(l)
      if (m) { dentro = m[1]; return }
      if (/^\}/.test(l)) { dentro = null; return }
      const c = CAMPO.exec(l)
      if (c && dentro) out.push({ campo: c[1], tipo: dentro, archivo: rel, linea: i + 1 })
    })
  }
  return out
}

const FUENTES = [...archivos('src'), ...archivos('scripts').filter(f => CODIGO.some(x => f.endsWith(x)))]
  .map(f => ({ f: relative('.', f), src: readFileSync(f, 'utf8') }))
  /**
   * No cuentan como uso ni los propios tipos —declararse a sí mismo no es
   * usarse— ni las pruebas. Lo segundo importa el doble aquí: la lista de
   * aceptados de este archivo NOMBRA cada campo, así que sin esta exclusión el
   * guardián se leería a sí mismo y daría todo por usado. Un guardián que se
   * cuenta a sí mismo siempre pasa.
   */
  .filter(({ f }) => !f.startsWith('src/types') && !f.includes('__tests__'))

function sinUsar(): string[] {
  return declarados()
    .filter(d => !FUENTES.some(({ src }) => new RegExp(`\\b${d.campo}\\b`).test(src)))
    .map(d => `${d.tipo}.${d.campo}`)
    .sort()
}

describe('Ningún campo del modelo promete lo que la aplicación no hace', () => {
  const actuales = sinUsar()

  it('el guardián lee tipos de verdad (si no, pasaría vacío)', () => {
    expect(declarados().length).toBeGreaterThan(400)
  })

  it('no hay ningún campo declarado y sin usar que sea NUEVO', () => {
    /**
     * Si esto se pone rojo: o lo usas, o lo borras del tipo, o lo añades a
     * `CAMPOS_ACEPTADOS` con su razón. Lo tercero es una decisión, no un
     * trámite — el modelo es lo que la aplicación dice de sí misma.
     */
    const nuevos = actuales.filter(c => !(c in CAMPOS_ACEPTADOS))
    expect(nuevos, `declarados y sin usar: ${nuevos.join(', ')}`).toEqual([])
  })

  it('y la lista de aceptados no guarda fantasmas', () => {
    const fantasmas = Object.keys(CAMPOS_ACEPTADOS).filter(c => !actuales.includes(c))
    expect(fantasmas, `ya se usan (o se borraron), quítalos: ${fantasmas.join(', ')}`).toEqual([])
  })

  it('cada aceptado dice POR QUÉ sigue ahí', () => {
    for (const [c, razon] of Object.entries(CAMPOS_ACEPTADOS)) {
      expect(razon.length, c).toBeGreaterThan(30)
    }
  })
})

describe('lo que se borró en v942, y no vuelve', () => {
  const tipos = readFileSync(join(process.cwd(), 'src', 'types', 'index.ts'), 'utf8')
  const codigo = tipos.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

  it('`AuditLog` describía una bitácora que no existe', () => {
    /**
     * Prometía `oldValue` y `newValue`: el antes y el después de cada cambio.
     * La bitácora real (`lib/expediente/audit-log.ts`) no guarda eso, y
     * `createAuditLog` —lo único que usaba el tipo— se había borrado.
     */
    expect(codigo).not.toContain('export interface AuditLog {')
    expect(tipos).toContain('describían otra aplicación'.toUpperCase())
  })

  it('`NotificationLog` tampoco: la entrega se registra con otra forma', () => {
    expect(codigo).not.toContain('export interface NotificationLog {')
  })

  it('`DashboardStats` no lo calculaba ninguna pantalla', () => {
    expect(codigo).not.toContain('export interface DashboardStats {')
  })

  it('`whatsappProveedor` era un segundo sitio para lo mismo', () => {
    // El que de verdad se lee es `ClinicWhatsApp.provider`.
    expect(codigo).not.toContain('whatsappProveedor')
    expect(codigo).toContain("provider: '360dialog' | 'meta' | 'none'")
  })

  it('y el valor por defecto de la config ya no lo lleva', () => {
    // Un `DEFAULT_CONFIG` con un campo que el tipo no tiene no compila; esto
    // deja constancia de que se quitó de los dos sitios.
    expect(codigo).not.toContain("whatsappProveedor: ''")
  })
})
