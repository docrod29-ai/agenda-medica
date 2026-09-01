/**
 * CONSERVACIÓN Y ARCHIVO DEL EXPEDIENTE — estados, no un cron.
 *
 * ── LA LÍNEA QUE NO SE CRUZA ─────────────────────────────────────────────────
 *
 * `src/lib/ops/retencion.ts` lo dice y sigue siendo verdad: cuánto tiempo se
 * conserva un expediente lo fijan la NOM-004 y el abogado del consultorio,
 * **no un cron**. Ese módulo barre datos OPERATIVOS de plataforma y tiene un
 * guardián que impide que aparezca una ruta de `clinics/{id}/…` en su lista.
 *
 * Este módulo NO lo cambia y NO lo extiende hacia lo clínico. Añade lo que #312
 * pide y allí no existe: un **ciclo de vida declarativo** para el expediente,
 * donde «se puede borrar» y «se borra» son dos cosas distintas separadas por una
 * decisión humana.
 *
 * ── LOS SEIS ESTADOS ─────────────────────────────────────────────────────────
 *
 *   ACTIVO               expediente en uso.
 *   ARCHIVADO            fuera del uso diario, íntegro y recuperable.
 *   REQUIERE_REVISION    algo impide decidir: falta fecha, falta consentimiento,
 *                        hay una solicitud ARCO abierta.
 *   RETENCION_LEGAL      hay un procedimiento. No se toca, pase lo que pase.
 *   RETENCION_CLINICA    el médico lo retiene por criterio clínico.
 *   ELEGIBLE_PARA_BORRADO  cumplió el plazo mínimo. **NO significa borrar.**
 *
 * ── LA REGLA MÁS IMPORTANTE DEL MÓDULO ───────────────────────────────────────
 *
 *     ELEGIBLE_PARA_BORRADO ≠ BORRAR
 *
 * Es un estado terminal de este motor. Lo que venga después —si es que viene
 * algo— es política del dueño y de su abogado, con un acto explícito, auditado,
 * acotado y con ventana de recuperación. Este módulo **no expone ninguna
 * función que borre**, y esa ausencia es el control.
 *
 * Módulo PURO. No mira el reloj: se le pasa el instante.
 */

export type EstadoDeConservacion =
  | 'ACTIVO'
  | 'ARCHIVADO'
  | 'REQUIERE_REVISION'
  | 'RETENCION_LEGAL'
  | 'RETENCION_CLINICA'
  | 'ELEGIBLE_PARA_BORRADO'

/**
 * Las retenciones GANAN a todo lo demás, en este orden.
 *
 * Una retención legal sobre un expediente que además cumplió el plazo mínimo
 * sigue siendo una retención legal. El orden no es estético: es el que impide
 * que un plazo cumplido se lea como permiso.
 */
export const PRECEDENCIA: readonly EstadoDeConservacion[] = [
  'RETENCION_LEGAL',
  'RETENCION_CLINICA',
  'REQUIERE_REVISION',
  'ELEGIBLE_PARA_BORRADO',
  'ARCHIVADO',
  'ACTIVO',
]

/** Lo que se sabe de un expediente a la hora de clasificarlo. */
export interface SituacionDelExpediente {
  /** Última actividad clínica registrada (ISO). `null` = no se sabe. */
  ultimaActividad: string | null
  /** Fecha de la última nota FIRMADA (ISO). Es la que cuenta para la NOM-004. */
  ultimaNotaFirmada: string | null
  /** Hay un procedimiento legal declarado sobre este expediente. */
  retencionLegal: boolean
  /** El médico lo retiene por criterio clínico, con su razón. */
  retencionClinica: string | null
  /** Hay una solicitud ARCO abierta. */
  arcoAbierta: boolean
  /** El consultorio lo marcó como archivado. */
  archivadoPorElConsultorio: boolean
}

export interface Clasificacion {
  estado: EstadoDeConservacion
  porQue: string
  /**
   * Qué haría falta para que este expediente pudiera pasar al siguiente estado.
   * Vacío cuando no hay siguiente estado posible sin una decisión del dueño.
   */
  queFaltaria: string
}

/**
 * Días mínimos de conservación que se usan para calcular la ELEGIBILIDAD.
 *
 * `null` a propósito: **este repositorio no fija el plazo**. La NOM-004 y el
 * abogado del consultorio lo fijan, y hasta que exista esa decisión escrita del
 * dueño ningún expediente puede llegar a `ELEGIBLE_PARA_BORRADO`.
 *
 * Poner aquí un número plausible —«cinco años», «diez años»— sería exactamente
 * el fallo que la regla de seguridad clínica llama el más caro posible: no
 * falla, no rompe una prueba, y decide sobre el expediente de alguien.
 * Se escribe `NEEDS_CLINICAL_REVIEW` y se sigue.
 */
export const DIAS_MINIMOS_DE_CONSERVACION: number | null = null

export const POR_QUE_NO_HAY_PLAZO =
  'NEEDS_CLINICAL_REVIEW — el plazo mínimo de conservación del expediente lo ' +
  'fija la NOM-004 y el abogado del consultorio, por jurisdicción y por tipo de ' +
  'documento. Falta: la decisión escrita del dueño con su fuente citada. Quién ' +
  'puede decidirlo: el dueño con asesoría legal. Mientras no exista, ningún ' +
  'expediente alcanza `ELEGIBLE_PARA_BORRADO` y este motor lo dice en vez de ' +
  'suponer un número redondo.'

/**
 * Clasifica un expediente. Determinista y sin efectos.
 *
 * @param ahoraMs el instante, inyectado. No se lee el reloj aquí para que la
 *   prueba pueda situarse donde quiera.
 * @param diasMinimos plazo mínimo, si el dueño ya lo fijó. Por omisión, el del
 *   módulo — que es `null`, o sea: no se puede llegar a elegible.
 */
export function clasificar(
  s: SituacionDelExpediente,
  ahoraMs: number,
  diasMinimos: number | null = DIAS_MINIMOS_DE_CONSERVACION,
): Clasificacion {
  if (s.retencionLegal) {
    return {
      estado: 'RETENCION_LEGAL',
      porQue: 'hay un procedimiento legal declarado sobre este expediente. Ninguna otra condición lo saca de aquí.',
      queFaltaria: 'que el dueño levante la retención legal, con constancia de quién y cuándo.',
    }
  }
  if (s.retencionClinica) {
    return {
      estado: 'RETENCION_CLINICA',
      porQue: `el médico lo retiene por criterio clínico: ${s.retencionClinica}`,
      queFaltaria: 'que el médico levante la retención clínica.',
    }
  }
  if (s.arcoAbierta) {
    return {
      estado: 'REQUIERE_REVISION',
      porQue: 'hay una solicitud ARCO abierta: el derecho del paciente se resuelve por su propio flujo, no por un ciclo de vida automático.',
      queFaltaria: 'resolver la solicitud ARCO y dejar su acuse.',
    }
  }

  const referencia = s.ultimaNotaFirmada ?? s.ultimaActividad
  const t = referencia ? Date.parse(referencia) : NaN
  if (!Number.isFinite(t)) {
    /**
     * Sin fecha legible NO se avanza. Es la misma regla de `ops/retencion.ts`
     * («sin fecha legible: ante la duda no se borra») y del barrido de audio.
     * Aquí no se borra nada nunca, pero un expediente sin fecha tampoco puede
     * pasar a archivado como si se supiera que está inactivo.
     */
    return {
      estado: 'REQUIERE_REVISION',
      porQue: 'no hay una fecha legible de última actividad clínica: no se puede afirmar que este expediente esté inactivo.',
      queFaltaria: 'una fecha de última nota firmada o de última actividad que se pueda leer.',
    }
  }

  if (diasMinimos === null) {
    return {
      estado: s.archivadoPorElConsultorio ? 'ARCHIVADO' : 'ACTIVO',
      porQue: s.archivadoPorElConsultorio
        ? 'el consultorio lo archivó: sigue íntegro y recuperable, sólo fuera del uso diario.'
        : 'expediente en uso.',
      queFaltaria: POR_QUE_NO_HAY_PLAZO,
    }
  }

  const dias = (ahoraMs - t) / 86_400_000
  if (dias >= diasMinimos) {
    return {
      estado: 'ELEGIBLE_PARA_BORRADO',
      porQue: `han pasado ${Math.floor(dias)} días desde la última actividad clínica y el plazo mínimo configurado es ${diasMinimos}. ELEGIBLE NO SIGNIFICA BORRAR: es el estado donde una persona decide.`,
      queFaltaria: 'una decisión explícita del dueño, con asesoría legal, acotada, auditada y con ventana de recuperación. Este motor no la puede tomar y no expone función para ejecutarla.',
    }
  }
  return {
    estado: s.archivadoPorElConsultorio ? 'ARCHIVADO' : 'ACTIVO',
    porQue: `${Math.floor(dias)} días desde la última actividad clínica; el plazo mínimo es ${diasMinimos}.`,
    queFaltaria: `esperar ${Math.ceil(diasMinimos - dias)} días más, y aun entonces sería sólo elegibilidad.`,
  }
}

/**
 * ¿Puede este estado llevar a un borrado?
 *
 * Se responde con dos booleanos y no con uno, porque son dos preguntas
 * distintas y confundirlas es el defecto: «cumple el plazo» y «se puede borrar»
 * no son lo mismo.
 */
export function permisoDeBorrado(estado: EstadoDeConservacion): {
  cumpleElPlazo: boolean
  autorizadoAborrar: false
  porQue: string
} {
  return {
    cumpleElPlazo: estado === 'ELEGIBLE_PARA_BORRADO',
    /**
     * SIEMPRE `false`, y el tipo lo fija literalmente para que no se pueda
     * cambiar por descuido: no existe ninguna combinación de estado que
     * autorice un borrado clínico desde código. La autorización es un acto del
     * dueño, fuera de este motor.
     */
    autorizadoAborrar: false,
    porQue: estado === 'ELEGIBLE_PARA_BORRADO'
      ? 'el expediente cumplió el plazo mínimo. Eso lo pone en la mesa de una persona, no en la cola de un barrido.'
      : `estado ${estado}: ni siquiera cumple el plazo.`,
  }
}

/** Una retención legal no se levanta desde aquí, y menos aún caduca sola. */
export function retencionLegalPuedeCaducar(): { puede: false; porQue: string } {
  return {
    puede: false,
    porQue:
      'Una retención legal existe porque hay un procedimiento abierto, y los ' +
      'procedimientos no caducan por antigüedad del expediente. Levantarla es ' +
      'un acto del dueño con constancia: si un plazo pudiera levantarla sola, ' +
      'la retención no sería una retención.',
  }
}

export const POR_QUE_ESTE_MODULO_NO_BORRA_NADA =
  'Un módulo de conservación que expone una función de borrado acaba conectado ' +
  'a un cron. La ausencia de esa función no es un descuido de alcance: es el ' +
  'control. Lo que este motor produce es un ESTADO, y el estado más avanzado ' +
  'que existe —elegible— sigue exigiendo que alguien con nombre decida.'
