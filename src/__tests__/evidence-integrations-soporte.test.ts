/**
 * GOLDEN — corrección de cita, respaldo fabricado y afirmación sin anclar (#314).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `claimDesde` (E2-01) ya rechaza una afirmación sin pasaje. Pero es
 * TODO-O-NADA POR AFIRMACIÓN, y una síntesis trae varias. Nada en el repo
 * representaba «tres respaldadas y una no», así que el llamador sólo podía
 * quedarse con las buenas y tirar la mala — el mismo descarte silencioso de
 * consulta/page.tsx:2698, un nivel más arriba.
 *
 * Y faltaba una comprobación que E2-01 no puede hacer: un pasaje puede ser
 * literal y aun así venir de un proveedor que NO PUEDE RESPALDAR (Perplexity,
 * notas personales). Un `Source` no lleva escrito de qué sobre salió.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Cruzando los puntos 3, 7 y 8 de #314 con el modelo existente: el modelo
 * garantiza «literal», no garantiza «de una fuente que podía respaldar».
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * La procedencia (qué sobre trajo qué fuente) se perdía en cuanto el `Source`
 * salía del adaptador. `CorpusParaSintesis` la conserva en un mapa.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Una afirmación no respaldada NO SE BORRA: se marca. Y una respuesta sólo se
 * puede presentar como respaldada si NINGUNA de sus afirmaciones quedó sin
 * anclar.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * NO juzga si la afirmación es clínicamente CORRECTA o RELEVANTE: un pasaje
 * literal puede sostener una frase cierta pero inútil, o citada fuera de
 * contexto. Eso lo juzga un médico y su sitio es `evals/`, no este archivo.
 * NO comprueba entailment semántico: comprueba literalidad, que es lo
 * verificable por software.
 */
import { describe, it, expect } from 'vitest'
import {
  corpusParaSintesis, mapaDeSoporte, tasaSinRespaldo,
  esRespuestaRespaldada, avisosDeDegradacion,
} from '@/lib/evidence-integrations/soporte'
import { sobreConMaterial, sobreSinMaterial } from '@/lib/evidence-integrations/contrato'
import { fuente, fechaPublicacionDesde, type Source } from '@/types/evidence'

const AHORA = '2026-08-22T10:00:00.000Z'
const CORR = 'corr-soporte-01'

const TEXTO_A = 'Objetivo: comparar dos duraciones de tratamiento en una cohorte simulada. Resultado: la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales, con un intervalo que cruza el nulo.'
const TEXTO_B = 'Objetivo: resumir la evidencia simulada disponible sobre marcadores de seguimiento. Resultado: se identificaron doce estudios simulados con heterogeneidad alta entre ellos.'

function src(id: string, texto: string): Source {
  const r = fuente({
    proveedor: 'pubmed', idExterno: id, titulo: `Documento ${id}`,
    publicado: fechaPublicacionDesde('2024'), recuperadoEn: AHORA, textoRecuperado: texto,
  })
  if (!r.ok) throw new Error(`fixture inválido: ${r.motivo} ${r.detalle}`)
  return r.valor
}

function sobrePubmed(fuentes: readonly Source[]) {
  const r = sobreConMaterial({
    proveedor: 'pubmed', estado: 'available', intentadoEn: AHORA, correlacion: CORR,
    telemetria: { latenciaMs: 150 }, fuentes,
  })
  if (!r.ok) throw new Error(`fixture inválido: ${r.motivo}`)
  return r.valor
}

describe('la afirmación que no se puede anclar se MARCA, no se borra', () => {
  const corpus = corpusParaSintesis([sobrePubmed([src('A', TEXTO_A), src('B', TEXTO_B)])])

  it('conserva las buenas Y la mala, sin perder ninguna', () => {
    const m = mapaDeSoporte([
      { texto: 'La diferencia observada cruzó el nulo.', citas: [1], pasajes: ['la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales'] },
      { texto: 'Se identificaron doce estudios.', citas: [2], pasajes: ['se identificaron doce estudios simulados con heterogeneidad alta entre ellos'] },
      // La inventada: cita la fuente 1 con un pasaje que NO está en ella.
      { texto: 'La mortalidad se redujo a la mitad.', citas: [1], pasajes: ['la mortalidad se redujo un cincuenta por ciento en el grupo de intervención'] },
    ], corpus)

    expect(m.respaldadas).toHaveLength(2)
    expect(m.sinRespaldo).toHaveLength(1)
    // Y el TEXTO de la inventada sigue ahí: la interfaz decide si la enseña
    // marcada, pero decide con el dato delante.
    expect(m.sinRespaldo[0].texto).toBe('La mortalidad se redujo a la mitad.')
    expect(m.sinRespaldo[0].motivo).toBe('PASAJE_NO_LITERAL')
    // 3 afirmaciones entraron, 3 salieron. Nada se evapora.
    expect(m.respaldadas.length + m.sinRespaldo.length).toBe(3)
  })

  it('una respuesta con UNA afirmación inventada NO es una respuesta respaldada', () => {
    const m = mapaDeSoporte([
      { texto: 'La diferencia observada cruzó el nulo.', citas: [1], pasajes: ['la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales'] },
      { texto: 'La mortalidad se redujo a la mitad.', citas: [1], pasajes: ['la mortalidad se redujo un cincuenta por ciento'] },
    ], corpus)
    expect(m.respaldadas).toHaveLength(1)
    expect(esRespuestaRespaldada(m)).toBe(false)
    expect(tasaSinRespaldo(m)).toBeCloseTo(0.5)
  })

  it('una cita fuera de rango se rechaza con motivo, no se descarta en silencio', () => {
    // Éste es el bug real de consulta/page.tsx:2698 elevado a la síntesis.
    const m = mapaDeSoporte([
      { texto: 'Afirmación con cita inexistente.', citas: [9], pasajes: ['cualquier texto suficientemente largo para pasar el mínimo de caracteres'] },
    ], corpus)
    expect(m.sinRespaldo[0].motivo).toBe('CITA_FUERA_DE_RANGO')
  })

  it('una afirmación con `citas: []` no se cuela', () => {
    const m = mapaDeSoporte([{ texto: 'Sin citas.', citas: [], pasajes: [] }], corpus)
    expect(m.sinRespaldo[0].motivo).toBe('SIN_PASAJE')
  })

  it('una cifra que no está literalmente en el pasaje se rechaza', () => {
    const m = mapaDeSoporte([{
      texto: 'La diferencia fue de 4.1 puntos.',
      citas: [1], pasajes: ['la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales'],
      cifra: '4.1',   // ← invertida respecto al pasaje: 1.4 vs 4.1
    }], corpus)
    expect(m.sinRespaldo[0].motivo).toBe('CIFRA_NO_LITERAL')
  })
})

describe('un pasaje literal de una fuente que NO podía respaldar tampoco vale', () => {
  it('el material de descubrimiento no entra al corpus de síntesis', () => {
    // Regla 7 de #314. El sobre de Perplexity ni siquiera puede llevar fuentes
    // (lo prueba el golden del contrato); aquí se comprueba el efecto: no
    // aporta nada al corpus y se declara como sobre sin aporte.
    const rPerplexity = sobreConMaterial({
      proveedor: 'perplexity', estado: 'available', intentadoEn: AHORA,
      correlacion: CORR, telemetria: { latenciaMs: 800 }, fuentes: [],
    })
    expect(rPerplexity.ok).toBe(true)
    if (!rPerplexity.ok) return

    const corpus = corpusParaSintesis([sobrePubmed([src('A', TEXTO_A)]), rPerplexity.valor])
    expect(corpus.fuentes).toHaveLength(1)
    expect(corpus.sobresSinAporte.map(s => s.proveedor)).toContain('perplexity')
  })
})

describe('la deduplicación evita inflar la sensación de respaldo', () => {
  it('el mismo artículo por dos caminos ocupa UNA entrada', () => {
    // Tres citas al mismo estudio se leen como tres estudios. Se dedupe por
    // `Source.id`, que es `proveedor:idExterno`.
    const corpus = corpusParaSintesis([
      sobrePubmed([src('A', TEXTO_A)]),
      sobrePubmed([src('A', TEXTO_A), src('B', TEXTO_B)]),
    ])
    expect(corpus.fuentes).toHaveLength(2)
    expect(corpus.fuentes.map(f => f.idExterno).sort()).toEqual(['A', 'B'])
  })
})

describe('lo que no se consultó se DECLARA junto a la respuesta', () => {
  it('un proveedor caído produce un aviso explícito, no un silencio', () => {
    const caido = sobreSinMaterial({
      proveedor: 'uptodate', estado: 'not_configured', intentadoEn: AHORA,
      correlacion: CORR, telemetria: { latenciaMs: 0 },
      motivo: 'requiere acuerdo de licencia.', clase: 'sin_contrato',
    })
    expect(caido.ok).toBe(true)
    if (!caido.ok) return

    const corpus = corpusParaSintesis([sobrePubmed([src('A', TEXTO_A)]), caido.valor])
    const m = mapaDeSoporte([
      { texto: 'La diferencia observada cruzó el nulo.', citas: [1], pasajes: ['la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales'] },
    ], corpus)

    const avisos = avisosDeDegradacion(m)
    expect(avisos.some(a => /UpToDate.*NO SE CONSULTÓ/.test(a))).toBe(true)
  })

  it('«se consultó y no encontró» y «no se consultó» son avisos DISTINTOS', () => {
    const corpus = corpusParaSintesis([sobrePubmed([])])
    const avisos = avisosDeDegradacion(mapaDeSoporte([], corpus))
    expect(avisos.some(a => /se consultó y no encontró/.test(a))).toBe(true)
    expect(avisos.some(a => /NO SE CONSULTÓ/.test(a))).toBe(false)
  })

  it('las afirmaciones sin anclar se anuncian con su cuenta', () => {
    const corpus = corpusParaSintesis([sobrePubmed([src('A', TEXTO_A)])])
    const m = mapaDeSoporte([{ texto: 'Inventada.', citas: [1], pasajes: ['texto que no aparece en la fuente pero es suficientemente largo'] }], corpus)
    expect(avisosDeDegradacion(m).some(a => /1 afirmación\(es\).*no quedaron ancladas/.test(a))).toBe(true)
  })
})

describe('tasaSinRespaldo no revienta con una síntesis vacía', () => {
  it('cero afirmaciones son cero inventadas, no NaN', () => {
    const corpus = corpusParaSintesis([sobrePubmed([])])
    expect(tasaSinRespaldo(mapaDeSoporte([], corpus))).toBe(0)
  })
})
