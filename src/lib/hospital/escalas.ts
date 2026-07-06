// ══════════════════════════════════════════════════════════════
// Escalas de enfermería (seguridad del paciente):
//  · Braden — riesgo de úlceras por presión
//  · Morse  — riesgo de caídas
// Puras y testeables.
// ══════════════════════════════════════════════════════════════

export interface EscalaResultado { score: number; riesgo: string; color: string }

const COLOR = { verde: '#0d9488', amarillo: '#d97706', rojo: '#dc2626' }

/** BRADEN: 6 subescalas. Menor puntaje = mayor riesgo. Rango 6–23. */
export interface BradenInput {
  percepcion: number   // 1-4
  humedad: number      // 1-4
  actividad: number    // 1-4
  movilidad: number    // 1-4
  nutricion: number    // 1-4
  friccion: number     // 1-3
}
export function calcBraden(i: BradenInput): EscalaResultado {
  const score = i.percepcion + i.humedad + i.actividad + i.movilidad + i.nutricion + i.friccion
  const riesgo = score <= 9 ? 'muy alto' : score <= 12 ? 'alto' : score <= 14 ? 'moderado' : score <= 18 ? 'bajo' : 'sin riesgo'
  const color = score <= 12 ? COLOR.rojo : score <= 18 ? COLOR.amarillo : COLOR.verde
  return { score, riesgo, color }
}
export const BRADEN_ITEMS: { key: keyof BradenInput; label: string; max: number }[] = [
  { key: 'percepcion', label: 'Percepción sensorial', max: 4 },
  { key: 'humedad', label: 'Humedad', max: 4 },
  { key: 'actividad', label: 'Actividad', max: 4 },
  { key: 'movilidad', label: 'Movilidad', max: 4 },
  { key: 'nutricion', label: 'Nutrición', max: 4 },
  { key: 'friccion', label: 'Fricción y cizallamiento', max: 3 },
]

/** MORSE: 6 ítems. Mayor puntaje = mayor riesgo. Rango 0–125. */
export interface MorseInput {
  caidasPrevias: number      // 0 / 25
  dxSecundario: number       // 0 / 15
  ayudaAmbulacion: number    // 0 / 15 / 30
  viaIV: number              // 0 / 20
  marcha: number             // 0 / 10 / 20
  estadoMental: number       // 0 / 15
}
export function calcMorse(i: MorseInput): EscalaResultado {
  const score = i.caidasPrevias + i.dxSecundario + i.ayudaAmbulacion + i.viaIV + i.marcha + i.estadoMental
  const riesgo = score >= 45 ? 'alto' : score >= 25 ? 'moderado' : 'bajo'
  const color = score >= 45 ? COLOR.rojo : score >= 25 ? COLOR.amarillo : COLOR.verde
  return { score, riesgo, color }
}
export const MORSE_ITEMS: { key: keyof MorseInput; label: string; opciones: { v: number; t: string }[] }[] = [
  { key: 'caidasPrevias', label: 'Antecedente de caídas', opciones: [{ v: 0, t: 'No' }, { v: 25, t: 'Sí' }] },
  { key: 'dxSecundario', label: 'Diagnóstico secundario', opciones: [{ v: 0, t: 'No' }, { v: 15, t: 'Sí' }] },
  { key: 'ayudaAmbulacion', label: 'Ayuda para deambular', opciones: [{ v: 0, t: 'Ninguna/reposo' }, { v: 15, t: 'Muletas/bastón' }, { v: 30, t: 'Se apoya en muebles' }] },
  { key: 'viaIV', label: 'Vía intravenosa/heparina', opciones: [{ v: 0, t: 'No' }, { v: 20, t: 'Sí' }] },
  { key: 'marcha', label: 'Marcha', opciones: [{ v: 0, t: 'Normal/reposo' }, { v: 10, t: 'Débil' }, { v: 20, t: 'Alterada' }] },
  { key: 'estadoMental', label: 'Estado mental', opciones: [{ v: 0, t: 'Consciente de sus límites' }, { v: 15, t: 'Sobreestima/olvida límites' }] },
]
