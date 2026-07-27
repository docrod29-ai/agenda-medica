/**
 * ══════════════════════════════════════════════════════════════════════════
 * CLINICAL ENGINE REGISTRY (charter §17)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Registro ÚNICO y auditable de los motores clínicos deterministas. Cada motor
 * declara aquí: id, versión, especialidad, referencia, unidad canónica de entrada,
 * política de redondeo, archivo, y el/los test(s) golden que lo respaldan.
 *
 * Propósito: que un revisor (o un test de integridad) pueda ver de un vistazo qué
 * motores existen, en qué versión, con qué evidencia y con qué cobertura de golden
 * tests — en vez de tenerlo disperso en comentarios. Es metadato PURO (no ejecuta
 * cálculo) para evitar ciclos de import; la lógica vive en cada `file`.
 *
 * REGLA: al agregar/modificar un motor clínico, actualiza su entrada aquí y su ADR
 * en docs/clinical-decisions/. Ver docs/audit/regression-ledger.md para incidentes.
 */

export type EstadoMotor = 'validado' | 'pendiente_validacion' | 'experimental'

export interface MotorClinico {
  id: string
  nombre: string
  especialidad: string
  version: string
  referencia: string
  /** Unidad canónica que el motor espera (safety-critical: evita el bug de escala). */
  unidades: string
  redondeo: string
  file: string
  goldenTests: string[]
  estado: EstadoMotor
}

export const CLINICAL_ENGINE_REGISTRY: MotorClinico[] = [
  {
    id: 'ckd-epi-2021', nombre: 'CKD-EPI 2021 (TFG, race-free)', especialidad: 'Nefrología',
    version: '2021.1', referencia: 'Inker LA et al. NEJM 2021 (CKD-EPI creatinine, sin raza)',
    unidades: 'creatinina mg/dL; edad años; sexo', redondeo: 'ninguno en el motor; el display redondea',
    file: 'src/lib/expediente/funcion-renal.ts',
    goldenTests: ['clinical-safety-harness.test.ts', 'funcion-renal.test.ts', 'funcion-renal-plausibilidad.test.ts'],
    estado: 'validado',
  },
  {
    id: 'cockcroft-gault', nombre: 'Cockcroft-Gault (ClCr)', especialidad: 'Nefrología/Farmacología',
    version: '1976.1', referencia: 'Cockcroft & Gault, Nephron 1976',
    unidades: 'creatinina mg/dL; edad años; peso kg; sexo', redondeo: 'entero al mostrar',
    file: 'src/lib/expediente/funcion-renal.ts',
    goldenTests: ['clinical-safety-harness.test.ts', 'funcion-renal.test.ts'],
    estado: 'validado',
  },
  {
    id: 'meld', nombre: 'MELD (UNOS)', especialidad: 'Hepatología',
    version: 'UNOS.1', referencia: 'Kamath PS et al. Hepatology 2001 (variante UNOS con pisos)',
    unidades: 'bilirrubina mg/dL; INR; creatinina mg/dL', redondeo: 'entero, acotado 6–40',
    file: 'src/lib/expediente/calculadoras.ts',
    goldenTests: ['clinical-safety-harness.test.ts', 'calculadoras.test.ts'],
    estado: 'validado',
  },
  {
    id: 'fib-4', nombre: 'FIB-4 (fibrosis hepática)', especialidad: 'Hepatología/MASLD',
    version: '1.1', referencia: 'Sterling RK et al. Hepatology 2006',
    unidades: 'edad años; AST/ALT U/L; plaquetas ×10⁹/L (normaliza si viene en /µL)', redondeo: '2 decimales',
    file: 'src/lib/expediente/cardiometabolico/masld.ts',
    goldenTests: ['clinical-safety-harness.test.ts (FIB-4 + property-based unidad)'],
    estado: 'validado',
  },
  {
    id: 'apfel', nombre: 'Apfel (NVPO)', especialidad: 'Anestesiología',
    version: '1999.1', referencia: 'Apfel CC et al. Anesthesiology 1999',
    unidades: 'nº de factores 0–4', redondeo: 'porcentaje entero',
    file: 'src/lib/expediente/cirugia.ts', goldenTests: ['clinical-safety-harness.test.ts'],
    estado: 'validado',
  },
  {
    id: 'rcri', nombre: 'RCRI (riesgo cardiaco perioperatorio)', especialidad: 'Medicina perioperatoria',
    version: 'Lee-rev', referencia: 'Lee TH et al. Circulation 1999 (revisado, guía AHA/ACC 2024)',
    unidades: '6 factores booleanos', redondeo: 'clase I–IV',
    file: 'src/lib/expediente/preop.ts', goldenTests: ['clinical-safety-harness.test.ts', 'preop-scales.test.ts'],
    estado: 'validado',
  },
  {
    id: 'caprini', nombre: 'Caprini (riesgo de ETV)', especialidad: 'Cirugía/Medicina perioperatoria',
    version: '2005.1', referencia: 'Caprini JA, Dis Mon 2005',
    unidades: 'suma ponderada de factores', redondeo: 'nivel Muy bajo/Bajo/Moderado/Alto',
    file: 'src/lib/expediente/preop.ts', goldenTests: ['clinical-safety-harness.test.ts', 'preop-scales.test.ts'],
    estado: 'validado',
  },
  {
    id: 'sofa', nombre: 'SOFA (disfunción orgánica)', especialidad: 'Medicina crítica',
    version: '1.1.0', referencia: 'Vincent JL et al. Intensive Care Med 1996',
    unidades: 'PaFi mmHg; plaquetas ×10³/µL; bili mg/dL; PAM mmHg; vasopresores mcg/kg/min; GCS; creat mg/dL',
    redondeo: 'entero; parcial si falta aparato (missing ≠ 0)',
    file: 'src/lib/uci/scores.ts', goldenTests: ['clinical-safety-harness.test.ts', 'uci-sofa.test.ts', 'uci-scores2.test.ts'],
    estado: 'validado',
  },
  {
    id: 'apache-ii', nombre: 'APACHE II', especialidad: 'Medicina crítica',
    version: '1.1.0', referencia: 'Knaus WA et al. Crit Care Med 1985',
    unidades: '12 variables fisiológicas + edad + salud crónica', redondeo: 'entero; parcial si falta variable (missing ≠ 0)',
    file: 'src/lib/uci/scores.ts', goldenTests: ['clinical-safety-harness.test.ts', 'uci-scores2.test.ts'],
    estado: 'validado',
  },
  {
    id: 'nee', nombre: 'Equivalente de norepinefrina', especialidad: 'Medicina crítica',
    version: '1.0.0', referencia: 'Kotani/Goradia norepinephrine equivalents',
    unidades: 'mcg/kg/min (vasopresina U/min); requiere peso para mcg/min', redondeo: '2 decimales; bloquea si no convertible',
    file: 'src/lib/uci/hemodinamia.ts', goldenTests: ['clinical-safety-harness.test.ts', 'uci-hemodinamia.test.ts'],
    estado: 'validado',
  },
  {
    id: 'vexus', nombre: 'VExUS (congestión venosa)', especialidad: 'Medicina crítica/POCUS',
    version: '2020.1', referencia: 'Beaubien-Souligny W et al. Ultrasound J 2020',
    unidades: 'VCI cm; patrones vena hepática/porta/renal', redondeo: 'grado 0–3; bloquea sin VCI',
    file: 'src/lib/uci/pocus.ts', goldenTests: ['clinical-safety-harness.test.ts', 'uci-pocus.test.ts'],
    estado: 'validado',
  },
  {
    id: 'news2', nombre: 'NEWS2 (deterioro clínico)', especialidad: 'Hospital/Medicina interna',
    version: '2017.1', referencia: 'Royal College of Physicians, NEWS2 2017',
    unidades: 'FR; SpO2 %; O2 supl.; TA sistólica mmHg; FC; temp °C; conciencia ACVPU (A=0, C/V/P/U=3)',
    redondeo: 'entero; parcial si falta parámetro (missing ≠ 0)',
    file: 'src/lib/hospital/news2.ts', goldenTests: ['hospital-news2.test.ts', 'hospital-news2-parcial.test.ts', 'l6-acvpu-fhir.test.ts'],
    estado: 'validado',
  },
  {
    id: 'dosis-pediatrica', nombre: 'Dosis pediátrica por peso', especialidad: 'Pediatría/Farmacología',
    version: '1.1', referencia: 'Referencias por fármaco + topes validados por el médico responsable',
    unidades: 'peso kg (conversión explícita lb→kg; hard-stop si sospecha de unidad)',
    redondeo: '1 decimal; aplica topes mg/kg/día, mg/kg/dosis, tope absoluto/día — a porToma y porDía',
    file: 'src/lib/expediente/pediatria.ts',
    goldenTests: ['clinical-safety-harness.test.ts (aminoglucósidos + invariante porToma≤porDía)', 'pediatria.test.ts', 'peso-pediatrico-seguridad.test.ts', 'seguridad-dosis.test.ts'],
    estado: 'validado',
  },
  {
    id: 'ckrt-prisma', nombre: 'CKRT/PRISMA (terapia de reemplazo renal)', especialidad: 'Nefrología/Medicina crítica',
    version: '1.0.0', referencia: 'KDIGO AKI 2012 + dosis de efluente mL/kg/h',
    unidades: 'flujos mL/h; peso kg; efluente mL/kg/h', redondeo: 'según motor; valida unidad/balance',
    file: 'src/lib/uci/ckrt.ts', goldenTests: ['uci-ckrt.test.ts'],
    estado: 'validado',
  },
  {
    id: 'ecmo', nombre: 'ECMO (soporte VA/VV)', especialidad: 'Medicina crítica/ECMO',
    version: '1.0.0', referencia: 'ELSO guidelines',
    unidades: 'flujo L/min; RPM; sweep; FiO2; presiones', redondeo: 'según motor; separa dato/cálculo/alerta',
    file: 'src/lib/uci/ecmo.ts', goldenTests: ['uci-ecmo.test.ts'],
    estado: 'validado',
  },
]

/** Busca un motor por id. */
export const motorPorId = (id: string): MotorClinico | undefined =>
  CLINICAL_ENGINE_REGISTRY.find(m => m.id === id)
