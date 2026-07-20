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
  | 'valoracion_preoperatoria' // Valoración de riesgo preoperatorio
  | 'valoracion_inmuno'  // Valoración infectológica del paciente inmunocomprometido
  | 'nota_postoperatoria' // Nota postquirúrgica (NOM-004)
  | 'nota_anestesia'     // Registro/nota de anestesia
  | 'consentimiento'     // Consentimiento informado

export const TIPO_NOTA_LABEL: Record<TipoNota, string> = {
  historia_clinica: 'Historia Clínica',
  primera_vez:      'Nota de Primera Vez',
  seguimiento:      'Nota de Seguimiento',
  alta_consulta:    'Nota de Alta',
  ingreso:          'Nota de Ingreso Hospitalario',
  evolucion:        'Nota de Evolución',
  egreso:           'Nota de Egreso Hospitalario',
  valoracion_preoperatoria: 'Valoración Preoperatoria',
  valoracion_inmuno: 'Valoración Inmunocomprometido',
  nota_postoperatoria: 'Nota Postoperatoria',
  nota_anestesia:   'Nota de Anestesia',
  consentimiento:   'Consentimiento Informado',
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

/**
 * Alergia registrada en la nota.
 *
 * Todo salvo el alérgeno es OPCIONAL, y eso es deliberado: cuando los campos eran
 * obligatorios, el código que construía la nota tenía que rellenarlos con algo, y
 * lo que rellenaba era `severidad:'moderada'`, `confirmada:true`, `tipo:'medicamento'`
 * y `reaccion:'Ver expediente'` a partir de un campo de texto libre. Nadie había
 * dicho "moderada" y nadie había confirmado nada: una anafilaxia dictada quedaba
 * registrada como moderada, y la nota firmada afirmaba una confirmación
 * inexistente.
 *
 * Un tipo que obliga a rellenar es un tipo que obliga a inventar. "No se sabe" es
 * un estado clínico real y aquí se representa como campo ausente.
 */
export interface Alergia {
  alergeno: string
  tipo?: 'medicamento' | 'alimento' | 'ambiental' | 'otro'
  reaccion?: string
  severidad?: 'leve' | 'moderada' | 'grave' | 'anafilaxia'
  /** Solo true si alguien la confirmó de verdad. Ausente = no se sabe. */
  confirmada?: boolean
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
  /**
   * SNAPSHOT de la imagen de firma+sello al momento de firmar.
   * NOM-024: las notas firmadas son inmutables, así que copiamos la firma
   * en ESTE momento y nunca la sobrescribimos. Si el médico cambia su firma
   * después, las notas viejas siguen mostrando la firma que tenía cuando
   * las firmó (correcto desde el punto de vista legal).
   */
  imagenDataUrl?: string
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
  /** Versión del algoritmo de sello. Ausente/1 = método antiguo (orden de llaves,
   *  no re-verificable). ≥2 = canonicalización estable (verificable de forma fiable). */
  hashVersion?: number
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

  // Estudios/laboratorios a solicitar (pre-pobla la Orden médica).
  // Lo llena p. ej. la Valoración del inmunocomprometido (estudios elegidos).
  estudiosOrden?: string[]

  // Vínculo con un episodio de internamiento (módulo de hospitalización).
  // Las notas hospitalarias (ingreso/evolución/egreso) cuelgan de un internamiento.
  internamientoId?: string

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

  // Datos estructurados de valoración preoperatoria (cuando tipo === 'valoracion_preoperatoria')
  preop?: {
    inputs: Record<string, unknown>   // selecciones de RCRI/DASI/Caprini + contexto
    resultados: Record<string, unknown> // puntajes calculados
  }

  // Fase B — Trazabilidad auditable de la IA
  iaAuditoria?: {
    extraction?: Record<string, unknown>   // bloque completo retornado por IA
    safety?: Record<string, unknown>       // conflictos / faltantes / autos
    aprobadosPorMedico?: string[]          // ids de campos aprobados explícitamente
    procesadoEn?: string                   // ISO timestamp del último procesamiento
    aprobadoPor?: string                   // email del médico que aprobó al firmar
    /**
     * Provenance INMUTABLE de la IA (trazabilidad medicolegal / SaMD): con qué
     * modelo, versión de prompt y motor se generó la nota, y su revisión humana.
     * Requisito de auditoría regulatoria y de IA clínica defendible.
     */
    provenance?: {
      modelo?: string          // modelo exacto (ej. claude-opus-4-8)
      motor?: string           // perfil/motor (estándar/máxima/rápida)
      promptVersion?: string   // versión del prompt/pipeline
      apiVersion?: string      // versión de la API del proveedor
      generadoEn?: string      // ISO timestamp de la generación
      revisadoPorHumano?: boolean  // el médico editó/aprobó antes de firmar
      pmids?: string[]         // identificadores de evidencia citada (si aplica)
    }
  }

  // Trazabilidad: transcripción cruda de voz junto a la nota procesada
  transcripcionCruda?: string
  // Trazabilidad legal: diálogo separado por voz (diarización), si la hubo.
  // Cada turno = quién habló (A/B/C) y qué dijo. Para auditoría/relectura.
  dialogoDiarizado?: { speaker: string; text: string }[]

  // Firma (presente cuando estado === 'firmada')
  firma?: Firma

  estado: EstadoNota
  fechaConsulta: string          // ISO — fecha clínica de la nota
  createdAt: string
  updatedAt: string
  creadoPor: string
}

// ── Adenda (corrección a una nota firmada, NOM-004) ────────────
/**
 * Nota de corrección o aclaración a una nota YA FIRMADA. No modifica el
 * documento original (que es inmutable): se agrega, fechada y firmada por su
 * autor, y se muestra junto a la nota. Nunca se edita ni se borra.
 */
export interface Adenda {
  id: string
  /** Texto de la corrección/aclaración. */
  texto: string
  /** Motivo breve (ej. "Corrección de dosis", "Dato omitido"). */
  motivo?: string
  autorNombre: string
  autorEmail: string
  /** Cédula profesional del autor al momento de la adenda (trazabilidad). */
  autorCedula?: string
  createdAt: string   // ISO
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
  especialidad?: string          // especialidad del médico → estructura la nota a esa especialidad
  instruccionesIA?: string       // preferencias de estilo del médico para redactar la nota
}
