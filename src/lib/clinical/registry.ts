/**
 * ══════════════════════════════════════════════════════════════════════════
 * CLINICAL ENGINE REGISTRY (charter §17 · unidad Nexus OS E0-03)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Registro ÚNICO y auditable de los motores clínicos deterministas. Cada motor
 * declara aquí: id, tipo, versión, especialidad, referencia, unidad canónica de
 * entrada, política de redondeo, RANGO VÁLIDO, qué hace cuando falta un dato,
 * archivo(s), punto(s) de entrada, ADR y el/los test(s) golden que lo respaldan.
 *
 * Propósito: que un revisor (o un test de integridad) pueda ver de un vistazo qué
 * motores existen, en qué versión, con qué evidencia y con qué cobertura de golden
 * tests — en vez de tenerlo disperso en comentarios. Es metadato PURO (no ejecuta
 * cálculo) para evitar ciclos de import; la lógica vive en cada `file`.
 *
 * POR QUÉ SE AMPLIÓ EN E0-03: el registro tenía 15 motores y el repo tiene decenas
 * más ya en producción (UCI, antibiograma, cardiometabólico, seguridad de dosis…).
 * Un motor sin registrar es un motor sin dueño, sin ADR y sin rango declarado. El
 * gate `src/__tests__/clinical-registry-cobertura.test.ts` recorre los directorios
 * clínicos y EXIGE que cada archivo esté aquí o justificado en `cobertura.ts`:
 * un motor nuevo sin registro rompe el CI. Ver `src/lib/clinical/cobertura.ts`.
 *
 * REGLA: al agregar/modificar un motor clínico, actualiza su entrada aquí y su ADR
 * en docs/clinical-decisions/. Ver docs/audit/regression-ledger.md para incidentes.
 *
 * REGLA DE GRANULARIDAD (E0-03 §3.1): un motor = un punto de entrada exportado con
 * su propia versión y su propia fuente. Las sub-fórmulas que ese punto de entrada
 * calcula van en `calculos[]`. Cuando un mismo punto de entrada ofrece una FAMILIA
 * de escalas publicadas, cada una con su cita, van en `subMotores[]` (así el
 * registro no se dispara a >100 entradas ilegibles sin perder ninguna cita).
 */

export type EstadoMotor = 'validado' | 'pendiente_validacion' | 'experimental'

/** Naturaleza del motor. Sirve para revisar por clase de riesgo, no es cosmético. */
export type TipoMotor =
  | 'formula'            // CKD-EPI, MELD, PPC
  | 'escala'             // SOFA, NEWS2, Braden, CHA2DS2-VASc
  | 'conversion'         // infusiones dosis↔mL/h, NEE, lb→kg
  | 'regla-de-seguridad' // vía parenteral, prescripción segura, plausibilidad de unidad
  | 'tabla-referencia'   // LMS OMS, coeficientes PREVENT

/**
 * Rango de validez del motor. NO se inventa: o está declarado en el código
 * (y se cita archivo + símbolo), o está en la fuente publicada (y se cita), o
 * queda explícitamente PENDIENTE de que lo defina el médico responsable.
 *
 * `ref` cita archivo + SÍMBOLO exportado, no `archivo:línea`: las líneas se mueven
 * entre unidades y dejan el registro apuntando a otra cosa (lección de E0-03 §0-bis).
 */
export type RangoValido =
  | { fuente: 'codigo'; entrada: string; salida: string; ref: string }
  | { fuente: 'referencia'; entrada: string; salida: string; ref: string }
  | { fuente: 'pendiente_validacion_clinica'; preguntaAlMedico: string }

/** Escala publicada que vive dentro de un motor-familia, con su propia cita. */
export interface SubMotor {
  id: string
  nombre: string
  referencia: string
}

export interface MotorClinico {
  id: string
  nombre: string
  especialidad: string
  tipo: TipoMotor
  version: string
  referencia: string
  /** Unidad canónica que el motor espera (safety-critical: evita el bug de escala). */
  unidades: string
  redondeo: string
  /** Rango de validez declarado — o la pregunta pendiente al médico responsable. */
  rangoValido: RangoValido
  /** Archivo principal del motor (relativo a la raíz del repo). */
  file: string
  /** Archivos ADICIONALES que forman parte del MISMO motor (pipeline multi-archivo). */
  archivos?: string[]
  /** Punto(s) de entrada exportado(s) que ESTE motor expone. */
  entryPoints: string[]
  /** Sub-cálculos que cubre (regla de granularidad §3.1). */
  calculos?: string[]
  /** Escalas publicadas dentro del motor, cada una con su cita propia. */
  subMotores?: SubMotor[]
  /** Qué hace el motor cuando falta un dato. `missing ≠ 0`, `missing ≠ normal`. */
  missingData: string
  /** Ruta del ADR, relativa a la raíz del repo. */
  adr: string
  /** Decisiones clínicas adicionales ligadas a este motor (ADR satélite). */
  adrExtra?: string[]
  /** Nombres de archivo EXACTOS de los tests golden, sin comentarios. */
  goldenTests: string[]
  estado: EstadoMotor
  /** Por qué existe este motor (una línea). El ADR lo desarrolla. */
  porQueExiste: string
}

const ADR = (n: string) => `docs/clinical-decisions/${n}.md`

export const CLINICAL_ENGINE_REGISTRY: MotorClinico[] = [
  // ── Nefrología / farmacología renal ──────────────────────────────────────
  {
    id: 'ckd-epi-2021', nombre: 'CKD-EPI 2021 (TFG, race-free)', especialidad: 'Nefrología',
    tipo: 'formula',
    version: '2021.1', referencia: 'Inker LA et al. NEJM 2021 (CKD-EPI creatinine, sin raza)',
    // E0-05: la firma REAL, no prosa. La creatinina ya no es un `number`.
    unidades: 'ckdEpi2021(ClinicalQuantity<concentracion_masa>, edad años: number, sexo) → ClinicalQuantity<depuracion_indexada> (mL/min/1.73m²)', redondeo: 'ninguno en el motor; el display redondea',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'creatinina dentro de CREAT_MGDL_MIN–CREAT_MGDL_MAX mg/dL; edad ≥ 18 años',
      salida: 'mL/min/1.73 m²',
      ref: 'src/lib/expediente/funcion-renal.ts (CREAT_MGDL_MIN, CREAT_MGDL_MAX, creatininaPlausibleMgDl, noAplicablePorEdad)',
    },
    file: 'src/lib/expediente/funcion-renal.ts',
    entryPoints: ['ckdEpi2021', 'evaluarFuncionRenal', 'clasificarTFG'],
    calculos: ['TFG estimada', 'estadio KDIGO G1–G5', 'guarda de plausibilidad de unidad (mg/dL vs µmol/L)'],
    missingData: 'creatinina implausible ⇒ `datoImplausible` y NO se calcula una TFG falsa; <18 años ⇒ `noAplicablePorEdad` (la fórmula es de adultos).',
    adr: ADR('CKD-EPI-2021'),
    goldenTests: ['clinical-safety-harness.test.ts', 'funcion-renal.test.ts', 'funcion-renal-plausibilidad.test.ts'],
    estado: 'validado',
    porQueExiste: 'La dosis de casi todo antimicrobiano depende de la depuración; sin una fuente única, cada pantalla estimaba la TFG distinto.',
  },
  {
    id: 'cockcroft-gault', nombre: 'Cockcroft-Gault (ClCr)', especialidad: 'Nefrología/Farmacología',
    tipo: 'formula',
    version: '1976.1', referencia: 'Cockcroft & Gault, Nephron 1976',
    // E0-05: firma real. El peso ya no puede llegar en gramos ni como volumen.
    unidades: 'cockcroftGault(ClinicalQuantity<concentracion_masa>, edad años: number, sexo, ClinicalQuantity<masa>) → ClinicalQuantity<depuracion> (mL/min)', redondeo: 'entero al mostrar',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'creatinina plausible en mg/dL; edad ≥ 18 años; requiere peso',
      salida: 'mL/min (sin normalizar a superficie corporal)',
      ref: 'src/lib/expediente/funcion-renal.ts (creatininaPlausibleMgDl, noAplicablePorEdad)',
    },
    file: 'src/lib/expediente/funcion-renal.ts',
    entryPoints: ['cockcroftGault'],
    missingData: 'sin peso devuelve null (no estima): la etiqueta del fármaco pide ClCr real, no una TFG normalizada.',
    adr: ADR('cockcroft-gault'),
    goldenTests: ['clinical-safety-harness.test.ts', 'funcion-renal.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es la depuración que usan las fichas técnicas para el ajuste de dosis; CKD-EPI no la sustituye.',
  },
  {
    id: 'ajuste-renal-antimicrobianos', nombre: 'Ajuste renal de antimicrobianos', especialidad: 'Infectología/PROA',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Umbrales por fármaco declarados en el propio módulo (núcleo PROA)',
    // E0-05: la depuración llega como unión DISCRIMINADA — trae su procedencia
    // (Cockcroft mL/min vs CKD-EPI mL/min/1.73m²), que antes se perdía en un number.
    unidades: 'ajusteRenalFarmacos(medicamentos, DepuracionParaDosis = {base:"cockcroft-gault", q:ClinicalQuantity<depuracion>} | {base:"ckd-epi", q:ClinicalQuantity<depuracion_indexada>}); umbrales de la tabla en mL/min', redondeo: 'no aplica (emite alertas, no números)',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué fuente primaria (Sanford / ficha técnica / criterio del servicio) fija los umbrales de ajuste por fármaco de esta tabla, y a partir de qué depuración deja de ser interpretable?',
    },
    file: 'src/lib/expediente/funcion-renal.ts',
    entryPoints: ['ajusteRenalFarmacos'],
    missingData: 'sin depuración utilizable no emite alerta y lo declara: ausencia de alerta ≠ dosis correcta.',
    adr: ADR('ajuste-renal-antimicrobianos'),
    goldenTests: ['funcion-renal.test.ts', 'clinical-safety-harness.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'El error de dosis más común en infectología es seguir con la dosis "de siempre" en un riñón que ya no filtra igual.',
  },

  // ── Hepatología ──────────────────────────────────────────────────────────
  {
    id: 'meld', nombre: 'MELD (UNOS)', especialidad: 'Hepatología',
    tipo: 'formula',
    version: 'UNOS.1', referencia: 'Kamath PS et al. Hepatology 2001 (variante UNOS con pisos)',
    unidades: 'bilirrubina mg/dL; INR; creatinina mg/dL', redondeo: 'entero, acotado 6–40',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'bilirrubina/INR con piso de 1; creatinina acotada 1–4 mg/dL (variante UNOS)',
      salida: 'entero 6–40',
      ref: 'src/lib/expediente/calculadoras.ts (meld)',
    },
    file: 'src/lib/expediente/calculadoras.ts',
    entryPoints: ['meld'],
    missingData: 'la función exige los tres valores; la UI no debe llamarla con parciales.',
    adr: ADR('meld'),
    goldenTests: ['clinical-safety-harness.test.ts', 'calculadoras.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es el puntaje de asignación de trasplante; un redondeo distinto cambia la prioridad del paciente.',
  },
  {
    id: 'fib-4', nombre: 'FIB-4 (fibrosis hepática)', especialidad: 'Hepatología/MASLD',
    tipo: 'formula',
    version: '1.1', referencia: 'Sterling RK et al. Hepatology 2006',
    unidades: 'edad años; AST/ALT U/L; plaquetas ×10⁹/L (normaliza si viene en /µL)', redondeo: '2 decimales',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué rango de edad hace NO interpretable el FIB-4 en su práctica (la validación original se hizo en adultos, y en >65 años el corte bajo pierde especificidad)? Hoy el motor calcula para cualquier edad adulta sin advertirlo.',
    },
    file: 'src/lib/expediente/cardiometabolico/masld.ts',
    entryPoints: ['fib4', 'interpretarFib4'],
    calculos: ['normalización de plaquetas /µL → ×10⁹/L', 'estadio de fibrosis por corte'],
    missingData: 'falta cualquiera de los cuatro valores ⇒ no calcula (no asume normal).',
    adr: ADR('FIB-4'),
    goldenTests: ['clinical-safety-harness.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es el primer filtro no invasivo de fibrosis en MASLD; el bug de unidad de plaquetas cambia el estadio por un factor de 1000.',
  },
  {
    id: 'masld-estadificacion', nombre: 'MASLD — criterios y estadificación', especialidad: 'Hepatología/MASLD',
    tipo: 'regla-de-seguridad',
    version: '2025.1', referencia: 'ADA. MASLD in People With Diabetes. Diabetes Care 2025;48:1057-1082 (leída íntegra; ver encabezado del archivo)',
    unidades: 'criterios cardiometabólicos booleanos; alcohol g/día; elastografía kPa; ELF score',
    redondeo: 'no aplica (clasifica, no calcula)',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'adultos con criterio cardiometabólico; consumo de alcohol dentro del rango que define MASLD/MetALD',
      salida: 'categoría (MASLD / MetALD / otra) + estadio de fibrosis',
      ref: 'FUENTE_MASLD en src/lib/expediente/cardiometabolico/masld.ts',
    },
    file: 'src/lib/expediente/cardiometabolico/masld.ts',
    entryPoints: ['categoriaPorAlcohol', 'interpretarElastografia', 'interpretarELF'],
    missingData: 'sin criterio cardiometabólico ni consumo declarado, no clasifica.',
    adr: ADR('masld-estadificacion'),
    goldenTests: ['cardiometabolico.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'El mismo archivo que hospeda FIB-4 decide la categoría diagnóstica; sin registrarlo quedaba invisible bajo el id "fib-4".',
  },

  // ── Perioperatorio / cirugía ─────────────────────────────────────────────
  {
    id: 'apfel', nombre: 'Apfel (NVPO)', especialidad: 'Anestesiología',
    tipo: 'escala',
    version: '1999.1', referencia: 'Apfel CC et al. Anesthesiology 1999',
    unidades: 'nº de factores 0–4', redondeo: 'porcentaje entero',
    rangoValido: {
      fuente: 'referencia',
      entrada: '0–4 factores booleanos',
      salida: 'riesgo aproximado de NVPO en porcentaje',
      ref: 'Apfel CC et al. Anesthesiology 1999',
    },
    file: 'src/lib/expediente/cirugia.ts',
    entryPoints: ['apfel', 'APFEL_FACTORES'],
    missingData: 'un factor no declarado cuenta como ausente; la UI debe pedir los cuatro.',
    adr: ADR('apfel'),
    goldenTests: ['clinical-safety-harness.test.ts', 'cirugia.test.ts'],
    estado: 'validado',
    porQueExiste: 'Decide la profilaxis antiemética; recalcularlo a ojo en el quirófano es donde se pierde.',
  },
  {
    id: 'asa-estado-fisico', nombre: 'ASA — estado físico', especialidad: 'Anestesiología',
    tipo: 'escala',
    version: '1.0.0', referencia: 'ASA Physical Status Classification System (tabla transcrita en el archivo)',
    unidades: 'clase I–VI', redondeo: 'no aplica',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'clase I–VI (+ modificador E de urgencia)',
      salida: 'descripción textual de la clase',
      ref: 'ASA Physical Status Classification System',
    },
    file: 'src/lib/expediente/cirugia.ts',
    entryPoints: ['ASA', 'asaTexto'],
    missingData: 'sin clase seleccionada no devuelve texto (no asume ASA I).',
    adr: ADR('asa-estado-fisico'),
    goldenTests: ['cirugia.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es el descriptor que va en la nota preanestésica; escribirlo a mano introduce clases inexistentes.',
  },
  {
    id: 'profilaxis-quirurgica', nombre: 'Profilaxis antibiótica quirúrgica (con redosificación)', especialidad: 'Cirugía/Infectología',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Esquemas por tipo de cirugía transcritos en el archivo (ver ESQUEMAS_POR_CIRUGIA) + checklist OMS',
    unidades: 'tipo de cirugía; peso kg; duración de la cirugía en horas', redondeo: 'no aplica',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué fuente primaria respalda los esquemas y los intervalos de redosificación de ESQUEMAS_POR_CIRUGIA, y qué peso o duración quedan fuera de rango?',
    },
    file: 'src/lib/expediente/cirugia.ts',
    entryPoints: ['planProfilaxis', 'ESQUEMAS_POR_CIRUGIA', 'CHECKLIST_OMS'],
    missingData: 'sin tipo de cirugía no propone esquema (no ofrece una cefalosporina "por defecto").',
    adr: ADR('profilaxis-quirurgica'),
    goldenTests: ['cirugia.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'La redosificación intraoperatoria es la parte que más se olvida y la que más pesa en infección de sitio quirúrgico.',
  },
  {
    id: 'rcri', nombre: 'RCRI (riesgo cardiaco perioperatorio)', especialidad: 'Medicina perioperatoria',
    tipo: 'escala',
    version: 'Lee-rev', referencia: 'Lee TH et al. Circulation 1999 (revisado, guía AHA/ACC 2024)',
    unidades: '6 factores booleanos', redondeo: 'clase I–IV',
    rangoValido: {
      fuente: 'referencia',
      entrada: '0–6 factores booleanos',
      salida: 'clase I–IV con riesgo aproximado',
      ref: 'Lee TH et al. Circulation 1999',
    },
    file: 'src/lib/expediente/preop.ts',
    entryPoints: ['calcularRCRI', 'rcriItems'],
    missingData: 'un factor sin responder cuenta como ausente; la UI marca los no respondidos.',
    adr: ADR('rcri'),
    goldenTests: ['clinical-safety-harness.test.ts', 'preop-scales.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es la puerta de entrada del algoritmo perioperatorio de la guía AHA/ACC 2024.',
  },
  {
    id: 'caprini', nombre: 'Caprini (riesgo de ETV)', especialidad: 'Cirugía/Medicina perioperatoria',
    tipo: 'escala',
    version: '2005.1', referencia: 'Caprini JA, Dis Mon 2005',
    unidades: 'suma ponderada de factores', redondeo: 'nivel Muy bajo/Bajo/Moderado/Alto',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'factores ponderados 1–5 puntos',
      salida: 'nivel de riesgo + profilaxis sugerida',
      ref: 'Caprini JA, Dis Mon 2005',
    },
    file: 'src/lib/expediente/preop.ts',
    entryPoints: ['calcularCaprini', 'CAPRINI_ITEMS'],
    missingData: 'factor no declarado = ausente; el nivel se marca como calculado sobre lo respondido.',
    adr: ADR('caprini'),
    goldenTests: ['clinical-safety-harness.test.ts', 'preop-scales.test.ts'],
    estado: 'validado',
    porQueExiste: 'Determina si el paciente sale del quirófano con profilaxis farmacológica o solo mecánica.',
  },
  {
    id: 'preop-escalas-complementarias', nombre: 'Escalas perioperatorias complementarias', especialidad: 'Medicina perioperatoria',
    tipo: 'escala',
    version: '1.0.0', referencia: 'Cada escala cita su publicación en subMotores (ver el encabezado de preop.ts, guía AHA/ACC 2024)',
    unidades: 'según escala (ítems booleanos o categóricos)', redondeo: 'entero por escala',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'ítems de cada escala, tal como los define su publicación',
      salida: 'puntaje entero + categoría de riesgo',
      ref: 'Encabezado de src/lib/expediente/preop.ts (guías 2024 citadas)',
    },
    file: 'src/lib/expediente/preop.ts',
    entryPoints: ['calcularDASI', 'calcularStopBang', 'calcularAriscat', 'calcularChadsVasc', 'calcularHasBled', 'generarRecomendaciones'],
    subMotores: [
      { id: 'dasi', nombre: 'DASI (capacidad funcional)', referencia: 'Hlatky MA et al. Am J Cardiol 1989' },
      { id: 'stop-bang', nombre: 'STOP-BANG (apnea del sueño)', referencia: 'Chung F et al. Anesthesiology 2008' },
      { id: 'ariscat', nombre: 'ARISCAT (riesgo pulmonar postoperatorio)', referencia: 'Canet J et al. Anesthesiology 2010' },
    ],
    missingData: 'ítems sin responder se reportan; el puntaje se marca parcial (missing ≠ 0).',
    adr: ADR('preop-escalas-complementarias'),
    goldenTests: ['preop-scales.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'Complementan a RCRI en el algoritmo perioperatorio; sin registrarlas quedaban invisibles dentro de un archivo ya "cubierto".',
  },

  // ── Medicina crítica (UCI) ───────────────────────────────────────────────
  {
    id: 'sofa', nombre: 'SOFA (disfunción orgánica)', especialidad: 'Medicina crítica',
    tipo: 'escala',
    version: '1.1.0', referencia: 'Vincent JL et al. Intensive Care Med 1996',
    unidades: 'PaFi mmHg; plaquetas ×10³/µL; bili mg/dL; PAM mmHg; vasopresores mcg/kg/min; GCS; creat mg/dL',
    redondeo: 'entero; parcial si falta aparato (missing ≠ 0)',
    rangoValido: {
      fuente: 'referencia',
      entrada: '6 aparatos, 0–4 puntos cada uno',
      salida: 'entero 0–24 (o parcial declarado)',
      ref: 'Vincent JL et al. Intensive Care Med 1996',
    },
    file: 'src/lib/uci/scores.ts',
    entryPoints: ['calcularSOFA'],
    calculos: ['subpuntaje por aparato', 'marca `pendienteValidacion` del cutoff local'],
    missingData: 'aparato sin datos NO suma 0: el score se devuelve PARCIAL y se declara qué faltó.',
    adr: ADR('sofa'),
    goldenTests: ['clinical-safety-harness.test.ts', 'uci-sofa.test.ts', 'uci-scores2.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es la definición operativa de disfunción orgánica en Sepsis-3; un SOFA "completado con ceros" subestima la gravedad.',
  },
  {
    id: 'apache-ii', nombre: 'APACHE II', especialidad: 'Medicina crítica',
    tipo: 'escala',
    version: '1.1.0', referencia: 'Knaus WA et al. Crit Care Med 1985',
    unidades: '12 variables fisiológicas + edad + salud crónica', redondeo: 'entero; parcial si falta variable (missing ≠ 0)',
    rangoValido: {
      fuente: 'referencia',
      entrada: '12 variables fisiológicas + edad + estado de salud crónica',
      salida: 'entero 0–71',
      ref: 'Knaus WA et al. Crit Care Med 1985',
    },
    file: 'src/lib/uci/scores.ts',
    entryPoints: ['calcularAPACHE2'],
    calculos: ['RASS', 'CAM-ICU (delirium)'],
    missingData: 'variable ausente ⇒ score parcial declarado, nunca imputada como normal.',
    adr: ADR('apache-ii'),
    goldenTests: ['clinical-safety-harness.test.ts', 'uci-scores2.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es la referencia de gravedad al ingreso a UCI y alimenta la comparación entre estancias.',
  },
  {
    id: 'nee', nombre: 'Equivalente de norepinefrina', especialidad: 'Medicina crítica',
    tipo: 'conversion',
    version: '1.0.0', referencia: 'Kotani/Goradia norepinephrine equivalents',
    unidades: 'mcg/kg/min (vasopresina U/min); requiere peso para mcg/min', redondeo: '2 decimales; bloquea si no convertible',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'dosis por fármaco en su unidad declarada; peso obligatorio para convertir mcg/min',
      salida: 'mcg/kg/min de norepinefrina equivalente',
      ref: 'src/lib/uci/hemodinamia.ts (equivalenteNorepinefrina)',
    },
    file: 'src/lib/uci/hemodinamia.ts',
    entryPoints: ['equivalenteNorepinefrina'],
    missingData: 'sin peso válido BLOQUEA la conversión y lo declara; no estima con un peso "típico".',
    adr: ADR('nee'),
    goldenTests: ['clinical-safety-harness.test.ts', 'uci-hemodinamia.test.ts'],
    estado: 'validado',
    porQueExiste: 'Permite comparar carga vasopresora entre fármacos y entre días sin que cada quien haga su propia regla de tres.',
  },
  {
    id: 'hemodinamia-pam', nombre: 'PAM e índice de choque', especialidad: 'Medicina crítica',
    tipo: 'formula',
    version: '1.0.0', referencia: 'Fisiología estándar (PAM = PAS + 2·PAD / 3); índice de choque = FC/PAS',
    unidades: 'PAS/PAD mmHg; FC lpm', redondeo: 'según motor (ver encabezado del archivo)',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿A partir de qué PAS/PAD/FC considera usted que el dato es implausible (error de captura) y el motor debe bloquear en vez de calcular?',
    },
    file: 'src/lib/uci/hemodinamia.ts',
    entryPoints: ['presionArterialMedia', 'shockIndex'],
    missingData: 'falta PAS o PAD ⇒ no calcula la PAM; falta FC o PAS ⇒ no calcula el índice de choque.',
    adr: ADR('hemodinamia-pam'),
    goldenTests: ['uci-hemodinamia.test.ts', 'uci-benchmark.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'La PAM es el número que gobierna la meta de perfusión; se recalculaba en cada pantalla.',
  },
  {
    id: 'ventilacion-protectora', nombre: 'Ventilación protectora (PBW, Kirby, driving pressure)', especialidad: 'Medicina crítica',
    tipo: 'formula',
    version: '1.0.0', referencia: 'ARDSNet / fórmula de Devine para PBW; PaO₂/FiO₂ (Kirby)',
    unidades: 'FiO₂ decimal (normaliza desde %); PaO₂ mmHg; VT mL; Pplateau/PEEP cmH₂O; talla cm',
    redondeo: 'según motor; declara fórmula y datos usados',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'RANGOS: FiO₂ 0.21–1.0; PaO₂ 20–700 mmHg; Pplat 5–60; PEEP 0–30; VT 50–2000 mL; talla 100–250 cm',
      salida: 'PBW kg; VT/kg PBW; PaFi mmHg; driving pressure y compliance cmH₂O (solo en modo controlado)',
      ref: 'src/lib/uci/ventilacion.ts (RANGOS, esModoEspontaneo)',
    },
    file: 'src/lib/uci/ventilacion.ts',
    entryPoints: ['analizarVentilacion'],
    calculos: ['PBW (ARDSNet/Devine)', 'VT/kg PBW', 'PaO₂/FiO₂ (Kirby)', 'driving pressure', 'compliance estática', 'normalización de FiO₂'],
    missingData: 'falta un dato o la condición de medición no es válida (modo espontáneo, gasometría venosa) ⇒ BLOQUEA y declara `motivoBloqueo` y `faltantes`. Un cálculo bloqueado es un resultado correcto.',
    adr: ADR('ventilacion-protectora'),
    goldenTests: ['uci-ventilacion.test.ts', 'uci-benchmark.test.ts'],
    estado: 'validado',
    porQueExiste: 'El VT se prescribe por peso PREDICHO, no real; calcularlo con el peso de la báscula sobre-distiende al paciente bajo.',
  },
  {
    id: 'gasometria-acidobase', nombre: 'Gasometría / ácido-base', especialidad: 'Medicina crítica',
    tipo: 'formula',
    version: '1.0.0', referencia: 'Fisiología estándar: Winters; compensaciones aguda/crónica; anion gap y delta-delta',
    // E0-05: firma real. El pH sigue siendo number (adimensional, §3.6 del diseño).
    unidades: 'analizarGasometria({ ph: number, paco2: ClinicalQuantity<presion>, hco3|na|cl: ClinicalQuantity<concentracion_equivalente> (mEq/L), albumina: ClinicalQuantity<concentracion_masa> (g/dL) })', redondeo: '1 decimal',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué valores de pH, PaCO₂ y HCO₃ considera usted incompatibles con una muestra real (error de captura) para que el motor bloquee en vez de interpretar?',
    },
    file: 'src/lib/uci/gasometria.ts',
    entryPoints: ['analizarGasometria'],
    calculos: ['trastorno primario', 'compensación esperada (Winters y equivalentes)', 'anion gap', 'anion gap corregido por albúmina', 'delta-delta'],
    missingData: 'falta un dato del cálculo ⇒ BLOQUEA esa parte y lo dice; la oxigenación arterial NO se evalúa con muestra venosa.',
    adr: ADR('gasometria-acidobase'),
    goldenTests: ['uci-gasometria.test.ts', 'uci-gasometria-alcalosis-resp.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es donde el LLM más "razona" de memoria; la compensación esperada tiene que ser aritmética verificable, no prosa.',
  },
  {
    id: 'neurocritico-ppc', nombre: 'Neurocrítico (PPC, RASS, banderas)', especialidad: 'Medicina crítica/Neurointensivismo',
    tipo: 'formula',
    version: '1.1.0', referencia: 'Brain Trauma Foundation 2016 (metas de PPC y PIC) + práctica estándar',
    unidades: 'PAM y PIC mmHg; Na mEq/L; osmolaridad mOsm/kg; PaCO₂ mmHg; temperatura °C',
    redondeo: 'entero para PPC',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'PAM y PIC medidas en mmHg de forma simultánea',
      salida: 'PPC en mmHg; meta 60–70 (BTF)',
      ref: 'Brain Trauma Foundation 2016 (citada en el encabezado de neuro.ts)',
    },
    file: 'src/lib/uci/neuro.ts',
    entryPoints: ['analizarNeuro', 'presionPerfusionCerebral', 'interpretarRASS'],
    calculos: ['PPC = PAM − PIC', 'banderas de osmolaridad/Na/PaCO₂/temperatura', 'GCS no valorable en intubado → RASS'],
    missingData: 'faltan PAM o PIC ⇒ no calcula la PPC y declara el motivo; no ejecuta terapia osmolar ni hiperventilación.',
    adr: ADR('neurocritico-ppc'),
    goldenTests: ['uci-neuro.test.ts', 'uci-neuro-rass.test.ts'],
    estado: 'validado',
    porQueExiste: 'La PPC es una resta que se hace mal cuando PAM y PIC se leen de pantallas distintas y a horas distintas.',
  },
  {
    id: 'infusiones-dosis-rate', nombre: 'Infusiones continuas — dosis ↔ mL/h', especialidad: 'Medicina crítica/Farmacología',
    tipo: 'conversion',
    version: '1.0.0', referencia: 'Diluciones estándar declaradas en CATALOGO_INFUSIONES (aritmética de concentración)',
    // E0-05: firma real. Las tres unidades de dosis son TRES DIMENSIONES sin puente
    // entre ellas, y la concentración en U/mL tiene su propia dimensión.
    unidades: 'dosis: ClinicalQuantity<tasa_dosis_peso|tasa_dosis|tasa_actividad>; peso: ClinicalQuantity<masa>; concentracion: ClinicalQuantity<concentracion_masa|concentracion_actividad>; rateMlH: ClinicalQuantity<tasa_volumen>',
    redondeo: '2 decimales',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'fármaco del catálogo + concentración de la dilución; peso obligatorio en fármacos por kg',
      salida: 'mL/h o dosis en la unidad del fármaco',
      ref: 'src/lib/uci/infusiones.ts (CATALOGO_INFUSIONES, dosisARate, rateADosis)',
    },
    file: 'src/lib/uci/infusiones.ts',
    entryPoints: ['dosisARate', 'rateADosis', 'CATALOGO_INFUSIONES'],
    missingData: 'sin peso (en fármacos por kg) o sin concentración ⇒ BLOQUEA. No hay dilución "por defecto".',
    adr: ADR('infusiones-dosis-rate'),
    goldenTests: ['uci-infusiones.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es la conversión con mayor potencial de daño de toda la UCI: un factor 60 mal puesto multiplica por 60 la dosis del vasopresor.',
  },
  {
    id: 'vexus', nombre: 'VExUS (congestión venosa)', especialidad: 'Medicina crítica/POCUS',
    tipo: 'escala',
    version: '2020.1', referencia: 'Beaubien-Souligny W et al. Ultrasound J 2020',
    unidades: 'VCI cm; patrones vena hepática/porta/renal', redondeo: 'grado 0–3; bloquea sin VCI',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'diámetro de VCI obligatorio + patrones venosos',
      salida: 'grado 0–3',
      ref: 'src/lib/uci/pocus.ts (vexus)',
    },
    file: 'src/lib/uci/pocus.ts',
    entryPoints: ['vexus'],
    missingData: 'sin VCI BLOQUEA: el grado no se infiere de los patrones sueltos.',
    adr: ADR('vexus'),
    goldenTests: ['clinical-safety-harness.test.ts', 'uci-pocus.test.ts'],
    estado: 'validado',
    porQueExiste: 'Sostiene la decisión de retirar volumen; sin la VCI el grado no significa lo mismo.',
  },
  {
    id: 'pocus-critico', nombre: 'POCUS crítico (VD, VCI, LUS, PLR)', especialidad: 'Medicina crítica/POCUS',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Umbrales verificados de las guías provistas (Soliman 2026, Rowe 2026, Kok 2022; ver src/lib/uci/evidencia.ts)',
    unidades: 'TAPSE mm; relación VD/VI; VCI cm y % de variación; E/e′; nº de líneas B; VTI cm',
    redondeo: 'según parámetro',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué condiciones de medición (ritmo, esfuerzo espontáneo, ventana ecográfica) invalidan cada parámetro en su práctica? El motor ya bloquea las que declara evidencia.ts; falta confirmar que la lista está completa.',
    },
    file: 'src/lib/uci/pocus.ts',
    entryPoints: ['disfuncionVD_TAPSE', 'sobrecargaVD_VDVI', 'distensibilidadVCI', 'presionesLlenado_Ee', 'lineasB', 'neumotorax', 'respuestaPLR', 'lusAeration'],
    missingData: 'cada función BLOQUEA si la condición que invalida la medición está presente; no interpola.',
    adr: ADR('pocus-critico'),
    goldenTests: ['uci-pocus.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'El POCUS aporta números (TAPSE, E/e′, líneas B) que se registran en la nota como si fueran laboratorio; deben tener las mismas garantías.',
  },
  {
    id: 'ckrt-prisma', nombre: 'CKRT/PRISMA (terapia de reemplazo renal)', especialidad: 'Nefrología/Medicina crítica',
    tipo: 'formula',
    version: '1.0.0', referencia: 'KDIGO AKI 2012 + dosis de efluente mL/kg/h',
    unidades: 'flujos mL/h; peso kg; efluente mL/kg/h', redondeo: 'según motor; valida unidad/balance',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué rango de dosis de efluente (mL/kg/h) y qué balance horario considera usted implausibles, para que el motor bloquee en vez de reportar?',
    },
    file: 'src/lib/uci/ckrt.ts',
    entryPoints: ['analizarCKRT', 'analizarCitrato', 'tendenciaFiltro'],
    missingData: 'sin peso o sin flujos no calcula la dosis de efluente; lo declara.',
    adr: ADR('ckrt-prisma'),
    goldenTests: ['uci-soportes.test.ts'],
    estado: 'validado',
    porQueExiste: 'La dosis de efluente se prescribe por kg; leerla de la máquina en mL/h sin normalizar oculta una sub-dosificación.',
  },
  {
    id: 'ecmo', nombre: 'ECMO (soporte VA/VV)', especialidad: 'Medicina crítica/ECMO',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'ELSO guidelines',
    unidades: 'flujo L/min; RPM; sweep L/min; FiO₂; presiones del circuito mmHg', redondeo: 'según motor; separa dato/cálculo/alerta',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué valores de flujo, RPM y presiones del oxigenador considera fuera de rango real para que el motor bloquee en vez de interpretar?',
    },
    file: 'src/lib/uci/ecmo.ts',
    entryPoints: ['analizarECMO', 'vigilanciaOxigenador', 'panelHemolisis', 'evaluarVV', 'evaluarVA'],
    missingData: 'sin los parámetros del circuito no emite juicio sobre el soporte; separa siempre dato de cálculo y de alerta.',
    adr: ADR('ecmo'),
    goldenTests: ['uci-soportes.test.ts'],
    estado: 'validado',
    porQueExiste: 'En ECMO el dato de la consola y la interpretación se confunden con facilidad; el motor obliga a mostrarlos separados.',
  },
  {
    id: 'uci-alertas-seguridad', nombre: 'Alertas jerarquizadas de UCI', especialidad: 'Medicina crítica',
    tipo: 'regla-de-seguridad',
    version: '1.1.0', referencia: 'ESICM 2025 (PAM), AHA-CICU 2020 / ARDSNet, McClave/ASPEN 2016, PADIS 2018, Nates 2016 (ver src/lib/uci/evidencia.ts)',
    unidades: 'las de cada parámetro vigilado (PAM mmHg, Pplat cmH₂O, glucosa mg/dL, pH…)',
    redondeo: 'no aplica (emite alertas)',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'valores del panel de UCI, incluidos censurados (">500", "<50")',
      salida: 'alertas con nivel crítica/alta/moderada/informativa y `fuenteId`',
      ref: 'REGLAS_UCI en src/lib/uci/evidencia.ts',
    },
    file: 'src/lib/uci/seguridad.ts',
    entryPoints: ['analizarSeguridadUCI', 'aptoMovilizacion'],
    missingData: 'parámetro ausente no genera alerta y no se asume normal; un valor censurado extremo SÍ alerta (auditoría P1).',
    adr: ADR('uci-alertas-seguridad'),
    goldenTests: ['uci-evidencia-seguridad.test.ts', 'uci-seguridad-rass.test.ts'],
    estado: 'validado',
    porQueExiste: 'Cada alerta debe llevar su guía citada; sin registro, la jerarquía de alertas era criterio no auditable.',
  },
  {
    id: 'uci-tendencias', nombre: 'Tendencias de UCI', especialidad: 'Medicina crítica',
    tipo: 'formula',
    version: '1.0.0', referencia: 'Aritmética de serie temporal (delta y delta %); no interpreta mejoría/deterioro',
    unidades: 'las del parámetro seguido; marca temporal en ms epoch o ISO', redondeo: 'según parámetro',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'serie con al menos dos puntos utilizables',
      salida: 'dirección sube/baja/estable/insuficiente + delta y delta %',
      ref: 'src/lib/uci/tendencias.ts (tendencia)',
    },
    file: 'src/lib/uci/tendencias.ts',
    entryPoints: ['tendencia', 'tendenciasUCI'],
    missingData: 'con menos de dos puntos devuelve `insuficiente`; nunca afirma una tendencia con un solo dato.',
    adr: ADR('uci-tendencias'),
    goldenTests: ['uci-tendencias.test.ts'],
    estado: 'validado',
    porQueExiste: 'Una frase como "tendencia favorable" tiene que poder mostrar los números que la respaldan.',
  },
  {
    id: 'uci-correlacion', nombre: 'Cambio y correlación temporal en UCI', especialidad: 'Medicina crítica',
    tipo: 'formula',
    version: '1.0.0', referencia: 'Comparación de lecturas seriadas con delta mínimo relevante por métrica (METRICAS_UCI)',
    unidades: 'las de cada métrica de METRICAS_UCI', redondeo: '1 decimal',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'dos o más lecturas aplanadas del panel de UCI',
      salida: 'lista de cambios con dirección y delta, y cronología de asociaciones',
      ref: 'src/lib/uci/correlacion.ts (METRICAS_UCI, compararLecturas)',
    },
    file: 'src/lib/uci/correlacion.ts',
    entryPoints: ['compararLecturas', 'correlacionTemporal', 'resumenCambios'],
    missingData: 'una métrica ausente en una de las lecturas no se compara; no se rellena con el valor anterior.',
    adr: ADR('uci-correlacion'),
    goldenTests: ['uci-correlacion.test.ts'],
    estado: 'validado',
    porQueExiste: 'Muestra secuencia temporal, nunca causalidad: es la diferencia entre "cambió junto con" e "hizo que".',
  },
  {
    id: 'uci-extraccion-plausibilidad', nombre: 'Extracción de UCI — unidad, sinónimo y plausibilidad', especialidad: 'Medicina crítica',
    tipo: 'regla-de-seguridad',
    version: '1.1.0', referencia: 'Unidades canónicas de UCI declaradas en el propio módulo (firewall de ambigüedad)',
    unidades: 'todas las canónicas de UCI (mcg/kg/min, mmHg, cmH₂O, mmol/L, mEq/L…)',
    redondeo: 'ninguno (normaliza, no calcula)',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'texto dictado o escrito con o sin unidad',
      salida: 'valor normalizado + unidad canónica, o marca `unidadPendiente`/`ambiguo`',
      ref: 'src/lib/uci/extraccion.ts (parsearValorClinico, extraerValoresUCIConAvisos)',
    },
    file: 'src/lib/uci/extraccion.ts',
    entryPoints: ['parsearValorClinico', 'extraerValoresUCIConAvisos', 'interpretarUnidad'],
    missingData: 'ante ambigüedad NO asume: marca el valor para que la UI pida confirmación.',
    adr: ADR('uci-extraccion-plausibilidad'),
    goldenTests: ['uci-extraccion.test.ts', 'uci-extraccion-seguridad.test.ts', 'uci-extraer-valores.test.ts', 'uci-extraccion-manoslibres.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es la frontera entre el dictado y los motores: si aquí se asume una unidad, todo lo que sigue calcula sobre una mentira.',
  },

  // ── Hospitalización ──────────────────────────────────────────────────────
  {
    id: 'news2', nombre: 'NEWS2 (deterioro clínico)', especialidad: 'Hospital/Medicina interna',
    tipo: 'escala',
    version: '2017.1', referencia: 'Royal College of Physicians, NEWS2 2017',
    unidades: 'FR; SpO2 %; O2 supl.; TA sistólica mmHg; FC; temp °C; conciencia ACVPU (A=0, C/V/P/U=3)',
    redondeo: 'entero; parcial si falta parámetro (missing ≠ 0)',
    rangoValido: {
      fuente: 'referencia',
      entrada: '7 parámetros; escala 2 de SpO₂ solo con indicación explícita (no por diagnóstico de EPOC)',
      salida: 'entero 0–20 + nivel de respuesta',
      ref: 'Royal College of Physicians, NEWS2 2017',
    },
    file: 'src/lib/hospital/news2.ts',
    entryPoints: ['calcularNews2', 'puntosSpo2Escala2'],
    missingData: 'parámetro ausente NO cuenta como 0: el score es parcial y lo advierte.',
    adr: ADR('NEWS2'),
    goldenTests: ['hospital-news2.test.ts', 'hospital-news2-parcial.test.ts', 'l6-acvpu-fhir.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es el disparador de escalamiento a piso/UCI; un NEWS2 completado con ceros retrasa el aviso.',
  },
  {
    id: 'braden', nombre: 'Braden (riesgo de úlceras por presión)', especialidad: 'Enfermería/Hospital',
    tipo: 'escala',
    version: '1.0.0', referencia: 'Bergstrom N, Braden BJ et al. Nurs Res 1987',
    unidades: '6 subescalas (5 de 1–4 y fricción 1–3)', redondeo: 'entero',
    rangoValido: {
      fuente: 'codigo',
      entrada: '6 subescalas; percepción/humedad/actividad/movilidad/nutrición 1–4, fricción 1–3',
      salida: 'entero 6–23; menor puntaje = mayor riesgo',
      ref: 'src/lib/hospital/escalas.ts (calcBraden, BRADEN_ITEMS)',
    },
    file: 'src/lib/hospital/escalas.ts',
    entryPoints: ['calcBraden', 'BRADEN_ITEMS'],
    missingData: 'la función exige las 6 subescalas; la UI no debe enviar parciales.',
    adr: ADR('braden'),
    goldenTests: ['hospital-escalas-fhir.test.ts'],
    estado: 'validado',
    porQueExiste: 'Gobierna la frecuencia de cambios de posición y superficie de apoyo; el registro es medicolegal.',
  },
  {
    id: 'morse', nombre: 'Morse (riesgo de caídas)', especialidad: 'Enfermería/Hospital',
    tipo: 'escala',
    version: '1.0.0', referencia: 'Morse JM et al. Can J Aging 1989',
    unidades: '6 ítems con pesos fijos (0–30)', redondeo: 'entero',
    rangoValido: {
      fuente: 'codigo',
      entrada: '6 ítems con los pesos publicados',
      salida: 'entero 0–125; mayor puntaje = mayor riesgo',
      ref: 'src/lib/hospital/escalas.ts (calcMorse, MORSE_ITEMS)',
    },
    file: 'src/lib/hospital/escalas.ts',
    entryPoints: ['calcMorse', 'MORSE_ITEMS'],
    missingData: 'la función exige los 6 ítems; la UI no debe enviar parciales.',
    adr: ADR('morse'),
    goldenTests: ['hospital-escalas-fhir.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es el indicador de seguridad del paciente más auditado en piso; los pesos no son intuitivos y se equivocan a mano.',
  },
  {
    id: 'lab-criticos', nombre: 'Valores críticos de laboratorio (valores de pánico)', especialidad: 'Hospital/Laboratorio',
    tipo: 'regla-de-seguridad',
    version: '1.1.0', referencia: 'Umbrales heredados del propio módulo, SIN fuente citada (declarado en su encabezado)',
    unidades: 'la unidad se compara explícitamente por analito (mg/dL vs mmol/L vs g/dL vs g/L)',
    redondeo: 'no aplica (marca crítico/no crítico)',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: 'Los umbrales de valor crítico de este módulo NO tienen fuente citada (así lo declara su propio encabezado). ¿Los adopta como política del servicio, o aporta la tabla de valores de pánico que quiere usar?',
    },
    file: 'src/lib/hospital/lab-criticos.ts',
    entryPoints: ['evaluarCriticoLab', 'esCriticoLab'],
    missingData: 'sin unidad reconocida NO compara (antes comparaba a ciegas e invertía la dirección de la alerta).',
    adr: ADR('lab-criticos'),
    goldenTests: ['lab-criticos.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'Red de seguridad para que un potasio de 7.2 no se pierda porque el LIS no puso el flag.',
  },
  {
    id: 'cds-punto-de-orden', nombre: 'CDS en el punto de orden', especialidad: 'Hospital/Farmacia clínica',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Diseño de alta especificidad para evitar fatiga de alertas (ver encabezado del archivo)',
    unidades: 'lista de medicamentos + alergias del paciente + TFG cuando existe',
    redondeo: 'no aplica (emite alertas)',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'medicamentos de la orden y alergias registradas',
      salida: 'alertas crítica/alta/info, pocas y accionables',
      ref: 'Encabezado de src/lib/hospital/cds.ts',
    },
    file: 'src/lib/hospital/cds.ts',
    entryPoints: ['cdsMedicamento'],
    missingData: 'sin alergias registradas no afirma que no las hay; reutiliza los motores de alergia e interacciones.',
    adr: ADR('cds-punto-de-orden'),
    goldenTests: ['hospital-cds.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'Es el único punto donde la alerta llega ANTES de que la orden se firme.',
  },

  // ── Seguridad farmacológica ──────────────────────────────────────────────
  {
    id: 'dosis-pediatrica', nombre: 'Dosis pediátrica por peso', especialidad: 'Pediatría/Farmacología',
    tipo: 'conversion',
    version: '1.1', referencia: 'Referencias por fármaco + topes validados por el médico responsable',
    unidades: 'peso kg (conversión explícita lb→kg; hard-stop si sospecha de unidad)',
    redondeo: '1 decimal; aplica topes mg/kg/día, mg/kg/dosis y tope absoluto/día a porToma y porDía',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'peso validado por revisarPesoPediatrico; fármaco presente en FARMACOS_PED',
      salida: 'mg por toma y mg por día, nunca por encima del tope declarado',
      ref: 'src/lib/expediente/pediatria.ts (FARMACOS_PED, revisarPesoPediatrico, calcularDosisPediatrica)',
    },
    file: 'src/lib/expediente/pediatria.ts',
    entryPoints: ['calcularDosisPediatrica', 'revisarPesoPediatrico', 'libraAKg'],
    calculos: ['conversión lb→kg', 'tomas/día desde el intervalo', 'aplicación de topes por toma y por día'],
    missingData: 'sin peso válido no calcula; un peso sospechoso de estar en libras dispara hard-stop.',
    adr: ADR('dosis-pediatrica'),
    adrExtra: [ADR('dosis-amoxicilina')],
    goldenTests: ['clinical-safety-harness.test.ts', 'pediatria.test.ts', 'peso-pediatrico-seguridad.test.ts', 'seguridad-dosis.test.ts', 'dosis-invariantes-property.test.ts'],
    estado: 'validado',
    porQueExiste: 'La sobredosis pediátrica por peso mal capturado es el error con más potencial de daño de toda la consulta.',
  },
  {
    id: 'dosis-adulto-techos', nombre: 'Techos de dosis del adulto', especialidad: 'Farmacología/Seguridad del paciente',
    tipo: 'regla-de-seguridad',
    version: '1.1.0', referencia: 'CATALOGO: semilla de valores de referencia comunes, declarada como PENDIENTE de validación en su propio encabezado',
    // E0-05: la dosis prescrita es una UNIÓN por dimensión — el booleano
    // `dosisPorKg` desapareció y con él el P0 de leer "50 mg/kg" como 50 mg.
    unidades: 'revisarDosis({ dosis: ClinicalQuantity<masa> (mg) | ClinicalQuantity<dosis_por_peso> (mg/kg/dosis), peso: ClinicalQuantity<masa> }); techos del CATALOGO en mg por toma y por día (y "mg de TMP" en trimetoprima-sulfametoxazol)',
    redondeo: 'no aplica (compara contra techos)',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'fármaco presente en CATALOGO con maxTomaMg / maxDiaMg (y hardMax* cuando existen)',
      salida: 'alertas de severidad crítica/alta/info',
      ref: 'src/lib/seguridad/dosis.ts (CATALOGO, revisarDosis)',
    },
    file: 'src/lib/seguridad/dosis.ts',
    entryPoints: ['revisarDosis', 'CATALOGO', 'buscarFarmaco'],
    calculos: ['detección de error de decimal (50 → 500 mg)', 'zona amarilla entre máximo habitual y absoluto', 'topes por vía y edad mínima'],
    missingData: 'fármaco fuera del catálogo ⇒ `sin_referencia` explícito. AUSENCIA de alerta ≠ dosis segura.',
    adr: ADR('dosis-adulto-techos'),
    adrExtra: [ADR('dosis-amoxicilina')],
    goldenTests: ['seguridad-dosis.test.ts', 'dosis-decision-amoxicilina.test.ts', 'dosis-invariantes-property.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'Es el techo que evita el error de decimal; E0-02 documentó que 20 de 25 fármacos pediátricos no tienen aquí referencia adulta (REG-043).',
  },
  {
    id: 'alergias-gate', nombre: 'Compuerta de alergias', especialidad: 'Seguridad del paciente',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Normalización estructurada de alergias para el cruce de seguridad y FHIR',
    unidades: 'texto libre o alergias estructuradas (sustancia + severidad)',
    redondeo: 'no aplica',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'alergiasEstructuradas si existen; si no, parseo del texto libre',
      salida: 'lista normalizada + bandera de alergia grave',
      ref: 'src/lib/seguridad/alergias.ts (alergiasDe, tieneAlergiaGrave)',
    },
    file: 'src/lib/seguridad/alergias.ts',
    entryPoints: ['alergiasDe', 'tieneAlergiaGrave', 'parsearAlergiasTexto', 'alergiasParaImpreso'],
    missingData: 'sin alergias registradas NO afirma "niega alergias": distingue "no hay dato" de "no tiene".',
    adr: ADR('alergias-gate'),
    goldenTests: ['alergias.test.ts', 'seguridad-red-clinica.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es la compuerta que bloquea la prescripción; un texto libre no normalizado deja pasar el betalactámico al alérgico.',
  },
  {
    id: 'cruce-alergia-farmaco-lexico', nombre: 'Cruce alergia ↔ medicamento (léxico)', especialidad: 'Seguridad del paciente',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Familias farmacológicas declaradas en el módulo (FAMILIA_BETALACTAMICOS, FARMACOS_CRITICOS)',
    unidades: 'nombres de fármaco y de alérgeno en texto', redondeo: 'no aplica',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'nombres reconocidos por el diccionario; solo corrige con confianza ALTA',
      salida: 'conflictos alergia↔medicamento y marca de fármaco crítico',
      ref: 'src/lib/expediente/medical-dictionary.ts (validarAlergiasVsMedicamentos, esMedicamentoCritico)',
    },
    file: 'src/lib/expediente/medical-dictionary.ts',
    entryPoints: ['validarAlergiasVsMedicamentos', 'esMedicamentoCritico', 'normalizarTermino'],
    missingData: 'un término no reconocido devuelve sugerencia + needs_review; nunca sustituye una palabra por otra de significado distinto.',
    adr: ADR('cruce-alergia-farmaco-lexico'),
    goldenTests: ['medical-dictionary.test.ts', 'seguridad-red-clinica.test.ts'],
    estado: 'validado',
    porQueExiste: 'La alergia se dicta por nombre comercial y el fármaco se prescribe por genérico; sin el léxico el cruce no ocurre.',
  },
  {
    id: 'prescripcion-segura', nombre: 'Prescripción segura (renal, hepática, embarazo)', especialidad: 'Farmacología clínica',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Tablas AJUSTE_RENAL, RIESGO_HEPATICO y EMBARAZO_LACTANCIA declaradas en el módulo',
    unidades: 'TFG mL/min/1.73 m²; nombre genérico del fármaco', redondeo: 'no aplica',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué fuente primaria respalda los cortes de TFG de AJUSTE_RENAL y las categorías de RIESGO_HEPATICO/EMBARAZO_LACTANCIA de este módulo?',
    },
    file: 'src/lib/expediente/prescripcion-segura.ts',
    entryPoints: ['revisarFarmaco', 'ajustePorTFG', 'revisarListaRenal', 'estadioERC'],
    missingData: 'sin TFG no emite ajuste renal y lo dice; no asume función renal normal.',
    adr: ADR('prescripcion-segura'),
    goldenTests: ['prescripcion-segura.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'Concentra las tres revisiones que se hacen "de memoria" al firmar la receta.',
  },
  {
    id: 'via-parenteral', nombre: 'Corrección de vía parenteral', especialidad: 'Seguridad del paciente',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Lista de fármacos sin presentación oral declarada en el módulo',
    unidades: 'nombre del fármaco + vía declarada', redondeo: 'no aplica',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'medicamento de la receta con su vía (la extracción pone "oral" por omisión)',
      salida: 'vía corregida a parenteral cuando el fármaco no existe por vía oral',
      ref: 'src/lib/expediente/via-parenteral.ts (esParenteralPuro, corregirViaParenteral)',
    },
    file: 'src/lib/expediente/via-parenteral.ts',
    entryPoints: ['corregirViaParenteral', 'esParenteralPuro'],
    missingData: 'fármaco no listado ⇒ no cambia la vía (no adivina).',
    adr: ADR('via-parenteral'),
    goldenTests: ['via-parenteral.test.ts'],
    estado: 'validado',
    porQueExiste: 'La extracción marcaba "oral" por omisión y la receta salía con insulina o heparina por vía oral.',
  },
  {
    id: 'farmacovigilancia', nombre: 'Farmacovigilancia de la receta', especialidad: 'Farmacología clínica/COFEPRIS',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Pares de interacción y catálogo de controlados declarados en el módulo (cumplimiento COFEPRIS)',
    unidades: 'lista de medicamentos de la receta', redondeo: 'no aplica',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué fuente primaria respalda la lista de pares de interacción de detectarInteracciones y la clasificación de grupo de los controlados?',
    },
    file: 'src/lib/expediente/farmacovigilancia.ts',
    entryPoints: ['detectarInteracciones', 'detectarControlados'],
    missingData: 'par no listado ⇒ sin alerta; no significa que no haya interacción.',
    adr: ADR('farmacovigilancia'),
    goldenTests: ['farmacovigilancia.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'Corre sobre la receta, que es el artefacto que realmente se dispensa.',
  },

  // ── Consulta: escalas contextuales ───────────────────────────────────────
  {
    id: 'calculadoras-contextuales', nombre: 'Calculadoras clínicas contextuales', especialidad: 'Medicina interna/Urgencias',
    tipo: 'escala',
    version: '1.0.0', referencia: 'Cada escala cita su publicación en subMotores (campo `referencia` de CALCULADORAS)',
    unidades: 'ítems booleanos o categóricos según la escala', redondeo: 'entero por escala',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'los ítems que define la publicación de cada escala',
      salida: 'puntaje entero + categoría + interpretación citada',
      ref: 'Campo `referencia` de cada entrada de CALCULADORAS (src/lib/expediente/calculadoras.ts)',
    },
    file: 'src/lib/expediente/calculadoras.ts',
    entryPoints: ['CALCULADORAS', 'calculadorasSugeridas', 'camposSinResponder'],
    subMotores: [
      { id: 'cha2ds2vasc', nombre: 'CHA₂DS₂-VASc', referencia: 'Lip GYH et al. Chest 2010 · ESC 2024' },
      { id: 'hasbled', nombre: 'HAS-BLED', referencia: 'Pisters R et al. Chest 2010' },
      { id: 'wells-tep', nombre: 'Wells (TEP)', referencia: 'Wells PS et al. Thromb Haemost 2000' },
      { id: 'wells-tvp', nombre: 'Wells (TVP)', referencia: 'Wells PS et al. Lancet 1997' },
      { id: 'curb65', nombre: 'CURB-65', referencia: 'Lim WS et al. Thorax 2003' },
      { id: 'qsofa', nombre: 'qSOFA', referencia: 'Singer M et al. JAMA 2016 (Sepsis-3)' },
      { id: 'centor', nombre: 'Centor / McIsaac', referencia: 'McIsaac WJ et al. CMAJ 1998' },
      { id: 'alvarado', nombre: 'Alvarado', referencia: 'Alvarado A. Ann Emerg Med 1986' },
      { id: 'heart', nombre: 'HEART', referencia: 'Six AJ et al. Neth Heart J 2008' },
      { id: 'glasgow', nombre: 'Glasgow (GCS)', referencia: 'Teasdale G, Jennett B. Lancet 1974' },
      { id: 'child-pugh', nombre: 'Child-Pugh', referencia: 'Pugh RNH et al. Br J Surg 1973' },
    ],
    missingData: 'HEART, Glasgow y Child-Pugh devuelven `scoreIncompleto` con los campos que faltan en vez de sumar ceros.',
    adr: ADR('calculadoras-contextuales'),
    goldenTests: ['calculadoras.test.ts'],
    estado: 'validado',
    porQueExiste: 'Se sugieren solas según el diagnóstico dictado; sin registro, once escalas publicadas vivían sin ADR ni rango declarado.',
  },

  // ── Pediatría ────────────────────────────────────────────────────────────
  {
    id: 'crecimiento-oms-lms', nombre: 'Crecimiento OMS (LMS → puntuación z)', especialidad: 'Pediatría',
    tipo: 'tabla-referencia',
    version: '1.0.0', referencia: 'WHO Child Growth Standards — tablas ampliadas de puntuación z publicadas por la OMS (cdn.who.int); archivo GENERADO, no editar a mano',
    unidades: 'peso kg; talla cm; perímetro cefálico cm; edad en meses; sexo',
    redondeo: 'z con 2 decimales; percentil entero al mostrar',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'edad dentro del rango de meses que cubre cada tabla LMS',
      salida: 'puntuación z y percentil',
      ref: 'src/lib/expediente/oms-crecimiento.ts (PESO_EDAD_*, TALLA_EDAD_*, IMC_EDAD_*, PC_EDAD_*)',
    },
    file: 'src/lib/expediente/oms-crecimiento.ts',
    entryPoints: ['PESO_EDAD_NINO', 'PESO_EDAD_NINA', 'TALLA_EDAD_NINO', 'TALLA_EDAD_NINA', 'IMC_EDAD_NINO', 'IMC_EDAD_NINA', 'PC_EDAD_NINO', 'PC_EDAD_NINA'],
    calculos: ['zScoreLMS y clasificación nutricional (consumidos desde pediatria.ts)'],
    missingData: 'edad fuera del rango de la tabla ⇒ no interpola: no devuelve z.',
    adr: ADR('crecimiento-oms-lms'),
    goldenTests: ['pediatria.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es una tabla de referencia oficial: si se edita a mano deja de ser la de la OMS y nadie lo nota.',
  },
  {
    id: 'esquema-vacunacion-mx', nombre: 'Esquema de vacunación de México', especialidad: 'Pediatría/Salud pública',
    tipo: 'tabla-referencia',
    version: '1.0.0', referencia: 'Esquema nacional de vacunación de México transcrito en ESQUEMA_MX',
    unidades: 'edad en meses/años', redondeo: 'no aplica',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué edición del esquema nacional (y de qué fecha) debe reflejar ESQUEMA_MX, para poder versionarlo cuando cambie la Cartilla?',
    },
    file: 'src/lib/expediente/pediatria.ts',
    entryPoints: ['ESQUEMA_MX', 'vacunasSegunEdad'],
    missingData: 'sin fecha de nacimiento no calcula atrasos.',
    adr: ADR('esquema-vacunacion-mx'),
    goldenTests: ['pediatria.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'La detección de atrasos es una bandera clínica que el médico lee como dato; debe tener versión y fecha.',
  },

  // ── Cardiometabólico ─────────────────────────────────────────────────────
  {
    id: 'prevent-ascvd', nombre: 'PREVENT-ASCVD (riesgo a 10 y 30 años)', especialidad: 'Cardiología/Prevención',
    tipo: 'formula',
    version: '2024.1', referencia: 'Khan SS et al. Development and Validation of the AHA PREVENT Equations. Circulation. 2024;149:430-449',
    unidades: 'edad años; TAS mmHg; colesterol total y HDL mg/dL; TFG mL/min/1.73 m²; booleanos de diabetes/tabaco/tratamiento',
    redondeo: 'porcentaje con 1 decimal',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'edad ≥ 30 años (las ecuaciones no aplican antes); el riesgo a 30 años solo tiene sentido en el rango publicado',
      salida: 'riesgo % a 10 años y, cuando aplica, a 30 años',
      ref: 'Khan SS et al. Circulation 2024 (coeficientes en prevent-coeficientes.ts, validados contra 4 valores publicados)',
    },
    file: 'src/lib/expediente/prevent.ts',
    archivos: ['src/lib/expediente/prevent-coeficientes.ts'],
    entryPoints: ['prevent', 'motivoSinPrevent'],
    missingData: '`motivoSinPrevent` explica por qué no se puede calcular en vez de devolver un riesgo inventado.',
    adr: ADR('prevent-ascvd'),
    goldenTests: ['prevent.test.ts'],
    estado: 'validado',
    porQueExiste: 'Sustituye a las Pooled Cohort Equations y sus estimaciones son 40–50 % más bajas: usar la ecuación vieja sobretrata.',
  },
  {
    id: 'dislipidemia-accaha-2026', nombre: 'Dislipidemia (metas e intensidad de estatina)', especialidad: 'Cardiología/Prevención',
    tipo: 'regla-de-seguridad',
    version: '2026.1', referencia: '2026 ACC/AHA Guideline on the Management of Dyslipidemia. J Am Coll Cardiol. 2026;87(19):2624-2757. doi:10.1016/j.jacc.2025.11.016',
    unidades: 'LDL-C, no-HDL-C y triglicéridos mg/dL; Lp(a) nmol/L o mg/dL',
    redondeo: 'no aplica (clasifica y recomienda intensidad)',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'panel lipídico + categoría de riesgo (PREVENT o condición de muy alto riesgo)',
      salida: 'meta lipídica, intensidad de estatina y potenciadores de riesgo',
      ref: 'FUENTE_DISLIPIDEMIA en src/lib/expediente/cardiometabolico/dislipidemia.ts',
    },
    file: 'src/lib/expediente/cardiometabolico/dislipidemia.ts',
    entryPoints: ['metaLipidica', 'recomendarEstatina', 'categorizarPrevent', 'planTrigliceridos', 'esMuyAltoRiesgo'],
    missingData: 'sin categoría de riesgo no fija meta; sin LDL-C no recomienda intensidad.',
    adr: ADR('dislipidemia-accaha-2026'),
    goldenTests: ['dislipidemia.test.ts', 'cardiometabolico.test.ts'],
    estado: 'validado',
    porQueExiste: 'Las metas cambiaron con la guía 2026 y la intensidad de estatina se elige mal de memoria.',
  },
  {
    id: 'obesidad-abcd', nombre: 'Obesidad — estadificación ABCD', especialidad: 'Endocrinología/Obesidad',
    tipo: 'escala',
    version: '2025.1', referencia: 'AACE Consensus Statement: Algorithm for the Evaluation and Treatment of Adults with Obesity/ABCD — 2025 Update. Endocr Pract. 2025;31:1351-1394',
    unidades: 'peso kg; talla m; cintura cm; IMC kg/m²', redondeo: 'IMC 1 decimal',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'adultos; cortes de cintura ajustados a población mexicana declarados en el módulo',
      salida: 'clase de IMC, índice cintura-talla y estadio ABCD',
      ref: 'FUENTE_OBESIDAD, CORTES_CINTURA y NOTA_IMC_ETNIA en src/lib/expediente/cardiometabolico/obesidad.ts',
    },
    file: 'src/lib/expediente/cardiometabolico/obesidad.ts',
    entryPoints: ['imc', 'clasificarIMC', 'indiceCinturaTalla', 'estadificarABCD', 'evaluarRespuesta'],
    missingData: 'sin talla no calcula IMC; sin complicación declarada no estadifica ABCD.',
    adr: ADR('obesidad-abcd'),
    goldenTests: ['cardiometabolico.test.ts'],
    estado: 'validado',
    porQueExiste: 'El estadio ABCD, no el IMC solo, es lo que decide la intensidad del tratamiento.',
  },
  {
    id: 'biomarcadores-lipidicos', nombre: 'Biomarcadores lipídicos (apoB, Lp(a), no-HDL, remanente)', especialidad: 'Cardiología/Prevención',
    tipo: 'formula',
    version: '1.0.0', referencia: 'Metas y cortes citados en el encabezado del módulo (complemento de la guía de dislipidemia)',
    unidades: 'apoB mg/dL; Lp(a) nmol/L o mg/dL; colesterol total, HDL y LDL-C mg/dL',
    redondeo: 'entero para no-HDL y remanente',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué corte de apoB y de Lp(a) adopta como meta en su práctica, y en qué unidad reporta Lp(a) su laboratorio (nmol/L vs mg/dL)? El módulo trae los cortes citados; falta su adopción explícita.',
    },
    file: 'src/lib/expediente/cardiometabolico/biomarcadores-lipidos.ts',
    entryPoints: ['evaluarPanelLipidico', 'calcularNoHDL', 'calcularRemanente', 'interpretarApoB', 'interpretarLpA'],
    calculos: ['no-HDL-C = CT − HDL', 'colesterol remanente = CT − HDL − LDL'],
    missingData: 'falta un componente del panel ⇒ no calcula el derivado correspondiente.',
    adr: ADR('biomarcadores-lipidicos'),
    goldenTests: ['biomarcadores-lipidos.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'El LDL-C se CALCULA y engaña con triglicéridos altos; apoB y no-HDL son el respaldo cuando discrepan.',
  },

  // ── Gineco-obstetricia ───────────────────────────────────────────────────
  {
    id: 'gineco-obstetricia', nombre: 'Gestación, Bishop y profilaxis de preeclampsia', especialidad: 'Ginecología y obstetricia',
    tipo: 'formula',
    version: '1.0.0', referencia: 'NOM-007 / OMS (control prenatal); ACOG-USPSTF (aspirina en preeclampsia); Bishop EH, Obstet Gynecol 1964',
    unidades: 'FUM como fecha; edad gestacional en semanas+días; ítems de Bishop 0–3',
    redondeo: 'semanas enteras + días',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿A partir de qué diferencia entre la edad gestacional por FUM y por ultrasonido debe el sistema preferir el ultrasonido y avisarlo?',
    },
    file: 'src/lib/expediente/ginecologia.ts',
    entryPoints: ['gestacionPorFUM', 'gestacionPorUltrasonido', 'bishop', 'aspirinaPreeclampsia', 'hitosSegunEG'],
    subMotores: [
      { id: 'bishop', nombre: 'Índice de Bishop', referencia: 'Bishop EH. Obstet Gynecol 1964' },
      { id: 'aspirina-preeclampsia', nombre: 'Profilaxis con aspirina', referencia: 'ACOG / USPSTF (factores de riesgo alto y moderado)' },
    ],
    missingData: 'sin FUM ni ultrasonido no estima edad gestacional; no promedia entre métodos.',
    adr: ADR('gineco-obstetricia'),
    goldenTests: ['ginecologia.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'La edad gestacional gobierna todo el control prenatal; calcularla mal desplaza cada hito.',
  },

  // ── Infectología / PROA ──────────────────────────────────────────────────
  {
    id: 'antibiograma-motor', nombre: 'Motor de interpretación de antibiogramas', especialidad: 'Infectología/Microbiología',
    tipo: 'regla-de-seguridad',
    version: '2.0.0', referencia: 'CLSI M100-Ed35 (2025); Torres & Cercenado 2010; Navarro 2010; Vila & Marco 2010; Bush & Bradford 2019; Magiorakos 2012; EUCAST Expert Rules 2013; NOM-045',
    unidades: 'CMI en µg/mL; categorías S/I/R; especie/organismo',
    redondeo: 'no aplica (interpreta categorías)',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'pares {antibiótico, S/I/R, CMI} de un organismo identificado; breakpoints del CLSI M100-Ed35',
      salida: 'fenotipo, mecanismo inferido, categorías MDR/XDR/PDR y terapia dirigida, todo citado',
      ref: 'REF en src/lib/expediente/antibiograma/referencias.ts',
    },
    file: 'src/lib/expediente/antibiograma/motor.ts',
    archivos: [
      'src/lib/expediente/antibiograma/index.ts',
      'src/lib/expediente/antibiograma/algoritmo.ts',
      'src/lib/expediente/antibiograma/aminoglucosidos.ts',
      'src/lib/expediente/antibiograma/betalactamasas.ts',
      'src/lib/expediente/antibiograma/clsi-breakpoints.ts',
      'src/lib/expediente/antibiograma/clsi-pruebas.ts',
      'src/lib/expediente/antibiograma/confirmatorias.ts',
      'src/lib/expediente/antibiograma/enterobacterales.ts',
      'src/lib/expediente/antibiograma/fastidiosos.ts',
      'src/lib/expediente/antibiograma/grampositivos.ts',
      'src/lib/expediente/antibiograma/intrinseca.ts',
      'src/lib/expediente/antibiograma/mdr.ts',
      'src/lib/expediente/antibiograma/nofermentadores.ts',
      'src/lib/expediente/antibiograma/seguridad.ts',
      'src/lib/expediente/antibiograma/validar-razonamiento.ts',
    ],
    entryPoints: ['interpretarAntibiograma'],
    subMotores: [
      { id: 'clsi-m100-breakpoints', nombre: 'Interpretación de CMI por breakpoint', referencia: 'CLSI M100-Ed35 (2025), Tabla 2A-1' },
      { id: 'mdr-xdr-pdr', nombre: 'MDR/XDR/PDR (Magiorakos)', referencia: 'Magiorakos AP et al. Clin Microbiol Infect 2012;18:268-281' },
      { id: 'resistencia-intrinseca', nombre: 'Resistencia intrínseca por especie', referencia: 'Vila & Marco 2010; Torres & Cercenado 2010' },
      { id: 'eucast-expert-rules', nombre: 'Fenotipos excepcionales y cross-resistencia', referencia: 'Leclercq R, Cantón R et al. Clin Microbiol Infect 2013;19:141-160 (Tablas 5-7, 12-13)' },
      { id: 'guardian-razonamiento-llm', nombre: 'Guardián anti-contradicción del LLM', referencia: 'Regla interna: el texto del modelo no puede contradecir las categorías del motor' },
    ],
    missingData: 'sin organismo identificado no infiere mecanismo; un antibiótico ausente del panel no se asume sensible.',
    adr: ADR('antibiograma-motor'),
    goldenTests: ['antibiograma.test.ts', 'antibiograma-clinico.test.ts', 'antibiograma-clsi-validado-dr.test.ts', 'antibiograma-matcher.test.ts', 'antibiograma-fosfo-nitro-gating.test.ts', 'antibiograma-frontera-ia.test.ts'],
    estado: 'validado',
    porQueExiste: 'El foso del producto: «la IA EXTRAE, el motor RAZONA». Ninguna afirmación de resistencia puede salir de un LLM.',
  },
  {
    id: 'proa-reevaluacion', nombre: 'PROA — reevaluación a 48-72 h', especialidad: 'Infectología/PROA',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Estándar de antimicrobial stewardship (reevaluación, desescalamiento, switch IV→VO, duración)',
    unidades: 'lista de antimicrobianos de la nota; días de tratamiento', redondeo: 'no aplica',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: '¿Qué duraciones máximas por síndrome quiere que el plan PROA proponga como recordatorio? Hoy solo recuerda reevaluar, sin fijar duración.',
    },
    file: 'src/lib/expediente/proa.ts',
    entryPoints: ['detectarAntimicrobianos', 'construirPlanPROA'],
    missingData: 'si no detecta antimicrobianos no genera plan (no propone stewardship sin antibiótico).',
    adr: ADR('proa-reevaluacion'),
    goldenTests: ['proa.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'El desescalamiento a las 48-72 h es el punto donde el stewardship se gana o se pierde, y es el que más se olvida.',
  },

  // ── Inmunocomprometido ───────────────────────────────────────────────────
  {
    id: 'inmuno-farmacos', nombre: 'Reglas por fármaco inmunosupresor', especialidad: 'Infectología/Trasplante',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Guía/artículo citado por regla en el campo `fuente` de cada recomendación',
    unidades: 'chips de fármaco inmunosupresor + serologías (VHB, VHC, VIH, CMV…)',
    redondeo: 'no aplica',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'fármaco inmunosupresor seleccionado + estado serológico capturado',
      salida: 'profilaxis y vigilancia condicionadas, con su cita',
      ref: 'Campo `fuente` de cada regla en src/lib/inmuno/farmacos.ts',
    },
    file: 'src/lib/inmuno/farmacos.ts',
    entryPoints: ['recsFarmacos'],
    missingData: 'serología no capturada NO se asume negativa: la recomendación condicionada no se emite y se pide el dato.',
    adr: ADR('inmuno-farmacos'),
    goldenTests: ['inmuno-farmacos.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'Un VHB+ que empieza rituximab sin profilaxis antiviral puede reactivar y morir; la regla no puede depender de la memoria.',
  },
  {
    id: 'inmuno-recomendaciones', nombre: 'Recomendaciones del huésped inmunocomprometido', especialidad: 'Infectología/Trasplante',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Guía/artículo citado por recomendación en el campo `fuente`',
    unidades: 'chips de tipo de trasplante/estado inmunológico + estudios seleccionados',
    redondeo: 'no aplica',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'perfil del huésped (SOT/TCMH/biológicos) y estudios capturados',
      salida: 'recomendaciones citadas para la nota',
      ref: 'Campo `fuente` de cada recomendación en src/lib/inmuno/recomendaciones.ts',
    },
    file: 'src/lib/inmuno/recomendaciones.ts',
    entryPoints: ['recomendaciones'],
    missingData: 'sin perfil de huésped no emite recomendaciones genéricas.',
    adr: ADR('inmuno-recomendaciones'),
    goldenTests: ['inmuno.test.ts'],
    estado: 'pendiente_validacion',
    porQueExiste: 'La valoración pre-trasplante se arma con listas de verificación que se pierden entre consultas.',
  },

  // ── Laboratorio longitudinal ─────────────────────────────────────────────
  {
    id: 'lab-analitos-plausibilidad', nombre: 'Analitos de laboratorio — clave canónica y plausibilidad', especialidad: 'Laboratorio clínico',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'Catálogo de analitos con unidad canónica y rango plausible declarado en el módulo',
    unidades: 'la unidad canónica declarada por analito en ANALITOS',
    redondeo: 'no aplica (normaliza y valida)',
    rangoValido: {
      fuente: 'codigo',
      entrada: 'valor + unidad reportados por el laboratorio',
      salida: 'clave canónica del analito y bandera de valor plausible',
      ref: 'src/lib/expediente/laboratorio/analitos.ts (ANALITOS, valorPlausible)',
    },
    file: 'src/lib/expediente/laboratorio/analitos.ts',
    archivos: ['src/lib/expediente/laboratorio/extraccion.ts'],
    entryPoints: ['ANALITOS', 'analitoDe', 'valorPlausible', 'validarPanel'],
    missingData: 'un valor sin unidad reconocida no entra a la serie temporal; no se convierte a ciegas.',
    adr: ADR('lab-analitos-plausibilidad'),
    goldenTests: ['laboratorio-extraccion.test.ts'],
    estado: 'validado',
    porQueExiste: 'Sin clave canónica la gráfica de tendencia se parte en tres series; sin plausibilidad, un OCR malo la deforma.',
  },

  // ── Orquestadores deterministas de consulta ──────────────────────────────
  {
    id: 'copiloto-clinico', nombre: 'Copiloto clínico (orquestador determinista)', especialidad: 'Medicina general',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'No introduce criterio propio: orquesta los motores ya citados (TFG, dosis, alergias, escalas)',
    unidades: 'las de cada motor que invoca', redondeo: 'el de cada motor',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'lo ya capturado en la consulta (edad, sexo, signos, diagnósticos, receta)',
      salida: 'solo lo que puede afirmar con esos datos; nada que exija preguntar al médico',
      ref: 'Encabezado de src/lib/expediente/copiloto.ts',
    },
    file: 'src/lib/expediente/copiloto.ts',
    entryPoints: ['copiloto', 'textoParaNota'],
    missingData: 'si el dato no está capturado, el copiloto calla en vez de pedirlo o suponerlo.',
    adr: ADR('copiloto-clinico'),
    goldenTests: ['copiloto.test.ts', 'copiloto-clinico-lote7.test.ts', 'copiloto-signos-pediatricos.test.ts', 'copiloto-puerperio.test.ts', 'copiloto-ckdepi-pediatrico.test.ts'],
    estado: 'validado',
    porQueExiste: 'Es el punto donde varios motores se combinan; una combinación mal ordenada convierte dos salidas correctas en una alerta falsa.',
  },
  {
    id: 'traza-razonamiento', nombre: 'Traza visible del razonamiento clínico', especialidad: 'Medicina general',
    tipo: 'regla-de-seguridad',
    version: '1.0.0', referencia: 'No añade criterio: hace visible lo que el copiloto ya calculó',
    unidades: 'las de los motores trazados', redondeo: 'no aplica',
    rangoValido: {
      fuente: 'referencia',
      entrada: 'salidas del copiloto y de los motores invocados',
      salida: 'pasos del razonamiento con el dato que los respalda',
      ref: 'Encabezado de src/lib/expediente/razonamiento.ts',
    },
    file: 'src/lib/expediente/razonamiento.ts',
    entryPoints: ['construirTraza', 'resumenTraza'],
    missingData: 'un paso sin dato de respaldo no se muestra como concluido.',
    adr: ADR('traza-razonamiento'),
    goldenTests: ['razonamiento.test.ts'],
    estado: 'validado',
    porQueExiste: 'Una recomendación sin traza es indistinguible de una alucinación del modelo.',
  },
  {
    id: 'medicina-preventiva', nombre: 'Tamizaje preventivo por edad y sexo', especialidad: 'Medicina preventiva',
    tipo: 'tabla-referencia',
    version: '0.1.0', referencia: 'ADVERTENCIA declarada en el propio módulo: las recomendaciones NO se construyeron leyendo los documentos originales',
    unidades: 'edad años; sexo', redondeo: 'no aplica',
    rangoValido: {
      fuente: 'pendiente_validacion_clinica',
      preguntaAlMedico: 'El módulo declara en su encabezado que sus recomendaciones no vienen de fuentes primarias. ¿Qué guía de tamizaje (USPSTF, CENETEC, u otra) adopta como fuente para reescribir TAMIZAJES?',
    },
    file: 'src/lib/expediente/preventivo.ts',
    entryPoints: ['tamizajesPara', 'tamizajesProximos', 'alertaDeTendencia'],
    missingData: 'sin edad no propone tamizaje.',
    adr: ADR('medicina-preventiva'),
    goldenTests: ['preventivo.test.ts'],
    estado: 'experimental',
    porQueExiste: 'Está en producción y su propio encabezado advierte que su procedencia es más débil que la del resto: registrarlo lo hace visible en vez de dejarlo indistinguible de los motores con fuente leída.',
  },
]

/** Busca un motor por id. */
export const motorPorId = (id: string): MotorClinico | undefined =>
  CLINICAL_ENGINE_REGISTRY.find(m => m.id === id)

/** Todos los archivos que un motor reclama como suyos (principal + adicionales). */
export const archivosDelMotor = (m: MotorClinico): string[] => [m.file, ...(m.archivos ?? [])]

/** Ids de escalas publicadas dentro de motores-familia (regla de granularidad §3.1). */
export const subMotorIds = (): string[] =>
  CLINICAL_ENGINE_REGISTRY.flatMap(m => (m.subMotores ?? []).map(s => s.id))
