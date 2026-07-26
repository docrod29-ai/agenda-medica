/**
 * DISCUSIÓN CLÍNICA MULTI-VOZ EN UCI — pase de visita (iteración nexusmed-icu-005b).
 *
 * En UCI la nota nace de una DISCUSIÓN: el residente presenta, el adscrito
 * cuestiona y decide, enfermería aporta signos/administración. El pipeline de
 * audio ya diariza por hablante (AssemblyAI) y atribuye roles con IA
 * (/api/expediente/atribuir-roles). Este módulo PURO añade los roles de UCI y
 * una capa determinista de heurísticas que COMPLEMENTA a la IA (nunca la
 * reemplaza) + arma la transcripción etiquetada que alimenta al constructor de
 * nota. La nota final es re-proyección de esta discusión; el médico firma.
 */

export const DISCUSION_UCI_VERSION = '1.0.0'

export type RolUCI = 'adscrito' | 'residente' | 'enfermeria' | 'paciente' | 'familiar' | 'desconocido'

export const ROL_UCI_LABEL: Record<RolUCI, string> = {
  adscrito: 'Médico adscrito',
  residente: 'Médico residente',
  enfermeria: 'Enfermería',
  paciente: 'Paciente',
  familiar: 'Familiar',
  desconocido: 'Hablante no identificado',
}

const norm = (s: string): string => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Señales de contenido por rol (heurística determinista, apoyo a la IA). */
const SENALES: { rol: RolUCI; patrones: RegExp[] }[] = [
  { rol: 'residente', patrones: [
    /\bpaciente (masculino|femenino|de)\b/, /\bdia \d+ (de )?(estancia|ventilacion|internamiento)\b/,
    /\bingres[oó] por\b/, /\bpresent[oa]\b/, /\ba la exploracion\b/, /\ben (el|los) laboratorio/, /\bles present[oa]\b/,
  ] },
  { rol: 'adscrito', patrones: [
    /\b(el plan es|vamos a|yo haria|indic[ao]|suspend[ae]|inici[ae]mos?|descart[ae]mos?)\b/,
    /\b(por que (crees|piensas)|que (opinas|propones|harias)|estas de acuerdo)\b/,
    /\b(coment[ao]|ense[nñ]|recuerd[ae]n?)\b/,
  ] },
  { rol: 'enfermeria', patrones: [
    /\b(signos vitales|tension (arterial|de)|diuresis de|balance de|goteo|administr[eé]|pas[eé] el medicamento|esta con .* de sedacion)\b/,
    /\b(turno|glucometria de|se ministr[oó])\b/,
  ] },
  { rol: 'paciente', patrones: [ /\b(me duele|siento|no puedo respirar|tengo (dolor|nausea)|me falta el aire)\b/ ] },
  { rol: 'familiar', patrones: [ /\b(mi (papa|mama|esposo|esposa|hijo|familiar)|es mi )\b/ ] },
]

/** ¿El turno aporta contenido clínico (vs. saludo/ruido)? */
export function esContenidoClinico(texto: string): boolean {
  // Quita un saludo/coletilla inicial y evalúa lo que queda.
  const t = norm(texto).replace(/^(hola|buenos dias|buenas( tardes| noches)?|gracias|con permiso|permiso|adelante|a ver|bueno|ok)[,. ]*/, '').trim()
  if (t.length < 8) return false
  if (/^(si|no|aja|mmm|claro|de acuerdo)\.?$/.test(t)) return false
  return true
}

export interface AtribucionRol { rol: RolUCI; confianza: number; senales: string[] }

/** Atribuye un rol de UCI al texto de un turno por heurística de contenido. */
export function atribuirRolUCI(texto: string): AtribucionRol {
  const t = norm(texto)
  const acumulado: Record<string, number> = {}
  const senales: string[] = []
  for (const s of SENALES) {
    for (const p of s.patrones) {
      const m = t.match(p)
      if (m) { acumulado[s.rol] = (acumulado[s.rol] ?? 0) + 1; senales.push(`${s.rol}:${m[0]}`) }
    }
  }
  const entradas = Object.entries(acumulado).sort((a, b) => b[1] - a[1])
  if (!entradas.length) return { rol: 'desconocido', confianza: 0, senales: [] }
  const [rol, hits] = entradas[0]
  // confianza simple: proporción de aciertos del ganador vs. total, acotada
  const total = entradas.reduce((a, [, n]) => a + n, 0)
  return { rol: rol as RolUCI, confianza: Math.min(1, hits / Math.max(1, total)), senales }
}

export interface TurnoDiscusion { hablante: string; texto: string; rol?: RolUCI }

/**
 * Atribuye rol a cada turno (respeta el rol que ya venga de la IA; si no, usa la
 * heurística) y mantiene coherencia: un mismo `hablante` conserva el rol de mayor
 * confianza que se le haya asignado en toda la discusión.
 */
export function atribuirRolesDiscusion(turnos: TurnoDiscusion[]): TurnoDiscusion[] {
  const rolPorHablante: Record<string, { rol: RolUCI; conf: number }> = {}
  // 1ª pasada: acumular la mejor señal por hablante
  for (const tn of turnos) {
    if (tn.rol && tn.rol !== 'desconocido') { rolPorHablante[tn.hablante] = { rol: tn.rol, conf: 1 }; continue }
    const a = atribuirRolUCI(tn.texto)
    const prev = rolPorHablante[tn.hablante]
    if (a.rol !== 'desconocido' && (!prev || a.confianza > prev.conf)) rolPorHablante[tn.hablante] = { rol: a.rol, conf: a.confianza }
  }
  // 2ª pasada: aplicar el rol consolidado por hablante
  return turnos.map(tn => ({ ...tn, rol: rolPorHablante[tn.hablante]?.rol ?? tn.rol ?? 'desconocido' }))
}

/**
 * Arma la transcripción etiquetada de la discusión para el constructor de nota.
 * Filtra el ruido no clínico. Cada línea: "[Rol] texto". La nota se re-proyecta
 * de aquí (fuente de verdad), separando quién decidió (adscrito) de quién
 * presentó (residente).
 */
export function formatearDiscusion(turnos: TurnoDiscusion[]): string {
  return atribuirRolesDiscusion(turnos)
    .filter(tn => esContenidoClinico(tn.texto))
    .map(tn => `[${ROL_UCI_LABEL[tn.rol ?? 'desconocido']}] ${tn.texto.trim()}`)
    .join('\n')
}
