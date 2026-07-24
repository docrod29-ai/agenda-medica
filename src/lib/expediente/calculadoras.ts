/**
 * CALCULADORAS CLÍNICAS CONTEXTUALES — scores validados que se SUGIEREN solos
 * según el diagnóstico de la nota, para no tener que buscarlos fuera del expediente.
 *
 * Todas son funciones PURAS y testeadas: mismos datos → mismo resultado, sin red.
 * Cada una cita su fuente. Son APOYO a la decisión: no sustituyen el juicio clínico.
 */

export type TipoCampo = 'bool' | 'num' | 'opciones'

export interface CampoCalc {
  key: string
  label: string
  tipo: TipoCampo
  /** Puntos que suma si es verdadero (tipo bool). */
  puntos?: number
  /** Opciones con su valor (tipo opciones). */
  opciones?: { label: string; valor: number }[]
  unidad?: string
  ayuda?: string
}

export interface ResultadoCalc {
  puntaje: number
  categoria: string
  interpretacion: string
  nivel: 'bajo' | 'medio' | 'alto'
  /** El score NO está completo: el puntaje no es utilizable ni pegable a la nota. */
  incompleto?: boolean
  /** Cuántos campos faltan por responder. */
  faltan?: number
}

export interface Calculadora {
  id: string
  nombre: string
  para: string
  /** Palabras del diagnóstico que la disparan. */
  disparadores: string[]
  campos: CampoCalc[]
  calcular: (v: Record<string, number>) => ResultadoCalc
  referencia: string
}

const n = (v: Record<string, number>, k: string) => Number(v[k] ?? 0)
const suma = (v: Record<string, number>, campos: CampoCalc[]) =>
  campos.reduce((acc, c) => acc + (c.tipo === 'bool' ? (n(v, c.key) ? (c.puntos ?? 1) : 0) : n(v, c.key)), 0)

/**
 * Campos de tipo 'opciones' que el médico AÚN NO ha respondido.
 *
 * EL BUG QUE ESTO CIERRA (auditoría 2026-07): un desplegable sin elegir valía 0 al
 * sumar, pero 0 NO es "sin responder" — en Child-Pugh y Glasgow ni siquiera es un
 * valor posible (el mínimo por eje es 1). Con llenado parcial el puntaje caía por
 * DEBAJO del mínimo real del score y la gravedad se subestimaba:
 *   · Child-Pugh: ascitis moderada (3) + encefalopatía I-II (2) = 5 → "Clase A,
 *     compensada, buen pronóstico quirúrgico" cuando el mínimo verdadero es 8 = Clase B.
 *   · Glasgow: podía cruzar falsamente el umbral ≤8 = "Grave".
 *   · HEART: la troponina sin elegir contaba como "Normal" → "Riesgo bajo" en un
 *     dolor torácico.
 * Y el resultado se pegaba al expediente con "Agregar a la nota". Un número falso
 * escrito en la nota es peor que no tener la calculadora.
 *
 * Los campos 'bool' NO cuentan: ahí "no marcado" sí significa legítimamente ausencia.
 */
export function camposSinResponder(v: Record<string, number>, campos: CampoCalc[]): number {
  return campos.filter(c => c.tipo === 'opciones' && v[c.key] == null).length
}

/** Resultado NO utilizable: faltan campos. Nunca debe pegarse a la nota. */
function scoreIncompleto(faltan: number): ResultadoCalc {
  return {
    puntaje: 0, nivel: 'bajo', incompleto: true, faltan,
    categoria: `Faltan ${faltan} campo${faltan === 1 ? '' : 's'}`,
    interpretacion: 'Responde todos los campos para obtener el puntaje. Un score parcial SUBESTIMA la gravedad.',
  }
}

// ── Definiciones ────────────────────────────────────────────────────────────

const chads: CampoCalc[] = [
  { key: 'icc', label: 'Insuficiencia cardiaca / disfunción VI', tipo: 'bool', puntos: 1 },
  { key: 'hta', label: 'Hipertensión', tipo: 'bool', puntos: 1 },
  { key: 'edad75', label: 'Edad ≥ 75 años', tipo: 'bool', puntos: 2 },
  { key: 'dm', label: 'Diabetes mellitus', tipo: 'bool', puntos: 1 },
  { key: 'acv', label: 'ACV / AIT / tromboembolia previa', tipo: 'bool', puntos: 2 },
  { key: 'vascular', label: 'Enfermedad vascular (IAM, EAP, placa aórtica)', tipo: 'bool', puntos: 1 },
  { key: 'edad65', label: 'Edad 65-74 años', tipo: 'bool', puntos: 1 },
  { key: 'mujer', label: 'Sexo femenino', tipo: 'bool', puntos: 1 },
]

const hasbled: CampoCalc[] = [
  { key: 'hta', label: 'HTA no controlada (TAS > 160)', tipo: 'bool', puntos: 1 },
  { key: 'renal', label: 'Función renal alterada (diálisis, trasplante, Cr > 2.26)', tipo: 'bool', puntos: 1 },
  { key: 'hepatica', label: 'Función hepática alterada (cirrosis, bili > 2×)', tipo: 'bool', puntos: 1 },
  { key: 'acv', label: 'ACV previo', tipo: 'bool', puntos: 1 },
  { key: 'sangrado', label: 'Sangrado previo o predisposición', tipo: 'bool', puntos: 1 },
  { key: 'inr', label: 'INR lábil (si usa warfarina)', tipo: 'bool', puntos: 1 },
  { key: 'edad65', label: 'Edad > 65 años', tipo: 'bool', puntos: 1 },
  { key: 'farmacos', label: 'Fármacos (antiagregantes / AINE)', tipo: 'bool', puntos: 1 },
  { key: 'alcohol', label: 'Alcohol (≥ 8 bebidas/semana)', tipo: 'bool', puntos: 1 },
]

const wellsTep: CampoCalc[] = [
  { key: 'tvp', label: 'Signos clínicos de TVP', tipo: 'bool', puntos: 3 },
  { key: 'alternativo', label: 'TEP es el dx MÁS probable', tipo: 'bool', puntos: 3 },
  { key: 'fc', label: 'FC > 100 lpm', tipo: 'bool', puntos: 1.5 },
  { key: 'inmovil', label: 'Inmovilización ≥3 días o cirugía < 4 semanas', tipo: 'bool', puntos: 1.5 },
  { key: 'previo', label: 'TVP/TEP previo', tipo: 'bool', puntos: 1.5 },
  { key: 'hemoptisis', label: 'Hemoptisis', tipo: 'bool', puntos: 1 },
  { key: 'cancer', label: 'Cáncer activo', tipo: 'bool', puntos: 1 },
]

const wellsTvp: CampoCalc[] = [
  { key: 'cancer', label: 'Cáncer activo', tipo: 'bool', puntos: 1 },
  { key: 'paralisis', label: 'Parálisis/paresia o inmovilización de MI', tipo: 'bool', puntos: 1 },
  { key: 'encamado', label: 'Encamado > 3 días o cirugía mayor < 12 semanas', tipo: 'bool', puntos: 1 },
  { key: 'dolor', label: 'Dolor a la palpación del trayecto venoso', tipo: 'bool', puntos: 1 },
  { key: 'edemaPierna', label: 'Edema de toda la pierna', tipo: 'bool', puntos: 1 },
  { key: 'pantorrilla', label: 'Pantorrilla > 3 cm vs contralateral', tipo: 'bool', puntos: 1 },
  { key: 'fovea', label: 'Edema con fóvea (pierna sintomática)', tipo: 'bool', puntos: 1 },
  { key: 'colaterales', label: 'Venas superficiales colaterales', tipo: 'bool', puntos: 1 },
  { key: 'tvpPrevia', label: 'TVP previa documentada', tipo: 'bool', puntos: 1 },
  { key: 'alternativo', label: 'Dx alternativo MÁS probable que TVP', tipo: 'bool', puntos: -2 },
]

const curb65: CampoCalc[] = [
  { key: 'confusion', label: 'Confusión (desorientación reciente)', tipo: 'bool', puntos: 1 },
  { key: 'urea', label: 'Urea > 42 mg/dL (BUN > 19)', tipo: 'bool', puntos: 1 },
  { key: 'fr', label: 'Frecuencia respiratoria ≥ 30', tipo: 'bool', puntos: 1 },
  { key: 'ta', label: 'TAS < 90 o TAD ≤ 60 mmHg', tipo: 'bool', puntos: 1 },
  { key: 'edad65', label: 'Edad ≥ 65 años', tipo: 'bool', puntos: 1 },
]

const qsofa: CampoCalc[] = [
  { key: 'fr', label: 'Frecuencia respiratoria ≥ 22', tipo: 'bool', puntos: 1 },
  { key: 'mental', label: 'Alteración del estado mental (Glasgow < 15)', tipo: 'bool', puntos: 1 },
  { key: 'tas', label: 'TA sistólica ≤ 100 mmHg', tipo: 'bool', puntos: 1 },
]

const centor: CampoCalc[] = [
  { key: 'fiebre', label: 'Fiebre > 38 °C', tipo: 'bool', puntos: 1 },
  { key: 'sinTos', label: 'AUSENCIA de tos', tipo: 'bool', puntos: 1 },
  { key: 'adenopatia', label: 'Adenopatía cervical anterior dolorosa', tipo: 'bool', puntos: 1 },
  { key: 'exudado', label: 'Exudado o inflamación amigdalina', tipo: 'bool', puntos: 1 },
  { key: 'edad', label: 'Edad', tipo: 'opciones', opciones: [
    { label: '3-14 años', valor: 1 }, { label: '15-44 años', valor: 0 }, { label: '≥ 45 años', valor: -1 },
  ] },
]

const alvarado: CampoCalc[] = [
  { key: 'migracion', label: 'Migración del dolor a FID', tipo: 'bool', puntos: 1 },
  { key: 'anorexia', label: 'Anorexia', tipo: 'bool', puntos: 1 },
  { key: 'nausea', label: 'Náusea / vómito', tipo: 'bool', puntos: 1 },
  { key: 'dolorFid', label: 'Dolor a la palpación en FID', tipo: 'bool', puntos: 2 },
  { key: 'rebote', label: 'Rebote positivo', tipo: 'bool', puntos: 1 },
  { key: 'fiebre', label: 'Fiebre ≥ 37.3 °C', tipo: 'bool', puntos: 1 },
  { key: 'leucocitosis', label: 'Leucocitos > 10 000', tipo: 'bool', puntos: 2 },
  { key: 'neutrofilia', label: 'Neutrófilos > 75 %', tipo: 'bool', puntos: 1 },
]

const heart: CampoCalc[] = [
  { key: 'historia', label: 'Historia clínica', tipo: 'opciones', opciones: [
    { label: 'Poco sospechosa', valor: 0 }, { label: 'Moderadamente sospechosa', valor: 1 }, { label: 'Muy sospechosa', valor: 2 } ] },
  { key: 'ecg', label: 'ECG', tipo: 'opciones', opciones: [
    { label: 'Normal', valor: 0 }, { label: 'Alteración inespecífica de la repolarización', valor: 1 }, { label: 'Desnivel significativo del ST', valor: 2 } ] },
  { key: 'edad', label: 'Edad', tipo: 'opciones', opciones: [
    { label: '< 45 años', valor: 0 }, { label: '45-64 años', valor: 1 }, { label: '≥ 65 años', valor: 2 } ] },
  { key: 'factores', label: 'Factores de riesgo CV', tipo: 'opciones', opciones: [
    { label: 'Ninguno', valor: 0 }, { label: '1-2 factores', valor: 1 }, { label: '≥3 factores o ateroesclerosis conocida', valor: 2 } ] },
  { key: 'troponina', label: 'Troponina', tipo: 'opciones', opciones: [
    { label: 'Normal', valor: 0 }, { label: '1-3× el límite', valor: 1 }, { label: '> 3× el límite', valor: 2 } ] },
]

const glasgow: CampoCalc[] = [
  { key: 'ocular', label: 'Respuesta ocular', tipo: 'opciones', opciones: [
    { label: 'Ninguna', valor: 1 }, { label: 'Al dolor', valor: 2 }, { label: 'A la voz', valor: 3 }, { label: 'Espontánea', valor: 4 } ] },
  { key: 'verbal', label: 'Respuesta verbal', tipo: 'opciones', opciones: [
    { label: 'Ninguna', valor: 1 }, { label: 'Sonidos incomprensibles', valor: 2 }, { label: 'Palabras inapropiadas', valor: 3 },
    { label: 'Confusa', valor: 4 }, { label: 'Orientada', valor: 5 } ] },
  { key: 'motora', label: 'Respuesta motora', tipo: 'opciones', opciones: [
    { label: 'Ninguna', valor: 1 }, { label: 'Extensión (descerebración)', valor: 2 }, { label: 'Flexión anormal (decorticación)', valor: 3 },
    { label: 'Retirada al dolor', valor: 4 }, { label: 'Localiza el dolor', valor: 5 }, { label: 'Obedece órdenes', valor: 6 } ] },
]

const childPugh: CampoCalc[] = [
  { key: 'bili', label: 'Bilirrubina total', tipo: 'opciones', opciones: [
    { label: '< 2 mg/dL', valor: 1 }, { label: '2-3 mg/dL', valor: 2 }, { label: '> 3 mg/dL', valor: 3 } ] },
  { key: 'albumina', label: 'Albúmina', tipo: 'opciones', opciones: [
    { label: '> 3.5 g/dL', valor: 1 }, { label: '2.8-3.5 g/dL', valor: 2 }, { label: '< 2.8 g/dL', valor: 3 } ] },
  { key: 'inr', label: 'INR', tipo: 'opciones', opciones: [
    { label: '< 1.7', valor: 1 }, { label: '1.7-2.3', valor: 2 }, { label: '> 2.3', valor: 3 } ] },
  { key: 'ascitis', label: 'Ascitis', tipo: 'opciones', opciones: [
    { label: 'Ausente', valor: 1 }, { label: 'Leve / controlada', valor: 2 }, { label: 'Moderada-grave / refractaria', valor: 3 } ] },
  { key: 'encefalopatia', label: 'Encefalopatía', tipo: 'opciones', opciones: [
    { label: 'Ausente', valor: 1 }, { label: 'Grado I-II', valor: 2 }, { label: 'Grado III-IV', valor: 3 } ] },
]

/** CKD-EPI 2021 (SIN coeficiente de raza). */
export function ckdEpi2021(creatinina: number, edad: number, esMujer: boolean): number {
  const scr = Math.max(creatinina, 0.01)
  const k = esMujer ? 0.7 : 0.9
  const a = esMujer ? -0.241 : -0.302
  const tfg = 142 * Math.pow(Math.min(scr / k, 1), a) * Math.pow(Math.max(scr / k, 1), -1.200) *
    Math.pow(0.9938, edad) * (esMujer ? 1.012 : 1)
  return Math.round(tfg * 10) / 10
}

/** MELD (UNOS): valores < 1 se llevan a 1; creatinina se topa en 4. */
export function meld(bilirrubina: number, inr: number, creatinina: number): number {
  const b = Math.max(bilirrubina, 1), i = Math.max(inr, 1)
  const c = Math.min(Math.max(creatinina, 1), 4)
  const v = 3.78 * Math.log(b) + 11.2 * Math.log(i) + 9.57 * Math.log(c) + 6.43
  return Math.max(6, Math.min(40, Math.round(v)))
}

// ── Catálogo ────────────────────────────────────────────────────────────────

export const CALCULADORAS: Calculadora[] = [
  {
    id: 'cha2ds2vasc', nombre: 'CHA₂DS₂-VASc', para: 'Fibrilación auricular — riesgo embólico',
    disparadores: ['fibrilacion auricular', 'fibrilación auricular', 'fa ', 'flutter', 'arritmia'],
    campos: chads, referencia: 'Lip GYH et al. Chest 2010 · ESC 2024',
    calcular: v => {
      const p = suma(v, chads)
      const mujer = !!n(v, 'mujer')
      const umbral = mujer ? 3 : 2
      const nivel = p >= umbral ? 'alto' : p === umbral - 1 ? 'medio' : 'bajo'
      return {
        puntaje: p, categoria: nivel === 'alto' ? 'Riesgo alto' : nivel === 'medio' ? 'Riesgo intermedio' : 'Riesgo bajo',
        nivel,
        interpretacion: nivel === 'alto'
          ? 'Anticoagulación oral indicada (ACOD de preferencia sobre warfarina, salvo válvula mecánica o estenosis mitral).'
          : nivel === 'medio' ? 'Considerar anticoagulación individualizando riesgo/beneficio.'
          : 'No se recomienda anticoagular solo por el score; reevaluar periódicamente.',
      }
    },
  },
  {
    id: 'hasbled', nombre: 'HAS-BLED', para: 'Riesgo de sangrado con anticoagulación',
    disparadores: ['fibrilacion auricular', 'fibrilación auricular', 'anticoagul', 'warfarina', 'apixaban', 'rivaroxaban'],
    campos: hasbled, referencia: 'Pisters R et al. Chest 2010',
    calcular: v => {
      const p = suma(v, hasbled)
      const nivel = p >= 3 ? 'alto' : p === 2 ? 'medio' : 'bajo'
      return {
        puntaje: p, nivel,
        categoria: nivel === 'alto' ? 'Riesgo alto de sangrado' : nivel === 'medio' ? 'Riesgo intermedio' : 'Riesgo bajo',
        interpretacion: p >= 3
          ? 'NO contraindica anticoagular: obliga a corregir los factores modificables (TA, AINE, alcohol, INR lábil) y vigilar más de cerca.'
          : 'Riesgo aceptable; corrige de todos modos los factores modificables.',
      }
    },
  },
  {
    id: 'wells-tep', nombre: 'Wells (TEP)', para: 'Probabilidad de tromboembolia pulmonar',
    disparadores: ['tep', 'tromboembolia', 'embolia pulmonar', 'disnea', 'dolor toracico pleuritico'],
    campos: wellsTep, referencia: 'Wells PS et al. Thromb Haemost 2000',
    calcular: v => {
      const p = suma(v, wellsTep)
      const nivel = p > 6 ? 'alto' : p >= 2 ? 'medio' : 'bajo'
      return {
        puntaje: p, nivel,
        categoria: p > 4 ? 'TEP probable' : 'TEP improbable',
        interpretacion: p > 4
          ? 'TEP probable → angioTAC pulmonar directo (no dímero D).'
          : 'TEP improbable → dímero D; si es negativo se descarta razonablemente.',
      }
    },
  },
  {
    id: 'wells-tvp', nombre: 'Wells (TVP)', para: 'Probabilidad de trombosis venosa profunda',
    disparadores: ['tvp', 'trombosis venosa', 'edema de pierna', 'edema miembro'],
    campos: wellsTvp, referencia: 'Wells PS et al. Lancet 1997',
    calcular: v => {
      const p = suma(v, wellsTvp)
      const nivel = p >= 2 ? 'alto' : 'bajo'
      return {
        puntaje: p, nivel,
        categoria: p >= 2 ? 'TVP probable' : 'TVP improbable',
        interpretacion: p >= 2
          ? 'TVP probable → ultrasonido Doppler de compresión.'
          : 'TVP improbable → dímero D; si es negativo se descarta.',
      }
    },
  },
  {
    id: 'curb65', nombre: 'CURB-65', para: 'Neumonía adquirida en la comunidad — severidad',
    disparadores: ['neumonia', 'neumonía', 'nac', 'infeccion respiratoria baja'],
    campos: curb65, referencia: 'Lim WS et al. Thorax 2003',
    calcular: v => {
      const p = suma(v, curb65)
      const nivel = p >= 3 ? 'alto' : p === 2 ? 'medio' : 'bajo'
      return {
        puntaje: p, nivel,
        categoria: p >= 3 ? 'Severa' : p === 2 ? 'Moderada' : 'Leve',
        interpretacion: p >= 3
          ? 'Hospitalizar; valorar UCI si ≥4. Mortalidad alta.'
          : p === 2 ? 'Considerar hospitalización o manejo supervisado.'
          : 'Candidato a manejo ambulatorio si no hay otros factores (hipoxemia, comorbilidad, soporte social).',
      }
    },
  },
  {
    id: 'qsofa', nombre: 'qSOFA', para: 'Tamizaje de sepsis fuera de UCI',
    disparadores: ['sepsis', 'infeccion', 'infección', 'fiebre', 'choque septico'],
    campos: qsofa, referencia: 'Singer M et al. JAMA 2016 (Sepsis-3)',
    calcular: v => {
      const p = suma(v, qsofa)
      const nivel = p >= 2 ? 'alto' : p === 1 ? 'medio' : 'bajo'
      return {
        puntaje: p, nivel,
        categoria: p >= 2 ? 'qSOFA positivo' : 'qSOFA negativo',
        interpretacion: p >= 2
          ? 'Mayor riesgo de mortalidad: evaluar disfunción orgánica (SOFA), lactato, cultivos y antibiótico precoz.'
          : 'No descarta sepsis: si la sospecha clínica es alta, sigue el protocolo igual.',
      }
    },
  },
  {
    id: 'centor', nombre: 'Centor / McIsaac', para: 'Faringitis — probabilidad de estreptococo',
    disparadores: ['faringitis', 'amigdalitis', 'odinofagia', 'dolor de garganta'],
    campos: centor, referencia: 'McIsaac WJ et al. CMAJ 1998',
    calcular: v => {
      const p = suma(v, centor)
      const nivel = p >= 4 ? 'alto' : p >= 2 ? 'medio' : 'bajo'
      return {
        puntaje: p, nivel,
        categoria: p >= 4 ? 'Alta probabilidad' : p >= 2 ? 'Probabilidad intermedia' : 'Baja probabilidad',
        interpretacion: p <= 1
          ? 'No hacer prueba ni dar antibiótico: manejo sintomático.'
          : p <= 3 ? 'Hacer prueba rápida o cultivo; tratar solo si es positiva.'
          : 'Prueba rápida; si es positiva, penicilina/amoxicilina (alergia: macrólido).',
      }
    },
  },
  {
    id: 'alvarado', nombre: 'Alvarado', para: 'Apendicitis aguda — probabilidad',
    disparadores: ['apendicitis', 'dolor abdominal', 'fosa iliaca derecha', 'abdomen agudo'],
    campos: alvarado, referencia: 'Alvarado A. Ann Emerg Med 1986',
    calcular: v => {
      const p = suma(v, alvarado)
      const nivel = p >= 7 ? 'alto' : p >= 5 ? 'medio' : 'bajo'
      return {
        puntaje: p, nivel,
        categoria: p >= 9 ? 'Muy probable' : p >= 7 ? 'Probable' : p >= 5 ? 'Posible' : 'Improbable',
        interpretacion: p >= 7
          ? 'Alta probabilidad: valoración quirúrgica; imagen según disponibilidad y sexo/edad.'
          : p >= 5 ? 'Zona gris: imagen (US/TAC) y observación seriada.'
          : 'Baja probabilidad: buscar diagnóstico alternativo; reevaluar si empeora.',
      }
    },
  },
  {
    id: 'heart', nombre: 'HEART', para: 'Dolor torácico — riesgo de evento cardiaco',
    disparadores: ['dolor toracico', 'dolor torácico', 'angina', 'sindrome coronario', 'precordial'],
    campos: heart, referencia: 'Six AJ et al. Neth Heart J 2008',
    calcular: v => {
      const faltan = camposSinResponder(v, heart)
      if (faltan) return scoreIncompleto(faltan)
      const p = suma(v, heart)
      const nivel = p >= 7 ? 'alto' : p >= 4 ? 'medio' : 'bajo'
      return {
        puntaje: p, nivel,
        categoria: p >= 7 ? 'Riesgo alto' : p >= 4 ? 'Riesgo moderado' : 'Riesgo bajo',
        interpretacion: p <= 3
          ? 'Riesgo bajo (~2 % de eventos): alta temprana con seguimiento es razonable.'
          : p <= 6 ? 'Riesgo moderado: observación, troponinas seriadas y prueba de isquemia.'
          : 'Riesgo alto: manejo invasivo temprano / cardiología.',
      }
    },
  },
  {
    id: 'glasgow', nombre: 'Glasgow (GCS)', para: 'Nivel de conciencia',
    disparadores: ['tce', 'traumatismo craneo', 'alteracion del estado', 'coma', 'inconsciente', 'estado mental'],
    campos: glasgow, referencia: 'Teasdale G, Jennett B. Lancet 1974',
    calcular: v => {
      const faltan = camposSinResponder(v, glasgow)
      if (faltan) return scoreIncompleto(faltan)
      const p = suma(v, glasgow)
      const nivel = p <= 8 ? 'alto' : p <= 12 ? 'medio' : 'bajo'
      return {
        puntaje: p, nivel,
        categoria: p <= 8 ? 'Grave' : p <= 12 ? 'Moderado' : 'Leve',
        interpretacion: p <= 8
          ? 'TCE grave: proteger vía aérea (considerar intubación), TAC urgente.'
          : p <= 12 ? 'Moderado: vigilancia estrecha e imagen.' : 'Leve: observación según mecanismo y factores de riesgo.',
      }
    },
  },
  {
    id: 'child-pugh', nombre: 'Child-Pugh', para: 'Cirrosis — clase funcional',
    disparadores: ['cirrosis', 'hepatopatia', 'hepatopatía', 'hepatica cronica', 'ascitis'],
    campos: childPugh, referencia: 'Pugh RNH et al. Br J Surg 1973',
    calcular: v => {
      const faltan = camposSinResponder(v, childPugh)
      if (faltan) return scoreIncompleto(faltan)
      const p = suma(v, childPugh)
      const clase = p <= 6 ? 'A' : p <= 9 ? 'B' : 'C'
      const nivel = clase === 'C' ? 'alto' : clase === 'B' ? 'medio' : 'bajo'
      return {
        puntaje: p, nivel, categoria: `Clase ${clase}`,
        interpretacion: clase === 'A'
          ? 'Enfermedad compensada; buen pronóstico quirúrgico relativo.'
          : clase === 'B' ? 'Compromiso funcional significativo: riesgo quirúrgico elevado, valorar trasplante.'
          : 'Descompensada: riesgo quirúrgico muy alto; evaluación para trasplante.',
      }
    },
  },
]

/** Devuelve las calculadoras pertinentes para el texto de diagnósticos/motivo. */
export function calculadorasSugeridas(texto: string): Calculadora[] {
  const t = (texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!t.trim()) return []
  return CALCULADORAS.filter(c =>
    c.disparadores.some(d => t.includes(d.normalize('NFD').replace(/[̀-ͯ]/g, ''))))
}
