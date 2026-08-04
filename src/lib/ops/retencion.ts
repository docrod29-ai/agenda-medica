/**
 * QUÉ SE BORRA SOLO, CUÁNDO, Y QUÉ NO SE TOCA.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * Sólo había dos crons y **ninguno borraba nada de Firestore** —`limpiar-audio`
 * toca únicamente Cloud Storage—. Mientras tanto:
 *
 * · `rate_limits` escribe **un documento por petición limitada** y su propio
 *   código dice, textualmente, que guarda `exp` «para poder purgar con TTL de
 *   Firestore **si algún día se activa**». No se activó nunca: no existe
 *   `firestore.indexes.json` ni política TTL en ninguna parte. Es otra vez la
 *   regla escrita en un comentario que nada hace cumplir.
 * · `platform_csp` la escribe un endpoint **público y sin autenticar**.
 * · `errores`, `whatsapp_status` y `clinic_review_requests` crecen sin techo.
 *
 * Nada de eso rompe hoy. Todo eso rompe con cien consultorios, y cuando rompa lo
 * hará por la vía más cara: la factura y el rendimiento de las consultas.
 *
 * ── LO QUE ESTE BARRIDO NO TOCA, Y NO ES NEGOCIABLE ──────────────────────────
 *
 * **Nada del expediente.** Ni notas, ni laboratorios, ni fotos, ni citas, ni la
 * bitácora de accesos del consultorio. Cuánto tiempo se conserva un expediente
 * lo fija la NOM-004 y el abogado del consultorio, **no un cron**. Un barrendero
 * que se lleve por delante un dato clínico es infinitamente peor que una
 * colección que crece.
 *
 * Por eso el manifiesto enumera colecciones **de plataforma** y el guardián
 * comprueba que ninguna ruta de `clinics/{id}/…` aparezca aquí.
 *
 * Módulo PURO.
 */

export interface ReglaRetencion {
  /** Colección de primer nivel. Nunca una subcolección de `clinics`. */
  coleccion: string
  /** Campo con la fecha a comparar. */
  campo: string
  /**
   * Formato del campo: `iso` (cadena ordenable) o `timestamp` (Date/Timestamp).
   * Compararlos mal no borra de más: no borra NADA, y eso pasa desapercibido.
   */
  formato: 'iso' | 'timestamp'
  /** Días que se conserva. */
  dias: number
  /** Por qué ese plazo, y por qué se puede borrar. */
  porQue: string
}

/**
 * Lo que se barre. Sólo datos **operativos**: nada clínico, nada del paciente.
 */
export const REGLAS: ReglaRetencion[] = [
  {
    coleccion: 'rate_limits', campo: 'exp', formato: 'timestamp', dias: 2,
    porQue: 'Contadores de peticiones por ventana. Un documento por petición limitada, y su ventana dura minutos: pasadas 48 h no describe nada. El propio código guardaba `exp` «para purgar con TTL si algún día se activa» — no se activó nunca.',
  },
  {
    coleccion: 'platform_csp', campo: 'fecha', formato: 'iso', dias: 90,
    porQue: 'Reportes de violación de la política de seguridad, escritos por un endpoint público y sin autenticar. Sirven para decidir si se puede pasar la CSP a bloquear; noventa días son más que suficientes para esa decisión, y sin tope es una colección que cualquiera puede engordar.',
  },
  {
    coleccion: 'whatsapp_dedup', campo: 'expira', formato: 'timestamp', dias: 0,
    porQue: 'Marcas para no procesar dos veces el mismo mensaje entrante. Una por mensaje. El módulo YA escribe `expira` «para una política TTL de Firestore (borra marcas viejas solas)» — y esa política tampoco se activó nunca. Con `dias: 0` se borra justo cuando `expira` queda atrás, que es exactamente lo que el TTL habría hecho: no se inventa un plazo, se respeta el suyo.',
  },
  {
    coleccion: 'transcript_owners', campo: 'at', formato: 'iso', dias: 7,
    porQue: 'Dueño de un trabajo de diarización, para que nadie consulte el de otro. La ruta lo borra sola al terminar; lo que queda son trabajos que nunca terminaron. Siete días es mucho más de lo que tarda el más largo (seis minutos) y no borra nada en curso.',
  },
  {
    coleccion: 'errores', campo: 'fecha', formato: 'iso', dias: 180,
    porQue: 'Rastreo de errores del cliente. Medio año cubre cualquier investigación real; más allá, un error de una versión que ya no existe no ayuda a nadie.',
  },
]

/**
 * Colecciones que se dejan crecer A PROPÓSITO, con su razón.
 *
 * Existe para que el guardián pueda distinguir «se me olvidó» de «se decidió» —
 * y para que la decisión quede por escrito donde se ve.
 */
export const SIN_BARRER: Record<string, string> = {
  platform_payments: 'Cada cargo de Stripe. Es contabilidad: no se borra, se archiva. Y su consulta debe acotarse por fecha, no purgarse.',
  platform_cost_ledger: 'El libro de costos de IA. Es la base del margen real; borrarlo sería perder la única cifra honesta que hay.',
  platform_admin_log: 'Acciones del dueño sobre la plataforma. Rastro de administración.',
  platform_heartbeats: 'Un documento por trabajo, que se sobrescribe. No crece.',
  clinic_members: 'Quién pertenece a qué consultorio. Estado vivo, no histórico.',
  clinic_invitations: 'Invitaciones pendientes. Las caducadas las gestiona su propio flujo.',
  googleTokens: 'Credenciales de calendario por médico. Estado vivo.',
  platform_packages: 'Catálogo de paquetes de créditos. Estado vivo: un puñado de documentos que se editan, no un histórico que crezca.',
  platform_meta: 'Metadatos de la plataforma. Un puñado de documentos fijos que se leen y se sobrescriben.',
  clinic_review_requests: 'Solicitudes de reseña con su `expiresAt`. Caducan solas y el flujo público ya las rechaza; borrarlas exigiría distinguir la usada de la caducada, y una reseña perdida es una queja del paciente.',
  clinics: 'Los consultorios. Borrar uno es una decisión del dueño, nunca de un cron.',
  platform_config: 'Configuración de la plataforma: catálogo de planes y parámetros del simulador. Dos documentos de identificador fijo.',
  platform_incidentes: 'Incidentes de IA registrados para el dueño. Es el rastro de lo que salió mal; borrarlo sería perder la memoria de las averías.',
  whatsapp_channels: 'Índice de qué consultorio corresponde a cada canal de WhatsApp. Estado vivo: se borra al desconectar, no por antigüedad.',
  anticipos_procesados: 'Marca de idempotencia de un anticipo de Stripe. Borrarla abre la puerta a aplicar dos veces el mismo pago si Stripe reintenta; y además es contabilidad.',
  recargas_procesadas: 'Ídem para las recargas de créditos: la marca es lo que impide duplicar una compra.',
  platform_recargas: 'Lo que el dueño abona a cada proveedor de IA. Es contabilidad y además es el minuendo del saldo: borrar una recarga vieja haría aparecer un saldo negativo y un aviso de agotamiento falso.',
  soporte: 'Tickets de soporte del médico. Es correspondencia con el cliente, no telemetría: se archiva, no se purga.',
}

/**
 * Nada de lo que cuelga de un consultorio se barre desde aquí.
 *
 * El guardián lo comprueba sobre el manifiesto; esto lo deja escrito para quien
 * venga a añadir una regla.
 */
export const POR_QUE_NADA_CLINICO =
  'Cuánto tiempo se conserva un expediente lo fija la NOM-004 y el abogado del ' +
  'consultorio, no un cron. Un barrendero que se lleve por delante un dato ' +
  'clínico es infinitamente peor que una colección que crece: lo segundo cuesta ' +
  'dinero, lo primero cuesta el expediente de alguien.'

/** ¿Está caducado este documento? PURO: se le pasa el instante. */
export function caducado(
  regla: ReglaRetencion, valor: unknown, ahoraMs: number,
): { borrar: boolean; porQue: string } {
  const corte = ahoraMs - regla.dias * 86_400_000
  let t: number
  if (regla.formato === 'iso') {
    t = Date.parse(String(valor ?? ''))
  } else {
    const v = valor as { toDate?: () => Date } | Date | number | undefined
    t = v && typeof (v as { toDate?: () => Date }).toDate === 'function'
      ? (v as { toDate: () => Date }).toDate().getTime()
      : v instanceof Date ? v.getTime()
      : typeof v === 'number' ? v : NaN
  }
  /**
   * Lo que no se puede fechar NO se borra — la misma regla que el barrido de
   * audio. Borrar ante la duda es la única forma de que un barrendero se
   * convierta en una pérdida de datos.
   */
  if (!Number.isFinite(t)) return { borrar: false, porQue: 'sin fecha legible: ante la duda no se borra' }
  if (t > ahoraMs + 86_400_000) return { borrar: false, porQue: 'fechado en el futuro: reloj desajustado' }
  return t < corte
    ? { borrar: true, porQue: `más viejo que ${regla.dias} día(s)` }
    : { borrar: false, porQue: `todavía dentro de los ${regla.dias} día(s)` }
}
