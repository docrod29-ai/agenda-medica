/**
 * Log de auditoría clínica.
 *
 * Registra eventos importantes (procesamiento de IA, aprobación de campos,
 * firma de nota, borrado de borrador) en `clinics/{clinicId}/audit_log`.
 * Útil para trazabilidad NOM-024 y para medir tasa de aprobación / edición.
 *
 * Es resiliente: si falla la escritura del log NUNCA debe romper la operación
 * principal (la persistencia clínica tiene prioridad).
 *
 * SE ESCRIBE POR SERVIDOR, no directo a Firestore. Antes esto hacía `addDoc`
 * desde el navegador con `new Date()` del navegador, y la regla lo permitía con
 * `create: if isMember` sin validar un campo: cualquier miembro podía insertar
 * entradas con el correo y la hora que quisiera, o atribuirle un acceso a otro
 * médico. Una bitácora que el auditado puede escribir a discreción no acredita
 * nada, que es justo lo contrario de para lo que existe. Ahora la identidad sale
 * del ID-token y la hora es `serverTimestamp()`.
 */
import { fetchAutenticado } from '@/lib/auth-client'
import { auth } from '@/lib/firebase'

/** Quién está usando la aplicación AHORA en este equipo. */
function uidActual(): string | undefined {
  try { return auth?.currentUser?.uid ?? undefined } catch { return undefined }
}

export type AuditEvento =
  // === Eventos clínicos (ya existentes) ===
  | 'ia_procesamiento'           // se llamó al endpoint de IA
  | 'ia_campo_aprobado'          // médico aprobó un campo individual
  | 'ia_campo_rechazado'         // médico rechazó un campo
  | 'nota_borrador_guardado'     // guardó borrador
  | 'nota_firmada'               // firmó (queda inmutable)
  | 'nota_adenda'                // agregó una adenda a una nota firmada (NOM-004)
  | 'nota_borrada'               // borró un borrador
  /**
   * Contenido del expediente que se puede borrar desde el navegador.
   *
   * Un resultado de laboratorio o una fotografía clínica asociados a una nota YA
   * FIRMADA podían desaparecer sin que quedara constancia de que existieron. El
   * aviso de privacidad promete conservación mínima; borrarlos sin rastro la
   * contradice. No se prohíbe —a veces hay que quitar una foto subida al
   * expediente equivocado— pero tiene que quedar quién y cuándo.
   */
  | 'laboratorio_borrado'
  | 'foto_clinica_borrada'
  | 'consentimiento_grabacion'   // confirmó el consentimiento del paciente
  // === Bitácora completa (requisito de trazabilidad de NOM-024; el numeral
  //     exacto NO está verificado contra el DOF — no citarlo en documentos) ===
  | 'expediente_lectura'         // alguien abrió un expediente
  | 'nota_lectura'               // alguien abrió una nota específica
  | 'nota_impresion'             // alguien imprimió/descargó PDF de nota
  | 'receta_generada'            // se generó una receta
  | 'receta_descargada'          // se descargó PDF de receta
  | 'orden_generada'             // se generó una orden médica
  | 'paciente_creado'            // se creó un nuevo paciente
  | 'paciente_modificado'        // se modificaron datos del paciente
  | 'paciente_borrado'           // se borró un paciente
  | 'aviso_privacidad_aceptado'  // paciente aceptó aviso LFPDPPP
  | 'arco_solicitud_recibida'    // paciente solicitó ARCO
  | 'arco_solicitud_resuelta'    // médico resolvió solicitud ARCO
  | 'login_exitoso'              // usuario inició sesión
  | 'login_fallido'              // intento de login fallido
  | 'export_datos'               // se exportaron datos del paciente
  | 'cobro_exento'               // se marcó una cita como cortesía (no cobrar), con motivo
  // === Agenda (trazabilidad NOM-024) ===
  // Cancelar, marcar "no asistió" y BORRAR una cita se hacían sin dejar rastro,
  // mientras el booking público sí registraba. Borrar además destruye el
  // documento: sin bitácora no queda ni la constancia de que existió.
  | 'cita_estado_cambiado'       // cancelada / no-asistió / confirmada / atendida
  | 'cita_borrada'               // se eliminó una cita del calendario
  /**
   * EL CANAL MÁS VIEJO ERA EL ÚNICO SIN BITÁCORA.
   *
   * El portal deja rastro, el bot deja rastro, cambiar el estado y borrar una
   * cita dejan rastro… y dar de alta o MOVER una cita desde el consultorio no
   * dejaba ninguno. Mover una cita cambia la fecha, la hora y hasta el médico, y
   * en una discusión —«me la cambiaron y nadie me avisó»— no había a qué acudir.
   */
  | 'cita_creada'                // alguien del consultorio dio de alta una cita
  | 'cita_reagendada'            // alguien del consultorio movió una cita ya existente
  // === Hospitalización (trazabilidad NOM-004) ===
  | 'hosp_ingreso'               // ingreso hospitalario
  | 'hosp_egreso'                // egreso hospitalario
  | 'hosp_administracion'        // administración de medicamento (MAR)
  | 'hosp_traslado'              // traslado de cama/servicio o cambio de tratante
  | 'hosp_lab_resultado'         // se cargó resultado de laboratorio
  /**
   * LO QUE SE BORRA DEL EPISODIO.
   *
   * Una indicación médica sin administrar y una interconsulta sin responder SÍ
   * se pueden borrar —a veces se teclean en el paciente equivocado— y la ruta ya
   * lo impide en cuanto hay MAR o respuesta. Pero se borraban **sin dejar nada**:
   * una orden suspendida sigue viéndose y una borrada desaparece entera.
   *
   * Es exactamente el mismo criterio que ya obligaba a registrar el borrado de un
   * laboratorio o de una foto clínica: no se prohíbe, pero tiene que quedar quién
   * y cuándo.
   */
  | 'hosp_indicacion_borrada'    // se eliminó una indicación aún no administrada
  | 'hosp_interconsulta_borrada' // se eliminó una interconsulta aún sin responder
  /**
   * === Lo que hace el PACIENTE por su cuenta (portal y bot) ===
   *
   * Estos cinco se escribían directo con el Admin SDK desde las rutas, sin pasar
   * por `logAudit`, así que quedaban FUERA de este tipo — y de la lista de
   * etiquetas de la pantalla de cumplimiento, que los enseñaba con su nombre
   * interno. La bitácora es lo que se le pone delante a un auditor: media
   * pantalla en jerga de base de datos no es trazabilidad.
   */
  | 'cita_solicitada_portal'     // el paciente reservó desde el portal público
  | 'cita_cancelada_portal'      // el paciente canceló desde su enlace
  | 'cita_reagendada_portal'     // el paciente movió su cita desde su enlace
  | 'cita_cancelada_whatsapp'    // el paciente canceló hablando con el bot
  | 'formulario_previo_enviado'  // el paciente llenó su información antes de la consulta

export interface AuditPayload {
  evento: AuditEvento
  clinicId: string
  patientId?: string
  notaId?: string
  medicoUid?: string
  medicoEmail?: string
  /** IP/dispositivo si se puede capturar (best effort) */
  contexto?: { userAgent?: string; locale?: string }
  meta?: Record<string, unknown>  // datos no sensibles (counts, ids, etc.)
}

/**
 * COLA LOCAL DE ASIENTOS QUE NO SE PUDIERON ESCRIBIR.
 *
 * ── EL PROBLEMA ──────────────────────────────────────────────────────────────
 *
 * `logAudit` se tragaba el error por diseño —«nunca debe romper la operación
 * clínica», que es correcto— pero eso significaba que un 4xx por un evento no
 * reconocido, o la red caída, producían una bitácora CON HUECOS que nadie
 * detecta. Ya pasó de verdad: el evento `cobro_exento` se registraba desde la
 * pantalla, el servidor lo rechazaba, y en la base no había ni una cortesía.
 *
 * Una bitácora es una promesa de trazabilidad; con huecos silenciosos no la
 * cumple, y encima nadie sabe que no la cumple.
 *
 * ── LA SOLUCIÓN, CON SU LÍMITE DECLARADO ─────────────────────────────────────
 *
 * Los fallos TRANSITORIOS (red, 5xx) se guardan y se reintentan en la siguiente
 * escritura. Los fallos PERMANENTES (4xx: evento no reconocido, sin permiso) NO
 * se encolan: reintentarlos sería llenar el disco con algo que nunca va a
 * entrar. Ésos van a la consola con el evento, que es lo que permite arreglarlos.
 *
 * La cola es acotada: 50 asientos. Un fallo prolongado no puede convertirse en
 * un problema de almacenamiento, y perder los más viejos es preferible a perder
 * la aplicación.
 */
const CLAVE_COLA = 'nx.audit.pendientes'
const TOPE_COLA = 50

/**
 * `uid`: DE QUIÉN es el asiento.
 *
 * La cola guardaba sólo el cuerpo, y el servidor pone la identidad desde el
 * token de quien la drena. En un consultorio con equipo compartido —que es la
 * norma— lo que hizo el Dr. A sin red se asentaba a nombre de quien entrara
 * después. Un registro medicolegal con el autor equivocado es peor que no
 * tenerlo: no se puede corregir porque nadie sabe que está mal.
 *
 * Ahora cada asiento recuerda a quién pertenece y sólo se manda cuando la
 * sesión es de esa persona. Los de otros esperan a que vuelva.
 */
type Pendiente = { cuerpo: Record<string, unknown>; intentos: number; uid?: string }

function leerCola(): Pendiente[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_COLA) ?? '[]')
    return Array.isArray(v) ? v.slice(-TOPE_COLA) : []
  } catch { return [] }
}

function escribirCola(cola: Pendiente[]): void {
  try {
    if (!cola.length) localStorage.removeItem(CLAVE_COLA)
    else localStorage.setItem(CLAVE_COLA, JSON.stringify(cola.slice(-TOPE_COLA)))
  } catch { /* almacenamiento lleno: se pierde la cola, no la operación */ }
}

/** Manda un asiento. Devuelve si se puede reintentar cuando falla. */
async function enviarAsiento(cuerpo: Record<string, unknown>): Promise<{ ok: boolean; reintentable: boolean }> {
  try {
    const res = await fetchAutenticado('/api/auditoria/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    if (res.ok) return { ok: true, reintentable: false }
    // 4xx = el asiento está mal formado o no está permitido: reintentar no lo arregla.
    const permanente = res.status >= 400 && res.status < 500
    if (permanente) {
      console.error('[auditoria] asiento RECHAZADO y descartado', cuerpo.evento, res.status)
    }
    return { ok: false, reintentable: !permanente }
  } catch {
    return { ok: false, reintentable: true }   // red caída
  }
}

/** Vacía lo que se pueda de la cola. No bloquea a quien la llama. */
async function drenarCola(): Promise<void> {
  const cola = leerCola()
  if (!cola.length) return
  const yo = uidActual()
  const quedan: Pendiente[] = []
  for (const p of cola) {
    // Sólo se manda lo MÍO. Un asiento con `uid` de otro se queda esperando a que
    // esa persona vuelva a entrar en este equipo; mandarlo ahora lo firmaría con
    // el nombre equivocado. Los antiguos (sin `uid`) se mandan como antes: no se
    // puede saber de quién eran, y perderlos tampoco los arregla.
    if (p.uid && yo && p.uid !== yo) { quedan.push(p); continue }
    const r = await enviarAsiento(p.cuerpo)
    if (!r.ok && r.reintentable && p.intentos < 5) quedan.push({ ...p, intentos: p.intentos + 1 })
  }
  escribirCola(quedan)
}

export async function logAudit(p: AuditPayload): Promise<void> {
  if (!p.clinicId) return
  const cuerpo = {
    evento: p.evento,
    clinicId: p.clinicId,
    patientId: p.patientId,
    notaId: p.notaId,
    meta: p.meta,
    timestampCliente: new Date().toISOString(),
  }
  // medicoUid/medicoEmail NO se mandan: los pone el servidor desde el token.
  const r = await enviarAsiento(cuerpo)
  if (!r.ok && r.reintentable) {
    escribirCola([...leerCola(), { cuerpo, intentos: 1, uid: uidActual() }])
  }
  // Aprovecha esta llamada para vaciar lo que quedó pendiente de antes. Va sin
  // esperar: la bitácora nunca puede frenar la operación clínica.
  void drenarCola()
}

/** Cuántos asientos están esperando. Para poder DECIRLO en pantalla. */
export function asientosPendientes(): number {
  return leerCola().length
}

/** Cuántos esperan a OTRO usuario de este equipo (no se pueden mandar desde aquí). */
export function asientosDeOtros(): number {
  const yo = uidActual()
  if (!yo) return 0
  return leerCola().filter(p => p.uid && p.uid !== yo).length
}


/**
 * CÓMO SE LEE CADA EVENTO — en la pantalla de cumplimiento y en cualquier otra.
 *
 * Vivía suelto dentro de `cumplimiento/page.tsx`, así que la bitácora podía
 * crecer sin que nadie se enterara de que a la pantalla le faltaban etiquetas:
 * doce eventos —los del portal, el bot y toda la hospitalización— salían con su
 * nombre interno, `hosp_administracion` en vez de «Administró medicamento».
 *
 * Está aquí, junto al tipo, y una prueba exige que cada evento del tipo tenga la
 * suya y que ningún `evento:` escrito en el repositorio falte del tipo. Es el
 * mismo trato que el trinquete de lint: lo que importa no es corregirlo hoy, es
 * que no se vuelva a descolgar mañana.
 */
export const EVENTO_LABEL: Record<AuditEvento, string> = {
  ia_procesamiento: 'IA procesó',
  ia_campo_aprobado: 'Aprobó campo IA',
  ia_campo_rechazado: 'Rechazó campo IA',
  nota_borrador_guardado: 'Guardó borrador',
  nota_firmada: 'Firmó nota',
  nota_adenda: 'Agregó adenda',
  nota_borrada: 'Borró borrador',
  laboratorio_borrado: 'Borró laboratorio',
  foto_clinica_borrada: 'Borró foto clínica',
  consentimiento_grabacion: 'Consintió grabar',
  expediente_lectura: 'Vio expediente',
  nota_lectura: 'Vio nota',
  nota_impresion: 'Imprimió nota',
  receta_generada: 'Generó receta',
  receta_descargada: 'Descargó receta',
  orden_generada: 'Generó orden',
  paciente_creado: 'Creó paciente',
  paciente_modificado: 'Modificó paciente',
  paciente_borrado: 'Borró paciente',
  aviso_privacidad_aceptado: 'Aviso aceptado',
  arco_solicitud_recibida: 'Solicitud ARCO',
  arco_solicitud_resuelta: 'ARCO resuelta',
  login_exitoso: 'Inicio de sesión',
  login_fallido: 'Login fallido',
  export_datos: 'Export de datos',
  cobro_exento: 'Marcó cortesía (no cobrar)',
  cita_estado_cambiado: 'Cambió estado de cita',
  cita_borrada: 'Borró cita',
  cita_creada: 'Agendó cita',
  cita_reagendada: 'Movió cita',
  hosp_ingreso: 'Ingreso hospitalario',
  hosp_egreso: 'Egreso hospitalario',
  hosp_administracion: 'Administró medicamento',
  hosp_traslado: 'Traslado de cama o tratante',
  hosp_lab_resultado: 'Cargó resultado de laboratorio',
  hosp_indicacion_borrada: 'Borró indicación médica',
  hosp_interconsulta_borrada: 'Borró interconsulta',
  // Lo que hace el paciente por su cuenta se nombra DICIENDO que fue él: en una
  // revisión, «canceló» sin sujeto se lee como que lo hizo el consultorio.
  cita_solicitada_portal: 'El paciente reservó (portal)',
  cita_cancelada_portal: 'El paciente canceló (portal)',
  cita_reagendada_portal: 'El paciente reagendó (portal)',
  cita_cancelada_whatsapp: 'El paciente canceló (WhatsApp)',
  formulario_previo_enviado: 'El paciente envió su información previa',
}

/** Cómo enseñar un evento, incluido uno que todavía no tenga etiqueta. */
export function etiquetaEvento(evento: string): string {
  return (EVENTO_LABEL as Record<string, string>)[evento] ?? evento
}
