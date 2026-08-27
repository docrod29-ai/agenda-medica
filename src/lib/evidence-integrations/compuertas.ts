/**
 * ══════════════════════════════════════════════════════════════════════════
 * COMPUERTAS — evidencia → acción clínica, y caché por licencia (#314)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Dos compuertas que no se parecen en nada salvo en una cosa: las dos existen
 * porque una regla escrita sólo en un prompt no es una regla.
 *
 * ── COMPUERTA 1 — NINGÚN RESULTADO DE EVIDENCIA SE VUELVE ACCIÓN CLÍNICA ────
 *
 * Punto 4 de #314 y regla del tablero #296: «Medicamentos: historia ≠ plan ≠
 * receta». Aquí se extiende a la evidencia: que un artículo diga que una pauta
 * de siete días no fue inferior NO PONE esa pauta en la receta.
 *
 * El fallo que esto previene no es que el médico se confunda: es que un flujo
 * automático «ayude». Un botón de «aplicar sugerencia», un prellenado, un
 * agente que rellena el plan con lo que dijo la evidencia. Cada uno parece
 * razonable por separado, y el resultado es una receta que nadie decidió.
 *
 *   ╔══════════════════════════════════════════════════════════════════════╗
 *   ║  LA EVIDENCIA INFORMA. EL MÉDICO DECIDE. NO HAY CAMINO AUTOMÁTICO.   ║
 *   ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Esta compuerta NO es un `if` que alguien pueda quitar sin darse cuenta: es un
 * tipo. Convertir evidencia en una acción exige pasar por `decisionDelMedico`,
 * que EXIGE la identidad de quien decide y su acto explícito. Sin eso, la
 * propuesta no tiene forma de acción y no compila donde se espera una.
 *
 * ── COMPUERTA 2 — CACHÉ SÓLO SI LA LICENCIA Y EL INQUILINO LO PERMITEN ──────
 *
 * Punto 8 del checkpoint de #314. Dos prohibiciones distintas:
 *  · la LEGAL: cachear material propietario puede ser redistribución no
 *    autorizada, aunque la copia sea nuestra y esté en nuestro servidor;
 *  · la de AISLAMIENTO: una caché de resultados clínicos compartida entre
 *    consultorios es una fuga entre inquilinos con forma de optimización
 *    (.claude/rules/security-tenant.md).
 */

import { entradaDeCatalogo, estaVerificado, type ProveedorDeEvidencia } from './catalogo'
import type { AfirmacionRespaldada, MapaDeSoporte } from './soporte'

// ---------------------------------------------------------------------------
// COMPUERTA 1 — evidencia → acción clínica
// ---------------------------------------------------------------------------

/** Las acciones clínicas que la evidencia NO puede originar por sí sola. */
export type AccionClinica = 'diagnostico' | 'orden' | 'receta' | 'plan_terapeutico' | 'nota_firmada'

/**
 * Lo máximo que la evidencia puede producir: una PROPUESTA.
 *
 * Nótese lo que NO tiene: ni código CIE-10, ni dosis, ni vía, ni frecuencia.
 * No es un olvido. Una propuesta que ya trae la dosis rellenada es una receta
 * esperando un clic, y un clic no es una decisión clínica: es un clic.
 */
export interface PropuestaDeEvidencia {
  readonly clase: 'propuesta_informativa'
  /** Qué dice la literatura, con su respaldo ya comprobado. */
  readonly afirmacion: AfirmacionRespaldada
  /** Sobre qué acción informa — informar NO es originar. */
  readonly informaSobre: AccionClinica
  /**
   * Lo que el médico tiene que decidir por su cuenta, dicho en voz alta.
   * Se genera aquí para que ninguna pantalla lo omita.
   */
  readonly quedaPorDecidir: string
}

/**
 * Convierte una afirmación respaldada en una propuesta.
 *
 * ES LA ÚNICA SALIDA de la evidencia hacia el terreno clínico, y desemboca en
 * algo que NO ES ejecutable. Para que se ejecute hace falta `decisionDelMedico`.
 */
export function propuestaDesdeEvidencia(
  afirmacion: AfirmacionRespaldada,
  informaSobre: AccionClinica,
): PropuestaDeEvidencia {
  return {
    clase: 'propuesta_informativa',
    afirmacion,
    informaSobre,
    quedaPorDecidir: QUEDA_POR_DECIDIR[informaSobre],
  }
}

/**
 * Qué sigue faltando después de leer la evidencia. Son los datos que la
 * literatura NO tiene porque dependen del paciente que está delante.
 */
const QUEDA_POR_DECIDIR: Readonly<Record<AccionClinica, string>> = {
  diagnostico: 'La evidencia describe poblaciones, no a este paciente. El diagnóstico y su código lo establece el médico.',
  orden: 'Indicación, oportunidad y utilidad para este paciente las decide el médico. La evidencia no conoce su contexto.',
  receta: 'Fármaco, dosis, vía, frecuencia, duración, alergias, función renal/hepática, embarazo e interacciones los decide y verifica el médico. La evidencia no prescribe.',
  plan_terapeutico: 'El plan lo arma el médico. Un fármaco mencionado en la literatura no entra al plan por haber sido mencionado.',
  nota_firmada: 'La firma es un acto medicolegal del médico sobre el expediente. Ninguna evidencia la origina.',
}

/**
 * Una acción clínica AUTORIZADA. Sólo la produce `decisionDelMedico`.
 *
 * La marca fantasma es lo que hace que esto no se pueda falsificar escribiendo
 * el objeto a mano, igual que en `src/types/evidence.ts`. Un flujo automático
 * NO puede construir una `AccionAutorizada` por mucho que lo intente.
 */
declare const MARCA_DECISION: unique symbol

export interface AccionAutorizada {
  readonly accion: AccionClinica
  /** Quién decidió. No es opcional: una decisión sin autor no es una decisión. */
  readonly decidioUid: string
  readonly decidioEn: string
  /**
   * De qué propuesta salió, si salió de alguna. `null` es legítimo y frecuente:
   * el médico decide casi todo sin que la evidencia se lo proponga.
   */
  readonly informadaPor: PropuestaDeEvidencia | null
  readonly [MARCA_DECISION]: (d: 'decision') => 'decision'
}

export type MotivoRechazoDecision = 'SIN_MEDICO' | 'INSTANTE_INVALIDO' | 'NO_ES_ACTO_EXPLICITO'

/**
 * ÚNICA puerta de la evidencia hacia una acción clínica.
 *
 * `actoExplicito` no es burocracia: es el testigo de que hubo un gesto humano
 * deliberado —pulsar, firmar, confirmar— y no un paso de un flujo automático.
 * Un orquestador que quisiera saltarse esto tendría que declarar `true` a
 * sabiendas, que es una línea que se ve en una revisión de código; rellenar un
 * campo en silencio, no.
 */
export function decisionDelMedico(e: {
  readonly accion: AccionClinica
  readonly decidioUid: string
  readonly decidioEn: string
  readonly actoExplicito: boolean
  readonly informadaPor?: PropuestaDeEvidencia | null
}): { ok: true; valor: AccionAutorizada } | { ok: false; motivo: MotivoRechazoDecision; detalle: string } {
  const uid = typeof e.decidioUid === 'string' ? e.decidioUid.trim() : ''
  if (!uid) return { ok: false, motivo: 'SIN_MEDICO', detalle: 'una acción clínica sin médico identificado no es una decisión: es un efecto secundario' }
  if (typeof e.decidioEn !== 'string' || Number.isNaN(Date.parse(e.decidioEn))) {
    return { ok: false, motivo: 'INSTANTE_INVALIDO', detalle: `decidioEn "${String(e.decidioEn)}" no es un instante ISO válido` }
  }
  if (e.actoExplicito !== true) {
    return {
      ok: false, motivo: 'NO_ES_ACTO_EXPLICITO',
      detalle: 'la evidencia NUNCA origina un diagnóstico, una orden ni una receta. Hace falta un acto deliberado del médico (#314 punto 4; tablero #296: historia ≠ plan ≠ receta).',
    }
  }
  const a: Omit<AccionAutorizada, typeof MARCA_DECISION> = {
    accion: e.accion, decidioUid: uid, decidioEn: e.decidioEn,
    informadaPor: e.informadaPor ?? null,
  }
  return { ok: true, valor: a as AccionAutorizada }
}

/**
 * Propuestas de una síntesis. Sólo salen de afirmaciones RESPALDADAS: una
 * afirmación que no se pudo anclar no llega ni a proponer.
 */
export function propuestasDeSintesis(m: MapaDeSoporte, informaSobre: AccionClinica): readonly PropuestaDeEvidencia[] {
  return m.respaldadas.map(a => propuestaDesdeEvidencia(a, informaSobre))
}

// ---------------------------------------------------------------------------
// COMPUERTA 2 — caché
// ---------------------------------------------------------------------------

export type VeredictoDeCache =
  | { readonly permitido: true; readonly alcance: 'global' | 'por_consultorio'; readonly porQue: string }
  | { readonly permitido: false; readonly porQue: string }

/**
 * ¿Se puede cachear el material de este proveedor, y con qué alcance?
 *
 * TRES REGLAS, aplicadas en orden y ninguna negociable:
 *
 *  1. Sin `derechoDeCache` VERIFICADO no se cachea. `UNVERIFIABLE` significa
 *     «nadie lo ha comprobado», y construir una caché encima de eso es
 *     exactamente el fallo que el centinela existe para evitar.
 *  2. El conocimiento personal se cachea SÓLO por consultorio. Es material del
 *     médico y puede contener PHI: una caché global sería una fuga.
 *  3. Material abierto y público puede ir en caché global — es el único caso,
 *     y es justo el que más se usa (PubMed).
 *
 * Devuelve el PORQUÉ siempre, también al permitir. Un permiso sin razón se
 * copia a otro sitio donde ya no aplica.
 */
export function puedeCachearse(p: ProveedorDeEvidencia): VeredictoDeCache {
  const cat = entradaDeCatalogo(p)

  if (cat.rol === 'conocimiento_personal') {
    return {
      permitido: true, alcance: 'por_consultorio',
      porQue: 'material del propio médico: se cachea dentro de su consultorio y NUNCA se comparte entre inquilinos. Puede contener PHI.',
    }
  }
  if (cat.licencia === 'OPEN') {
    return {
      permitido: true, alcance: 'global',
      porQue: `${cat.nombre} es material abierto: la caché no redistribuye nada que no fuera ya público.`,
    }
  }
  if (estaVerificado(cat.matriz.derechoDeCache)) {
    return {
      permitido: true, alcance: 'por_consultorio',
      porQue: `derecho de caché verificado: ${cat.matriz.derechoDeCache.nota}`,
    }
  }
  return {
    permitido: false,
    porQue: `no se cachea material de ${cat.nombre}: su derecho de caché está UNVERIFIABLE. Cachear material propietario puede ser redistribución no autorizada aunque la copia esté en nuestro servidor.`,
  }
}

/**
 * Clave de caché. Incluye el consultorio cuando el alcance es por inquilino, y
 * la ausencia de esa clave hace FALLAR la operación en vez de caer a global.
 *
 * Ese detalle es el que evita el fallo real: una caché por inquilino cuyo
 * `clinicId` llega `undefined` y que degrada a una clave compartida se
 * convierte, en silencio, en la fuga entre consultorios que quería evitar.
 */
export function claveDeCache(
  p: ProveedorDeEvidencia,
  huellaDeConsulta: string,
  clinicId?: string,
): { ok: true; valor: string } | { ok: false; motivo: string } {
  const v = puedeCachearse(p)
  if (!v.permitido) return { ok: false, motivo: v.porQue }
  if (v.alcance === 'por_consultorio') {
    if (!clinicId?.trim()) {
      return { ok: false, motivo: `la caché de ${p} es por consultorio y no llegó clinicId: NO se degrada a una clave global, porque eso sería una fuga entre inquilinos.` }
    }
    return { ok: true, valor: `ev:${p}:${clinicId.trim()}:${huellaDeConsulta}` }
  }
  return { ok: true, valor: `ev:${p}:global:${huellaDeConsulta}` }
}
