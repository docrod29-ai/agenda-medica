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
  | 'evolucion_uci'      // Evolución de UCI por aparatos y sistemas (cabeza a pies)

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
  evolucion_uci:    'Nota de Evolución UCI',
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

/**
 * Estado de una orden de medicamento dentro de su ciclo de vida (V6 · P-008).
 *
 * ── POR QUÉ HACÍA FALTA ──────────────────────────────────────────────────────
 *
 * La orden no tenía estado: un fármaco estaba en la lista o no estaba. Eso deja
 * sin representar dos situaciones que ocurren todos los días en consulta:
 *
 *  · **Suspender sin borrar.** «Deja el ibuprofeno mientras te dure la gastritis»
 *    no es lo mismo que «nunca tomaste ibuprofeno». Borrarlo de la lista pierde
 *    la historia; dejarlo activo miente sobre lo que el paciente está tomando.
 *  · **Retirar lo que nunca debió indicarse.** Si se prescribe por error y se
 *    detecta antes de que el paciente lo tome, «cancelada» y «terminada» son
 *    hechos clínicos distintos y el expediente tiene que distinguirlos.
 *
 * `borrador` existe porque la nota se autoguarda cada 30 segundos: un fármaco a
 * medio teclear —con el nombre puesto y la dosis todavía no— no es una
 * prescripción, y contarlo como tal en cualquier lectura del expediente afirmaría
 * algo que el médico no ha decidido.
 */
export type EstadoOrdenMedicamento =
  | 'borrador'    // se está capturando; la nota no está firmada
  | 'activa'      // prescrita y vigente
  | 'suspendida'  // se detuvo, puede reanudarse
  | 'terminada'   // completó su duración
  | 'cancelada'   // se retiró; no debió administrarse

export interface Medicamento {
  nombre: string                // DCI / genérico
  nombreComercial?: string
  dosis: string                 // "500 mg"
  via: 'oral' | 'iv' | 'im' | 'sc' | 'topica' | 'inhalatoria' | 'sublingual' | 'rectal' | 'otra'
  frecuencia: string            // "cada 8 horas"
  duracion: string              // "7 días" / "indefinido"
  indicacion?: string
  instruccionesEspeciales?: string
  /**
   * OPCIONAL a propósito: todo lo prescrito antes de que esto existiera no lo
   * lleva. Ponerlo obligatorio obligaría a rellenar miles de órdenes viejas con
   * un valor que nadie decidió — y `estadoDeOrden()` ya trata la ausencia como
   * «activa», que es lo que esas órdenes significaban cuando se escribieron.
   */
  estado?: EstadoOrdenMedicamento
  /** Por qué se suspendió o se canceló. Sin esto, el cambio de estado no informa. */
  motivoEstado?: string
  /**
   * ── ¿YA LO TOMA, O SE LO RECETO HOY? (5-ago-2026, REG-183) ────────────────
   *
   * Es el eje que faltaba, y su ausencia costó caro. La compuerta de dosis
   * (REG-174/175) trataba igual dos cosas que no se parecen:
   *
   *   · «Toma algo para la presión, no sé cuál» — es un HALLAZGO clínico.
   *     Que el paciente no sepa la dosis es el dato, no un descuido del médico.
   *   · «Le doy levotiroxina» sin cantidad — es un ERROR que sale impreso en la
   *     receta, y quien la surta no puede saber cuánto dispensar.
   *
   * Al medirlo, 4 de 8 notas del Dr. NO se habrían podido firmar, y lo que las
   * bloqueaba era medicación previa (REG-176). Sin este campo, ni el modelo ni
   * la compuerta pueden distinguirlas: sólo ven un renglón sin dosis.
   *
   * OPCIONAL a propósito, y la ausencia NO significa nada: las notas anteriores
   * no lo traen y no se puede adivinar cuál era cuál. Lo que no está declarado
   * se trata como hasta ahora.
   *
   * QUÉ NO HACE, HOY — no cambia qué bloquea la firma. Eso lo decidió el médico
   * dueño el 5-ago con el dato delante, y volver a decidirlo por mi cuenta sería
   * pasar por encima de su decisión. De momento sirve para que el aviso DIGA de
   * cuál de los dos se trata, que es información que hoy no tiene.
   */
  procedenciaClinica?: 'ya_lo_toma' | 'se_prescribe_hoy'
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
     * Sello de procedencia: cuántos datos estructurados de la nota vinieron del
     * dictado (con cita), de inferencia de IA (sin cita) o capturados a mano.
     * Derivado (no inventado), aditivo; refuerza la trazabilidad medicolegal.
     */
    procedencia?: { dictado: number; ia: number; manual: number; total: number }
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
      /**
       * ¿El médico revisó de verdad lo que generó la IA antes de firmar?
       *
       * Antes se calculaba como `aprobados.size > 0 || estado === 'firmada'`, es
       * decir: FIRMAR era lo que lo ponía en true. Firma y revisión eran la misma
       * acción, así que el campo siempre decía "sí" — incluso en el flujo
       * dictar → procesar → firmar sin leer nada. Un registro que nunca puede
       * decir "firmada sin revisar" no sirve para auditar exactamente eso.
       *
       * Ahora es true SOLO si el médico aceptó campos en el panel de revisión.
       */
      revisadoPorHumano?: boolean
      /** Cuántos campos aceptó explícitamente. 0 = firmó sin revisar en detalle. */
      camposAprobados?: number
      pmids?: string[]         // identificadores de evidencia citada (si aplica)
    }
  }

  // Trazabilidad: transcripción cruda de voz junto a la nota procesada
  /**
   * El texto de TRABAJO del dictado: ya pasó por las cuatro etapas del pipeline
   * y el médico puede haberlo editado.
   *
   * El nombre viene de antes y se conserva porque hay lectores —la restauración
   * de borradores y el historial de versiones— que dependen de él. **No es el
   * material de origen**: para eso está `transcripcionMotor`.
   */
  transcripcionCruda?: string
  /**
   * Lo que el reconocedor dijo, ANTES del pipeline y antes de cualquier edición.
   *
   * Es el material de origen. Hasta la v996 no se guardaba en ningún sitio: el
   * pipeline lo producía y se descartaba en la misma línea. Ante una discusión
   * medicolegal, el «original» archivado ya había pasado por tres etapas de
   * reescritura automática.
   */
  transcripcionMotor?: string
  // Trazabilidad legal: diálogo separado por voz (diarización), si la hubo.
  // Cada turno = quién habló (A/B/C) y qué dijo. Para auditoría/relectura.
  /**
   * Los turnos de habla. **Sin `palabras`**, y no es un olvido.
   *
   * Se estaba persistiendo el objeto completo, con la confianza de cada palabra
   * dentro: una consulta de 20 minutos son miles de `{texto,inicioMs,confianza}`
   * en el documento de la nota — que ya tiene historial de reventar el tope de
   * 1 MB de Firestore y **bloquear todo guardado posterior**.
   *
   * Lo que sí se conserva es la lista corta de palabras a verificar, que es lo
   * que un revisor necesita: qué dudó el audio y en qué minuto.
   *
   * `rol` es **quién habló** —«Médico», «Paciente», «Familiar»…—, tal como quedó
   * después de que el médico lo revisara o lo corrigiera en pantalla. Antes se
   * archivaba sólo `speaker`, que es la etiqueta del motor: «A» y «B». La
   * atribución que el médico confirmó a mano se perdía al guardar, y el
   * expediente quedaba con un diálogo que no dice quién dijo qué — justo lo que
   * hace falta cuando se discute si el diagnóstico lo afirmó el paciente o lo
   * nombró la pregunta del médico.
   */
  dialogoDiarizado?: { speaker: string; text: string; rol?: string }[]
  /** Las palabras que el audio no oyó con seguridad, con su minuto. */
  palabrasAVerificar?: { texto: string; momento: string; seguridad: number }[]

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
  /**
   * Motivo breve (ej. "Corrección de dosis", "Dato omitido"). OBLIGATORIO.
   *
   * Era opcional en el tipo y en el formulario. Es el único mecanismo de
   * corrección que existe sobre un documento inmutable: una enmienda sin motivo
   * no explica por qué se corrigió, y sin eso no es oponible a nadie.
   * Las adendas anteriores a esta regla no lo traen; leerlas sigue funcionando.
   */
  motivo?: string
  /** Quién la escribió, según el TOKEN — no según el formulario. */
  autorUid?: string
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
