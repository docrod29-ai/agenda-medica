/**
 * LA TAXONOMÍA DE INCIDENTES — provider-neutral, y sin PHI por construcción.
 *
 * ── QUÉ NO ES ESTO ───────────────────────────────────────────────────────────
 *
 * No es una taxonomía nueva de fallos de IA. Esa ya existe y es buena:
 * `src/lib/ia/fallo-proveedor.ts` clasifica llave inválida, sin saldo, límite de
 * tasa, sobrecarga y timeout, y además dice **a quién le toca arreglarlo**. Aquí
 * se REUTILIZA entera (ver `puente-ia.ts`): `ClaseFallo` es el *subtipo* de la
 * categoría `ai_provider`, no un competidor suyo.
 *
 * Tampoco es la taxonomía de transporte de #310/#342
 * (`src/lib/observability/evento.ts` → `TaxonomiaError`: timeout, saturación,
 * autenticación…). Esa contesta **cómo falló la llamada**. Ésta contesta **qué
 * parte del producto se rompió y quién sufre**. Son ejes distintos y se cruzan:
 * un `timeout` de transporte puede ser categoría `transcription` o `payment`, y
 * lo que hay que hacer no se parece en nada. El adaptador vive en
 * `correlacion-contrato.ts` y NO reimplementa nada de #342.
 *
 * ── POR QUÉ LA IDENTIDAD ES VOCABULARIO CERRADO Y NO TEXTO ───────────────────
 *
 * Todo lo que entra en la firma de un incidente tiene que ser una *etiqueta*, no
 * una frase. Un mensaje de error libre —«no se pudo guardar la nota de Ana
 * Ruiz»— es PHI, y en cuanto entra en la firma entra en el agrupador, en la
 * consola de soporte y en la alerta. La lista de lo PROHIBIDO siempre va por
 * detrás; la de lo PERMITIDO no. Por eso `esEtiqueta()` es una compuerta de
 * forma, no un filtro de contenido: una frase no puede pasar porque no tiene la
 * forma de una etiqueta.
 *
 * Módulo PURO.
 */

/**
 * De qué parte del producto es el fallo.
 *
 * `whatsapp` no tiene categoría propia a propósito: en este producto WhatsApp
 * **es** el proveedor de notificaciones, así que va como
 * `notification` + `proveedor: 'whatsapp'`. Una categoría por proveedor haría
 * que cambiar de proveedor cambiara la taxonomía, que es justo lo que una
 * taxonomía no debe hacer.
 */
export type CategoriaIncidente =
  | 'ui'
  | 'api'
  | 'auth'
  | 'authorization'
  | 'tenant_isolation'
  | 'persistence'
  | 'autosave'
  | 'scheduling'
  | 'transcription'
  | 'ai_provider'
  | 'ai_reasoning'
  | 'evidence'
  | 'payment'
  | 'notification'
  | 'network'
  | 'browser_runtime'
  | 'unknown'

export const CATEGORIAS: readonly CategoriaIncidente[] = [
  'ui', 'api', 'auth', 'authorization', 'tenant_isolation', 'persistence',
  'autosave', 'scheduling', 'transcription', 'ai_provider', 'ai_reasoning',
  'evidence', 'payment', 'notification', 'network', 'browser_runtime', 'unknown',
]

/**
 * Gravedad. Cuatro escalones y ninguno «medio-alto».
 *
 * `sev1` no es «muchos usuarios»: es **el expediente o el aislamiento en
 * riesgo**. Un fallo que afecta a un solo consultorio pero puede cruzar datos
 * entre dos es sev1 con un único evento; una caída de evidencia que molesta a
 * todos es sev3, porque la nota sigue editable.
 */
export type Severidad = 'sev1' | 'sev2' | 'sev3' | 'sev4'

/** ¿Reintentar puede servir de algo, y cuándo? */
export type Reintentabilidad = 'nunca' | 'tras_espera' | 'inmediato'

/**
 * ¿Se puede deshacer la acción de reparación?
 *
 * `desconocida` es un valor de primera clase y **se trata como irreversible**.
 * Un `false` por omisión sería adivinar; aquí no se adivina.
 */
export type Reversibilidad = 'reversible' | 'irreversible' | 'desconocida'

/** ¿Repetir la operación produce el mismo estado final? */
export type ExigenciaIdempotencia = 'no_aplica' | 'requerida' | 'garantizada'

/** Qué le pasa a quien está delante de la pantalla. */
export type ImpactoUsuario =
  | 'ninguno'
  | 'cosmetico'
  | 'degradado'
  | 'bloquea_tarea'
  | 'riesgo_de_perdida'
  | 'riesgo_clinico'

/** Quién puede arreglarlo. Alineado con `QuienPaga` de `fallo-proveedor.ts`. */
export type DuenoIncidente = 'medico' | 'consultorio' | 'plataforma' | 'proveedor'

/** Estado del ciclo de vida del grupo, no de un intento concreto. */
export type EstadoIncidente =
  | 'abierto'
  | 'en_remediacion'
  | 'degradado'
  | 'recuperado'
  | 'resuelto'
  | 'requiere_humano'

/**
 * La forma de una etiqueta admisible en la identidad de un incidente.
 *
 * Minúsculas, dígitos, `_`, `-` y `.`, hasta 64. Ni espacios ni acentos: una
 * frase dictada, un nombre o un mensaje de proveedor no pueden pasar por aquí.
 */
const ETIQUETA = /^[a-z0-9][a-z0-9_.-]{0,63}$/

export function esEtiqueta(v: unknown): v is string {
  return typeof v === 'string' && ETIQUETA.test(v)
}

/**
 * Un EVENTO: un fallo suelto, tal y como lo ve quien lo sufre.
 *
 * Conjunto CERRADO de campos, igual que el evento de telemetría de #342 y por la
 * misma razón. Un evento no es todavía un incidente — ver `umbrales.ts`.
 */
export interface EventoIncidente {
  readonly categoria: CategoriaIncidente
  /** Vocabulario cerrado por categoría. Ej. `sin_saldo`, `escritura_rechazada`. */
  readonly subtipo: string
  /** Qué función del producto lo sufrió. Ej. `nota`, `agenda`, `transcribir`. */
  readonly feature: string
  /** PLANTILLA de ruta, nunca la ruta real: `/consulta/[id]`, no `/consulta/ab12`. */
  readonly ruta?: string
  /** Familia del proveedor externo. Nunca la llave ni el punto final. */
  readonly proveedor?: string
  /** Código normalizado y estable: `http_503`, `sin_saldo`, `permission_denied`. */
  readonly codigoNormalizado?: string
  /** Versión de la app donde ocurrió. Entra en la firma: separa la regresión nueva. */
  readonly appVersion: string
  /** ISO. Cuándo ocurrió el fallo, no cuándo se anotó. */
  readonly ocurridoEn: string
  /** Hilo de #342. Opaco, sin origen de dominio. Ver `correlacion-contrato.ts`. */
  readonly correlationId?: string
  /** Seudónimo del consultorio. NUNCA el `clinicId`. */
  readonly tenantRef?: string
  /** Operación afectada, opaca. Permite contar operaciones sin contar personas. */
  readonly operationId?: string
  /** Gravedad declarada por quien reporta; si falta se deriva de la categoría. */
  readonly severidad?: Severidad
}

/** Las dimensiones que ordenan qué se puede hacer con un incidente. */
export interface DimensionesIncidente {
  readonly severidad: Severidad
  readonly reintentabilidad: Reintentabilidad
  readonly reversibilidad: Reversibilidad
  readonly idempotencia: ExigenciaIdempotencia
  readonly impacto: ImpactoUsuario
  readonly dueno: DuenoIncidente
}

/**
 * Lo que se sabe de una categoría ANTES de mirar el caso concreto.
 *
 * Es el suelo, no el techo: `dimensionesDe()` deja que el reportante endurezca
 * cualquier dimensión, y nunca que la ablande. Un reportante que dice «esto es
 * menos grave de lo que su categoría dice» es exactamente el camino por el que
 * un incidente de aislamiento acabaría en la cola de los cosméticos.
 */
const BASE: Record<CategoriaIncidente, DimensionesIncidente> = {
  ui:               { severidad: 'sev3', reintentabilidad: 'inmediato',   reversibilidad: 'reversible',   idempotencia: 'no_aplica',   impacto: 'degradado',         dueno: 'plataforma' },
  api:              { severidad: 'sev3', reintentabilidad: 'tras_espera', reversibilidad: 'desconocida',  idempotencia: 'requerida',   impacto: 'bloquea_tarea',     dueno: 'plataforma' },
  auth:             { severidad: 'sev2', reintentabilidad: 'nunca',       reversibilidad: 'irreversible', idempotencia: 'no_aplica',   impacto: 'bloquea_tarea',     dueno: 'plataforma' },
  authorization:    { severidad: 'sev2', reintentabilidad: 'nunca',       reversibilidad: 'irreversible', idempotencia: 'no_aplica',   impacto: 'bloquea_tarea',     dueno: 'plataforma' },
  tenant_isolation: { severidad: 'sev1', reintentabilidad: 'nunca',       reversibilidad: 'irreversible', idempotencia: 'no_aplica',   impacto: 'riesgo_clinico',    dueno: 'plataforma' },
  persistence:      { severidad: 'sev2', reintentabilidad: 'tras_espera', reversibilidad: 'desconocida',  idempotencia: 'requerida',   impacto: 'riesgo_de_perdida', dueno: 'plataforma' },
  autosave:         { severidad: 'sev2', reintentabilidad: 'inmediato',   reversibilidad: 'reversible',   idempotencia: 'requerida',   impacto: 'riesgo_de_perdida', dueno: 'plataforma' },
  scheduling:       { severidad: 'sev2', reintentabilidad: 'tras_espera', reversibilidad: 'desconocida',  idempotencia: 'requerida',   impacto: 'bloquea_tarea',     dueno: 'plataforma' },
  transcription:    { severidad: 'sev2', reintentabilidad: 'tras_espera', reversibilidad: 'reversible',   idempotencia: 'garantizada', impacto: 'degradado',         dueno: 'proveedor'  },
  ai_provider:      { severidad: 'sev2', reintentabilidad: 'tras_espera', reversibilidad: 'reversible',   idempotencia: 'garantizada', impacto: 'degradado',         dueno: 'proveedor'  },
  ai_reasoning:     { severidad: 'sev3', reintentabilidad: 'tras_espera', reversibilidad: 'reversible',   idempotencia: 'garantizada', impacto: 'degradado',         dueno: 'plataforma' },
  evidence:         { severidad: 'sev3', reintentabilidad: 'tras_espera', reversibilidad: 'reversible',   idempotencia: 'garantizada', impacto: 'degradado',         dueno: 'proveedor'  },
  payment:          { severidad: 'sev2', reintentabilidad: 'nunca',       reversibilidad: 'irreversible', idempotencia: 'requerida',   impacto: 'degradado',         dueno: 'plataforma' },
  notification:     { severidad: 'sev3', reintentabilidad: 'tras_espera', reversibilidad: 'reversible',   idempotencia: 'requerida',   impacto: 'degradado',         dueno: 'proveedor'  },
  network:          { severidad: 'sev4', reintentabilidad: 'inmediato',   reversibilidad: 'reversible',   idempotencia: 'requerida',   impacto: 'degradado',         dueno: 'plataforma' },
  browser_runtime:  { severidad: 'sev3', reintentabilidad: 'inmediato',   reversibilidad: 'reversible',   idempotencia: 'no_aplica',   impacto: 'degradado',         dueno: 'plataforma' },
  unknown:          { severidad: 'sev3', reintentabilidad: 'tras_espera', reversibilidad: 'desconocida',  idempotencia: 'requerida',   impacto: 'bloquea_tarea',     dueno: 'plataforma' },
}

const ORDEN_SEV: readonly Severidad[] = ['sev4', 'sev3', 'sev2', 'sev1']
const ORDEN_IMPACTO: readonly ImpactoUsuario[] =
  ['ninguno', 'cosmetico', 'degradado', 'bloquea_tarea', 'riesgo_de_perdida', 'riesgo_clinico']

/** La más grave de las dos. */
export function peorSeveridad(a: Severidad, b: Severidad): Severidad {
  return ORDEN_SEV.indexOf(a) >= ORDEN_SEV.indexOf(b) ? a : b
}

/** El peor de los dos impactos. */
export function peorImpacto(a: ImpactoUsuario, b: ImpactoUsuario): ImpactoUsuario {
  return ORDEN_IMPACTO.indexOf(a) >= ORDEN_IMPACTO.indexOf(b) ? a : b
}

/** Escalones de gravedad, para comparar sin depender del orden del literal. */
export function nivelDeSeveridad(s: Severidad): number {
  return ORDEN_SEV.indexOf(s) + 1
}

/**
 * Las dimensiones de un evento concreto.
 *
 * El reportante sólo puede ENDURECER la severidad. Nunca suavizarla: si pudiera,
 * bastaría con que un llamador dijera `sev4` para que un incidente de
 * `tenant_isolation` dejara de despertar a nadie.
 */
export function dimensionesDe(e: Pick<EventoIncidente, 'categoria' | 'severidad'>): DimensionesIncidente {
  const base = BASE[e.categoria] ?? BASE.unknown
  if (!e.severidad) return base
  return { ...base, severidad: peorSeveridad(base.severidad, e.severidad) }
}

/** Las dimensiones por omisión de una categoría, sin evento. Para documentar y probar. */
export function dimensionesDeCategoria(c: CategoriaIncidente): DimensionesIncidente {
  return BASE[c] ?? BASE.unknown
}

/**
 * Las categorías que NUNCA se pueden silenciar por umbral.
 *
 * Un solo evento basta. No es una lista de «lo grave»: es la lista de lo que, si
 * ocurre una vez, ya ocurrió demasiadas — cruzar datos entre consultorios y
 * saltarse una autorización no tienen una tasa aceptable.
 */
export const NUNCA_SE_AGREGA_POR_RUIDO: readonly CategoriaIncidente[] = [
  'tenant_isolation',
  'authorization',
]

export const POR_QUE_LA_IDENTIDAD_ES_VOCABULARIO_CERRADO =
  'Porque todo lo que entra en la firma sale en la alerta, en la consola de ' +
  'soporte y en el agrupador. Un mensaje de error libre lleva PHI y ninguna ' +
  'lista de patrones prohibidos la caza entera: «no se pudo guardar la nota de ' +
  'Ana Ruiz» no parece un CURP ni un teléfono, parece una frase. Una etiqueta ' +
  'no puede llevarla porque no tiene sitio donde llevarla.'
