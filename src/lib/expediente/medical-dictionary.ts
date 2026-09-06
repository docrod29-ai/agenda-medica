/**
 * Diccionario médico conservador.
 *
 * Solo corrige cuando la confianza es ALTA (forma exacta esperada). En cualquier
 * otro caso devuelve sugerencia + needs_review para que el médico valide.
 *
 * NUNCA cambia una palabra por otra de significado distinto sin evidencia clara.
 */

/* ─── Catálogos (subset clínicamente común — extensible) ──────────── */

export const ENF_CRONICAS = [
  'diabetes mellitus tipo 2', 'hipertensión arterial sistémica', 'enfermedad renal crónica',
  'insuficiencia cardiaca', 'cardiopatía isquémica', 'EPOC', 'asma', 'cirrosis',
  'hipotiroidismo', 'hipertiroidismo', 'lupus', 'artritis reumatoide', 'cáncer',
  'VIH', 'tuberculosis', 'obesidad',
] as const

export const SINTOMAS = [
  'fiebre', 'escalofríos', 'tos', 'disnea', 'dolor torácico', 'dolor abdominal',
  'diarrea', 'náusea', 'vómito', 'disuria', 'polaquiuria', 'hematuria', 'cefalea',
  'mareo', 'síncope', 'pérdida de peso', 'astenia', 'adinamia',
] as const

export const MEDICAMENTOS = [
  'losartán', 'telmisartán', 'amlodipino', 'metoprolol', 'carvedilol',
  'atorvastatina', 'rosuvastatina', 'aspirina', 'clopidogrel', 'warfarina',
  'rivaroxabán', 'apixabán', 'metformina', 'dapagliflozina', 'empagliflozina',
  'sitagliptina', 'linagliptina', 'insulina', 'levotiroxina',
  'omeprazol', 'pantoprazol', 'prednisona', 'deflazacort',
  'metotrexato', 'leflunomida', 'micofenolato', 'rituximab',
] as const

export const ANTIBIOTICOS = [
  'amoxicilina', 'amoxicilina/clavulanato', 'cefalexina', 'ceftriaxona', 'cefepime',
  'piperacilina/tazobactam', 'meropenem', 'ertapenem', 'vancomicina', 'linezolid',
  'daptomicina', 'clindamicina', 'metronidazol', 'ciprofloxacino', 'levofloxacino',
  'trimetoprim/sulfametoxazol', 'nitrofurantoína', 'fosfomicina',
  'fluconazol', 'voriconazol', 'aciclovir', 'valaciclovir', 'oseltamivir',
] as const

export const ABREVIATURAS: Record<string, string> = {
  DM2: 'diabetes mellitus tipo 2', HAS: 'hipertensión arterial sistémica',
  ERC: 'enfermedad renal crónica', EPOC: 'enfermedad pulmonar obstructiva crónica',
  IVU: 'infección de vías urinarias', IAM: 'infarto agudo de miocardio',
  EVC: 'enfermedad vascular cerebral', FA: 'fibrilación auricular',
  FC: 'frecuencia cardiaca', FR: 'frecuencia respiratoria',
  TA: 'tensión arterial', SatO2: 'saturación de oxígeno',
  IMC: 'índice de masa corporal', HbA1c: 'hemoglobina glucosilada',
  PCR: 'proteína C reactiva', VSG: 'velocidad de sedimentación globular',
  TSH: 'hormona estimulante de tiroides', T4L: 'tiroxina libre',
}

/* Datos críticos que SIEMPRE requieren revisión humana */
export const FARMACOS_CRITICOS = [
  'warfarina', 'rivaroxabán', 'apixabán', 'dabigatrán', 'enoxaparina', 'heparina',
  'insulina', 'metotrexato', 'micofenolato', 'rituximab', 'prednisona',
  'morfina', 'tramadol', 'oxicodona', 'fentanilo', 'codeína',
  'diazepam', 'alprazolam', 'clonazepam', 'lorazepam',
]

/* Familias de antibióticos beta-lactámicos para validación cruzada con alergia */
/**
 * Betalactámicos para la alerta de alergia de la RECETA. Auditoría 2026-07 (P1):
 * faltaban cefazolina, ceftazidima y cefixima —que SÍ están en el copiloto
 * (FAMILIAS_ALERGIA)—, así que un alérgico a penicilina podía recibir cefazolina
 * (la profilaxis quirúrgica más usada) sin alerta al imprimir. Se alinea con el
 * copiloto para tener UNA sola fuente de verdad.
 */
export const FAMILIA_BETALACTAMICOS = [
  'penicilina', 'amoxicilina', 'ampicilina', 'dicloxacilina', 'oxacilina',
  'cefalexina', 'ceftriaxona', 'cefepime', 'cefuroxima', 'cefotaxima',
  'cefazolina', 'ceftazidima', 'cefixima',
  'piperacilina', 'meropenem', 'imipenem', 'ertapenem',
]

/**
 * ── LA ALERGIA ESCRITA POR CLASE, NO POR FÁRMACO — MI-004 y MI-005 ──────────
 *
 * Los médicos escriben la alergia como se la cuenta el paciente: «alérgico a
 * las cefalosporinas», «a los betalactámicos», «a las penicilinas». El motor
 * sólo conocía nombres de principio activo, así que «Cefalosporinas» +
 * ceftriaxona no disparaba **nada** (MI-004).
 *
 * El parche que había para eso era peor que el hueco: `a.includes('beta')`, una
 * subcadena suelta que convertía «betametasona» y «betabloqueadores» en alergia
 * a betalactámicos, bloqueaba la firma de la nota, y la única salida era borrar
 * la alergia del expediente (MI-005). Un corticoide y un antihipertensivo no
 * comparten nada con la penicilina salvo cinco letras.
 *
 * QUÉ DISPARA QUÉ. Un término de SUBFAMILIA alerta sobre su propia subfamilia;
 * el término paraguas alerta sobre todas. Extenderlo —que una alergia a
 * cefalosporinas alerte también sobre penicilinas— es criterio clínico sobre
 * reactividad cruzada, no una decisión de programación: `NEEDS_CLINICAL_REVIEW`.
 * Se deja en el lado que no fabrica alarmas, porque la alarma de más ya causó
 * el defecto de arriba.
 */
export const SUBFAMILIAS_BETALACTAMICOS: Record<string, string[]> = {
  penicilinas: ['penicilina', 'amoxicilina', 'ampicilina', 'dicloxacilina', 'oxacilina', 'piperacilina'],
  cefalosporinas: ['cefalexina', 'ceftriaxona', 'cefepime', 'cefuroxima', 'cefotaxima', 'cefazolina', 'ceftazidima', 'cefixima'],
  carbapenemicos: ['meropenem', 'imipenem', 'ertapenem', 'doripenem'],
}

/**
 * Cómo se escribe cada clase en un expediente mexicano. Van con límite de
 * palabra al comparar: «beta» suelto es lo que produjo MI-005.
 */
const DISPARADORES_DE_CLASE: Record<'todas' | keyof typeof SUBFAMILIAS_BETALACTAMICOS, RegExp> = {
  todas: /\bbeta[\s-]?lact[áa]mic[oa]s?\b|\bbetalactamas?\b/i,
  penicilinas: /\bpenicilinas?\b|\bpenicilinicos?\b/i,
  cefalosporinas: /\bcefalosporinas?\b|\bcefalospor[íi]nicos?\b|\bcefas\b/i,
  carbapenemicos: /\bcarbapen[ée]mic[oa]s?\b|\bcarbapenems?\b/i,
}

/**
 * Los miembros de la familia que cubre esta alergia escrita, o lista vacía.
 * Puro y exportado para poder probarlo solo — incluida la prueba al revés, que
 * es la que caza el regreso de MI-005.
 */
export function miembrosCubiertosPorAlergia(textoAlergia: string): string[] {
  const a = (textoAlergia ?? '').toLowerCase()
  if (!a.trim()) return []
  if (DISPARADORES_DE_CLASE.todas.test(a)) return [...FAMILIA_BETALACTAMICOS]
  const cubiertos = new Set<string>()
  for (const [clase, miembros] of Object.entries(SUBFAMILIAS_BETALACTAMICOS)) {
    if (DISPARADORES_DE_CLASE[clase as keyof typeof SUBFAMILIAS_BETALACTAMICOS].test(a)) {
      for (const m of miembros) cubiertos.add(m)
    }
  }
  // Y el fármaco nombrado tal cual, que es el caso de siempre.
  for (const f of FAMILIA_BETALACTAMICOS) if (a.includes(f)) cubiertos.add(f)
  return [...cubiertos]
}

/* ─── Normalización conservadora ─────────────────────────────────── */

export interface NormalizacionResult {
  original: string
  suggested: string
  confidence: 'alta' | 'media' | 'baja'
  needs_review: boolean
}

const CORRECCIONES_ALTA_CONFIANZA: Record<string, string> = {
  // typos comunes, solo cambios de acento/ortografía no de significado
  'losartan':    'losartán',
  'telmisartan': 'telmisartán',
  'cefriaxona':  'ceftriaxona',
  'ceftriazona': 'ceftriaxona',
  'meropenen':   'meropenem',
  'omeprasol':   'omeprazol',
  'metformine':  'metformina',
  'aciclovir':   'aciclovir',
  'tuberculose': 'tuberculosis',
}

/** Devuelve sugerencia ortográfica. Solo cambia con confianza alta. */
export function normalizarTermino(term: string): NormalizacionResult {
  const orig = term.trim()
  const low = orig.toLowerCase()

  // Abreviatura conocida
  const abrev = ABREVIATURAS[orig.toUpperCase()]
  if (abrev) return { original: orig, suggested: abrev, confidence: 'alta', needs_review: false }

  // Corrección alta confianza
  if (CORRECCIONES_ALTA_CONFIANZA[low]) {
    return { original: orig, suggested: CORRECCIONES_ALTA_CONFIANZA[low], confidence: 'alta', needs_review: false }
  }

  // Coincidencia exacta con catálogo conocido
  const allKnown = [...MEDICAMENTOS, ...ANTIBIOTICOS, ...ENF_CRONICAS, ...SINTOMAS]
  if (allKnown.some(k => k.toLowerCase() === low)) {
    return { original: orig, suggested: orig, confidence: 'alta', needs_review: false }
  }

  // No reconocido — sin sugerencia para evitar cambiar por algo incorrecto
  return { original: orig, suggested: orig, confidence: 'baja', needs_review: true }
}

/* ─── Validaciones clínicas cruzadas ─────────────────────────────── */

export interface AlertaClinica {
  severidad: 'info' | 'advertencia' | 'critica'
  mensaje: string
  campos: string[]
}

interface Allergeno { alergeno?: string; reaccion?: string }
interface MedItem { nombre?: string; dosis?: string }

/** Detecta interacciones graves entre alergias y medicamentos prescritos. */
export function validarAlergiasVsMedicamentos(
  alergias: Allergeno[],
  medicamentos: MedItem[],
): AlertaClinica[] {
  const alertas: AlertaClinica[] = []
  const alergiasLow = alergias.map(a => (a.alergeno ?? '').toLowerCase())

  for (const med of medicamentos) {
    const nom = (med.nombre ?? '').toLowerCase()
    if (!nom) continue

    /**
     * Alergia a betalactámicos + betalactámico prescrito. La cobertura ya no es
     * «¿aparece alguna letra?» sino «¿este fármaco está entre los que cubre lo
     * que el médico escribió?» — ver `miembrosCubiertosPorAlergia` (MI-004,
     * MI-005).
     */
    const cubiertos = new Set(alergiasLow.flatMap(a => miembrosCubiertosPorAlergia(a)))
    const esBetalactamico = FAMILIA_BETALACTAMICOS.some(f => nom.includes(f))
    const alergicoBetalactamico = [...cubiertos].some(f => nom.includes(f))
    if (alergicoBetalactamico && esBetalactamico) {
      /**
       * CARBAPENÉMICOS — decisión clínica del médico dueño (E0-15d, 2026-07-28).
       *
       * Con historia de alergia a PENICILINA aislada, el carbapenémico NO se
       * bloquea: la reactividad cruzada es <1% (parámetro de práctica
       * AAAAI/ACAAI 2022, ~0.87% en metaanálisis), y una alerta crítica aquí
       * bloquea la primera línea justo en sepsis y meningitis — donde el retraso
       * mata más que el riesgo que se intenta evitar.
       *
       * La alerta baja a PRECAUCIÓN, salvo tres excepciones donde vuelve a ser
       * crítica: alergia al propio carbapenémico, reacción cutánea grave (SCAR:
       * SJS/TEN, DRESS, AGEP) o daño de órgano atribuido a β-lactámicos.
       */
      const esCarbapenemico = /meropenem|imipenem|ertapenem|doripenem|carbapenem/.test(nom)
      // Texto completo de la alergia (alérgeno + reacción) para buscar gravedad.
      const textoAlergias = alergias
        .map(a => `${a.alergeno ?? ''} ${a.reaccion ?? ''}`.toLowerCase())
        .join(' | ')
      const RE_SCAR = /stevens|johnson|sjs\b|\bten\b|necrolisis|necrólisis|epidermica|epidérmica|dress|agep|pustulosis|exantema.*pustuloso/
      const RE_ORGANO = /nefritis|hepatitis|hepatot|anafilaxia al (?:meropenem|imipenem|ertapenem)|citopenia|hemolisis|hemólisis|vasculitis/
      const alergicoAlCarbapenemicoMismo = alergiasLow.some(a =>
        /meropenem|imipenem|ertapenem|doripenem|carbapenem/.test(a)
      )
      const reaccionGrave = RE_SCAR.test(textoAlergias) || RE_ORGANO.test(textoAlergias)

      if (esCarbapenemico && !alergicoAlCarbapenemicoMismo && !reaccionGrave) {
        alertas.push({
          severidad: 'advertencia',
          mensaje: `Alergia a beta-lactámicos y se prescribe ${med.nombre} (carbapenémico). La reactividad cruzada con penicilina es <1%: NO es contraindicación. Verifica que la alergia no sea al propio carbapenémico ni una reacción cutánea grave (SJS/TEN, DRESS, AGEP) o con daño de órgano.`,
          campos: ['alergias', 'medicamentos'],
        })
      } else {
        alertas.push({
          severidad: 'critica',
          mensaje: esCarbapenemico
            ? `Paciente con ${alergicoAlCarbapenemicoMismo ? 'alergia al propio carbapenémico' : 'reacción grave previa a beta-lactámicos (cutánea grave o con daño de órgano)'} y se prescribe ${med.nombre}. Requiere valoración especializada antes de administrar.`
            : `Paciente con alergia documentada a beta-lactámicos y se prescribe ${med.nombre}. Reacción cruzada posible — verificar.`,
          campos: ['alergias', 'medicamentos'],
        })
      }
    }

    // AINE + alergia a AINE (paracetamol NO es AINE → excluido para evitar falsos positivos)
    if (alergiasLow.some(a => a.includes('aine') || a.includes('aspirin') || a.includes('antiinflamator'))) {
      if (/ibuprofen|naproxen|aspir|acetilsalic|ketorol|diclofen|meloxicam|piroxicam|indometac|celecox|ketoprof|nimesul|metamizol/.test(nom)) {
        alertas.push({
          severidad: 'critica',
          mensaje: `Posible alergia a AINE y se prescribe ${med.nombre}. Revisar.`,
          campos: ['alergias', 'medicamentos'],
        })
      }
    }

    // Sulfonamidas (alergia frecuente y potencialmente grave)
    if (alergiasLow.some(a => a.includes('sulfa'))) {
      if (/sulfametoxazol|trimetoprim|sulfadiaz|sulfasalaz|sulfona/.test(nom)) {
        alertas.push({
          severidad: 'critica',
          mensaje: `Alergia a sulfas y se prescribe ${med.nombre}. Reacción posible — verificar.`,
          campos: ['alergias', 'medicamentos'],
        })
      }
    }

    // Macrólidos
    if (alergiasLow.some(a => a.includes('macrolid') || a.includes('eritromic') || a.includes('azitromic') || a.includes('claritromic'))) {
      if (/eritromic|azitromic|claritromic/.test(nom)) {
        alertas.push({
          severidad: 'critica',
          mensaje: `Alergia a macrólidos y se prescribe ${med.nombre}. Verificar.`,
          campos: ['alergias', 'medicamentos'],
        })
      }
    }

    // Quinolonas
    if (alergiasLow.some(a => a.includes('quinolon') || a.includes('floxacin'))) {
      if (/floxacin/.test(nom)) {
        alertas.push({
          severidad: 'critica',
          mensaje: `Alergia a quinolonas y se prescribe ${med.nombre}. Verificar.`,
          campos: ['alergias', 'medicamentos'],
        })
      }
    }
  }
  return alertas
}

/** Detecta prescripciones que requieren ajuste por función renal/embarazo/anticoagulación. */
export function validacionesGeneralesMedicamentos(
  medicamentos: MedItem[],
  contexto: { embarazo?: boolean; erc?: boolean; anticoagulado?: boolean },
): AlertaClinica[] {
  const alertas: AlertaClinica[] = []
  for (const med of medicamentos) {
    const nom = (med.nombre ?? '').toLowerCase()
    if (!nom) continue

    if (contexto.embarazo && /metotrex|warfarina|isotret|ibuprofen|naproxen/.test(nom)) {
      alertas.push({
        severidad: 'critica',
        mensaje: `Embarazo + ${med.nombre}: medicamento potencialmente riesgoso en gestación. Evaluar alternativa.`,
        campos: ['medicamentos'],
      })
    }
    if (contexto.erc && /metformina|aines|gentamicina|amikacina|vancomicina|ibuprofen|naproxen/.test(nom)) {
      alertas.push({
        severidad: 'advertencia',
        mensaje: `ERC + ${med.nombre}: requiere ajuste de dosis o tiene riesgo de nefrotoxicidad. Verificar.`,
        campos: ['medicamentos'],
      })
    }
    if (contexto.anticoagulado && /aines|ibuprofen|aspir|ketorol|naproxen|diclofen/.test(nom)) {
      alertas.push({
        severidad: 'advertencia',
        mensaje: `Anticoagulado + ${med.nombre}: riesgo aumentado de sangrado.`,
        campos: ['medicamentos'],
      })
    }
  }
  return alertas
}

/** Marca medicamentos críticos para que necesiten revisión adicional. */
export function esMedicamentoCritico(nombre: string): boolean {
  const low = nombre.toLowerCase()
  return FARMACOS_CRITICOS.some(c => low.includes(c))
}
