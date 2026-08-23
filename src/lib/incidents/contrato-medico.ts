/**
 * LO QUE VE EL MÉDICO CUANDO ALGO FALLA — cuatro respuestas, siempre las mismas.
 *
 * ── LAS CUATRO PREGUNTAS ─────────────────────────────────────────────────────
 *
 *   1. ¿QUÉ falló?
 *   2. ¿Mi trabajo está a salvo?
 *   3. ¿Qué puedo seguir haciendo?
 *   4. ¿Tiene sentido reintentar?
 *
 * Con un paciente enfrente no hay una quinta. Y la segunda es la que de verdad
 * está preguntando, aunque el mensaje hable de otra cosa: `fallo-proveedor.ts`
 * ya lo aprendió el 31-jul y por eso TODOS sus textos terminan en «tu dictado
 * está guardado». Aquí ese aprendizaje se vuelve un CAMPO, `dataSafety`, para
 * que no se pueda escribir un mensaje que se olvide de contestarla.
 *
 * ── QUÉ SE REUTILIZA Y QUÉ SE AÑADE ──────────────────────────────────────────
 *
 * Para `ai_provider` el texto lo sigue redactando `avisoAlMedico()`, con su
 * distinción entre llave del consultorio y llave de la plataforma. Este módulo
 * **no lo reescribe**: lo envuelve y le añade los campos que el resto de
 * categorías también necesitan. Un segundo redactor de mensajes de IA sería otra
 * fuente de verdad para lo mismo.
 *
 * ── LA EXCEPCIÓN DEL AUTOGUARDADO ────────────────────────────────────────────
 *
 * Todas las demás caídas se cuentan bajito: la regla de
 * `ops/interrumpe-la-consulta.ts` es que con un paciente delante sólo entra lo
 * que impide atenderlo. El autoguardado es justo eso. Si deja de guardar y el
 * médico no se entera, sigue dictando veinte minutos sobre algo que no existe —
 * y lo descubre al cerrar. Por eso es la única categoría con visibilidad
 * `bloqueante` de fábrica.
 *
 * Módulo PURO.
 */
import { avisoAlMedico, type ClaseFallo, type QuienPaga } from '@/lib/ia/fallo-proveedor'
import type { CategoriaIncidente, DimensionesIncidente } from './taxonomia'

/**
 * Cuánto sitio ocupa el aviso en la pantalla.
 *
 * `silencioso` no es esconder el error: es anotarlo y no robarle la atención al
 * médico por algo que no le impide atender. La regla 3 de seguridad clínica
 * («nada cambia en silencio») habla de CORRECCIONES automáticas sobre lo que él
 * dictó, no de avisos; un fallo de notificación que se repara solo no cambia
 * nada suyo.
 */
export type Visibilidad = 'silencioso' | 'discreto' | 'franja' | 'bloqueante'

export interface EstadoParaElMedico {
  /** Titular corto. Lo que se lee de un vistazo. */
  readonly title: string
  /** Qué falló, en su idioma. Nunca el nombre del módulo ni el código HTTP. */
  readonly whatFailed: string
  /** LA pregunta. Nunca vacío: un contrato sin esta frase no compila el sentido. */
  readonly dataSafety: string
  /** Qué puede seguir haciendo ahora mismo. */
  readonly canContinue: string
  /** ¿Ofrecer botón de reintentar? Falso cuando reintentar no puede salir bien. */
  readonly retryAvailable: boolean
  /** ¿Hay un camino alterno ya disponible? */
  readonly fallbackAvailable: boolean
  /** ¿Ya está avisado quien puede arreglarlo? Sólo `true` si de verdad lo está. */
  readonly supportAlreadyNotified: boolean
  readonly visibilidad: Visibilidad
  /** ¿Merece cortar una consulta? Lo consume `ops/interrumpe-la-consulta.ts`. */
  readonly interrumpeConsulta: boolean
}

export interface ContextoDelMedico {
  readonly categoria: CategoriaIncidente
  readonly dimensiones: DimensionesIncidente
  /** ¿Existe modo limitado o proveedor de respaldo YA disponible? */
  readonly hayRespaldo?: boolean
  /** ¿El aviso al dueño/soporte salió de verdad? No se promete lo que no ocurrió. */
  readonly soporteAvisado?: boolean
  /** Sólo para `ai_provider`: se delega en `avisoAlMedico()`. */
  readonly ia?: { clase: ClaseFallo; quien: QuienPaga; proveedor?: 'anthropic' | 'openai' | 'assemblyai' }
}

/**
 * Frase de seguridad de datos por categoría.
 *
 * Nunca se dice «no se perdió nada» sin saberlo. Cuando el estado del dato es
 * dudoso —una escritura que pudo llegar o no— se dice exactamente eso, porque
 * un médico que sabe que hay duda revisa, y uno al que se le prometió que todo
 * estaba bien no revisa.
 */
const SEGURIDAD: Record<CategoriaIncidente, string> = {
  ui:               'Tu nota y tu dictado siguen guardados en este dispositivo.',
  api:              'Lo que ya se había guardado sigue guardado. Esta acción concreta no se completó.',
  auth:             'Nada de lo tuyo se ha perdido. Vuelve a entrar y lo encontrarás donde lo dejaste.',
  authorization:    'No se cambió ningún dato. La acción se detuvo antes de escribir.',
  tenant_isolation: 'La operación se detuvo. No se escribió nada y el caso ya está en revisión.',
  persistence:      'ATENCIÓN: no se pudo confirmar el guardado. Tu texto sigue en pantalla — no cierres sin comprobar que aparece guardado.',
  autosave:         'ATENCIÓN: el guardado automático dejó de funcionar. Tu texto sigue en pantalla y en este dispositivo, pero NO está en el servidor.',
  scheduling:       'La agenda no cambió. Ninguna cita se creó ni se movió a medias.',
  transcription:    'El audio está guardado. La transcripción se puede repetir sobre el mismo material.',
  ai_provider:      'Tu dictado está guardado.',
  ai_reasoning:     'Tu nota sigue editable y guardada. Sólo faltó la parte que redacta la IA.',
  evidence:         'Tu nota sigue editable y guardada. Sólo faltó la consulta de evidencia.',
  payment:          'El cobro no se duplicó. Si aparece dos veces, avísanos antes de volver a intentarlo.',
  notification:     'La cita sigue guardada; sólo falló el mensaje al paciente.',
  network:          'Tu trabajo sigue en este dispositivo. Se enviará cuando vuelva la conexión.',
  browser_runtime:  'Tu nota y tu dictado siguen guardados en este dispositivo.',
  unknown:          'No se pudo confirmar qué pasó con esta acción. Tu texto sigue en pantalla: compruébalo antes de cerrar.',
}

const QUE_FALLO: Record<CategoriaIncidente, string> = {
  ui:               'Una parte de la pantalla no se pudo mostrar.',
  api:              'No pude completar esta acción en el servidor.',
  auth:             'Tu sesión caducó.',
  authorization:    'Esta acción no está permitida con tu perfil.',
  tenant_isolation: 'Se detuvo una operación por una comprobación de seguridad.',
  persistence:      'No pude confirmar el guardado en el servidor.',
  autosave:         'El guardado automático no está funcionando.',
  scheduling:       'No pude completar el cambio en la agenda.',
  transcription:    'No pude transcribir el audio ahora.',
  ai_provider:      'El servicio de IA no está disponible.',
  ai_reasoning:     'No pude redactar la nota ahora.',
  evidence:         'No pude consultar evidencia ahora.',
  payment:          'No pude confirmar el cobro.',
  notification:     'No se pudo enviar el mensaje al paciente.',
  network:          'Se perdió la conexión.',
  browser_runtime:  'Algo falló en el navegador.',
  unknown:          'Algo falló y todavía no sé qué.',
}

const CONTINUAR: Record<CategoriaIncidente, string> = {
  ui:               'Puedes seguir con el resto de la consulta.',
  api:              'Puedes seguir escribiendo; vuelve a intentar la acción en un momento.',
  auth:             'Vuelve a entrar para continuar.',
  authorization:    'Pide acceso a quien administra el consultorio.',
  tenant_isolation: 'No repitas la acción. Ya está avisado quien tiene que revisarlo.',
  persistence:      'Copia tu texto antes de cerrar y vuelve a intentar guardar.',
  autosave:         'Guarda a mano ahora y no cierres la pestaña hasta verlo guardado.',
  scheduling:       'Vuelve a intentarlo; si el hueco se ocupó, elige otro.',
  transcription:    'Puedes escribir la nota mientras tanto; el audio no se pierde.',
  ai_provider:      'Puedes seguir escribiendo la nota a mano.',
  ai_reasoning:     'Puedes seguir escribiendo la nota a mano.',
  evidence:         'Puedes seguir con la nota y consultar evidencia más tarde.',
  payment:          'No vuelvas a cobrar sin comprobar antes si el cargo salió.',
  notification:     'Confirma la cita por teléfono si te urge.',
  network:          'Sigue trabajando; se enviará solo cuando vuelva la conexión.',
  browser_runtime:  'Recarga la página; tu nota está guardada en este dispositivo.',
  unknown:          'Comprueba el estado antes de repetir la acción.',
}

/** Sólo el autoguardado y el aislamiento se ponen delante del médico de fábrica. */
function visibilidadDe(c: CategoriaIncidente, d: DimensionesIncidente): Visibilidad {
  if (c === 'autosave') return 'bloqueante'
  if (c === 'persistence' || d.impacto === 'riesgo_de_perdida') return 'franja'
  if (c === 'tenant_isolation') return 'franja'
  if (d.impacto === 'bloquea_tarea') return 'franja'
  if (d.impacto === 'degradado') return 'discreto'
  return 'silencioso'
}

/**
 * El estado que ve el médico.
 *
 * Para `ai_provider` con contexto de IA, el texto sale de `avisoAlMedico()` —el
 * módulo que ya sabe no echarle la culpa cuando la llave es de la plataforma— y
 * aquí sólo se le añaden los campos que faltaban.
 */
export function estadoParaElMedico(ctx: ContextoDelMedico): EstadoParaElMedico {
  const { categoria, dimensiones } = ctx
  const hayRespaldo = ctx.hayRespaldo === true
  const soporteAvisado = ctx.soporteAvisado === true

  if (categoria === 'ai_provider' && ctx.ia) {
    const a = avisoAlMedico(ctx.ia.clase, ctx.ia.quien, ctx.ia.proveedor ?? 'anthropic')
    return {
      title: 'La IA no está disponible',
      whatFailed: a.texto,
      dataSafety: SEGURIDAD.ai_provider,
      canContinue: hayRespaldo
        ? 'Puedes seguir con el modo limitado, o escribir la nota a mano.'
        : CONTINUAR.ai_provider,
      retryAvailable: a.reintentar,
      fallbackAvailable: hayRespaldo,
      /**
       * `avisoAlMedico` promete «ya avisamos a soporte» sólo con llave de
       * plataforma. Aquí no se repite la promesa por costumbre: se dice que
       * está avisado cuando el llamador confirma que el aviso salió.
       */
      supportAlreadyNotified: soporteAvisado,
      visibilidad: visibilidadDe(categoria, dimensiones),
      interrumpeConsulta: true,   // sin IA no se puede documentar: eso sí impide atender
    }
  }

  const reintentar = dimensiones.reintentabilidad !== 'nunca'
  return {
    title: QUE_FALLO[categoria] ?? QUE_FALLO.unknown,
    whatFailed: QUE_FALLO[categoria] ?? QUE_FALLO.unknown,
    dataSafety: SEGURIDAD[categoria] ?? SEGURIDAD.unknown,
    canContinue: hayRespaldo
      ? `${CONTINUAR[categoria] ?? CONTINUAR.unknown} Hay un modo limitado disponible.`
      : (CONTINUAR[categoria] ?? CONTINUAR.unknown),
    retryAvailable: reintentar,
    fallbackAvailable: hayRespaldo,
    supportAlreadyNotified: soporteAvisado,
    visibilidad: visibilidadDe(categoria, dimensiones),
    /**
     * Sólo interrumpe lo que impide atender AHORA. Un fallo de notificación o de
     * cobro espera a que salga de la consulta — es la lección del 5-ago que ya
     * está escrita en `ops/interrumpe-la-consulta.ts`.
     */
    interrumpeConsulta:
      categoria === 'autosave' || categoria === 'persistence' ||
      dimensiones.impacto === 'riesgo_de_perdida' || dimensiones.impacto === 'riesgo_clinico',
  }
}

/** Las categorías cubiertas. Un guardián comprueba que no falte ninguna. */
export function categoriasConTexto(): CategoriaIncidente[] {
  return Object.keys(SEGURIDAD) as CategoriaIncidente[]
}

export const POR_QUE_DATASAFETY_ES_UN_CAMPO_Y_NO_UNA_COSTUMBRE =
  'Porque la pregunta que el médico se está haciendo no es «qué falló» sino ' +
  '«¿perdí lo que llevo dictado?». `fallo-proveedor.ts` lo aprendió el 31-jul y ' +
  'terminó todos sus textos con «tu dictado está guardado». Una costumbre se ' +
  'olvida en el mensaje número doce; un campo obligatorio no.'
