// ══════════════════════════════════════════════════════════════
// MÓDULO DE HOSPITALIZACIÓN — Episodio de internamiento.
// El "episodio" es el hueso que une TODO lo de una hospitalización:
// ingreso → evoluciones → egreso, órdenes, signos, interconsultas.
// Cumple NOM-004-SSA3-2012 (documentos del expediente hospitalario).
// Vive en clinics/{clinicId}/internamientos/{id}; las notas hospitalarias
// siguen en el expediente del paciente pero llevan `internamientoId`.
// ══════════════════════════════════════════════════════════════

import type { EstadoObservacion } from '@/lib/clinical/observacion-version'

export type EstadoInternamiento = 'activo' | 'egresado'

export type TipoEgreso =
  | 'mejoria'          // por mejoría
  | 'maximo_beneficio' // por máximo beneficio
  | 'voluntaria'       // alta voluntaria
  | 'traslado'         // traslado a otra unidad
  | 'defuncion'        // defunción
  | 'otro'

export const TIPO_EGRESO_LABEL: Record<TipoEgreso, string> = {
  mejoria: 'Por mejoría',
  maximo_beneficio: 'Por máximo beneficio',
  voluntaria: 'Alta voluntaria',
  traslado: 'Traslado a otra unidad',
  defuncion: 'Defunción',
  otro: 'Otro',
}

/** Servicios/áreas hospitalarias comunes (editables por texto libre). */
export const SERVICIOS_HOSPITAL = [
  'Medicina Interna', 'Cirugía General', 'Urgencias', 'UCI / Terapia Intensiva',
  'Pediatría', 'Ginecología y Obstetricia', 'Traumatología y Ortopedia',
  'Cardiología', 'Nefrología', 'Neurología', 'Neumología', 'Oncología',
  'Infectología', 'Gastroenterología', 'Urología', 'Cuidados Paliativos', 'Otro',
]

export interface Internamiento {
  id: string
  clinicId: string
  pacienteId: string
  pacienteNombre: string

  // ── Datos administrativos ──
  servicio: string
  cama: string
  medicoTratanteId: string
  medicoTratanteNombre: string

  // ── Datos clínicos de ingreso ──
  diagnosticoIngreso: string
  cie10?: string
  motivoIngreso: string

  // ── Estado del episodio ──
  estado: EstadoInternamiento
  fechaIngreso: string          // ISO
  fechaEgreso?: string          // ISO

  // ── Egreso ──
  tipoEgreso?: TipoEgreso
  resumenEgreso?: string

  // ── Movimientos del episodio (traslados de cama/servicio, cambio de tratante) ──
  movimientos?: { fecha: string; tipo: 'traslado' | 'tratante'; detalle: string; por?: string }[]

  // ── Interconsultas y órdenes (arrays acotados por episodio) ──
  interconsultas?: Interconsulta[]
  indicaciones?: Indicacion[]

  // ── Conciliación de medicamentos ──
  medicamentosCasa?: string[]        // medicamentos que el paciente tomaba en casa (al ingreso)
  conciliadoAl?: string              // fecha ISO de la última conciliación

  // ── Enfermería (F6) ──
  balanceHidrico?: { fecha: string; ingresos: number; egresos: number; por?: string }[]
  escalas?: { fecha: string; tipo: 'braden' | 'morse'; score: number; riesgo: string; por?: string }[]
  sbar?: { fecha: string; texto: string; por?: string }[]

  // ── Metadatos ──
  createdAt: string
  updatedAt: string
  creadoPor: string
}

// ══════════════════════════════════════════════════════════════
// F2 — Interconsultas
// ══════════════════════════════════════════════════════════════
// Catálogo compartido con el alta de equipo (fuente única en @/lib/especialidades).
export { ESPECIALIDADES_INTERCONSULTA as ESPECIALIDADES_IC } from '@/lib/especialidades'

export interface Interconsulta {
  id: string
  especialidad: string
  motivo: string
  solicitanteNombre: string
  solicitanteId?: string           // uid del médico que la pide → para avisarle la respuesta por WhatsApp
  medicoSolicitadoId?: string      // id del médico destino (catálogo doctors) → resuelve su WhatsApp server-side
  medicoSolicitadoNombre?: string  // a quién se dirige (si se eligió un médico concreto)
  fecha: string
  estado: 'solicitada' | 'respondida'
  respuesta?: string
  respondidaPor?: string
  fechaRespuesta?: string
  notaId?: string            // si se respondió con una nota del expediente
}

// ══════════════════════════════════════════════════════════════
// F3 — Indicaciones médicas + MAR (registro de administración) + signos seriados
// ══════════════════════════════════════════════════════════════
export type TipoIndicacion = 'medicamento' | 'liquidos' | 'dieta' | 'cuidado' | 'estudio' | 'otro'

export const TIPO_INDICACION_LABEL: Record<TipoIndicacion, string> = {
  medicamento: 'Medicamento',
  liquidos: 'Líquidos / soluciones',
  dieta: 'Dieta',
  cuidado: 'Cuidados de enfermería',
  estudio: 'Estudio / laboratorio',
  otro: 'Otra indicación',
}

export interface Administracion {
  fecha: string
  por: string
  estado: 'administrado' | 'omitido'
  nota?: string
  cincoCorrectos?: boolean    // BCMA: se verificaron los "5 correctos"
  identidadVerificada?: boolean  // se escaneó/confirmó el brazalete del paciente
}

export interface Indicacion {
  id: string
  tipo: TipoIndicacion
  descripcion: string        // "Ceftriaxona 1 g IV", "Dieta blanda", "Vigilar diuresis"
  frecuencia?: string        // "cada 12 h"
  activa: boolean
  fecha: string
  creadaPor?: string
  administraciones: Administracion[]
  // Verificación farmacéutica (ciclo cerrado del medicamento)
  verificadaFarmacia?: boolean
  verificadaPor?: string
  fechaVerificacion?: string
}

/** Un registro puntual de signos vitales (para la gráfica/tendencia). */
export interface RegistroSignos {
  id: string
  fecha: string
  ta?: string
  fc?: number
  fr?: number
  temp?: number
  spo2?: number
  glucosa?: number
  dolor?: number             // EVA 0-10
  // ACVPU COMPLETO (decisión del Dr, L6): Alert / Confusion(nuevo) / Voice / Pain /
  // Unresponsive. Se conserva la letra real (no solo alerta/alterada) para no
  // destruir información en FHIR/auditoría/evolución; NEWS2 se DERIVA (A=0, resto=3).
  // 'alerta'/'alterada' se mantienen como legado (datos ya guardados).
  conciencia?: 'A' | 'C' | 'V' | 'P' | 'U' | 'alerta' | 'alterada'
  oxigeno?: boolean          // O2 suplementario (para NEWS2)
  oxigenoFlujoLpm?: number   // flujo de O2 (L/min) si se conoce → FHIR LOINC 3151-8
  oxigenoFiO2?: number       // FiO2 (%) si se conoce → FHIR LOINC 3150-0
  por?: string
  // ── E0-09 · corrección APPEND-ONLY de un signo mal capturado ──
  // Ambos OPCIONALES a propósito: los documentos ya guardados siguen siendo
  // válidos sin migración. Un signo NO se sobrescribe ni se borra: se anexa
  // otro registro que apunta al erróneo con `corrigeA`.
  /** id del registro de signos que ESTE registro corrige. */
  corrigeA?: string
  /** Por qué se corrigió. Su obligatoriedad es política del expediente → E0-09/Q4. */
  motivoCorreccion?: string

  // ── ICU-002b · vigencia temporal (decisión ICU-Q3, que cerró E0-09/Q1) ──
  //
  // `fecha` es la hora en que se CAPTURÓ el registro, y se conserva intacta:
  // ningún documento ya guardado deja de ser válido. Los dos campos de abajo son
  // opcionales y ADITIVOS; el lector cae a `fecha` cuando faltan.
  //
  // POR QUÉ HACEN FALTA: una corrección hecha a las 08:03 de un signo tomado a
  // las 08:00 se guardaba con `fecha: 08:03`. Un NEWS2 recalculado para las
  // 08:00 no la encontraba, y descartar el valor erróneo dejaba un HUECO en vez
  // de una corrección. La decisión exige lo contrario: «el NEWS2 retrospectivo
  // de las 08:00 debe usar 92».
  //
  // Es `effectiveDateTime` / `issued` de FHIR Observation.
  /**
   * Cuándo OCURRIÓ la medición. Una **corrección hereda la del original**.
   * Ausente ⇒ se usa `fecha` (registros previos a ICU-002b).
   */
  fechaEfectiva?: string
  /**
   * Cuándo se CAPTURÓ este registro. Siempre la propia, nunca heredada.
   * Ausente ⇒ se usa `fecha`.
   */
  fechaRegistro?: string
  /**
   * Estado del ciclo de vida (`ESTADOS_OBSERVACION`). Ausente ⇒ se DERIVA:
   * `CONFIRMED`, o `CORRECTED` si otro registro lo apunta con `corrigeA`.
   * Ver `signosComoObservaciones` en `src/lib/hospital/eventos.ts`.
   */
  estadoObservacion?: EstadoObservacion
}

// ══════════════════════════════════════════════════════════════
// E0-09 — Libro clínico-legal APPEND-ONLY del episodio
// ══════════════════════════════════════════════════════════════
/**
 * Los arrays del doc de internamiento (`indicaciones[].administraciones[]`,
 * `balanceHidrico`, `escalas`, `sbar`, `movimientos`) son CACHÉ DE DISPLAY y
 * están topados por el límite de 1 MB por documento. El libro clínico-legal
 * completo vive en la subcolección append-only `registros`, que sólo escribe el
 * servidor (Admin SDK, /api/hospital/mutar) — ver `registro-durable.ts`.
 *
 * Un hecho ya ocurrido no se edita ni se borra: se ANEXA una corrección que lo
 * referencia. El evento erróneo permanece visible (NOM-004).
 */
export type TipoEventoClinico =
  | 'administracion'          // MAR: una dosis administrada u omitida
  | 'indicacion_alta'         // se prescribió una indicación
  | 'indicacion_suspension'   // se suspendió / reactivó una indicación
  | 'verificacion_farmacia'   // ciclo cerrado del medicamento
  | 'balance'                 // (ya en producción desde 2026-07, forma PLANA)
  | 'escala'                  // (ya en producción desde 2026-07, forma PLANA)
  | 'sbar'                    // (ya en producción desde 2026-07, forma PLANA)
  | 'correccion'              // corrige un evento anterior; nunca lo reemplaza

/** Qué afirma una corrección sobre el evento que corrige. */
export type EfectoCorreccion =
  | 'anula'      // el hecho NO ocurrió (p. ej. la dosis no se administró)
  | 'sustituye'  // el hecho ocurrió, pero con otros datos
  | 'aclara'     // el hecho ocurrió tal cual; se añade información

/** Valores admitidos dentro de `detalle` (serializables a Firestore sin sorpresas). */
export type ValorDetalle = string | number | boolean | null

/** Un hecho ya ocurrido en el episodio. Inmutable: sólo se le anexan correcciones. */
export interface EventoClinico {
  tipo: TipoEventoClinico
  /** ISO — reloj del SERVIDOR, nunca el del cliente. */
  fecha: string
  /** Autor REAL sellado por el servidor (no el `por` que manda el cliente). */
  por: string
  porUid?: string
  /** A qué indicación pertenece el hecho (MAR / órdenes). */
  indicacionId?: string
  /** Contenido propio del tipo de evento, saneado por lista blanca. */
  detalle?: Record<string, ValorDetalle>

  // ── Sólo cuando tipo === 'correccion' ──
  /** id del documento de `registros` que esta corrección corrige. */
  corrigeEventoId?: string
  motivo?: string
  efecto?: EfectoCorreccion

  // ── Campos PLANOS de los tres eventos que YA existen en producción ──
  // `balance`/`escala`/`sbar` se escriben con esta forma desde 2026-07. NO se
  // migran a `detalle`: hay documentos ya escritos en un libro append-only, y
  // reescribirlos para uniformar la forma sería exactamente lo que este módulo
  // existe para impedir. Se declaran `unknown` porque hoy pasan sin validar
  // desde el payload del cliente; ése es el estado real, no un ideal.
  ingresos?: unknown
  egresos?: unknown
  escala?: unknown
  score?: unknown
  riesgo?: unknown
  texto?: unknown
}

/** Un evento tal como se lee de `registros` (el id lo pone Firestore). */
export type EventoClinicoConId = EventoClinico & { id: string }

// ══════════════════════════════════════════════════════════════
// F4 — Roles (vista, no seguridad de servidor)
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// F4 — Módulo de laboratorio (solicitud → resultado → valor crítico)
// ══════════════════════════════════════════════════════════════
export interface ResultadoLab {
  estudio: string
  valor: string
  unidad?: string
  referencia?: string
  critico?: boolean
}
export interface SolicitudLab {
  id: string
  clinicId: string
  internamientoId: string
  pacienteId: string
  pacienteNombre: string
  estudios: string[]
  prioridad: 'rutina' | 'urgente'
  solicitadaPor: string
  fecha: string
  estado: 'solicitada' | 'en_proceso' | 'resultado'
  resultados?: ResultadoLab[]
  procesadaPor?: string
  fechaResultado?: string
  /**
   * Cargas ANTERIORES de resultados, en orden. Nunca se borra: cada nueva carga
   * empuja aquí lo que había antes de sobrescribir `resultados`. Antes una
   * segunda carga reemplazaba la primera sin rastro — pérdida de dato clínico y
   * de trazabilidad (NOM-004). Vacío o ausente = solo hubo una carga.
   */
  historialResultados?: CargaResultadoLab[]
  createdAt: string
  updatedAt: string
}
export interface CargaResultadoLab {
  resultados: ResultadoLab[]
  procesadaPor: string
  fechaResultado: string
}
export const ESTUDIOS_LAB_RAPIDOS = [
  'Biometría hemática', 'Química sanguínea', 'Electrolitos séricos', 'Pruebas de función hepática',
  'Tiempos de coagulación', 'Gasometría arterial', 'Examen general de orina', 'PCR', 'Procalcitonina',
  'Troponina', 'Dímero D', 'Hemocultivo', 'Urocultivo', 'Lactato', 'Perfil tiroideo',
]

// ══════════════════════════════════════════════════════════════
// Catálogo de camas (inventario + ocupación)
// ══════════════════════════════════════════════════════════════
/**
 * Estado de la cama — LOCALIZACIÓN, nunca estado clínico (charter §2).
 *
 * ICU-002c amplía de 4 a 7 los valores que pide el charter. Los cuatro viejos se
 * conservan con su mismo nombre, así que ningún documento guardado deja de ser
 * válido; los tres nuevos (`reservada`, `mantenimiento`, `aislamiento`) permiten
 * el flujo B del charter —reservar una cama ANTES de que llegue el paciente— y
 * distinguir «bloqueada por decisión» de «fuera de servicio».
 *
 * `ESTADO_CAMA_LABEL` es un `Record` a propósito: al añadir un valor, tsc obliga
 * a completarlo y encuentra por ti cada pantalla que lo consume.
 */
export type EstadoCama =
  | 'libre' | 'ocupada' | 'bloqueada' | 'limpieza'
  | 'reservada' | 'mantenimiento' | 'aislamiento'
  // ── Decisión del Dr. (2026-07-30) — flujo de rotación de cama ──
  // `limpieza` pasa a significar PENDING_TERMINAL_CLEANING: el mismo valor que
  // ya está guardado en los documentos, con el significado explícito. Se añaden
  // los dos pasos que faltaban del flujo:
  //   ocupada → limpieza → lista → libre
  | 'lista'                  // CLEAN_READY: limpieza confirmada, falta liberarla
  | 'limpieza_aislamiento'   // ISOLATION_CLEANING: precauciones de transmisión

export const ESTADO_CAMA_LABEL: Record<EstadoCama, string> = {
  libre: 'Libre', ocupada: 'Ocupada', bloqueada: 'Bloqueada',
  limpieza: 'Pendiente de limpieza terminal',
  reservada: 'Reservada', mantenimiento: 'Mantenimiento', aislamiento: 'Aislamiento',
  lista: 'Limpia y lista', limpieza_aislamiento: 'Limpieza de aislamiento',
}

/** Estados en los que la cama NO puede recibir a un paciente nuevo. */
export const ESTADOS_CAMA_NO_DISPONIBLE: readonly EstadoCama[] = [
  'ocupada', 'bloqueada', 'limpieza', 'mantenimiento', 'limpieza_aislamiento',
]

// ══════════════════════════════════════════════════════════════
// ICU-002c — ESTANCIA UCI y ASIGNACIÓN DE CAMA
// ══════════════════════════════════════════════════════════════
//
// DECISIÓN DE DISEÑO (ICU-001): NO se crea `HospitalEncounter`. `Internamiento`
// YA lo es —paciente, servicio, tratante, dx de ingreso, estado, fechas, egreso,
// movimientos, interconsultas e indicaciones—, y duplicarlo rompería las reglas,
// la subcolección `signos`, el censo, el MAR y las notas sin ganar nada clínico.
// Estas dos capas se añaden ENCIMA:
//
//     Patient → Internamiento (=encounter) → ICUStay → BedAssignment
//
// Así los cinco flujos del charter (§1 A-E) quedan cubiertos sin migración
// destructiva: un paciente puede entrar y salir de UCI varias veces dentro del
// MISMO internamiento, y cada estancia se conserva.

/** Soportes activos de la estancia. La UI se adapta a esto (charter §32). */
export type SoporteActivo =
  | 'vm_invasiva' | 'vm_ni' | 'hfnc'
  | 'vasopresor' | 'inotropico'
  | 'ckrt' | 'ecmo' | 'iabp' | 'impella' | 'monitor_pic'

export const SOPORTE_LABEL: Record<SoporteActivo, string> = {
  vm_invasiva: 'Ventilación mecánica invasiva',
  vm_ni: 'Ventilación no invasiva',
  hfnc: 'Cánula nasal de alto flujo',
  vasopresor: 'Vasopresor',
  inotropico: 'Inotrópico',
  ckrt: 'CKRT / terapia continua',
  ecmo: 'ECMO',
  iabp: 'Balón intraaórtico',
  impella: 'Impella',
  monitor_pic: 'Monitor de PIC',
}

/** Qué peso se usa para dosificar. NO se cambia solo (charter §16). */
export type TipoPesoDosificacion = 'actual' | 'ingreso' | 'seco' | 'configurado'

/**
 * Una ESTANCIA en UCI, dentro de un internamiento.
 * `clinics/{c}/internamientos/{iid}/icu_stays/{stayId}`
 */
export interface ICUStay {
  id: string
  internamientoId: string
  pacienteId: string
  estado: 'activa' | 'egresada'
  fechaIngresoUci: string
  fechaEgresoUci?: string
  motivoIngresoUci: string
  soportes: SoporteActivo[]
  /**
   * Peso para dosificación. Se fija explícitamente y queda con su autor: la
   * decisión del charter §16 prohíbe cambiarlo de forma automática.
   */
  pesoDosificacion?: {
    valorKg: number
    tipo: TipoPesoDosificacion
    fijadoPor: string
    fijadoEn: string
  }
  /** Talla en cm, para poder calcular PBW y VT/PBW (charter §31). */
  tallaCm?: number
  codigoReanimacion?: string
  aislamiento?: string
  createdAt: string
  creadoPor: string
}

/** Por qué se asignó la cama. */
export type MotivoAsignacion = 'ingreso' | 'traslado' | 'egreso' | 'reserva'

/**
 * Asignación de cama — APPEND-ONLY, con historia.
 * `clinics/{c}/internamientos/{iid}/bed_assignments/{id}`
 *
 * POR QUÉ EXISTE: `Internamiento.cama` es un STRING, y la unión cama↔paciente se
 * hacía comparando texto. No había historia de traslados (quedaban como texto
 * libre en `movimientos[].detalle`) ni forma de reservar una cama antes de que
 * llegue el paciente. El string NO se borra: durante la transición conviven y el
 * lector prefiere la asignación, con respaldo al string.
 */
export interface BedAssignment {
  id: string
  /** Ausente si la cama es de piso (no de UCI). */
  icuStayId?: string
  /** Referencia REAL a `Cama.id`, no un texto libre. */
  camaId: string
  desde: string
  /** Abierta (vigente) mientras no tenga `hasta`. */
  hasta?: string
  motivo: MotivoAsignacion
  por: string
}
export interface Cama {
  id: string
  clinicId: string
  servicio: string
  etiqueta: string          // "302-A"
  tipo?: string             // general / UCI / aislamiento
  estado: EstadoCama
  createdAt: string
}

export type RolHospital = 'medico' | 'enfermeria' | 'farmacia' | 'laboratorio' | 'admin'
export const ROL_HOSPITAL_LABEL: Record<RolHospital, string> = {
  medico: 'Médico',
  enfermeria: 'Enfermería',
  farmacia: 'Farmacia',
  laboratorio: 'Laboratorio',
  admin: 'Administración',
}

/** Días de estancia (desde el ingreso hasta hoy o hasta el egreso). */
export function diasEstancia(i: Pick<Internamiento, 'fechaIngreso' | 'fechaEgreso'>, nowMs = Date.now()): number {
  const ini = new Date(i.fechaIngreso).getTime()
  const fin = i.fechaEgreso ? new Date(i.fechaEgreso).getTime() : nowMs
  if (isNaN(ini) || isNaN(fin)) return 0
  return Math.max(0, Math.floor((fin - ini) / 86400000))
}
