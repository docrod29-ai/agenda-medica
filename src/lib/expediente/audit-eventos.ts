/**
 * LOS EVENTOS DE LA BITÁCORA Y SUS ETIQUETAS — sin nada del navegador.
 *
 * ── POR QUÉ ESTÁN AQUÍ Y NO EN `audit-log.ts` ────────────────────────────────
 *
 * `audit-log.ts` importa `@/lib/firebase` para saber quién está usando la
 * aplicación, y ese módulo **se inicializa al importarse**: cualquier ruta de
 * servidor que lo arrastre rompe `next build` sin las variables
 * `NEXT_PUBLIC_FIREBASE_*` (REG-059, con su propio guardián).
 *
 * La exportación de la bitácora en CSV necesita las etiquetas y corre en el
 * SERVIDOR. Sacarlas a un módulo puro es lo que el propio guardián recomienda, y
 * evita la alternativa mala: duplicar el mapa y que las dos copias se
 * desincronicen sin que nadie lo note.
 *
 * Módulo PURO.
 */

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
  | 'arco_solicitud_ligada'      // se ató una solicitud del portal a un expediente identificado
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
  /**
   * === LO QUE SE LE LIBERA AL PACIENTE (V9 · POSTVISIT-001) ===
   *
   * Firmar la nota y liberarle información al paciente son DOS actos, y por eso
   * dejan DOS rastros. `nota_firmada` acredita el acto medicolegal hacia el
   * expediente; éstos acreditan el acto de comunicación hacia el paciente: quién
   * autorizó que leyera el resumen de su consulta, en qué versión y cuándo.
   *
   * Sin esta pareja, la pregunta «¿quién aprobó que este paciente leyera esto?»
   * sólo se podría contestar mirando un campo del propio documento — el mismo
   * campo que una migración puede escribir. La bitácora es lo que no se puede
   * reescribir desde la pantalla que se audita.
   */
  | 'paquete_liberado'           // se liberó al paciente el paquete de una visita
  | 'paquete_retirado'           // se retiró un paquete ya liberado (vuelve a DRAFT)

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
  arco_solicitud_ligada: 'ARCO ligada a expediente',
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
  paquete_liberado: 'Liberó el resumen de la visita al paciente',
  paquete_retirado: 'Retiró el resumen de la visita del portal',
}

/** Cómo enseñar un evento, incluido uno que todavía no tenga etiqueta. */
export function etiquetaEvento(evento: string): string {
  return (EVENTO_LABEL as Record<string, string>)[evento] ?? evento
}
