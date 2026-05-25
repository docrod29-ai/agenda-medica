// ══════════════════════════════════════════════════════════════
// EXPEDIENTE CLÍNICO ELECTRÓNICO (ECE)
// Cumple NOM-004-SSA3-2012 (expediente) y NOM-024-SSA3-2012 (integridad)
// Arquitectura unificada por secciones: cada tipo de nota declara qué
// secciones usa; la IA las rellena y el médico edita.
// ══════════════════════════════════════════════════════════════

export type TipoNota =
  | 'historia_clinica'   // Primera vez completa
  | 'primera_vez'        // Consulta de primera vez (simplificada)
  | 'seguimiento'        // Consulta subsecuente (SOAP)
  | 'alta_consulta'      // Alta de consulta externa
  | 'ingreso'            // Ingreso hospitalario
  | 'evolucion'          // Evolución hospitalaria (SOAP diario)
  | 'egreso'             // Egreso hospitalario

export const TIPO_NOTA_LABEL: Record<TipoNota, string> = {
  historia_clinica: 'Historia Clínica',
  primera_vez:      'Nota de Primera Vez',
  seguimiento:      'Nota de Seguimiento',
  alta_consulta:    'Nota de Alta',
  ingreso:          'Nota de Ingreso Hospitalario',
  evolucion:        'Nota de Evolución',
  egreso:           'Nota de Egreso Hospitalario',
}

export type EstadoNota = 'borrador' | 'firmada' | 'cancelada'
export type FuenteGeneracion = 'manual' | 'ia_voz' | 'ia_texto' | 'plantilla'

// ── Modelos comunes ───────────────────────────────────────────

export interface Diagnostico {
  descripcion: string
  codigoCIE10?: string
  tipo: 'definitivo' | 'presuntivo' | 'descartado' | 'diferencial'
  estado: 'activo' | 'resuelto' | 'cronico' | 'en_seguimiento'
  fechaDiagnostico?: string
}

export interface Medicamento {
  nombre: string                // DCI / genérico
  nombreComercial?: string
  dosis: string                 // "500 mg"
  via: 'oral' | 'iv' | 'im' | 'sc' | 'topica' | 'inhalatoria' | 'sublingual' | 'rectal' | 'otra'
  frecuencia: string            // "cada 8 horas"
  duracion: string              // "7 días" / "indefinido"
  indicacion?: string
  instruccionesEspeciales?: string
}

export interface Alergia {
  alergeno: string
  tipo: 'medicamento' | 'alimento' | 'ambiental' | 'otro'
  reaccion: string
  severidad: 'leve' | 'moderada' | 'grave' | 'anafilaxia'
  confirmada: boolean
}

export interface SignosVitales {
  fc?: number          // lpm
  fr?: number          // rpm
  ta?: string          // "120/80" mmHg
  temperatura?: number // °C
  spo2?: number        // %
  peso?: number        // kg
  talla?: number       // cm
  imc?: number         // calculado
  glucometria?: number // mg/dL
  glasgow?: number     // 3-15
  escalaDolor?: number // EVA 0-10
}

export interface Firma {
  nombreMedico: string
  cedulaProfesional: string
  especialidad: string
  institucion?: string
  timestamp: string          // ISO
  hashFirma: string          // SHA-256
}

// ── Sección genérica de la nota ────────────────────────────────
// El cuerpo narrativo de cada nota se compone de secciones de texto.
// Las secciones que aplican dependen del tipo de nota (ver TEMPLATES).

export interface NotaSeccion {
  key: string                // identificador, p.ej. "subjetivo"
  label: string              // etiqueta visible, p.ej. "Subjetivo"
  value: string              // contenido (texto libre, rellenado por IA o médico)
  obligatorio?: boolean      // NOM-004 (*)
  placeholder?: string
}

// ── Metadatos NOM-024 ──────────────────────────────────────────

export interface MetadataNOM024 {
  id: string
  tipoNota: TipoNota
  clinicId: string
  pacienteId: string
  medicoId: string
  cedulaProfesional: string
  especialidad: string
  establecimiento: string
  fechaCreacion: string
  fechaModificacion: string
  hashIntegridad: string
  version: number
  estado: EstadoNota
  fuenteGeneracion: FuenteGeneracion
}

// ── Documento principal de nota ────────────────────────────────

export interface NotaMedica {
  id: string
  clinicId: string
  pacienteId: string
  pacienteNombre: string
  tipo: TipoNota

  metadata: MetadataNOM024

  // Resumen ejecutivo (1 línea, generado por IA)
  resumenEjecutivo?: string

  // Cuerpo narrativo por secciones (depende del tipo de nota)
  secciones: NotaSeccion[]

  // Datos estructurados transversales
  signosVitales?: SignosVitales
  diagnosticos: Diagnostico[]
  medicamentos: Medicamento[]
  alergias: Alergia[]

  // Campos específicos hospitalarios (opcionales)
  hospital?: {
    servicio?: string
    cama?: string
    diaHospitalizacion?: number
    condicion?: 'estable' | 'grave' | 'critico'
    fechaIngreso?: string
    fechaEgreso?: string
    balanceHidrico?: { ingresos: number; egresos: number; balance: number }
  }

  // Específico Infectología / PROA (opcional)
  infectologia?: {
    diaAntibiotico?: number
    antibioticoActual?: string
    candidatoDesescalada?: boolean
    candidatoSwitchIVVO?: boolean
    cultivosSeguimiento?: string
  }

  // Trazabilidad: transcripción cruda de voz junto a la nota procesada
  transcripcionCruda?: string

  // Firma (presente cuando estado === 'firmada')
  firma?: Firma

  estado: EstadoNota
  fechaConsulta: string          // ISO — fecha clínica de la nota
  createdAt: string
  updatedAt: string
  creadoPor: string
}

// ── Resultado de validación NOM-004 ────────────────────────────

export interface ValidationResult {
  valida: boolean
  errores: string[]
  advertencias: string[]
  puntajeCompletitud: number     // 0-100
}

// ── Contexto del paciente que se manda a la IA ─────────────────

export interface PacienteContexto {
  nombre: string
  edad?: number
  sexo?: string
  alergias?: string
  notasPrevias?: string          // resumen de notas anteriores
  medicamentosActuales?: string
}
