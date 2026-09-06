/**
 * LA TAREA QUE NACE DE UNA PREGUNTA ESCALADA — REG-521.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * PATIENT-AI-001 (REG-446) abrió «Preguntar» en el portal del paciente. La
 * pregunta se clasifica sin modelo, se guarda en `preguntas_paciente` ANTES de
 * contestar, y si el motor la escala sale un WhatsApp al consultorio. Al
 * paciente se le dice: «Ya quedó registrada y el consultorio la va a ver».
 *
 * El consultorio la veía **sólo por ese WhatsApp**. Ninguna pantalla lee
 * `preguntas_paciente` (el único lector es el propio paciente en su portal), y
 * el aviso sólo se intenta si hay `whatsappConsultorio` o `telefonoAdmin`
 * configurados — que en un consultorio recién abierto, en su prueba de 14
 * días, no hay. Resultado: «me falta el aire» → `URGENT_REVIEW_REQUIRED` →
 * documento escrito, cero avisos, cero rastro en el producto, y la promesa
 * impresa en la pantalla del paciente.
 *
 * Es «el dato tiene que LLEGAR» en su forma más cara: el dato acababa en la
 * función que lo escribe.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Convierte la pregunta escalada en una `TareaClinica` de tipo
 * `pregunta_paciente` para `clinics/{clinicId}/tareas_clinicas`, que es lo que
 * `/pendientes` ya lista, agrupa por urgencia y deja cerrar con decisión. El
 * WhatsApp pasa a ser el aviso; **el worklist es el rastro**.
 *
 * Módulo PURO: sin Firestore, sin reloj (la hora se recibe), sin modelo. Se
 * escribe desde el servidor (Admin SDK), no por `crearTareas` —que es código
 * de navegador— y por eso reproduce aquí la única regla de esa puerta que
 * importa: `pesoUrgencia` se deriva de `prioridad` y no se acepta de fuera.
 *
 * ── LO QUE NO DECIDE ─────────────────────────────────────────────────────────
 *
 * - No INVENTA `venceEn`. Cuánto puede esperar una pregunta escalada es
 *   política del consultorio (`NEEDS_CLINICAL_REVIEW`): sólo lo pone si el
 *   consultorio declaró `horasParaContestarPreguntas` en su configuración. Sin
 *   esa cifra, la tarea escala por otra vía que no necesita número: una
 *   pregunta de paciente SIN DUEÑO escala en el acto (`debeEscalar`,
 *   Panel de Lujo RT-006), y por eso nace con dueño cuando el llamador lo sabe.
 * - No cambia el texto que ve el paciente ni el clasificador: siguen siendo
 *   los de `pregunta-del-paciente.ts`, con sus fixtures.
 *
 * ── EL TÍTULO ES LO QUE DIJO EL PACIENTE (Panel de Lujo PO-005) ────────────────
 * Antes el título describía el estado del plan («todavía no tiene ninguna
 * consulta liberada») y la frase del paciente iba al final de la tarjeta. Ahora
 * el título son sus primeras palabras y el motivo es el subtítulo.
 */
import { pesoDeUrgencia, type TareaClinica, type Prioridad } from './modelo'
import { MOTIVO_ESCALACION_LABEL, type MotivoEscalacion } from '@/lib/paciente/pregunta-del-paciente'
import { MOTIVO_LABEL, type MotivoUrgencia, type ClaseRespuestaPaciente } from '@/lib/paciente/urgencia'

export const ORIGEN_PREGUNTA = 'portal:pregunta'

/**
 * Id DERIVADO de la pregunta: la misma pregunta no puede abrir dos tareas
 * aunque la petición se reintente. El prefijo hace legible en la consola de
 * dónde salió.
 */
export function idDeTareaDePregunta(preguntaId: string): string {
  return `pregunta__${preguntaId}`
}

/** Etiqueta legible del motivo, sin diagnóstico ni opinión. */
function etiquetaDelMotivo(motivo: MotivoUrgencia | MotivoEscalacion | null): string {
  if (!motivo) return 'la pregunta no se pudo contestar desde el plan'
  if (motivo in MOTIVO_LABEL) return MOTIVO_LABEL[motivo as MotivoUrgencia]
  if (motivo in MOTIVO_ESCALACION_LABEL) return MOTIVO_ESCALACION_LABEL[motivo as MotivoEscalacion]
  return String(motivo)
}

/** Cuántas palabras del paciente caben en el título antes de recortar. */
export const TOPE_TITULO = 70

export function tituloDeLaPregunta(texto: string): string {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return 'Pregunta del paciente'
  if (t.length <= TOPE_TITULO) return `«${t}»`
  const corte = t.lastIndexOf(' ', TOPE_TITULO)
  return `«${t.slice(0, corte > 30 ? corte : TOPE_TITULO).trim()}…»`
}

export interface PreguntaEscalada {
  clinicId: string
  patientId: string
  patientNombre?: string
  preguntaId: string
  clase: ClaseRespuestaPaciente
  motivo: MotivoUrgencia | MotivoEscalacion | null
  /** Lo que escribió el paciente, ya recortado por la ruta. */
  texto: string
  /** ISO de cuándo se recibió. Se pasa, no se lee del reloj. */
  ahoraIso: string
  /** Por dónde entró: `ORIGEN_PREGUNTA` (portal) u otro canal. */
  origen?: string
  /** Quién responde. Nace con dueño cuando el llamador lo sabe (RT-006). */
  ownerUid?: string
  ownerNombre?: string
  /**
   * Plazo declarado por el consultorio, en horas. Sin él NO se inventa
   * `venceEn`; la tarea escala por «sin dueño» hasta que alguien la tome.
   */
  horasParaContestar?: number | null
}

/**
 * La prioridad NO es opinión clínica: sale de la clase que ya decidió el motor.
 * Urgente → crítica (la primera del worklist). Escalada → alta: hay un humano
 * esperando a otro humano, por encima de los estudios de rutina.
 */
export function prioridadDeUnaPregunta(clase: ClaseRespuestaPaciente): Prioridad {
  return clase === 'URGENT_REVIEW_REQUIRED' ? 'critica' : 'alta'
}

export function tareaDeUnaPregunta(p: PreguntaEscalada): Omit<TareaClinica, 'id'> & { pesoUrgencia: number } {
  const prioridad = prioridadDeUnaPregunta(p.clase)
  const tarea: Omit<TareaClinica, 'id'> & { pesoUrgencia: number } = {
    clinicId: p.clinicId,
    patientId: p.patientId,
    tipo: 'pregunta_paciente',
    titulo: tituloDeLaPregunta(p.texto),
    detalle: `Pregunta del paciente: ${etiquetaDelMotivo(p.motivo)}`,
    prioridad,
    pesoUrgencia: pesoDeUrgencia(prioridad),
    estado: 'solicitada',
    creadaEn: p.ahoraIso,
    origen: p.origen || ORIGEN_PREGUNTA,
    preguntaId: p.preguntaId,
  }
  // `undefined` revienta en Firestore («Unsupported field value»): sólo se
  // añade lo que viene.
  if (p.patientNombre) tarea.patientNombre = p.patientNombre
  if (p.ownerUid) {
    tarea.ownerUid = p.ownerUid
    if (p.ownerNombre) tarea.ownerNombre = p.ownerNombre
  }
  const horas = Number(p.horasParaContestar)
  if (Number.isFinite(horas) && horas > 0) {
    const t = Date.parse(p.ahoraIso)
    if (Number.isFinite(t)) tarea.venceEn = new Date(t + horas * 3_600_000).toISOString()
  }
  return tarea
}
