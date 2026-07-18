/**
 * PRESCRIPCIÓN SEGURA — la capa que evita el error de dosis más común:
 * seguir prescribiendo la dosis "de siempre" en un riñón que ya no filtra igual.
 *
 *  1. Ajuste por función renal (TFG estimada).
 *  2. Fármacos a evitar o vigilar en enfermedad hepática.
 *  3. Embarazo y lactancia.
 *
 * Funciones PURAS y testeadas. Apoyo a la decisión: la dosis la decide el médico,
 * que además debe considerar indicación, peso, edad, interacciones y niveles.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. AJUSTE POR FUNCIÓN RENAL
// ═══════════════════════════════════════════════════════════════════════════

export interface ReglaRenal {
  /** TFG mínima (inclusive) a la que aplica esta regla, en mL/min/1.73 m². */
  desde: number
  /** TFG máxima (exclusiva). */
  hasta: number
  conducta: string
  /** true cuando el fármaco NO debe usarse en ese rango. */
  contraindicado?: boolean
}

export interface FarmacoRenal {
  nombre: string
  clase: string
  reglas: ReglaRenal[]
  nota?: string
}

/**
 * Ajustes por TFG. Se listan los fármacos donde el ajuste cambia la conducta o
 * donde no ajustar causa daño real (acumulación, acidosis láctica, sangrado).
 */
export const AJUSTE_RENAL: FarmacoRenal[] = [
  {
    nombre: 'Metformina', clase: 'Antidiabético',
    reglas: [
      { desde: 45, hasta: 999, conducta: 'Dosis habitual. Vigilar la función renal al menos una vez al año.' },
      { desde: 30, hasta: 45, conducta: 'No iniciar. Si ya la toma, valorar continuar a dosis reducida (máximo 1000 mg/día) con vigilancia cada 3 a 6 meses.' },
      { desde: 0, hasta: 30, conducta: 'CONTRAINDICADA por riesgo de acidosis láctica.', contraindicado: true },
    ],
    nota: 'Suspender temporalmente ante medio de contraste yodado, deshidratación, sepsis o cirugía mayor.',
  },
  {
    nombre: 'Enoxaparina', clase: 'Anticoagulante',
    reglas: [
      { desde: 30, hasta: 999, conducta: 'Dosis habitual (1 mg/kg cada 12 h en tratamiento).' },
      { desde: 0, hasta: 30, conducta: 'Reducir a 1 mg/kg cada 24 h en dosis terapéutica. Considerar heparina no fraccionada, que no requiere ajuste renal.' },
    ],
    nota: 'Se acumula en falla renal y el riesgo de sangrado sube. Valorar medir anti-Xa.',
  },
  {
    nombre: 'Apixabán', clase: 'Anticoagulante',
    reglas: [
      { desde: 25, hasta: 999, conducta: 'Dosis habitual. Reducir a 2.5 mg cada 12 h si cumple 2 de 3: edad ≥80 años, peso ≤60 kg, creatinina ≥1.5 mg/dL.' },
      { desde: 15, hasta: 25, conducta: 'Usar con precaución; datos limitados.' },
      { desde: 0, hasta: 15, conducta: 'No recomendado fuera de indicación especializada.', contraindicado: true },
    ],
  },
  {
    nombre: 'Rivaroxabán', clase: 'Anticoagulante',
    reglas: [
      { desde: 50, hasta: 999, conducta: 'Dosis habitual.' },
      { desde: 15, hasta: 50, conducta: 'Reducir la dosis (en fibrilación auricular, 15 mg cada 24 h).' },
      { desde: 0, hasta: 15, conducta: 'Evitar.', contraindicado: true },
    ],
  },
  {
    nombre: 'Gabapentina', clase: 'Neuromodulador',
    reglas: [
      { desde: 60, hasta: 999, conducta: 'Dosis habitual.' },
      { desde: 30, hasta: 60, conducta: 'Reducir aproximadamente a la mitad de la dosis diaria.' },
      { desde: 15, hasta: 30, conducta: 'Reducir a alrededor de una cuarta parte de la dosis diaria.' },
      { desde: 0, hasta: 15, conducta: 'Reducción mayor y espaciamiento; riesgo alto de neurotoxicidad, sedación y mioclonías.' },
    ],
    nota: 'La acumulación de gabapentina y pregabalina en falla renal es una causa frecuente y poco reconocida de confusión en el anciano.',
  },
  {
    nombre: 'Pregabalina', clase: 'Neuromodulador',
    reglas: [
      { desde: 60, hasta: 999, conducta: 'Dosis habitual.' },
      { desde: 30, hasta: 60, conducta: 'Reducir aproximadamente a la mitad.' },
      { desde: 15, hasta: 30, conducta: 'Reducir a alrededor de una cuarta parte.' },
      { desde: 0, hasta: 15, conducta: 'Reducción mayor; vigilar sedación y estado mental.' },
    ],
  },
  {
    nombre: 'Antiinflamatorios no esteroideos', clase: 'Analgésico',
    reglas: [
      { desde: 60, hasta: 999, conducta: 'Usar el menor tiempo posible; vigilar la función renal y la presión arterial.' },
      { desde: 30, hasta: 60, conducta: 'Evitar salvo indicación clara, dosis mínima y por pocos días.' },
      { desde: 0, hasta: 30, conducta: 'EVITAR: precipitan lesión renal aguda.', contraindicado: true },
    ],
    nota: 'La combinación de AINE, inhibidor de la enzima convertidora o ARA II y diurético es la "triple whammy" que causa lesión renal aguda.',
  },
  {
    nombre: 'Vancomicina', clase: 'Antibiótico',
    reglas: [
      { desde: 0, hasta: 999, conducta: 'La dosis de carga NO se ajusta; lo que se ajusta es el intervalo. Dosificar por AUC/CMI con niveles séricos y vigilar la función renal.' },
    ],
  },
  {
    nombre: 'Aminoglucósidos', clase: 'Antibiótico',
    reglas: [
      { desde: 60, hasta: 999, conducta: 'Dosis única diaria basada en peso; monitorizar niveles.' },
      { desde: 0, hasta: 60, conducta: 'Espaciar el intervalo y monitorizar niveles séricos de forma obligada. Valorar alternativa no nefrotóxica.' },
    ],
  },
  {
    nombre: 'Nitrofurantoína', clase: 'Antibiótico',
    reglas: [
      { desde: 30, hasta: 999, conducta: 'Puede usarse en infección urinaria baja no complicada.' },
      { desde: 0, hasta: 30, conducta: 'EVITAR: no alcanza concentración urinaria eficaz y aumenta la toxicidad.', contraindicado: true },
    ],
  },
  {
    nombre: 'Colchicina', clase: 'Antiinflamatorio',
    reglas: [
      { desde: 30, hasta: 999, conducta: 'Dosis habitual para crisis de gota.' },
      { desde: 0, hasta: 30, conducta: 'Reducir la dosis y espaciar; alto riesgo de toxicidad (mielosupresión, miopatía). Evitar junto con claritromicina o ciclosporina.' },
    ],
  },
  {
    nombre: 'Digoxina', clase: 'Cardiológico',
    reglas: [
      { desde: 50, hasta: 999, conducta: 'Dosis habitual; vigilar niveles.' },
      { desde: 0, hasta: 50, conducta: 'Reducir la dosis y monitorizar niveles séricos; margen terapéutico estrecho.' },
    ],
  },
  {
    nombre: 'Alopurinol', clase: 'Antihiperuricémico',
    reglas: [
      { desde: 60, hasta: 999, conducta: 'Escalar según ácido úrico hasta la meta.' },
      { desde: 0, hasta: 60, conducta: 'Iniciar con dosis baja (por ejemplo 50 a 100 mg/día) y escalar despacio vigilando el ácido úrico.' },
    ],
    nota: 'Iniciar bajo y escalar reduce el riesgo de síndrome de hipersensibilidad.',
  },
  {
    nombre: 'Litio', clase: 'Psiquiátrico',
    reglas: [
      { desde: 60, hasta: 999, conducta: 'Dosis habitual con niveles séricos periódicos.' },
      { desde: 0, hasta: 60, conducta: 'Reducir la dosis y monitorizar niveles de forma estrecha; riesgo alto de intoxicación.' },
    ],
    nota: 'Deshidratación, AINE, diuréticos tiazídicos e inhibidores de la enzima convertidora elevan el litio.',
  },
]

export interface AjusteResultado {
  farmaco: string
  clase: string
  conducta: string
  contraindicado: boolean
  nota?: string
}

/** Devuelve la conducta que corresponde a esa TFG para un fármaco. */
export function ajustePorTFG(f: FarmacoRenal, tfg: number): AjusteResultado | null {
  if (!(tfg >= 0)) return null
  const r = f.reglas.find(x => tfg >= x.desde && tfg < x.hasta)
  if (!r) return null
  return {
    farmaco: f.nombre, clase: f.clase, conducta: r.conducta,
    contraindicado: !!r.contraindicado, nota: f.nota,
  }
}

/** Revisa una lista de fármacos contra la TFG y devuelve solo los que requieren acción. */
export function revisarListaRenal(nombres: string[], tfg: number): AjusteResultado[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const salida: AjusteResultado[] = []
  for (const n of nombres) {
    const q = norm(n).trim()
    // Una cadena vacía o de una letra hacía match por subcadena con el primer
    // fármaco del catálogo: una línea en blanco al partir un textarea inventaba
    // una contraindicación de metformina en quien no la toma.
    if (q.length < 3) continue
    const f = AJUSTE_RENAL.find(x => q.includes(norm(x.nombre)) || norm(x.nombre).includes(q))
    if (!f) continue
    const a = ajustePorTFG(f, tfg)
    if (a) salida.push(a)
  }
  // Los contraindicados primero: son los que no pueden pasar desapercibidos.
  return salida.sort((a, b) => Number(b.contraindicado) - Number(a.contraindicado))
}

/** Estadio de enfermedad renal crónica por TFG (KDIGO). */
export function estadioERC(tfg: number): { estadio: string; descripcion: string } | null {
  if (!(tfg >= 0)) return null
  if (tfg >= 90) return { estadio: 'G1', descripcion: 'Normal o alta (≥90). Solo es enfermedad renal crónica si hay daño renal documentado.' }
  if (tfg >= 60) return { estadio: 'G2', descripcion: 'Levemente disminuida (60-89). Solo es enfermedad renal crónica si hay daño renal documentado.' }
  if (tfg >= 45) return { estadio: 'G3a', descripcion: 'Disminución leve a moderada (45-59).' }
  if (tfg >= 30) return { estadio: 'G3b', descripcion: 'Disminución moderada a severa (30-44).' }
  if (tfg >= 15) return { estadio: 'G4', descripcion: 'Disminución severa (15-29). Preparar terapia sustitutiva.' }
  return { estadio: 'G5', descripcion: 'Falla renal (<15). Terapia sustitutiva salvo decisión de manejo conservador.' }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. ENFERMEDAD HEPÁTICA
// ═══════════════════════════════════════════════════════════════════════════

export interface RiesgoHepatico {
  farmaco: string
  riesgo: 'evitar' | 'ajustar' | 'vigilar'
  motivo: string
}

export const RIESGO_HEPATICO: RiesgoHepatico[] = [
  { farmaco: 'Antiinflamatorios no esteroideos', riesgo: 'evitar', motivo: 'En cirrosis precipitan sangrado variceal, síndrome hepatorrenal y retención de líquidos.' },
  { farmaco: 'Paracetamol', riesgo: 'ajustar', motivo: 'Sigue siendo el analgésico de elección en hepatopatía, pero limitado a 2 g al día en cirrosis. No usar si hay consumo activo de alcohol.' },
  { farmaco: 'Benzodiacepinas', riesgo: 'evitar', motivo: 'Precipitan encefalopatía hepática. Si son indispensables, preferir las de vida media corta sin metabolismo oxidativo (lorazepam, oxazepam).' },
  { farmaco: 'Opioides', riesgo: 'ajustar', motivo: 'Vida media prolongada; reducir dosis y espaciar. Precipitan encefalopatía y estreñimiento.' },
  { farmaco: 'Estatinas', riesgo: 'vigilar', motivo: 'NO están contraindicadas en hepatopatía crónica estable ni en hígado graso; se evitan en falla hepática descompensada. La elevación leve de transaminasas no obliga a suspender.' },
  { farmaco: 'Metformina', riesgo: 'vigilar', motivo: 'Puede usarse en hepatopatía crónica estable; se evita en falla hepática descompensada por riesgo de acidosis láctica.' },
  { farmaco: 'Amiodarona', riesgo: 'evitar', motivo: 'Hepatotoxicidad y depósito hepático.' },
  { farmaco: 'Metotrexato', riesgo: 'evitar', motivo: 'Fibrosis hepática con el uso acumulado.' },
  { farmaco: 'Ácido valproico', riesgo: 'evitar', motivo: 'Hepatotoxicidad e hiperamonemia; agrava la encefalopatía.' },
]

// ═══════════════════════════════════════════════════════════════════════════
// 3. EMBARAZO Y LACTANCIA
// ═══════════════════════════════════════════════════════════════════════════

export interface RiesgoGestacional {
  farmaco: string
  embarazo: 'contraindicado' | 'evitar' | 'seguro-conocido'
  lactancia: 'compatible' | 'evitar' | 'precaucion'
  motivo: string
  alternativa?: string
}

export const EMBARAZO_LACTANCIA: RiesgoGestacional[] = [
  { farmaco: 'Inhibidores de la enzima convertidora y ARA II', embarazo: 'contraindicado', lactancia: 'precaucion', motivo: 'Fetopatía: oligohidramnios, hipoplasia pulmonar, falla renal y muerte fetal. Suspender en cuanto se confirma el embarazo.', alternativa: 'Labetalol, nifedipino de acción prolongada o metildopa.' },
  { farmaco: 'Estatinas', embarazo: 'evitar', lactancia: 'evitar', motivo: 'Se suspenden durante el embarazo y la lactancia; el colesterol es necesario para el desarrollo fetal.', alternativa: 'Manejo con dieta; en hipertrigliceridemia severa la guía permite fibratos después del primer trimestre u omega-3 a dosis alta.' },
  { farmaco: 'Warfarina', embarazo: 'contraindicado', lactancia: 'compatible', motivo: 'Embriopatía warfarínica, sobre todo entre las semanas 6 y 12. En lactancia sí es compatible.', alternativa: 'Heparina de bajo peso molecular, que no cruza la placenta.' },
  { farmaco: 'Anticoagulantes orales directos', embarazo: 'contraindicado', lactancia: 'evitar', motivo: 'Datos insuficientes y paso placentario.', alternativa: 'Heparina de bajo peso molecular.' },
  { farmaco: 'Isotretinoína', embarazo: 'contraindicado', lactancia: 'evitar', motivo: 'Teratógeno mayor. Requiere anticoncepción eficaz y prueba de embarazo antes, durante y después.' },
  { farmaco: 'Ácido valproico', embarazo: 'contraindicado', lactancia: 'precaucion', motivo: 'Defectos del tubo neural y afectación del neurodesarrollo. Evitar en toda mujer en edad fértil sin anticoncepción.', alternativa: 'Lamotrigina o levetiracetam, según la indicación.' },
  { farmaco: 'Metotrexato', embarazo: 'contraindicado', lactancia: 'evitar', motivo: 'Abortivo y teratógeno. Suspender al menos 3 meses antes de buscar embarazo.' },
  { farmaco: 'Tetraciclinas y doxiciclina', embarazo: 'evitar', lactancia: 'precaucion', motivo: 'Después de la semana 15 se depositan en dientes y hueso fetal.', alternativa: 'Amoxicilina o azitromicina según el germen.' },
  { farmaco: 'Quinolonas', embarazo: 'evitar', lactancia: 'precaucion', motivo: 'Efecto sobre el cartílago en estudios animales; se prefieren alternativas.', alternativa: 'Betalactámicos o nitrofurantoína (esta última no al término).' },
  { farmaco: 'Penicilinas y cefalosporinas', embarazo: 'seguro-conocido', lactancia: 'compatible', motivo: 'Amplia experiencia de uso seguro; son los antibióticos de elección en el embarazo.' },
  { farmaco: 'Paracetamol', embarazo: 'seguro-conocido', lactancia: 'compatible', motivo: 'Analgésico y antipirético de elección en el embarazo, a la dosis eficaz más baja y por el menor tiempo.' },
  { farmaco: 'Antiinflamatorios no esteroideos', embarazo: 'evitar', lactancia: 'compatible', motivo: 'Desde la semana 20 se asocian a oligohidramnios y desde la 30 a cierre prematuro del conducto arterioso.', alternativa: 'Paracetamol.' },
  { farmaco: 'Insulina', embarazo: 'seguro-conocido', lactancia: 'compatible', motivo: 'Tratamiento de elección de la diabetes en el embarazo; no cruza la placenta.' },
  { farmaco: 'Levotiroxina', embarazo: 'seguro-conocido', lactancia: 'compatible', motivo: 'Debe continuarse; el requerimiento suele AUMENTAR durante el embarazo y necesita ajuste con perfil tiroideo.' },
  { farmaco: 'Agonistas del receptor de GLP-1', embarazo: 'contraindicado', lactancia: 'evitar', motivo: 'Se suspenden antes de un embarazo planeado; la pérdida de peso no es deseable en la gestación.' },
]

/** Busca en las tres listas por nombre y devuelve todo lo que aplique. */
export function revisarFarmaco(nombre: string): {
  renal?: FarmacoRenal
  hepatico?: RiesgoHepatico
  gestacional?: RiesgoGestacional
} {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const q = norm(nombre).trim()
  if (q.length < 3) return {}
  const coincide = (n: string) => q.includes(norm(n)) || norm(n).includes(q)
  return {
    renal: AJUSTE_RENAL.find(x => coincide(x.nombre)),
    hepatico: RIESGO_HEPATICO.find(x => coincide(x.farmaco)),
    gestacional: EMBARAZO_LACTANCIA.find(x => coincide(x.farmaco)),
  }
}
