/**
 * QUÉ PUEDE ARREGLARSE SOLO — y la lista de lo que NO, que es la que importa.
 *
 * ── LA INSTRUCCIÓN DEL DUEÑO, LITERAL ────────────────────────────────────────
 *
 * «Que se recupere automáticamente cuando sea SEGURO.» Y a renglón seguido: no
 * un sistema que se autoedite el código, no un agente con permiso para hacer
 * cualquier cosa, no reintentos infinitos, **no auto-reparación de contenido
 * clínico**.
 *
 * ── POR QUÉ LA LISTA BLANCA ES LA ÚNICA FORMA ────────────────────────────────
 *
 * Una lista de acciones prohibidas siempre va por detrás: el día que alguien
 * añade `borrarBorradorHuerfano` nadie la ha prohibido, así que está permitida.
 * Aquí una acción que no está en el catálogo **no existe**, y una acción del
 * catálogo que no declara todas sus banderas tampoco se ejecuta.
 *
 * Es la misma decisión que tomó `observability/evento.ts` en #342 con los campos
 * de telemetría, por la misma razón, aplicada a lo que el sistema puede HACER en
 * vez de a lo que puede DECIR.
 *
 * ── LA REGLA 3 DE SEGURIDAD CLÍNICA, DICHA EN ESTE IDIOMA ────────────────────
 *
 * «Nada cambia en silencio.» Una remediación automática es, por definición, un
 * cambio que nadie pidió. Por eso sólo puede tocar lo que se puede DESHACER y lo
 * que, repetido, deja el mismo estado. Todo lo demás es una edición que alguien
 * le hizo al trabajo del médico sin decírselo.
 *
 * Módulo PURO. No ejecuta nada: decide.
 */
import type { CategoriaIncidente, DimensionesIncidente } from './taxonomia'

/**
 * Una acción de reparación, con TODAS sus banderas declaradas.
 *
 * Ninguna es opcional a propósito: un `?` en cualquiera de ellas convertiría
 * «no lo declaré» en «false», y `false` en estas banderas significa «seguro».
 * Aquí no se adivina.
 */
export interface AccionRemediacion {
  readonly clave: string
  readonly descripcion: string
  /** ¿Se puede deshacer lo que hizo? */
  readonly reversible: boolean
  /** ¿Repetirla deja el mismo estado final? */
  readonly idempotente: boolean
  /** ¿Toca el expediente, la nota, la orden o el resultado? */
  readonly tocaVerdadClinica: boolean
  /** ¿Toca algo ya firmado? */
  readonly tocaDocumentoFirmado: boolean
  readonly cambiaDiagnosticoOTratamiento: boolean
  readonly cambiaPermisos: boolean
  readonly rotaSecretos: boolean
  /** ¿Mueve dinero? */
  readonly cobraOReembolsa: boolean
  readonly destruyeDatos: boolean
  /** ¿Implica contratar o gastar? */
  readonly implicaGasto: boolean
  readonly cruzaInquilinos: boolean
  /** ¿Vive entera en el navegador y no escribe en el servidor? */
  readonly soloCliente: boolean
}

/**
 * EL CATÁLOGO. Lo que no está aquí, no se ejecuta.
 *
 * Las de arriba PUEDEN ser elegibles; las de abajo están declaradas justo para
 * que `puedeAutoRepararse()` tenga que decir que no a algo concreto, y para que
 * exista una prueba que lo compruebe. Una prohibición que no se puede probar es
 * una intención.
 */
export const CATALOGO: readonly AccionRemediacion[] = [
  // ── Candidatas legítimas ──────────────────────────────────────────────────
  {
    clave: 'reintento_idempotente',
    descripcion: 'Repetir una operación con clave de idempotencia, con presupuesto finito.',
    reversible: true, idempotente: true, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'reencolar_trabajo_diferido',
    descripcion: 'Devolver a la cola un trabajo asíncrono duradero que no llegó a ejecutarse.',
    reversible: true, idempotente: true, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'reconectar',
    descripcion: 'Rehacer una conexión caída (escucha de Firestore, canal de voz).',
    reversible: true, idempotente: true, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: true,
  },
  {
    clave: 'refrescar_token_tecnico',
    descripcion:
      'Renovar el token de sesión con el mecanismo de refresco que YA existe. ' +
      'No es rotar un secreto: es usar la renovación prevista, con el mismo alcance.',
    reversible: true, idempotente: true, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: true,
  },
  {
    clave: 'respaldo_de_proveedor_autorizado',
    descripcion:
      'Pasar al proveedor de respaldo YA autorizado para esa tarea. No elige ' +
      'proveedor nuevo ni contrata nada: usa el que el dueño ya aprobó.',
    reversible: true, idempotente: true, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'reiniciar_estado_de_cliente',
    descripcion: 'Volver a montar un componente o rehacer estado que sólo vive en el navegador.',
    reversible: true, idempotente: true, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: true,
  },
  {
    clave: 'invalidar_cache_caduca',
    descripcion: 'Tirar una caché de lectura para forzar relectura desde la fuente.',
    reversible: true, idempotente: true, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: true,
  },
  {
    clave: 'reabrir_flujo_no_destructivo',
    descripcion: 'Reabrir un stream de lectura (transcripción en vivo) sin descartar lo recibido.',
    reversible: true, idempotente: true, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: true,
  },
  {
    clave: 'reintentar_notificacion',
    descripcion:
      'Reintentar el envío de una notificación ya redactada, sin tocar la cita. ' +
      'La cita quedó guardada: el mensaje es lo único que falló.',
    reversible: true, idempotente: true, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },

  // ── Prohibidas SIEMPRE. Están aquí para poder decirles que no con nombre ──
  {
    clave: 'editar_receta',
    descripcion: 'Cambiar una receta.',
    reversible: false, idempotente: false, tocaVerdadClinica: true, tocaDocumentoFirmado: true,
    cambiaDiagnosticoOTratamiento: true, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'editar_nota_firmada',
    descripcion: 'Modificar una nota ya firmada.',
    reversible: false, idempotente: false, tocaVerdadClinica: true, tocaDocumentoFirmado: true,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'aceptar_diagnostico_sugerido',
    descripcion: 'Confirmar un diagnóstico que la IA sugirió.',
    reversible: false, idempotente: false, tocaVerdadClinica: true, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: true, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'borrar_encuentro',
    descripcion: 'Eliminar un encuentro que quedó a medias.',
    reversible: false, idempotente: false, tocaVerdadClinica: true, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: true, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'cambiar_permisos',
    descripcion: 'Ajustar permisos o reglas de acceso para que la operación pase.',
    reversible: false, idempotente: false, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: true, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'rotar_llave_de_proveedor',
    descripcion: 'Generar y publicar una llave de API nueva.',
    reversible: false, idempotente: false, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: true,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'recargar_saldo_de_proveedor',
    descripcion: 'Comprar saldo en el proveedor para que la IA vuelva.',
    reversible: false, idempotente: false, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: true, destruyeDatos: false, implicaGasto: true, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'reembolsar_cobro',
    descripcion: 'Devolver un cobro que quedó en un estado raro.',
    reversible: false, idempotente: false, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: true, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
  {
    clave: 'copiar_datos_entre_consultorios',
    descripcion: 'Mover o replicar datos de un consultorio a otro para «reparar» una lectura.',
    reversible: false, idempotente: false, tocaVerdadClinica: true, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: true,
    soloCliente: false,
  },
  {
    clave: 'desplegar_correccion',
    descripcion: 'Publicar código nuevo a producción por su cuenta.',
    reversible: false, idempotente: false, tocaVerdadClinica: false, tocaDocumentoFirmado: false,
    cambiaDiagnosticoOTratamiento: false, cambiaPermisos: false, rotaSecretos: false,
    cobraOReembolsa: false, destruyeDatos: false, implicaGasto: false, cruzaInquilinos: false,
    soloCliente: false,
  },
]

const POR_CLAVE = new Map(CATALOGO.map(a => [a.clave, a]))

/** Busca una acción del catálogo. `undefined` = no existe, y eso ya es un «no». */
export function accion(clave: string): AccionRemediacion | undefined {
  return POR_CLAVE.get(clave)
}

/** Lo mínimo que hace falta saber del incidente para decidir. */
export interface IncidenteParaDecidir {
  readonly categoria: CategoriaIncidente
  readonly dimensiones: DimensionesIncidente
  /** ¿La operación afectada tiene garantía de idempotencia AHORA? */
  readonly idempotenciaGarantizada?: boolean
}

export type ReglaDeNegativa =
  | 'accion_desconocida'
  | 'accion_irreversible'
  | 'accion_no_idempotente'
  | 'toca_verdad_clinica'
  | 'toca_documento_firmado'
  | 'cambia_diagnostico_o_tratamiento'
  | 'cambia_permisos'
  | 'rota_secretos'
  | 'mueve_dinero'
  | 'destruye_datos'
  | 'implica_gasto'
  | 'cruza_inquilinos'
  | 'categoria_de_seguridad'
  | 'incidente_irreversible'
  | 'no_se_arregla_reintentando'
  | 'sin_garantia_de_idempotencia'

export interface Decision {
  readonly permitida: boolean
  /** Todas las reglas que dijeron que no, no sólo la primera. */
  readonly reglas: readonly ReglaDeNegativa[]
  /** Una frase para el registro y para la consola. */
  readonly porQue: string
}

/**
 * ¿Puede este incidente repararse solo con esta acción?
 *
 * **La respuesta por omisión es NO.** Se llega al `true` sólo después de que
 * todas las puertas hayan dicho que sí; cualquier duda —una acción que no está
 * en el catálogo, una reversibilidad `desconocida`, una idempotencia que se
 * exige y nadie garantiza— cae al lado seguro.
 */
export function puedeAutoRepararse(inc: IncidenteParaDecidir, claveAccion: string): Decision {
  const a = accion(claveAccion)
  if (!a) {
    return {
      permitida: false,
      reglas: ['accion_desconocida'],
      porQue: `«${String(claveAccion).slice(0, 40)}» no está en el catálogo. Lo que no está declarado no se ejecuta.`,
    }
  }

  const reglas: ReglaDeNegativa[] = []

  // Propiedades de la ACCIÓN.
  if (!a.reversible) reglas.push('accion_irreversible')
  if (!a.idempotente) reglas.push('accion_no_idempotente')
  if (a.tocaVerdadClinica) reglas.push('toca_verdad_clinica')
  if (a.tocaDocumentoFirmado) reglas.push('toca_documento_firmado')
  if (a.cambiaDiagnosticoOTratamiento) reglas.push('cambia_diagnostico_o_tratamiento')
  if (a.cambiaPermisos) reglas.push('cambia_permisos')
  if (a.rotaSecretos) reglas.push('rota_secretos')
  if (a.cobraOReembolsa) reglas.push('mueve_dinero')
  if (a.destruyeDatos) reglas.push('destruye_datos')
  if (a.implicaGasto) reglas.push('implica_gasto')
  if (a.cruzaInquilinos) reglas.push('cruza_inquilinos')

  // Propiedades del INCIDENTE.
  /**
   * Aislamiento, autorización y autenticación NO se reparan solos, ni siquiera
   * con una acción inocente. Ahí la reparación automática es peor que el fallo:
   * borra la señal. Un incidente de aislamiento que «se recuperó» es un
   * incidente de aislamiento que nadie va a investigar.
   */
  if (inc.categoria === 'tenant_isolation' || inc.categoria === 'authorization' || inc.categoria === 'auth') {
    reglas.push('categoria_de_seguridad')
  }
  if (inc.dimensiones.reversibilidad !== 'reversible') reglas.push('incidente_irreversible')
  if (inc.dimensiones.reintentabilidad === 'nunca') reglas.push('no_se_arregla_reintentando')
  if (inc.dimensiones.idempotencia === 'requerida' && inc.idempotenciaGarantizada !== true) {
    reglas.push('sin_garantia_de_idempotencia')
  }

  if (reglas.length) {
    return {
      permitida: false,
      reglas,
      porQue: `«${a.clave}» no puede ejecutarse sola: ${reglas.join(', ')}.`,
    }
  }
  return {
    permitida: true,
    reglas: [],
    porQue: `«${a.clave}» es reversible e idempotente, no toca verdad clínica ni permisos ni dinero, y el incidente admite reintento.`,
  }
}

/** Las que hoy podrían ejecutarse solas para un incidente dado. Para el runbook. */
export function accionesElegibles(inc: IncidenteParaDecidir): string[] {
  return CATALOGO.filter(a => puedeAutoRepararse(inc, a.clave).permitida).map(a => a.clave)
}

export const POR_QUE_LA_LISTA_ES_BLANCA_Y_NO_NEGRA =
  'Porque una lista de prohibiciones siempre llega tarde: el día que alguien ' +
  'escribe una acción nueva, nadie la ha prohibido todavía y por eso está ' +
  'permitida. Con lista blanca, la acción nueva no se ejecuta hasta que alguien ' +
  'la declara — y declararla obliga a contestar, una por una, las once ' +
  'preguntas que deciden si es segura.'
