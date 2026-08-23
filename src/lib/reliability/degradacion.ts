/**
 * MODO LIMITADO — qué se conserva, qué se reintenta, qué se degrada y qué se
 * bloquea, para cada cosa que se puede caer.
 *
 * ── POR QUÉ ESTO ES CÓDIGO Y NO UN DOCUMENTO ─────────────────────────────────
 *
 * «El fallo de la IA no debe bloquear la consulta» es una frase con la que todo
 * el mundo está de acuerdo y que nadie puede verificar. Escrita como tabla, se
 * puede recorrer con una prueba y fallar el día que alguien marque que la caída
 * de la evidencia bloquea la firma.
 *
 * Cada fila responde CUATRO preguntas, siempre las mismas, y la respuesta a
 * «qué se bloquea» tiene que estar justificada por seguridad clínica o queda
 * vacía. Un bloqueo sin justificación clínica es un producto que se rinde.
 *
 * ── LA REGLA QUE ORDENA LA TABLA ─────────────────────────────────────────────
 *
 * De `clases-de-trabajo.ts`: sólo `hot:firmar-nota` puede bloquear al médico.
 * Todo lo demás degrada. Firmar es el único acto en que decir «listo» sin que
 * lo esté sería una mentira medicolegal.
 *
 * Y de la regla 4 de seguridad clínica: **ausencia de dato no es dato de
 * ausencia**. Cuando la evidencia no está, se dice que no está. Nunca se
 * rellena, nunca se calla.
 *
 * Módulo PURO.
 */

/** Lo que se puede caer. Uno por frontera externa real del producto. */
export type SubsistemaCaido =
  | 'proveedor-ia'
  | 'transcripcion'
  | 'evidencia'
  | 'whatsapp'
  | 'notificaciones'
  | 'almacenamiento-transitorio'
  | 'componente-secundario'

export interface ModoLimitado {
  subsistema: SubsistemaCaido
  /** Lo que NO se pierde bajo ninguna circunstancia. */
  seConserva: readonly string[]
  /** Lo que se reintenta por detrás, sin que el médico espere. */
  seReintenta: readonly string[]
  /** Lo que deja de estar disponible, dicho en voz alta al médico. */
  seDegrada: readonly string[]
  /**
   * Lo que se bloquea con justificación clínica. Vacío en casi todas las filas
   * — y eso es lo que hay que poder demostrar.
   */
  seBloquea: readonly string[]
  /** Qué ve el médico. No un código de error; una frase que le sirva. */
  loQueVeElMedico: string
}

export const MODOS_LIMITADOS: Readonly<Record<SubsistemaCaido, ModoLimitado>> = {
  'proveedor-ia': {
    subsistema: 'proveedor-ia',
    seConserva: ['transcripción ya capturada', 'borrador de la nota', 'audio local', 'medicamentos y diagnósticos ya confirmados'],
    seReintenta: ['estructuración de la nota', 'razonamiento clínico'],
    seDegrada: ['redacción asistida', 'sugerencias de diagnóstico', 'verificación de la nota'],
    seBloquea: [],
    loQueVeElMedico: 'La asistencia de IA no está disponible ahora. Tu nota se sigue guardando y puedes escribirla y firmarla igual.',
  },
  transcripcion: {
    subsistema: 'transcripcion',
    seConserva: ['audio ya grabado (IndexedDB)', 'texto ya transcrito', 'lo escrito a mano'],
    seReintenta: ['transcripción de los fragmentos pendientes'],
    seDegrada: ['dictado en vivo'],
    seBloquea: [],
    loQueVeElMedico: 'No pude transcribir ahora. Tu audio está guardado y puedes seguir escribiendo a mano; lo intento otra vez en cuanto vuelva.',
  },
  evidencia: {
    subsistema: 'evidencia',
    seConserva: ['nota', 'plan', 'medicamentos'],
    seReintenta: ['búsqueda de evidencia'],
    seDegrada: ['citas bibliográficas', 'respaldo de las recomendaciones'],
    seBloquea: [],
    loQueVeElMedico: 'Evidencia no disponible en este momento. No se muestran referencias hasta que vuelva; nada se completa por aproximación.',
  },
  whatsapp: {
    subsistema: 'whatsapp',
    seConserva: ['la cita canónica, que vive en el expediente y no en el mensaje'],
    seReintenta: ['envío del recordatorio (outbox con retroceso)'],
    seDegrada: ['confirmación por mensaje', 'recordatorio automático'],
    seBloquea: [],
    loQueVeElMedico: 'La cita quedó agendada. El mensaje al paciente no salió todavía y se reintenta solo.',
  },
  notificaciones: {
    subsistema: 'notificaciones',
    seConserva: ['la cita', 'el cambio de estado que la originó'],
    seReintenta: ['el aviso'],
    seDegrada: ['aviso al paciente', 'aviso al médico'],
    seBloquea: [],
    loQueVeElMedico: 'Se guardó el cambio. El aviso está pendiente de salir.',
  },
  'almacenamiento-transitorio': {
    subsistema: 'almacenamiento-transitorio',
    seConserva: ['borrador en el dispositivo (localStorage/IndexedDB)', 'último punto durable guardado'],
    seReintenta: ['autoguardado a Firestore'],
    seDegrada: ['sincronización entre dispositivos', 'indicador de guardado en la nube'],
    seBloquea: [],
    loQueVeElMedico: 'No pude guardar en la nube. Tu trabajo está en este dispositivo y lo subo en cuanto vuelva la conexión.',
  },
  'componente-secundario': {
    subsistema: 'componente-secundario',
    seConserva: ['todo lo demás de la pantalla'],
    seReintenta: ['montaje del componente que falló'],
    seDegrada: ['ese panel, y sólo ese panel'],
    seBloquea: [],
    loQueVeElMedico: 'Esta parte no se pudo mostrar. El resto de la consulta sigue funcionando.',
  },
}

/**
 * INVARIANTE: ningún modo limitado bloquea salvo con justificación clínica
 * escrita. Hoy la tabla no tiene ni una fila con bloqueo, y ése es el punto:
 * si mañana aparece una, tiene que ser una decisión visible en un diff.
 */
export function modosQueBloquean(): SubsistemaCaido[] {
  return (Object.keys(MODOS_LIMITADOS) as SubsistemaCaido[])
    .filter(s => MODOS_LIMITADOS[s].seBloquea.length > 0)
}

/**
 * INVARIANTE DE PANTALLA BLANCA: todo subsistema declara qué se conserva y qué
 * ve el médico. Un subsistema que se cae sin mensaje ES la pantalla blanca —
 * aunque técnicamente el DOM tenga contenido, el médico no sabe qué pasó ni si
 * su trabajo sigue ahí.
 */
export function modosSinMensaje(): SubsistemaCaido[] {
  return (Object.keys(MODOS_LIMITADOS) as SubsistemaCaido[]).filter(s => {
    const m = MODOS_LIMITADOS[s]
    return m.loQueVeElMedico.trim().length === 0 || m.seConserva.length === 0
  })
}
