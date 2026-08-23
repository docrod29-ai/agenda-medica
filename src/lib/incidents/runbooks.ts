/**
 * RUNBOOKS LEGIBLES POR MÁQUINA — porque a las 3am nadie lee un PDF.
 *
 * ── POR QUÉ CÓDIGO Y NO UN MARKDOWN ──────────────────────────────────────────
 *
 * Es la misma razón por la que `calidad/familias-de-defecto.ts` no es una tabla:
 * un documento escrito a mano envejece en silencio. Un runbook que dice
 * «reintentar hasta 5 veces» mientras el código reintenta 3 no es una guía, es
 * una mentira con formato. Aquí la política de reintento del runbook **es** la
 * que consume la máquina de estados, y las acciones que declara se validan
 * contra el catálogo de `remediacion.ts`: un runbook que autorice una acción que
 * no existe pone el CI en rojo.
 *
 * ── LO QUE TODO RUNBOOK TIENE QUE DECLARAR ───────────────────────────────────
 *
 * detección · acciones automáticas permitidas · acciones prohibidas · qué hace
 * el dueño · qué ve el médico · cómo se verifica que se arregló · cómo se
 * deshace si empeoró.
 *
 * El paso de VERIFICACIÓN es el que casi nunca se escribe y el que hace falta:
 * sin él, «se reintentó» se lee como «se arregló».
 *
 * Módulo PURO.
 */
import type { CategoriaIncidente } from './taxonomia'
import { accion } from './remediacion'

export interface Runbook {
  readonly id: string
  readonly titulo: string
  /** Con qué se dispara: categoría y, si aplica, subtipo exacto. */
  readonly deteccion: { readonly categoria: CategoriaIncidente; readonly subtipos?: readonly string[] }
  /** Claves del catálogo de `remediacion.ts`. Vacío = nada se hace solo. */
  readonly accionesAutomaticas: readonly string[]
  /** Claves prohibidas EXPLÍCITAMENTE para este caso, además de la política general. */
  readonly accionesProhibidas: readonly string[]
  /** Qué tiene que hacer una persona. `null` = no hace falta nadie. */
  readonly accionDelDueno: string | null
  /** Qué se le dice al médico, en una frase. El texto largo sale del contrato. */
  readonly mensajeAlMedico: string
  /** ¿Ofrecer reintentar mientras esto siga? */
  readonly permiteReintento: boolean
  /** Cómo se comprueba que de verdad se arregló. Sin esto no hay «resuelto». */
  readonly verificacion: string
  /** Cómo se deshace la remediación si empeoró. `null` si no hubo nada que deshacer. */
  readonly rollback: string | null
}

export const RUNBOOKS: readonly Runbook[] = [
  {
    id: 'RB-IA-SALDO',
    titulo: 'La cuenta del proveedor de IA se quedó sin saldo',
    deteccion: { categoria: 'ai_provider', subtipos: ['sin_saldo'] },
    /**
     * NINGUNA. Reintentar contra una cuenta sin saldo es una tormenta de
     * llamadas que no puede salir bien: `seArreglaReintentando('sin_saldo')` ya
     * dice `false` desde el 31-jul y ésta es la misma decisión, dicha aquí.
     */
    accionesAutomaticas: [],
    accionesProhibidas: ['recargar_saldo_de_proveedor', 'rotar_llave_de_proveedor'],
    accionDelDueno:
      'Recargar saldo en el proveedor y activar la recarga automática. ' +
      'REQUIERE GASTO: no lo hace el sistema.',
    mensajeAlMedico: 'El servicio de IA está fuera por un problema nuestro. Tu dictado está guardado.',
    permiteReintento: false,
    verificacion: 'Una llamada de prueba al proveedor devuelve 200 y la clase de fallo deja de aparecer en la ventana siguiente.',
    rollback: null,
  },
  {
    id: 'RB-IA-LLAVE',
    titulo: 'La llave del proveedor de IA fue rechazada',
    deteccion: { categoria: 'ai_provider', subtipos: ['llave_invalida'] },
    accionesAutomaticas: [],
    accionesProhibidas: ['rotar_llave_de_proveedor'],
    accionDelDueno:
      'Si es la llave de la PLATAFORMA: generar una nueva y actualizar la variable ' +
      'de entorno en el hosting. Si es la del CONSULTORIO: el médico la actualiza ' +
      'en Configuración → Llaves de IA, y eso ya se le dijo en su pantalla.',
    mensajeAlMedico: 'El servicio de IA no está disponible. Tu dictado está guardado.',
    permiteReintento: false,
    verificacion: 'Una llamada de prueba con la llave nueva devuelve 200.',
    rollback: null,
  },
  {
    id: 'RB-IA-SOBRECARGA',
    titulo: 'El proveedor de IA está saturado o limitando la tasa',
    deteccion: { categoria: 'ai_provider', subtipos: ['sobrecarga', 'limite_tasa', 'timeout'] },
    accionesAutomaticas: ['reintento_idempotente', 'respaldo_de_proveedor_autorizado'],
    accionesProhibidas: ['recargar_saldo_de_proveedor', 'desplegar_correccion'],
    accionDelDueno:
      'Sólo si se repite: pedir subir el límite de tasa o subir de tier. ' +
      'REQUIERE GASTO cuando implica cambiar de plan.',
    mensajeAlMedico: 'La IA va lenta ahora mismo. Tu dictado está guardado y puedes seguir escribiendo.',
    permiteReintento: true,
    verificacion: 'La tasa de la firma vuelve por debajo de la línea base durante una ventana completa.',
    rollback: 'Volver al proveedor primario en cuanto responda: el respaldo es temporal, no un cambio de proveedor.',
  },
  {
    id: 'RB-NOTIF-WHATSAPP',
    titulo: 'La notificación al paciente no salió, pero la cita sí quedó',
    deteccion: { categoria: 'notification' },
    accionesAutomaticas: ['reintentar_notificacion', 'reencolar_trabajo_diferido'],
    /**
     * La prohibición que importa: NUNCA deshacer la reserva porque falló el
     * aviso. La cita es el dato; el mensaje es el acuse. El camino real ya lo
     * hace bien —`api/public/booking` anota el no entregado y sigue— y este
     * runbook lo declara para que no se pierda al reescribir la ruta.
     */
    accionesProhibidas: ['borrar_encuentro', 'reembolsar_cobro'],
    accionDelDueno: 'Si se repite en muchos consultorios, revisar el estado del proveedor de WhatsApp.',
    mensajeAlMedico: 'La cita quedó guardada; sólo falló el mensaje al paciente.',
    permiteReintento: true,
    verificacion: 'El registro de no entregados de ese consultorio deja de crecer y el reintento sale con acuse.',
    rollback: null,
  },
  {
    id: 'RB-AUTOSAVE',
    titulo: 'El autoguardado dejó de guardar',
    deteccion: { categoria: 'autosave' },
    accionesAutomaticas: ['reintento_idempotente', 'reconectar'],
    accionesProhibidas: ['borrar_encuentro', 'editar_nota_firmada'],
    accionDelDueno: 'Si afecta a varios consultorios a la vez, mirar la persistencia antes que la pantalla.',
    /**
     * El único mensaje del producto que se pone DELANTE del médico con un
     * paciente enfrente. Si no lo ve, sigue dictando sobre algo que no existe.
     */
    mensajeAlMedico: 'ATENCIÓN: el guardado automático no está funcionando. Guarda a mano y no cierres la pestaña.',
    permiteReintento: true,
    verificacion: 'Un guardado de prueba vuelve con acuse del servidor y el documento existe al releerlo.',
    rollback: 'Ninguno: el reintento de guardado es idempotente sobre el mismo documento.',
  },
  {
    id: 'RB-AISLAMIENTO',
    titulo: 'Se detectó una violación de aislamiento entre consultorios',
    deteccion: { categoria: 'tenant_isolation' },
    /** NADA automático, ni una acción inocente: repararlo borraría la señal. */
    accionesAutomaticas: [],
    accionesProhibidas: ['copiar_datos_entre_consultorios', 'cambiar_permisos', 'borrar_encuentro'],
    accionDelDueno:
      'Contener y auditar: identificar la ruta, revisar la bitácora de ese consultorio y ' +
      'no cerrar el incidente hasta tener prueba de regresión. Un evento basta.',
    mensajeAlMedico: 'La operación se detuvo por una comprobación de seguridad. No se escribió nada.',
    permiteReintento: false,
    verificacion: 'Una prueba adversarial reproduce el acceso cruzado y falla ANTES del arreglo; después, no.',
    rollback: null,
  },
  {
    id: 'RB-PERSISTENCIA',
    titulo: 'Escritura rechazada o no confirmada en la base',
    deteccion: { categoria: 'persistence' },
    accionesAutomaticas: ['reintento_idempotente'],
    accionesProhibidas: ['borrar_encuentro', 'cambiar_permisos'],
    accionDelDueno: 'Si el rechazo es de reglas y no transitorio, es un defecto de autorización: no se reintenta, se repara.',
    mensajeAlMedico: 'No pude confirmar el guardado. Tu texto sigue en pantalla: compruébalo antes de cerrar.',
    permiteReintento: true,
    verificacion: 'Releer el documento y comprobar que el contenido esperado está escrito. Contrato: no basta con que la escritura no lance.',
    rollback: 'Ninguno: el reintento va con clave de idempotencia sobre el mismo documento.',
  },
  {
    id: 'RB-AGENDA',
    titulo: 'La operación de agenda no se pudo completar',
    deteccion: { categoria: 'scheduling' },
    accionesAutomaticas: ['reintento_idempotente'],
    /** Nunca «arreglar» un choque de horario borrando una de las dos citas. */
    accionesProhibidas: ['borrar_encuentro', 'copiar_datos_entre_consultorios'],
    accionDelDueno: 'Si el choque es real, lo resuelve el consultorio eligiendo otro hueco. No es un fallo que se repare solo.',
    mensajeAlMedico: 'La agenda no cambió. Vuelve a intentarlo; si el hueco se ocupó, elige otro.',
    permiteReintento: true,
    verificacion: 'La cita existe una sola vez y con el estado esperado tras releer la agenda del día.',
    rollback: 'Ninguno: la reserva va en transacción, o entra entera o no entra.',
  },
  {
    id: 'RB-EVIDENCIA',
    titulo: 'La consulta de evidencia no respondió',
    deteccion: { categoria: 'evidence' },
    accionesAutomaticas: ['reintento_idempotente', 'respaldo_de_proveedor_autorizado', 'invalidar_cache_caduca'],
    accionesProhibidas: ['editar_nota_firmada', 'aceptar_diagnostico_sugerido'],
    accionDelDueno: 'Ninguna mientras sea del proveedor. Si dura, revisar su estado.',
    mensajeAlMedico: 'No pude consultar evidencia ahora. Tu nota sigue editable.',
    permiteReintento: true,
    verificacion: 'Una consulta de prueba devuelve resultados con su fuente citada.',
    rollback: 'Volver al proveedor primario cuando responda.',
  },
  {
    id: 'RB-UI',
    titulo: 'Un componente de la pantalla lanza y se lleva su zona por delante',
    deteccion: { categoria: 'ui' },
    accionesAutomaticas: ['reiniciar_estado_de_cliente', 'invalidar_cache_caduca'],
    accionesProhibidas: ['editar_nota_firmada', 'borrar_encuentro'],
    accionDelDueno: 'Si el componente es el mismo en varios consultorios, es un defecto de despliegue: mirar la versión.',
    mensajeAlMedico: 'Esta parte no se pudo mostrar. El resto de la consulta sigue funcionando.',
    permiteReintento: true,
    verificacion: 'El componente vuelve a montar sin lanzar y el resto de la pantalla nunca dejó de estar en pie.',
    rollback: 'Ninguno: reiniciar estado de cliente no escribe nada.',
  },
  {
    id: 'RB-RED',
    titulo: 'Se perdió la conexión',
    deteccion: { categoria: 'network' },
    accionesAutomaticas: ['reintento_idempotente', 'reconectar'],
    accionesProhibidas: ['borrar_encuentro', 'reembolsar_cobro'],
    accionDelDueno: 'Ninguna mientras sea de la red del consultorio. Si es masivo y simultáneo, mirar el hosting.',
    mensajeAlMedico: 'Se perdió la conexión. Tu trabajo sigue en este dispositivo y se enviará al volver.',
    permiteReintento: true,
    verificacion: 'Una petición de prueba vuelve con 200 y la cola local se vacía.',
    rollback: null,
  },
  {
    id: 'RB-TRANSCRIPCION',
    titulo: 'La transcripción del dictado no salió',
    deteccion: { categoria: 'transcription' },
    accionesAutomaticas: ['reintento_idempotente', 'respaldo_de_proveedor_autorizado', 'reabrir_flujo_no_destructivo'],
    /**
     * Nunca se descarta el audio para «limpiar» un fallo. El crudo no se borra:
     * es la regla de `.claude/rules/voice-asr.md` y de ella cuelga el
     * aprendizaje y cualquier discusión medicolegal.
     */
    accionesProhibidas: ['borrar_encuentro', 'editar_nota_firmada'],
    accionDelDueno: 'Si falla el motor de diarización y el de respaldo a la vez, es del proveedor: revisar su estado.',
    mensajeAlMedico: 'No pude transcribir el audio ahora. El audio está guardado y se puede repetir sobre el mismo material.',
    permiteReintento: true,
    verificacion: 'Una transcripción de prueba devuelve texto y el audio crudo sigue en su sitio.',
    rollback: 'Volver al motor primario cuando responda.',
  },
  {
    id: 'RB-RAZONAMIENTO',
    titulo: 'La IA no pudo redactar la nota',
    deteccion: { categoria: 'ai_reasoning' },
    accionesAutomaticas: ['reintento_idempotente'],
    /** Jamás aceptar por su cuenta lo que la IA sugirió para «terminar» la nota. */
    accionesProhibidas: ['aceptar_diagnostico_sugerido', 'editar_nota_firmada', 'editar_receta'],
    accionDelDueno: 'Si se repite en una función concreta, mirar el prompt y el modelo de esa función antes que el proveedor.',
    mensajeAlMedico: 'No pude redactar la nota ahora. Tu nota sigue editable y guardada.',
    permiteReintento: true,
    verificacion: 'Una redacción de prueba devuelve texto con su procedencia y sin cifras inventadas.',
    rollback: null,
  },
  {
    id: 'RB-PAGO',
    titulo: 'El cobro quedó en un estado que no se pudo confirmar',
    deteccion: { categoria: 'payment' },
    /**
     * NADA automático. Un cobro es dinero de un paciente: reintentarlo sin
     * confirmar si el primero pasó es cobrar dos veces, y eso no se deshace con
     * otro reintento.
     */
    accionesAutomaticas: [],
    accionesProhibidas: ['reembolsar_cobro', 'reintento_idempotente'],
    accionDelDueno: 'Conciliar contra el proveedor de pagos ANTES de tocar nada. Si hubo cargo doble, devolverlo a mano.',
    mensajeAlMedico: 'No pude confirmar el cobro. No vuelvas a cobrar sin comprobar antes si el cargo salió.',
    permiteReintento: false,
    verificacion: 'El estado del cargo en el proveedor coincide con el guardado, y hay exactamente uno.',
    rollback: null,
  },
  {
    id: 'RB-SESION',
    titulo: 'La sesión del usuario caducó o fue rechazada',
    deteccion: { categoria: 'auth' },
    /**
     * Ninguna. `refrescar_token_tecnico` existe en el catálogo y aquí NO se
     * autoriza: la política ya para toda la categoría `auth`, y un runbook que
     * la autorizara sería un runbook que contradice a la política.
     */
    accionesAutomaticas: [],
    accionesProhibidas: ['cambiar_permisos', 'rotar_llave_de_proveedor'],
    accionDelDueno: 'Si caducan muchas sesiones a la vez, mirar el reloj del servidor y la vida del token antes que al usuario.',
    mensajeAlMedico: 'Tu sesión caducó. Vuelve a entrar; nada de lo tuyo se ha perdido.',
    permiteReintento: false,
    verificacion: 'Un inicio de sesión de prueba devuelve un token válido con la vida esperada.',
    rollback: null,
  },
  {
    id: 'RB-AUTORIZACION',
    titulo: 'Una acción se detuvo por falta de permiso',
    deteccion: { categoria: 'authorization' },
    accionesAutomaticas: [],
    accionesProhibidas: ['cambiar_permisos', 'copiar_datos_entre_consultorios'],
    accionDelDueno:
      'Decidir si es un permiso mal puesto (lo arregla quien administra el consultorio) ' +
      'o un defecto de la ruta (lo arregla el código). Nunca ampliar permisos para que pase.',
    mensajeAlMedico: 'Esta acción no está permitida con tu perfil. No se cambió ningún dato.',
    permiteReintento: false,
    verificacion: 'La misma acción con el perfil correcto pasa, y con el perfil de antes sigue sin pasar.',
    rollback: null,
  },
  {
    id: 'RB-NAVEGADOR',
    titulo: 'Algo falló en el navegador del médico',
    deteccion: { categoria: 'browser_runtime' },
    accionesAutomaticas: ['reiniciar_estado_de_cliente', 'invalidar_cache_caduca'],
    accionesProhibidas: ['borrar_encuentro'],
    accionDelDueno: 'Si se concentra en una versión de navegador, es compatibilidad y no una caída.',
    mensajeAlMedico: 'Algo falló en el navegador. Recarga la página; tu nota está guardada en este dispositivo.',
    permiteReintento: true,
    verificacion: 'La pantalla vuelve a montar y el borrador local sigue completo tras recargar.',
    rollback: null,
  },
  {
    id: 'RB-API',
    titulo: 'Una ruta de API no completó la acción',
    deteccion: { categoria: 'api' },
    accionesAutomaticas: ['reintento_idempotente'],
    accionesProhibidas: ['cambiar_permisos', 'desplegar_correccion'],
    accionDelDueno: 'Distinguir 5xx (nuestro) de 4xx repetido (contrato roto entre cliente y ruta).',
    mensajeAlMedico: 'No pude completar esta acción. Lo que ya estaba guardado sigue guardado.',
    permiteReintento: true,
    verificacion: 'La misma petición vuelve con 2xx y el efecto esperado está escrito al releer.',
    rollback: 'Ninguno: el reintento va con clave de idempotencia.',
  },
  {
    id: 'RB-DESCONOCIDO',
    titulo: 'Error repetido que todavía no está clasificado',
    deteccion: { categoria: 'unknown' },
    /**
     * Nada automático. Un error sin clasificar es un error del que no se sabe si
     * es reversible; `remediacion.ts` ya lo pararía por `desconocida`, y este
     * runbook lo dice también para que quien lo lea no lo busque.
     */
    accionesAutomaticas: [],
    accionesProhibidas: ['desplegar_correccion'],
    accionDelDueno: 'Clasificarlo. Un incidente sin categoría no tiene runbook y por eso no puede repararse solo.',
    mensajeAlMedico: 'Algo falló y todavía no sé qué. Comprueba el estado antes de repetir la acción.',
    permiteReintento: false,
    verificacion: 'Existe una categoría y un subtipo para esta firma, y el runbook que le toca.',
    rollback: null,
  },
]

/** Categorías sin runbook propio. Vacío = todas cubiertas. Lo consume su prueba. */
export function categoriasSinRunbook(categorias: readonly CategoriaIncidente[]): CategoriaIncidente[] {
  const conRunbook = new Set(RUNBOOKS.map(r => r.deteccion.categoria))
  return categorias.filter(c => !conRunbook.has(c))
}

/** El runbook de un incidente. El más específico gana: subtipo antes que categoría. */
export function runbookPara(categoria: CategoriaIncidente, subtipo?: string): Runbook {
  const dela = RUNBOOKS.filter(r => r.deteccion.categoria === categoria)
  const conSubtipo = subtipo ? dela.find(r => r.deteccion.subtipos?.includes(subtipo)) : undefined
  return conSubtipo
    ?? dela.find(r => !r.deteccion.subtipos)
    ?? RUNBOOKS.find(r => r.id === 'RB-DESCONOCIDO')!
}

/**
 * Comprueba que todo runbook cite acciones que EXISTEN en el catálogo.
 *
 * Lo consume su prueba: es la diferencia entre un runbook y un documento con
 * buenas intenciones. Devuelve la lista de problemas; vacía = coherente.
 */
export function incoherenciasDeRunbooks(): string[] {
  const problemas: string[] = []
  for (const r of RUNBOOKS) {
    for (const clave of [...r.accionesAutomaticas, ...r.accionesProhibidas]) {
      if (!accion(clave)) problemas.push(`${r.id} cita «${clave}», que no está en el catálogo de remediación`)
    }
    if (r.accionesAutomaticas.length > 0 && !r.permiteReintento) {
      problemas.push(`${r.id} autoriza acciones automáticas pero declara que no admite reintento`)
    }
    if (!r.verificacion.trim()) problemas.push(`${r.id} no declara cómo se verifica que se arregló`)
  }
  return problemas
}

export const POR_QUE_EL_PASO_DE_VERIFICACION_ES_OBLIGATORIO =
  'Porque sin él «se reintentó» se lee como «se arregló», y así es como un ' +
  'incidente se cierra estando vivo. La regla ya existe en este repositorio con ' +
  'otro nombre: el dato tiene que LLEGAR. Mirar del otro lado no es opcional ' +
  'cuando se está declarando que algo se recuperó.'
