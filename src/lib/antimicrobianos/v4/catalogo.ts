/**
 * CATÁLOGO V4 — carga el dataset verificado y lo sella.
 *
 * Fuente: `Ausculta_Antibacterial_Dosing_V3_EVIDENCE_VERIFIED.json`, 49
 * fármacos, 39 fuentes, 12 reglas de motor. Verificado contra FDA/DailyMed,
 * IDSA 2026, CLSI M100 Ed36 y EUCAST v16.1.
 *
 * ── POR QUÉ EL TEXTO SE GUARDA TAL CUAL ──────────────────────────────────────
 *
 * Los campos del dataset son prosa clínica: «eGFR 30-49: 2 g q8h; 15-29: 2 g
 * q12h; <15: 1 g q12h». Convertir eso a números es PARSEAR, y un fallo de
 * parseo aquí no produce un error visible: produce una dosis distinta que se ve
 * igual de segura que la correcta.
 *
 * Así que el texto verificado **se conserva íntegro y se muestra**, y la
 * estructura sólo se emite cuando la lectura es inequívoca. Lo que no se pueda
 * leer sin ambigüedad sale como `UNKNOWN_INSUFFICIENT_DATA` y va a valoración —
 * que es exactamente lo que manda `RULE_HUMAN_OVERSIGHT`: «el LLM puede
 * interpretar el contexto clínico pero no puede generar una dosis sin una regla
 * verificada ejecutable».
 *
 * ── LO QUE ESTE MÓDULO NO TIENE ──────────────────────────────────────────────
 *
 * Los veinte antibióticos que el propio dataset marca como pendientes
 * (ampicilina, amoxicilina, amoxi/clav IR y XR, oxacilina, cefotaxima,
 * cefuroxima, macrólidos, lincosamidas, dalbavancina, oritavancina, tedizolid,
 * omadaciclina, delafloxacina, lefamulina, fosfomicina, rifamicinas…). **No se
 * rellenan de memoria.** Preguntar por uno de ellos devuelve «no tengo la
 * regla», que es la respuesta honesta y la única segura.
 *
 * Módulo PURO salvo la lectura del JSON empaquetado.
 */

import datos from '@/lib/antimicrobianos/v4/data/dosing-v3-verificado.json'

/**
 * Huella del dataset.
 *
 * Cambió el 31-jul al separar siete entradas que traían la pauta de ficha y la
 * de guía fusionadas en un solo texto (A8). Se cortaron **sólo donde el propio
 * texto pone el marcador** —«FDA label: …; IDSA AMR: …»—: no hay interpretación,
 * hay leer dónde el autor puso la etiqueta. Las cuatro que no lo llevan siguen
 * fusionadas y declaradas.
 *
 * Si cambia sin que nadie lo sepa, el test se pone rojo.
 */
export const HUELLA_DATASET =
  '9af5eb4051986e13f254d987ece3c3a17a102af51ef9e124d2aadf4298bcf7e8'

export interface FarmacoV3 {
  drug: string
  class: string
  /** A1, B… El nivel de verificación viaja con la respuesta. */
  verification_tier: string
  /** READY / no. Un fármaco que no está listo no dosifica solo. */
  auto_dose_status: string
  core_regimen: string
  label_regimen: string
  guideline_regimen: string
  renal_adjustment: string
  arc: string
  ihd: string
  crrt: string
  tdm_pkpd: string
  hard_stops: string
  ast_governance: string
  notes: string
  source_ids: string[]
}

export interface ReglaMotor {
  id: string
  severity: 'HARD' | 'WARNING' | 'GUIDELINE'
  text: string
}

const D = datos as unknown as {
  metadata: Record<string, string>
  engine_rules: ReglaMotor[]
  source_registry: Record<string, unknown>
  drugs: FarmacoV3[]
  next_priority_for_v3_1: string[]
  claude_contract: Record<string, unknown>
}

export const METADATA = D.metadata
export const REGLAS_MOTOR: readonly ReglaMotor[] = D.engine_rules
export const FARMACOS: readonly FarmacoV3[] = D.drugs
export const REGISTRO_FUENTES = D.source_registry
export const CONTRATO_LLM = D.claude_contract

/** Los que el propio dataset declara pendientes. No se inventan. */
export const PENDIENTES_V3_1: readonly string[] = D.next_priority_for_v3_1

const norm = (s: string) => s.trim().toLowerCase()
const porNombre = new Map(FARMACOS.map(f => [norm(f.drug), f]))

/**
 * Busca un fármaco. **Sólo coincidencia exacta.**
 *
 * La primera versión aceptaba coincidencia por inclusión cuando había un único
 * candidato, y su propio test la tumbó: pedir «Ampicillin» devolvía
 * **Ampicillin-sulbactam**, que es otro fármaco —lleva un inhibidor de
 * betalactamasas, cubre otro espectro y se dosifica distinto—. La ampicilina
 * sola está declarada PENDIENTE en el dataset, así que la respuesta correcta era
 * «no la tengo» y lo que salía era una combinación con aspecto de respuesta
 * buena.
 *
 * Esa clase de error no se ve: el médico pide un fármaco, recibe una dosis, y
 * nada en la pantalla dice que la dosis es de otro. Por eso la comodidad de la
 * búsqueda aproximada se cambia por `candidatos()`, que ofrece opciones para que
 * elija una persona.
 *
 * «Vancomycin» tampoco resuelve: IV y VO son dos fármacos con dos indicaciones
 * distintas, y elegir por orden alfabético sería elegir por azar.
 */
export function buscarFarmaco(nombre: string): FarmacoV3 | null {
  const n = norm(nombre)
  if (!n) return null
  return porNombre.get(n) ?? null
}

/** Los candidatos, para poder pedirle al médico que precise. */
export function candidatos(nombre: string): FarmacoV3[] {
  const n = norm(nombre)
  if (!n) return []
  return FARMACOS.filter(f => norm(f.drug).includes(n) || n.includes(norm(f.drug)))
}

/** ¿Este fármaco está declarado como pendiente de verificar? */
export function estaPendiente(nombre: string): boolean {
  const n = norm(nombre)
  return PENDIENTES_V3_1.some(p => norm(p) === n || norm(p).includes(n) || n.includes(norm(p)))
}

/** Las reglas duras: las que no admiten excepción. */
export function reglasDuras(): ReglaMotor[] {
  return REGLAS_MOTOR.filter(r => r.severity === 'HARD')
}

export const POR_QUE_NO_SE_RELLENAN_LOS_QUE_FALTAN =
  'El dataset declara veinte antibióticos pendientes de verificar. Rellenarlos ' +
  'de memoria daría un motor que responde a todo y acierta casi siempre, que es ' +
  'peor que uno que responde a menos y no falla: el médico no tiene forma de ' +
  'saber cuáles son las respuestas buenas. «No tengo la regla» es una respuesta ' +
  'útil; una dosis inventada con aspecto de verificada, no.'
