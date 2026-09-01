/**
 * CONTINUIDAD DE LA CONSULTA EN CURSO — el punto seguro, y decirlo.
 *
 * ── QUÉ HAY YA EN ESTE REPOSITORIO (auditado, no supuesto) ───────────────────
 *
 * En `consulta/[patientId]/page.tsx`:
 *
 *  · **autoguardado al servidor cada 30 s**, con el intervalo armado UNA vez y
 *    leyendo un ref — porque atarlo a las dependencias hacía que dictando sin
 *    pausas no disparara nunca;
 *  · **guardado serializado**: cada guardado espera al anterior, así que dos
 *    autoguardados no crean la nota dos veces;
 *  · **control de escritura rancia**: `vistoEnRef` lleva la
 *    `metadata.fechaModificacion` que ESTA pestaña vio, y `updateNota` se niega
 *    si en Firestore hay otra. Dos pestañas ya no se pisan;
 *  · **red local anti-caída**: copia ofuscada en `localStorage`
 *    (`nx.consulta.bkp.{paciente}[.h.{episodio}]`), con pestillo
 *    anti-resurrección tras cerrar sesión;
 *  · **cierre de sesión con acuse**: `salir-seguro` espera la promesa de
 *    guardado de verdad y, si no se confirma, **no purga lo local**.
 *
 * Eso es más de lo que tienen casi todos. Lo que falta es lo que #312 pide con
 * estas palabras: **«visible last-safe checkpoint»**.
 *
 * ── LO QUE FALTA, Y POR QUÉ IMPORTA ──────────────────────────────────────────
 *
 * Hoy la pantalla enseña un botón «Guardar borrador» que gira mientras guarda.
 * Al médico eso le dice que ALGO está pasando ahora. No le dice lo único que
 * necesita saber cuando se le va el wifi a media consulta:
 *
 *     ¿qué es lo último que quedó a salvo, y a qué hora?
 *
 * Sin esa frase, el médico no puede decidir si sigue dictando o si para y
 * apunta en papel. Y cuando el autoguardado lleva cuatro minutos fallando
 * porque la red se cayó, la pantalla se ve exactamente igual que cuando todo va
 * bien. Un guardado que falla en silencio es peor que uno que no existe: el
 * médico confía en él.
 *
 * ── QUÉ ES ESTE MÓDULO ───────────────────────────────────────────────────────
 *
 * La **máquina de estados pura** del punto seguro. Decide qué se le enseña al
 * médico a partir de hechos comprobables, sin tocar la interfaz. La interfaz es
 * de #306: el traspaso exacto está en
 * `docs/recovery/HANDOFF-306-AUTOGUARDADO.md`.
 *
 * Módulo PURO. Se le pasa el instante; no lee el reloj.
 */

/** Dónde está a salvo el trabajo, de más seguro a menos. */
export type DondeEstaSalvo =
  /** En Firestore, confirmado. Sobrevive a que se apague el equipo. */
  | 'servidor'
  /** Sólo en el navegador. Sobrevive a un refresco y a un cuelgue; no al equipo. */
  | 'este-navegador'
  /** En ninguna parte todavía. */
  | 'en-ninguna-parte'

export type EstadoDelPuntoSeguro =
  | 'al-dia'
  | 'guardando'
  /** Hay cambios sin guardar y el último intento fue bien. Normal entre ticks. */
  | 'pendiente'
  /** El último intento falló. Hay trabajo que sólo existe aquí. */
  | 'sin-confirmar'
  /** Falla desde hace tanto que el médico tiene que enterarse SÍ o SÍ. */
  | 'en-riesgo'
  /** Otra pestaña o dispositivo escribió: no se puede guardar sin decidir. */
  | 'conflicto'

/** Los hechos con los que se decide. Todos comprobables desde la pantalla. */
export interface HechosDelGuardado {
  /** Instante del último guardado CONFIRMADO por el servidor (ms). */
  ultimoConfirmadoEnServidorMs: number | null
  /** Instante de la última copia local escrita (ms). */
  ultimaCopiaLocalMs: number | null
  /** Instante del último cambio del médico (ms). */
  ultimoCambioMs: number | null
  /** Hay un guardado en vuelo ahora mismo. */
  guardandoAhora: boolean
  /** Intentos de guardado al servidor fallidos seguidos. */
  fallosSeguidos: number
  /** El servidor rechazó por escritura rancia: alguien más escribió. */
  conflictoDeVersion: boolean
  /** La nota ya está firmada: deja de haber borrador que guardar. */
  firmada: boolean
}

export interface PuntoSeguro {
  estado: EstadoDelPuntoSeguro
  dondeEstaSalvo: DondeEstaSalvo
  /** Antigüedad del punto seguro más fuerte, en ms. `null` si no hay ninguno. */
  antiguedadMs: number | null
  /**
   * La frase para el médico. Se genera aquí para que diga lo mismo en todas las
   * pantallas y para que se pueda probar sin montar una interfaz.
   */
  frase: string
  /** `true` si hay que enseñarlo de forma que no se pueda pasar por alto. */
  exigeAtencion: boolean
}

/**
 * Cuántos fallos seguidos antes de avisar fuerte.
 *
 * Tres, con el intervalo de 30 s, son 90 segundos de dictado que sólo existen
 * en esta pestaña. Menos avisaría por cada bache de red del consultorio; más
 * deja al médico dictando cinco minutos sobre nada.
 */
export const FALLOS_ANTES_DE_AVISAR = 3

/**
 * Cuánto puede tener el punto seguro antes de decirlo aunque no haya fallado
 * nada. Dos minutos: cuatro ticks de autoguardado. Si el punto seguro tiene más
 * de eso sin que nadie haya reportado un fallo, algo no está corriendo.
 */
export const ANTIGUEDAD_QUE_PREOCUPA_MS = 120_000

function comoHace(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `hace ${s} s`
  const m = Math.round(s / 60)
  return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`
}

/** Calcula el punto seguro. Determinista. */
export function calcularPuntoSeguro(h: HechosDelGuardado, ahoraMs: number): PuntoSeguro {
  if (h.firmada) {
    return {
      estado: 'al-dia', dondeEstaSalvo: 'servidor', antiguedadMs: null,
      frase: 'Nota firmada. Ya no hay borrador que guardar.', exigeAtencion: false,
    }
  }

  const enServidor = h.ultimoConfirmadoEnServidorMs
  const enLocal = h.ultimaCopiaLocalMs
  const dondeEstaSalvo: DondeEstaSalvo = enServidor !== null ? 'servidor'
    : enLocal !== null ? 'este-navegador' : 'en-ninguna-parte'
  const referencia = enServidor ?? enLocal
  const antiguedadMs = referencia === null ? null : Math.max(0, ahoraMs - referencia)

  /**
   * ── EL CONFLICTO GANA A TODO ─────────────────────────────────────────────
   *
   * `updateNota` se niega cuando otra pestaña escribió. Eso NO es un fallo de
   * red que se reintente solo: es una decisión que sólo puede tomar el médico
   * (qué versión vale). Enseñarlo como «guardando…» sería mentir dos veces:
   * ni está guardando, ni se va a arreglar solo.
   */
  if (h.conflictoDeVersion) {
    return {
      estado: 'conflicto', dondeEstaSalvo, antiguedadMs,
      frase: antiguedadMs === null
        ? 'Otra pestaña o dispositivo cambió esta nota. Lo que escribas aquí no se está guardando.'
        : `Otra pestaña o dispositivo cambió esta nota. Lo último a salvo aquí es de ${comoHace(antiguedadMs)}; lo que escribas ahora no se está guardando.`,
      exigeAtencion: true,
    }
  }

  if (h.fallosSeguidos >= FALLOS_ANTES_DE_AVISAR) {
    return {
      estado: 'en-riesgo', dondeEstaSalvo, antiguedadMs,
      frase: dondeEstaSalvo === 'servidor' && antiguedadMs !== null
        ? `Sin conexión con el servidor. Lo último a salvo allí es de ${comoHace(antiguedadMs)}; lo de después sólo está en este navegador.`
        : 'Sin conexión con el servidor, y todavía no hay nada guardado allí. Lo escrito sólo existe en este navegador: no cierres esta pestaña.',
      exigeAtencion: true,
    }
  }

  if (h.guardandoAhora) {
    return {
      estado: 'guardando', dondeEstaSalvo, antiguedadMs,
      frase: 'Guardando…', exigeAtencion: false,
    }
  }

  if (h.fallosSeguidos > 0) {
    return {
      estado: 'sin-confirmar', dondeEstaSalvo, antiguedadMs,
      frase: antiguedadMs === null
        ? 'El último guardado no se pudo confirmar. Lo escrito está sólo en este navegador.'
        : `El último guardado no se pudo confirmar. A salvo en el servidor: ${comoHace(antiguedadMs)}.`,
      exigeAtencion: false,
    }
  }

  if (antiguedadMs !== null && antiguedadMs > ANTIGUEDAD_QUE_PREOCUPA_MS) {
    return {
      estado: 'en-riesgo', dondeEstaSalvo, antiguedadMs,
      frase: `Lo último a salvo en el servidor es de ${comoHace(antiguedadMs)} y no ha vuelto a guardarse. Guarda a mano antes de seguir.`,
      exigeAtencion: true,
    }
  }

  const hayCambios = h.ultimoCambioMs !== null && referencia !== null && h.ultimoCambioMs > referencia
  if (hayCambios) {
    return {
      estado: 'pendiente', dondeEstaSalvo, antiguedadMs,
      frase: antiguedadMs === null ? 'Cambios sin guardar.' : `A salvo ${comoHace(antiguedadMs)}. Hay cambios más nuevos sin guardar.`,
      exigeAtencion: false,
    }
  }

  return {
    estado: 'al-dia', dondeEstaSalvo, antiguedadMs,
    frase: antiguedadMs === null ? 'Sin cambios.' : `A salvo en el servidor ${comoHace(antiguedadMs)}.`,
    exigeAtencion: false,
  }
}

/** Sucesos que la consulta tiene que sobrevivir, con lo que se espera de cada uno. */
export interface SucesoDeContinuidad {
  suceso: string
  queLoProtegeHoy: string
  queSeEsperaQueSobreviva: string
  /** `true` si hoy hay código que lo cubre; `false` si es un hueco. */
  cubiertoHoy: boolean
}

/**
 * El catálogo, auditado contra el código de este repositorio.
 *
 * No es una lista de buenas intenciones: cada línea dice qué archivo lo cubre, y
 * las que dicen `cubiertoHoy: false` son el traspaso a #306.
 */
export const SUCESOS_DE_CONTINUIDAD: SucesoDeContinuidad[] = [
  {
    suceso: 'refresco accidental de la pestaña',
    queLoProtegeHoy: 'copia local ofuscada en `localStorage` (`nx.consulta.bkp.…`), escrita con retardo desde la propia consulta.',
    queSeEsperaQueSobreviva: 'todo lo dictado y escrito desde el último autoguardado.',
    cubiertoHoy: true,
  },
  {
    suceso: 'cuelgue del navegador o del equipo',
    queLoProtegeHoy: 'la misma copia local; sobrevive porque se escribe antes de que el proceso muera.',
    queSeEsperaQueSobreviva: 'lo mismo, siempre que el equipo vuelva a arrancar.',
    cubiertoHoy: true,
  },
  {
    suceso: 'corte de red durante la consulta',
    queLoProtegeHoy: 'la cola de escrituras pendientes de Firestore más la copia local. `salir-seguro` NO purga lo local si el guardado no se confirmó.',
    queSeEsperaQueSobreviva: 'la nota entera, en cuanto vuelva la red.',
    cubiertoHoy: true,
  },
  {
    suceso: 'dos pestañas sobre la misma nota',
    queLoProtegeHoy: '`vistoEnRef` + `updateNota`, que se niega a escribir si la marca de modificación del servidor no es la que esta pestaña vio.',
    queSeEsperaQueSobreviva: 'las dos versiones: ninguna pisa a la otra en silencio.',
    cubiertoHoy: true,
  },
  {
    suceso: 'cierre de sesión por inactividad a mitad del dictado',
    queLoProtegeHoy: '`salir-seguro` espera el acuse de guardado de verdad, y conserva lo local si no llegó.',
    queSeEsperaQueSobreviva: 'la nota, en el servidor o en el disco.',
    cubiertoHoy: true,
  },
  {
    suceso: 'el médico no sabe qué quedó a salvo ni cuándo',
    queLoProtegeHoy: 'NADA. La pantalla enseña un botón que gira mientras guarda, y se ve igual cuando el autoguardado lleva minutos fallando.',
    queSeEsperaQueSobreviva: 'la capacidad del médico de decidir si sigue dictando o para. Éste es el hueco de #312.',
    cubiertoHoy: false,
  },
  {
    suceso: 'fallo de un proveedor secundario (transcripción, IA)',
    queLoProtegeHoy: 'la nota se guarda igual: el autoguardado no depende del proveedor.',
    queSeEsperaQueSobreviva: 'el encuentro entero. Un fallo secundario no puede perder la consulta.',
    cubiertoHoy: true,
  },
  {
    suceso: 'recuperación de sesión al volver a entrar',
    queLoProtegeHoy: 'la copia local se ofrece al reabrir la consulta del mismo paciente y episodio.',
    queSeEsperaQueSobreviva: 'el borrador, y que el médico pueda ver de cuándo es antes de aceptarlo.',
    cubiertoHoy: false,
  },
]

/** Los huecos, para que el traspaso no haya que deducirlo leyendo la lista. */
export function huecosDeContinuidad(): SucesoDeContinuidad[] {
  return SUCESOS_DE_CONTINUIDAD.filter(s => !s.cubiertoHoy)
}

export const POR_QUE_UN_GUARDADO_MUDO_ES_PEOR_QUE_NINGUNO =
  'Si no hay autoguardado, el médico lo sabe y guarda a mano. Si lo hay y falla ' +
  'en silencio, el médico confía y no guarda. La red de seguridad sólo funciona ' +
  'cuando el que camina sobre ella puede ver si sigue puesta.'
