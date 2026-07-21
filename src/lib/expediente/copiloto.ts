/**
 * COPILOTO CLÍNICO — el motor que hace que las herramientas dejen de ser botones.
 *
 * Regla de diseño: NO se le pide nada al médico. Este motor lee lo que YA está
 * capturado en la consulta (edad, sexo, signos vitales, diagnósticos, receta) y
 * devuelve solo lo que puede CALCULAR o lo que la seguridad del paciente obliga
 * a decir. Si un dato falta, no se pinta un formulario: se calla, o pide ese
 * dato en una línea.
 *
 * Consecuencia práctica: una consulta normal no dispara nada. Un niño con una
 * receta dispara la verificación de dosis por peso. Una alergia que choca con
 * lo recetado dispara una alerta crítica. Nada más.
 *
 * Todo es PURO y testeado. El médico decide; esto solo pone lo que ya se sabe.
 */

import { FARMACOS_PED, calcularDosisPediatrica, imc as calcImc } from './pediatria'
import { AJUSTE_RENAL, ajustePorTFG, EMBARAZO_LACTANCIA } from './prescripcion-segura'
import { ckdEpi2021 } from './calculadoras'
import { metaLipidica } from './cardiometabolico/dislipidemia'
import { clasificarIMC } from './cardiometabolico/obesidad'
import { fib4, interpretarFib4 } from './cardiometabolico/masld'
import { prevent, motivoSinPrevent } from './prevent'

export type NivelSugerencia = 'critico' | 'accion' | 'info'

export interface Sugerencia {
  id: string
  nivel: NivelSugerencia
  titulo: string
  detalle: string
  /** Texto listo para pegarse en la nota. Vacío = no tiene sentido documentarlo. */
  textoNota: string
  /** Qué dato falta para poder calcular esto (solo cuando aporta pedirlo). */
  pide?: string
}

export interface MedicamentoConsulta { nombre: string; dosis?: string }
export interface DiagnosticoConsulta { descripcion: string }

export interface SignosConsulta {
  ta?: string
  fc?: number
  fr?: number
  temperatura?: number
  spo2?: number
  peso?: number
  talla?: number
}

export interface EntradaCopiloto {
  edad?: number
  sexo?: string
  alergias?: string
  diagnosticos?: DiagnosticoConsulta[]
  medicamentos?: MedicamentoConsulta[]
  signos?: SignosConsulta
  /** Laboratorios sueltos si la nota los trae: creatinina, ast, alt, plaquetas, ldl… */
  labs?: Record<string, number>
}

// ── utilidades ──────────────────────────────────────────────────────────────

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Sistólica de una TA escrita como "120/80". */
export function sistolica(ta?: string): number | undefined {
  if (!ta) return undefined
  const m = ta.match(/(\d{2,3})\s*\/\s*(\d{2,3})/)
  return m ? Number(m[1]) : undefined
}
export function diastolica(ta?: string): number | undefined {
  if (!ta) return undefined
  const m = ta.match(/(\d{2,3})\s*\/\s*(\d{2,3})/)
  return m ? Number(m[2]) : undefined
}

/**
 * Familias de alergia: si el paciente es alérgico a penicilina, una cefalosporina
 * también debe saltar. Comparar solo por nombre exacto dejaría pasar justo el
 * caso peligroso.
 */
const FAMILIAS_ALERGIA: { familia: string; dispara: string[]; miembros: string[] }[] = [
  {
    familia: 'betalactámicos',
    dispara: ['penicilina', 'amoxicilina', 'ampicilina', 'betalactam', 'cefalosporina', 'peni'],
    miembros: ['penicilina', 'amoxicilina', 'ampicilina', 'dicloxacilina', 'piperacilina',
      'cefalexina', 'cefuroxima', 'ceftriaxona', 'cefotaxima', 'cefepime', 'cefazolina',
      'cefixima', 'ceftazidima', 'meropenem', 'imipenem', 'ertapenem'],
  },
  {
    familia: 'sulfas',
    dispara: ['sulfa', 'sulfonamida', 'trimetoprim', 'tmp', 'bactrim'],
    miembros: ['trimetoprim', 'sulfametoxazol', 'sulfadiazina', 'furosemida', 'hidroclorotiazida'],
  },
  {
    familia: 'antiinflamatorios no esteroideos',
    dispara: ['aine', 'aspirina', 'acido acetilsalicilico', 'ibuprofeno', 'naproxeno', 'antiinflamatorio'],
    miembros: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'ketorolaco', 'indometacina',
      'meloxicam', 'aspirina', 'acido acetilsalicilico', 'celecoxib'],
  },
  {
    familia: 'quinolonas',
    dispara: ['quinolona', 'ciprofloxacino', 'levofloxacino'],
    miembros: ['ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'norfloxacino'],
  },
  {
    familia: 'macrólidos',
    dispara: ['macrolido', 'eritromicina', 'azitromicina', 'claritromicina'],
    miembros: ['eritromicina', 'azitromicina', 'claritromicina'],
  },
]

// ── 1. SEGURIDAD: alergia contra lo recetado ────────────────────────────────

function alergiaVsReceta(e: EntradaCopiloto): Sugerencia[] {
  const alergias = norm(e.alergias ?? '')
  if (!alergias || /ning|nega|no refier|sin alerg/.test(alergias)) return []
  const meds = e.medicamentos ?? []
  if (meds.length === 0) return []

  const out: Sugerencia[] = []
  for (const fam of FAMILIAS_ALERGIA) {
    if (!fam.dispara.some(d => alergias.includes(d))) continue
    for (const m of meds) {
      const nm = norm(m.nombre ?? '')
      if (!nm) continue
      const choca = fam.miembros.find(x => nm.includes(x))
      if (!choca) continue
      out.push({
        id: `alergia:${fam.familia}:${choca}`,
        nivel: 'critico',
        titulo: `${m.nombre} choca con una alergia registrada`,
        detalle: `El paciente tiene registrada alergia a ${fam.familia}, y ${m.nombre} pertenece a esa familia. Confirma la reacción previa antes de recetarlo o cambia de familia.`,
        textoNota: `Se identificó que ${m.nombre} pertenece a la familia de ${fam.familia}, a la que el paciente refiere alergia. Se verificó con el paciente antes de prescribir.`,
      })
    }
  }
  return out
}

// ── 2. SEGURIDAD: dosis pediátrica contra el peso real ──────────────────────

/** Extrae los miligramos de un texto de dosis ("500 mg", "1 g", "0.5 g"). */
export function mgDeTexto(dosis?: string): number | undefined {
  if (!dosis) return undefined
  const g = dosis.match(/([\d.]+)\s*g\b/i)
  if (g) return Number(g[1]) * 1000
  const mg = dosis.match(/([\d.]+)\s*mg\b/i)
  if (mg) return Number(mg[1])
  return undefined
}

function dosisPediatrica(e: EntradaCopiloto): Sugerencia[] {
  const edad = e.edad
  const peso = e.signos?.peso
  const meds = e.medicamentos ?? []
  if (edad == null || edad >= 18 || meds.length === 0) return []

  if (!peso || peso <= 0) {
    return [{
      id: 'ped:falta-peso',
      nivel: 'accion',
      titulo: 'Falta el peso para verificar las dosis',
      detalle: 'Es un paciente pediátrico con receta. Con el peso puedo comprobar cada dosis contra el rango por kilogramo y avisarte si alguna rebasa el tope de adulto.',
      textoNota: '',
      pide: 'peso',
    }]
  }

  const out: Sugerencia[] = []
  for (const m of meds) {
    const nm = norm(m.nombre ?? '')
    const f = FARMACOS_PED.find(x => nm.includes(norm(x.nombre)) || norm(x.nombre).includes(nm))
    if (!f) continue
    const d = calcularDosisPediatrica(f, peso)
    if (!d) continue

    const recetada = mgDeTexto(m.dosis)
    const excede = recetada != null && recetada > d.porToma.max * 1.05
    const corta = recetada != null && recetada < d.porToma.min * 0.95

    out.push({
      id: `ped:dosis:${f.nombre}`,
      nivel: excede ? 'critico' : 'accion',
      titulo: excede
        ? `${f.nombre}: la dosis recetada rebasa el rango para ${peso} kg`
        : `${f.nombre} para ${peso} kg`,
      detalle: excede
        ? `Recetaste ${recetada} ${d.unidad} por toma; para ${peso} kg el rango es ${d.porToma.min} a ${d.porToma.max} ${d.unidad} ${d.intervalo}${d.topeAplicado ? ' (ya con el tope de adulto aplicado)' : ''}.`
        : corta
          ? `Recetaste ${recetada} ${d.unidad}; el rango para ${peso} kg es ${d.porToma.min} a ${d.porToma.max} ${d.unidad} ${d.intervalo}. Verifica si es intencional.`
          : `${d.porToma.min === d.porToma.max ? d.porToma.max : `${d.porToma.min} a ${d.porToma.max}`} ${d.unidad} ${d.intervalo}${d.topeAplicado ? ' · ya con el tope de adulto' : ''}.`,
      textoNota: `${f.nombre}: ${d.porToma.min === d.porToma.max ? d.porToma.max : `${d.porToma.min}-${d.porToma.max}`} ${d.unidad} ${d.intervalo} para ${peso} kg${d.nota ? `. ${d.nota}` : ''}`,
    })
  }
  return out
}

// ── 3. SEGURIDAD: ajuste renal de lo recetado ───────────────────────────────

function ajusteRenal(e: EntradaCopiloto): Sugerencia[] {
  const cr = e.labs?.creatinina
  const edad = e.edad
  const meds = e.medicamentos ?? []
  if (!cr || !edad || meds.length === 0) return []

  const tfg = ckdEpi2021(cr, edad, !!e.sexo && /^f/i.test(e.sexo))
  if (!Number.isFinite(tfg) || tfg >= 60) return []

  const out: Sugerencia[] = []
  for (const m of meds) {
    const nm = norm(m.nombre ?? '')
    const f = AJUSTE_RENAL.find(x => nm.includes(norm(x.nombre)) || norm(x.nombre).includes(nm))
    if (!f) continue
    const a = ajustePorTFG(f, tfg)
    if (!a) continue
    out.push({
      id: `renal:${f.nombre}`,
      nivel: a.contraindicado ? 'critico' : 'accion',
      titulo: a.contraindicado
        ? `${f.nombre} está contraindicado con TFG de ${Math.round(tfg)}`
        : `${f.nombre} requiere ajuste con TFG de ${Math.round(tfg)}`,
      detalle: a.conducta + (a.nota ? ` ${a.nota}` : ''),
      textoNota: `Con TFG estimada de ${Math.round(tfg)} mL/min/1.73 m² (CKD-EPI 2021): ${f.nombre} — ${a.conducta}`,
    })
  }
  return out
}

// ── 4. SEGURIDAD: fármaco de riesgo en mujer en edad fértil ─────────────────

function riesgoGestacional(e: EntradaCopiloto): Sugerencia[] {
  const esMujer = !!e.sexo && /^f/i.test(e.sexo)
  const edad = e.edad
  if (!esMujer || edad == null || edad < 12 || edad > 50) return []
  const meds = e.medicamentos ?? []
  const out: Sugerencia[] = []
  for (const m of meds) {
    const nm = norm(m.nombre ?? '')
    if (!nm) continue
    const g = EMBARAZO_LACTANCIA.find(x =>
      x.embarazo === 'contraindicado' &&
      // Sinónimos (principios activos) PRIMERO: el nombre de clase ('Inhibidores de
      // la enzima…') nunca casa con "enalapril"/"losartan"; sin esto, un IECA/ARA-II
      // o un anticoagulante directo en embarazo NO disparaba la alerta crítica.
      ((x.sinonimos ?? []).some(s => nm.includes(norm(s))) ||
       nm.includes(norm(x.farmaco)) ||
       norm(x.farmaco).split(/[ ,]/).some(w => w.length > 5 && nm.includes(w))))
    if (!g) continue
    out.push({
      id: `gesta:${m.nombre}`,
      nivel: 'critico',
      titulo: `${m.nombre} está contraindicado en el embarazo`,
      // Correcto en ambos casos (el motor aún no sabe con certeza si hay embarazo):
      // si está embarazada → suspender; si no → descartar antes de prescribir.
      detalle: `${g.motivo}${g.alternativa ? ` Alternativa: ${g.alternativa}` : ''} Si la paciente está o pudiera estar embarazada, suspender de inmediato; si no, descarta embarazo antes de prescribir y comenta planeación/anticoncepción.`,
      textoNota: `Se comentó con la paciente que ${m.nombre} está contraindicado en el embarazo. ${g.motivo}`,
    })
  }
  return out
}

// ── 5. SIGNOS VITALES QUE CRUZAN UMBRAL ─────────────────────────────────────

function signosDeAlarma(e: EntradaCopiloto): Sugerencia[] {
  const s = e.signos
  if (!s) return []
  const out: Sugerencia[] = []
  const tas = sistolica(s.ta)
  const tad = diastolica(s.ta)

  // qSOFA: dos de los tres componentes son medibles con lo que ya hay. Si esos
  // dos ya suman 2, el puntaje YA es positivo — no puede bajar con el tercero.
  if (s.fr != null && tas != null && s.fr >= 22 && tas <= 100) {
    out.push({
      id: 'vital:qsofa',
      nivel: 'critico',
      titulo: 'qSOFA ya es positivo con los signos capturados',
      detalle: `Frecuencia respiratoria ${s.fr} y sistólica ${tas}: dos criterios de qSOFA. Ante sospecha de infección, indica mayor riesgo de mortalidad y obliga a valorar sepsis y el nivel de atención.`,
      textoNota: `qSOFA positivo (FR ${s.fr}/min y TAS ${tas} mmHg). Se valora sepsis y nivel de atención.`,
    })
  }

  if (s.spo2 != null && s.spo2 < 90) {
    out.push({
      id: 'vital:hipoxemia',
      nivel: 'critico',
      titulo: `Hipoxemia: SpO₂ ${s.spo2}%`,
      detalle: 'Saturación por debajo de 90%. Requiere oxígeno suplementario y valorar el nivel de atención.',
      textoNota: `SpO₂ de ${s.spo2}% al aire ambiente. Se indica oxígeno suplementario y se valora el nivel de atención.`,
    })
  }

  if (tas != null && tas < 90) {
    out.push({
      id: 'vital:hipotension',
      nivel: 'critico',
      titulo: `Hipotensión: sistólica ${tas} mmHg`,
      detalle: 'Presión sistólica por debajo de 90. Valora perfusión, causa y necesidad de reanimación con líquidos.',
      textoNota: `TA ${s.ta} mmHg. Se valora estado de perfusión y causa de la hipotensión.`,
    })
  }

  if (tas != null && tad != null && (tas >= 180 || tad >= 110)) {
    out.push({
      id: 'vital:crisis-ht',
      nivel: 'critico',
      titulo: `Cifras de crisis hipertensiva: ${s.ta} mmHg`,
      detalle: 'Distingue urgencia de emergencia hipertensiva: busca daño agudo a órgano blanco (neurológico, cardiaco, renal, visual).',
      textoNota: `TA ${s.ta} mmHg. Se busca intencionadamente daño agudo a órgano blanco para distinguir urgencia de emergencia hipertensiva.`,
    })
  } else if (tas != null && tad != null && (tas >= 140 || tad >= 90) && (e.edad ?? 0) >= 18) {
    out.push({
      id: 'vital:ht',
      nivel: 'info',
      titulo: `Cifras elevadas: ${s.ta} mmHg`,
      detalle: 'Por arriba de 140/90. Una sola toma no diagnostica hipertensión: confirma con tomas repetidas o monitoreo ambulatorio.',
      textoNota: `TA ${s.ta} mmHg. Se indica confirmar con tomas seriadas antes de establecer el diagnóstico.`,
    })
  }

  if (s.fc != null && s.fc >= 120) {
    out.push({
      id: 'vital:taquicardia',
      nivel: 'accion',
      titulo: `Taquicardia: ${s.fc} lpm`,
      detalle: 'Busca causa: fiebre, dolor, deshidratación, anemia, hipoxemia, arritmia o tirotoxicosis.',
      textoNota: `FC de ${s.fc} lpm. Se busca causa de la taquicardia.`,
    })
  }

  if (s.temperatura != null && s.temperatura >= 38) {
    out.push({
      id: 'vital:fiebre',
      nivel: 'info',
      titulo: `Fiebre: ${s.temperatura} °C`,
      detalle: 'Documenta foco infeccioso y tiempo de evolución.',
      textoNota: `Temperatura de ${s.temperatura} °C.`,
    })
  }
  return out
}

// ── 6. LO QUE SE PUEDE CALCULAR SOLO ────────────────────────────────────────

function calculosAutomaticos(e: EntradaCopiloto): Sugerencia[] {
  const out: Sugerencia[] = []
  const s = e.signos
  const edad = e.edad

  // IMC
  if (s?.peso && s?.talla) {
    const i = calcImc(s.peso, s.talla)
    if (Number.isFinite(i)) {
      const pediatrico = edad != null && edad < 18
      out.push({
        id: 'calc:imc',
        nivel: 'info',
        titulo: `IMC ${i}`,
        detalle: pediatrico
          ? 'En menores de 18 años el IMC se interpreta por percentil para edad y sexo, no por los cortes de adulto.'
          : `${clasificarIMC(i)}.`,
        textoNota: pediatrico
          ? `IMC ${i} kg/m² (a interpretar por percentil para edad y sexo).`
          : `IMC ${i} kg/m² — ${clasificarIMC(i)}.`,
      })
    }
  }

  // Función renal
  if (e.labs?.creatinina && edad != null) {
    const tfg = ckdEpi2021(e.labs.creatinina, edad, !!e.sexo && /^f/i.test(e.sexo))
    if (Number.isFinite(tfg)) {
      out.push({
        id: 'calc:tfg',
        nivel: tfg < 45 ? 'accion' : 'info',
        titulo: `TFG estimada ${Math.round(tfg)} mL/min/1.73 m²`,
        detalle: tfg < 60
          ? 'Por debajo de 60: revisa que todo lo que se elimina por riñón esté ajustado.'
          : 'Por CKD-EPI 2021, sin coeficiente de raza.',
        textoNota: `TFG estimada por CKD-EPI 2021: ${Math.round(tfg)} mL/min/1.73 m² (creatinina ${e.labs.creatinina} mg/dL).`,
      })
    }
  }

  // FIB-4 cuando los laboratorios ya están
  const { ast, alt, plaquetas } = e.labs ?? {}
  if (ast && alt && plaquetas && edad != null) {
    const v = fib4(edad, ast, plaquetas, alt)
    const r = v != null ? interpretarFib4(v, edad) : null
    if (r) {
      out.push({
        id: 'calc:fib4',
        nivel: r.zona === 'alto' ? 'accion' : 'info',
        titulo: `FIB-4 ${r.valor} — ${r.zona === 'bajo' ? 'riesgo bajo' : r.zona === 'alto' ? 'riesgo alto de fibrosis' : 'zona indeterminada'}`,
        detalle: r.conducta,
        textoNota: `FIB-4 de ${r.valor}. ${r.interpretacion} ${r.conducta}`,
      })
    }
  }

  return out
}

// ── 7. METAS SEGÚN EL DIAGNÓSTICO ───────────────────────────────────────────

function metasPorDiagnostico(e: EntradaCopiloto): Sugerencia[] {
  const dx = norm((e.diagnosticos ?? []).map(d => d.descripcion).join(' · '))
  if (!dx) return []
  const out: Sugerencia[] = []

  const tieneDiabetes = /diabetes|dm2|dm 2|dm1/.test(dx)
  const tieneASCVD = /infarto|cardiopatia isquemica|angina|evc|isquemi|arteriopat|aterosclerosis|revasculariza/.test(dx)
  const tieneDislip = /dislipidemia|hipercolesterolemia|hipertriglicerid|colesterol/.test(dx)

  if (tieneDiabetes || tieneASCVD || tieneDislip) {
    const meta = metaLipidica({ diabetes: tieneDiabetes, ascvdClinica: tieneASCVD, tg: e.labs?.trigliceridos })
    const ldl = e.labs?.ldl
    out.push({
      id: 'meta:ldl',
      nivel: ldl != null && ldl > meta.ldl ? 'accion' : 'info',
      titulo: `Meta de LDL-C: menos de ${meta.ldl} mg/dL`,
      detalle: ldl != null
        ? (ldl > meta.ldl
            ? `Está en ${ldl}: faltan ${Math.round(ldl - meta.ldl)} mg/dL. ${meta.poblacion}.`
            : `Está en ${ldl}, dentro de meta. ${meta.poblacion}.`)
        : `${meta.poblacion}. Con el LDL puedo decirte cuánto falta.`,
      textoNota: `Meta de LDL-C menor de ${meta.ldl} mg/dL y no-HDL-C menor de ${meta.noHDL} mg/dL (${meta.poblacion}), según la guía ACC/AHA 2026.`,
      pide: ldl == null ? 'LDL' : undefined,
    })
  }

  // MASLD (antes «hígado graso no alcohólico»): el tamizaje con FIB-4 se hace
  // aunque las enzimas estén normales.
  if ((tieneDiabetes || /obesidad|sobrepeso|higado graso|esteatosis/.test(dx)) && !(e.labs?.ast && e.labs?.alt && e.labs?.plaquetas)) {
    out.push({
      id: 'meta:fib4-tamizaje',
      nivel: 'info',
      titulo: 'Corresponde tamizar esteatosis hepática metabólica (MASLD) con FIB-4',
      detalle: 'La ADA lo indica anual en diabetes tipo 2, prediabetes u obesidad con factor cardiovascular, AUNQUE las enzimas hepáticas estén normales: la mayoría de quienes tienen fibrosis significativa las tiene normales.',
      textoNota: 'Se solicita AST, ALT y plaquetas para calcular FIB-4 como tamizaje de fibrosis hepática (ADA, Standards of Care 2026).',
      pide: 'AST, ALT y plaquetas',
    })
  }

  return out
}

// ── 8. RIESGO CARDIOVASCULAR (PREVENT) ──────────────────────────────────────

/**
 * La guía ACC/AHA 2026 pide estimar el riesgo con PREVENT en prevención
 * primaria de 30 a 79 años. No se le pregunta nada al médico: si los datos ya
 * están en la nota se calcula, y si falta alguno se dice cuál en una línea.
 */
function riesgoCardiovascular(e: EntradaCopiloto): Sugerencia[] {
  const dx = norm((e.diagnosticos ?? []).map(d => d.descripcion).join(' · '))
  // En prevención SECUNDARIA no aplica: ahí la meta ya la fija el evento previo.
  if (/infarto|cardiopatia isquemica|angina|evc|isquemi|arteriopat|revasculariza/.test(dx)) return []
  if (e.edad == null || e.edad < 30 || e.edad > 79) return []

  const tfg = e.labs?.tfg ?? (e.labs?.creatinina && e.edad
    ? ckdEpi2021(e.labs.creatinina, e.edad, !!e.sexo && /^f/i.test(e.sexo))
    : undefined)

  const entrada = {
    edad: e.edad,
    esMujer: !!e.sexo && /^f/i.test(e.sexo),
    tas: sistolica(e.signos?.ta) ?? 0,
    colesterolTotal: e.labs?.colesterolTotal ?? 0,
    hdl: e.labs?.hdl ?? 0,
    tfg: tfg ?? 0,
    diabetes: /diabetes|dm2|dm 2|dm1/.test(dx),
    fuma: /tabaquismo|fumador|fuma/.test(dx),
    tomaAntihipertensivo: (e.medicamentos ?? []).some(m =>
      /losartan|telmisartan|valsartan|enalapril|lisinopril|amlodipino|metoprolol|hidroclorotiazida|clortalidona/
        .test(norm(m.nombre ?? ''))),
    tomaEstatina: (e.medicamentos ?? []).some(m =>
      /atorvastatina|rosuvastatina|simvastatina|pravastatina|pitavastatina|lovastatina|fluvastatina/
        .test(norm(m.nombre ?? ''))),
  }

  const r = prevent(entrada)
  if (!r) {
    // No se pide en cualquier consulta: en una faringitis, pedir colesterol y
    // TFG para estimar riesgo cardiovascular es justo el ruido que hace que las
    // alertas dejen de leerse. Solo cuando el propio caso ya lo justifica.
    const pertinente = /diabetes|dm2|dm 2|hipertension|hta|dislipidemia|colesterol|obesidad|sobrepeso|tabaquismo|fumador|sindrome metabolico|renal cronica/.test(dx)
    if (!pertinente) return []
    const falta = motivoSinPrevent(entrada)
    if (!falta) return []
    return [{
      id: 'prevent:falta',
      nivel: 'info',
      titulo: 'Se puede estimar el riesgo cardiovascular a 10 años',
      detalle: `La guía 2026 lo pide en prevención primaria de 30 a 79 años. Con ${falta} lo calculo y te digo la meta de LDL que le corresponde.`,
      textoNota: '',
      pide: falta,
    }]
  }

  return [{
    id: 'prevent:riesgo',
    nivel: r.categoria === 'alto' ? 'accion' : 'info',
    titulo: `PREVENT-ASCVD a 10 años: ${r.riesgo10}% — ${r.etiqueta.replace(/ \(.*/, '')}`,
    detalle: r.conducta + (r.riesgo30 != null ? ` Riesgo a 30 años: ${r.riesgo30}%.` : ''),
    textoNota: `Riesgo de ASCVD a 10 años por las ecuaciones PREVENT: ${r.riesgo10}% (${r.etiqueta.replace(/ \(.*/, '').toLowerCase()})${r.riesgo30 != null ? `, y ${r.riesgo30}% a 30 años` : ''}. ${r.conducta} Fuente: ${r.fuente}.`,
  }]
}

// ── ORQUESTADOR ─────────────────────────────────────────────────────────────

const ORDEN: Record<NivelSugerencia, number> = { critico: 0, accion: 1, info: 2 }

/**
 * Devuelve lo relevante para ESTE paciente, ordenado por lo que puede dañarlo.
 * Una consulta sin hallazgos devuelve arreglo vacío, y entonces no se pinta nada.
 */
export function copiloto(e: EntradaCopiloto): Sugerencia[] {
  const todas = [
    ...alergiaVsReceta(e),
    ...riesgoGestacional(e),
    ...dosisPediatrica(e),
    ...ajusteRenal(e),
    ...signosDeAlarma(e),
    ...calculosAutomaticos(e),
    ...metasPorDiagnostico(e),
    ...riesgoCardiovascular(e),
  ]
  // Sin duplicados por id, y lo grave primero.
  const vistos = new Set<string>()
  return todas
    .filter(s => (vistos.has(s.id) ? false : (vistos.add(s.id), true)))
    .sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel])
}

/** Junta en un solo texto lo que el médico decida documentar. */
export function textoParaNota(sugerencias: Sugerencia[]): string {
  return sugerencias.map(s => s.textoNota).filter(Boolean).join('\n')
}
