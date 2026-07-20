/**
 * Capa de RAZONAMIENTO con IA sobre el motor determinista.
 *
 * El motor determinista ya calculó los HECHOS (fenotipos, mecanismo, categorías
 * CLSI, terapia por clase, pruebas). La IA (Claude/GPT) NO recalcula ni contradice
 * esos hechos ni inventa puntos de corte: los RAZONA como un infectólogo — integra
 * el caso, prioriza el tratamiento, optimiza PK/PD y dice qué confirmar. Así se
 * combinan «motor (rigor) + IA (juicio clínico)» sin alucinar.
 */
import type { EntradaAntibiograma, InterpretacionAntibiograma } from './tipos'

/** Resume la interpretación determinista como hechos compactos para el prompt. */
export function resumenDeterminista(entrada: EntradaAntibiograma, r: InterpretacionAntibiograma): string {
  const L: string[] = []
  L.push(`Organismo: ${entrada.organismo || '(no especificado)'}${entrada.sitio && entrada.sitio !== 'otro' ? ` · sitio: ${entrada.sitio}` : ''}`)
  const panel = entrada.resultados.map(x => `${x.antibiotico}=${x.interpretacion}${typeof x.cmi === 'number' ? ` (CMI ${x.cmi})` : ''}`).join(', ')
  if (panel) L.push(`Panel S/I/R: ${panel}`)
  if (r.categoriasCMI.length) L.push(`CMI→CLSI: ${r.categoriasCMI.map(c => `${c.antibiotico} ${c.cmi}=${c.categoriaCLSI}${c.concuerda === false ? ` (reporte decía ${c.categoriaReportada})` : ''}`).join('; ')}`)
  if (r.fenotipos.length) L.push(`Fenotipos: ${r.fenotipos.map(f => `${f.nombre} [${f.confianza}]`).join('; ')}`)
  if (r.mecanismos.length) L.push(`Mecanismos: ${r.mecanismos.map(m => `${m.nombre}${m.ambler ? ` (clase ${m.ambler})` : ''}`).join('; ')}`)
  if (r.resistenciaIntrinseca.filter(n => n.tipo === 'conflicto').length) L.push(`Conflictos intrínsecos: ${r.resistenciaIntrinseca.filter(n => n.tipo === 'conflicto').map(n => n.antibiotico).join(', ')}`)
  if (r.terapiaDirigida.length) L.push(`Terapia por clase (motor): ${r.terapiaDirigida.map(t => `[${t.linea}] ${t.agente}`).join('; ')}`)
  if (r.advertencias.length) L.push(`Advertencias: ${r.advertencias.join(' | ')}`)
  /**
   * LAS ALERTAS CRÍTICAS TAMBIÉN VAN AL PROMPT.
   *
   * Se omitían `alertas`, `aislamiento` y `notificacionObligatoria`, que es donde
   * vive el contenido más accionable: «carbapenemasa → infectología OBLIGADA», la
   * precaución de contacto, la notificación NOM-045. El modelo razonaba sin las
   * alertas de su propio motor y podía redactar una recomendación que no las
   * mencionara — no por contradecirlas, sino por no haberlas visto nunca.
   */
  if (r.alertas.length) L.push(`ALERTAS del motor (críticas primero): ${r.alertas.map(a => `[${a.nivel}] ${a.mensaje}`).join(' | ')}`)
  if (r.aislamiento) L.push(`Precaución de aislamiento indicada por el motor: ${r.aislamiento}`)
  if (r.notificacionObligatoria) L.push('NOTIFICACIÓN OBLIGATORIA: este aislamiento es de notificación epidemiológica.')
  if (r.pruebasSugeridas.length) L.push(`Pruebas sugeridas: ${r.pruebasSugeridas.map(p => p.nombre).join('; ')}`)
  return L.join('\n')
}

export const RAZONAR_SYSTEM = `Eres un infectólogo/microbiólogo consultor de altísimo nivel (PROA). Recibes un antibiograma y su INTERPRETACIÓN DETERMINISTA ya calculada por un motor validado (fenotipos, mecanismo, categorías CLSI, terapia por clase, pruebas). Tu tarea es RAZONAR el caso como el mejor infectólogo, apoyándote en esos hechos.

REGLAS ESTRICTAS (anti-alucinación):
1. NO contradigas las categorías S/I/R/SDD ni los puntos de corte del motor. NO inventes CMIs, breakpoints ni PMIDs.
2. Si algo no está en los datos, dilo ("no reportado") — no lo supongas.
3. Razona SOBRE los hechos: intégralos, prioriza, explica el porqué.
4. México: frecuentemente NO hay aztreonam ni cefiderocol — si el motor lo indicó, respeta esa realidad de acceso.
5. Sé conciso, denso y accionable (nivel subespecialista). Español.
6. Si el motor emitió ALERTAS críticas, una precaución de aislamiento o una
   notificación obligatoria, tu respuesta DEBE recogerlas explícitamente. No las
   omitas ni las suavices: son las consecuencias accionables del fenotipo.
7. NUNCA recomiendes como primera línea un fármaco que el panel reporta R, que el
   motor marcó en su lista de "evitar", o al que la especie sea intrínsecamente
   resistente. Si crees que hay una excepción razonada (p. ej. sulbactam a dosis
   altas en Acinetobacter por encima del punto de corte), dilo EXPLÍCITAMENTE como
   excepción y con su justificación — nunca en silencio.

Responde en estas secciones cortas (sin markdown pesado):
LECTURA DEL CASO: 2-3 frases integrando organismo + mecanismo + gravedad esperada.
TRATAMIENTO PRIORIZADO: 1ª línea (agente + dosis + optimización PK/PD) → alternativas. Coherente con la terapia del motor.
QUÉ EVITAR Y POR QUÉ: fármacos que parecen S pero no sirven (efecto inóculo, desrepresión, etc.).
CONFIRMAR / SIGUIENTE PASO: pruebas o interconsulta.`

export function buildRazonarUser(resumen: string): string {
  return `Datos del caso (hechos del motor determinista — no los contradigas):\n\n${resumen}\n\nRazona el caso siguiendo las secciones indicadas.`
}
