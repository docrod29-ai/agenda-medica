/**
 * COMANDOS DE VOZ MANOS-LIBRES PARA UCI — ICU (iteración nexusmed-icu-003).
 *
 * El intensivista dicta con las manos ocupadas: navega por aparatos y sistemas,
 * corrige un valor, marca pendientes y finaliza — todo por voz. PURO (string →
 * comando), testeable sin micrófono. El pipeline de audio (chunks, diarización,
 * pausa/recovery) ya existe en useGrabacionAudio.ts; esto solo interpreta la
 * intención de comando dentro de la transcripción.
 *
 * No ejecuta nada: devuelve la intención. La capa de UI aplica la acción y, para
 * los NÚMEROS CRÍTICOS (dosis, PEEP, FiO2…), muestra el valor para confirmación
 * visual antes de registrarlo (regla del contrato de voz).
 */
import { normalizarTexto } from './comandos'
import type { ICUSystem } from '@/types/uci'

export type ComandoUCI =
  | { tipo: 'navegar'; sistema: ICUSystem }
  | { tipo: 'corregir'; campo: string; valor: string }
  | { tipo: 'eliminar_ultimo' }
  | { tipo: 'repetir_ultimo' }
  | { tipo: 'agregar_plan'; texto: string }
  | { tipo: 'marcar_pendiente'; texto: string }
  | { tipo: 'finalizar' }
  | { tipo: 'cancelar' }

/** Sinónimos de cada aparato/sistema → clave canónica. */
const SISTEMAS: { sistema: ICUSystem; claves: string[] }[] = [
  { sistema: 'neurologic',            claves: ['neurologico', 'neuro', 'neurologia'] },
  { sistema: 'respiratory',           claves: ['respiratorio', 'ventilatorio', 'ventilacion', 'pulmonar', 'respi'] },
  { sistema: 'hemodynamic',           claves: ['hemodinamico', 'hemodinamia', 'cardiovascular', 'cardio', 'hemodinamica'] },
  { sistema: 'renal_metabolic',       claves: ['renal', 'metabolico', 'hidrometabolico', 'nefro', 'renal metabolico'] },
  { sistema: 'gastrointestinal',      claves: ['gastrointestinal', 'digestivo', 'gastro', 'nutricion', 'nutricional'] },
  { sistema: 'hematologic_infectious',claves: ['hematoinfeccioso', 'hematologico', 'infeccioso', 'infectologia', 'hemato', 'infecto'] },
  { sistema: 'skin_devices',          claves: ['piel', 'dispositivos', 'tegumentario', 'piel y dispositivos'] },
  { sistema: 'ultrasound',            claves: ['ultrasonido', 'ecografia', 'pocus', 'usg', 'eco'] },
]

const UNIDADES: Record<string, number> = {
  cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}
const DECENAS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }

/** Convierte un entero en palabras (0–99) a número. null si no reconoce. */
function enteroEs(txt: string): number | null {
  const t = txt.trim()
  if (t === '') return null
  if (/^\d+$/.test(t)) return parseInt(t, 10)
  if (t in UNIDADES) return UNIDADES[t]
  if (t in DECENAS) return DECENAS[t]
  // "treinta y cinco"
  const m = t.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(\w+)$/)
  if (m && m[2] in UNIDADES) return DECENAS[m[1]] + UNIDADES[m[2]]
  return null
}

/**
 * Parsea un número dictado, con decimales por "punto": "cero punto cuatro" → "0.4",
 * "cinco punto ocho" → "5.8", "ocho" → "8", "40" → "40". null si no reconoce.
 */
export function parsearNumeroEs(texto: string): string | null {
  const t = normalizarTexto(texto).replace(/\bpunto\b/g, '.')
  const partes = t.split('.').map(s => s.trim()).filter(Boolean)
  if (partes.length === 0 || partes.length > 2) return null
  const entero = enteroEs(partes[0])
  if (entero === null) return null
  if (partes.length === 1) return String(entero)
  // Parte decimal: puede ser "cuatro" (→ .4) o "cuarenta y cinco" no aplica; se
  // toma dígito a dígito si son varias palabras.
  const decPalabras = partes[1].split(/\s+/)
  let dec = ''
  for (const p of decPalabras) {
    const d = /^\d+$/.test(p) ? parseInt(p, 10) : UNIDADES[p]
    if (d === undefined || d < 0 || d > 9) return null
    dec += String(d)
  }
  return `${entero}.${dec}`
}

/**
 * Interpreta un comando de UCI en el texto dictado. Devuelve la intención o null
 * si no hay comando (entonces el texto es contenido clínico normal).
 */
export function interpretarComandoUCI(texto: string): ComandoUCI | null {
  const t = normalizarTexto(texto)
  if (!t) return null

  // Finalizar / cancelar
  if (/\b(finalizar|termina[r]?|cerrar)\s+(la\s+)?nota\b/.test(t)) return { tipo: 'finalizar' }
  if (/\bcancelar\b/.test(t)) return { tipo: 'cancelar' }

  // Eliminar / repetir
  if (/\b(elimina[r]?|borra[r]?|quita[r]?)\s+(la\s+)?(ultima\s+frase|ultimo\s+dato)\b/.test(t)) return { tipo: 'eliminar_ultimo' }
  if (/\b(repet\w*|repit\w*)\s+(el\s+)?ultimo\s+(dato|valor)\b/.test(t)) return { tipo: 'repetir_ultimo' }

  // Agregar al plan / marcar pendiente (captura el texto que sigue, si lo hay)
  const plan = t.match(/\b(agrega[r]?|anade|anadir|pon[er]?)\s+(esto\s+)?al\s+plan\b:?\s*(.*)$/)
  if (plan) return { tipo: 'agregar_plan', texto: plan[3].trim() }
  const pend = t.match(/\bmarca[r]?\s+(como\s+)?pendiente\b:?\s*(.*)$/)
  if (pend) return { tipo: 'marcar_pendiente', texto: pend[2].trim() }

  // Corregir <campo> a <valor>   (ej. "corregir PEEP a ocho")
  const corr = t.match(/\b(correg\w*|corrig\w*|corrij\w*|cambi\w*|ajust\w*)\s+(?:el\s+|la\s+)?(.+?)\s+(?:a|en|por)\s+(.+)$/)
  if (corr) {
    const valor = parsearNumeroEs(corr[3]) ?? corr[3].trim()
    return { tipo: 'corregir', campo: corr[2].trim(), valor }
  }

  // Navegar a un sistema ("iniciar neurologico", "pasar a respiratorio", "ir a hemodinamia")
  const nav = t.match(/\b(inicia[r]?|pasa[r]?|ir|ve|vamos|abre|abrir)\s+(a\s+|al\s+)?(.+)$/)
  if (nav) {
    const destino = nav[3].trim()
    for (const s of SISTEMAS) {
      if (s.claves.some(c => destino === c || destino.startsWith(c + ' ') || destino.endsWith(' ' + c) || destino.includes(c))) {
        return { tipo: 'navegar', sistema: s.sistema }
      }
    }
  }
  return null
}
