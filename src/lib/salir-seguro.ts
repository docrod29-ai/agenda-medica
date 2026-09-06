'use client'
/**
 * CERRAR SESIÓN SIN PERDER LO QUE NO SE HABÍA GUARDADO.
 *
 * ── EL FALLO QUE ESTO CIERRA ─────────────────────────────────────────────────
 *
 * Al salir —por inactividad o a mano— se pedía a la pantalla abierta que
 * guardara, se esperaban **1200 ms fijos**, y después se purgaba todo: los
 * borradores de `localStorage`, el audio, y la caché de Firestore con
 * `terminate` + `clearIndexedDbPersistence`.
 *
 * Nadie esperaba la promesa del guardado. Y esa última purga borra la COLA DE
 * ESCRITURAS PENDIENTES de Firestore, que es donde vive una nota cuando la red
 * va lenta o está caída.
 *
 * O sea: con el wifi del consultorio lento, a los 1200 ms se borraba a la vez
 * (a) el respaldo local, (b) la cola que aún no había llegado al servidor y
 * (c) el audio. **La nota desaparecía de los tres sitios al mismo tiempo**,
 * mientras el aviso decía «Guardaremos tu nota en el servidor antes de cerrar».
 *
 * Y dictar no genera ratón ni teclas, así que el cierre por inactividad a los 30
 * minutos cae justo en mitad de una consulta dictada. Es el caso normal, no el
 * raro.
 *
 * ── LO QUE HACE AHORA ────────────────────────────────────────────────────────
 *
 * El evento deja de ser un grito al vacío y pasa a ser un ACUSE: quien escucha
 * entrega su promesa de guardado, y aquí se espera de verdad.
 *
 * Y lo más importante: **si el guardado no se pudo confirmar, NO se purga lo
 * local**. Cuando el servidor no recibió la nota, el borrador del navegador es
 * la única copia que queda; borrarlo «por seguridad» convierte un problema de
 * red en una pérdida definitiva. La sesión se cierra igual —eso sí es
 * seguridad— pero el trabajo se queda en el disco para la próxima entrada.
 */

/** Evento que pide a la pantalla activa que persista lo que tenga, ya. */
export const EVENTO_GUARDAR_TODO = 'nx:guardar-todo'

/**
 * Lo que viaja en el evento. Quien escuche llama a `esperar(promesa)` y así
 * quien cierra la sesión sabe cuándo terminó de verdad.
 *
 * Es opcional a propósito: una pantalla que no lo use sigue funcionando como
 * antes, sólo que sin acuse.
 */
export interface DetalleGuardarTodo {
  esperar: (p: Promise<unknown>) => void
  /**
   * Lo llama quien tenga audio grabado que **todavía no se ha transcrito**.
   *
   * Sirve para una sola cosa: que la purga NO se lleve ese audio. Ver
   * `ResultadoGuardado.audioSinTranscribir` y REG-297.
   *
   * Opcional a propósito, como `esperar`: una pantalla que no lo use sigue
   * funcionando igual.
   */
  marcarAudioSinTranscribir?: () => void
}

/** Margen para que un listener reaccione cuando NADIE entrega promesa. */
const ESPERA_SIN_ACUSE_MS = 1200

/** Tope duro: nadie se queda encerrado esperando un guardado que no vuelve. */
const TOPE_MS = 10_000

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

export interface ResultadoGuardado {
  /** ¿Hubo alguien escuchando que entregara una promesa? */
  huboAcuse: boolean
  /** ¿Todo lo que se estaba guardando terminó bien? */
  todoGuardado: boolean
  /** Se agotó el tope antes de que respondieran. */
  seAgotoElTiempo: boolean
  /**
   * Alguien declaró audio grabado y **sin transcribir todavía**.
   *
   * Cuando es cierto, el audio local NO se purga: es la única copia que existe
   * de lo que dijo el paciente. Ver REG-297.
   */
  audioSinTranscribir: boolean
}

/**
 * Pide guardar y ESPERA. Devuelve si se pudo confirmar.
 *
 * Sin acuse (nadie escuchaba, o la pantalla es vieja) se conserva la espera
 * corta de antes y se responde `todoGuardado: false`: no se pudo confirmar, así
 * que se trata con la misma prudencia que un fallo.
 */
export async function guardarTodoYEsperar(topeMs = TOPE_MS): Promise<ResultadoGuardado> {
  const promesas: Promise<unknown>[] = []
  let audioSinTranscribir = false
  const detalle: DetalleGuardarTodo = {
    esperar: p => { promesas.push(p) },
    marcarAudioSinTranscribir: () => { audioSinTranscribir = true },
  }
  window.dispatchEvent(new CustomEvent(EVENTO_GUARDAR_TODO, { detail: detalle }))

  if (promesas.length === 0) {
    await dormir(ESPERA_SIN_ACUSE_MS)
    return { huboAcuse: false, todoGuardado: false, seAgotoElTiempo: false, audioSinTranscribir }
  }

  let seAgotoElTiempo = false
  const resultados = await Promise.race([
    Promise.allSettled(promesas),
    dormir(topeMs).then(() => { seAgotoElTiempo = true; return null }),
  ])

  if (seAgotoElTiempo || resultados === null) {
    return { huboAcuse: true, todoGuardado: false, seAgotoElTiempo: true, audioSinTranscribir }
  }
  return {
    huboAcuse: true,
    todoGuardado: resultados.every(r => r.status === 'fulfilled'),
    seAgotoElTiempo: false,
    audioSinTranscribir,
  }
}

/**
 * Cierra la sesión, purgando lo local SÓLO si el trabajo quedó a salvo.
 *
 * `destino` es adónde ir después. `motivo` sólo se usa para el aviso.
 */
export async function salirSeguro(destino = '/login'): Promise<void> {
  const r = await guardarTodoYEsperar()

  const { auth, limpiarCacheFirestore } = await import('@/lib/firebase')
  const { limpiarBorradoresLocales, limpiarAudioLocal } = await import('@/lib/mobile/local-drafts')
  const { limpiarZonaConsultorio } = await import('@/lib/timezone')

  limpiarZonaConsultorio()   // si entra otro consultorio, no hereda la zona del anterior

  /**
   * LA COLA DE AUDITORÍA SE VACÍA ANTES DE CERRAR, NO DESPUÉS.
   *
   * `nx.audit.pendientes` vive en `localStorage` y sobrevivía al logout: en un
   * equipo compartido —que es la norma en un consultorio— quedaban en disco
   * asientos con el paciente y el evento dentro, visibles para quien entrara
   * después.
   *
   * No se purga a ciegas: un asiento sin mandar es registro medicolegal, y
   * borrarlo «por seguridad» sería perderlo. Se **manda** mientras el token
   * todavía sirve, que es lo único que lo vacía de verdad. Lo que no se pueda
   * enviar se queda —igual que el borrador—, y los asientos de OTRA persona
   * siguen esperando a que vuelva, como ya hacía `drenarCola`.
   *
   * Va antes del `signOut` a propósito: después, `fetchAutenticado` ya no tiene
   * con qué autenticar y la cola no se vaciaría nunca.
   */
  try {
    const { drenarCola } = await import('@/lib/expediente/audit-log')
    await drenarCola()
  } catch { /* nunca trabar el cierre de sesión por la bitácora */ }

  /**
   * LA PURGA ES CONDICIONAL, Y ÉSTE ES EL CAMBIO QUE IMPORTA.
   *
   * Purgar es el control de PHI en dispositivo compartido y se mantiene cuando
   * el trabajo YA está en el servidor. Cuando no se pudo confirmar, el borrador
   * local es la única copia: se conserva, y con él la caché de Firestore, que
   * es donde espera la escritura pendiente para reintentarse al volver.
   */
  /**
   * EL AUDIO SIN TRANSCRIBIR NO SE PURGA — REG-297.
   *
   * `limpiarAudioLocal()` se llamaba en LAS DOS ramas, sin condición, y hace
   * `deleteDatabase('nexusmed-recovery')`: se lleva el audio de recuperación
   * entero.
   *
   * La razón escrita era «el texto ya transcrito vive en el borrador que se
   * está conservando», y es cierta **para una grabación terminada**. A mitad de
   * grabación no lo es: la cola sin transcribir no existe en ningún otro sitio.
   *
   * Y el caso que lo dispara es justo ése. El cierre por inactividad no oía
   * dictar (REG-296), así que quien se llevaba el audio era, con diferencia
   * mayor, la consulta que se estaba dictando en ese momento.
   *
   * Ahora quien tenga audio en vuelo lo declara, y aquí se respeta. Es el mismo
   * criterio que ya gobierna el borrador de la nota —no se purga lo que es
   * única copia— aplicado a la otra mitad del trabajo.
   *
   * **La sesión se cierra igual**: eso sí es seguridad. Lo que se conserva es
   * un archivo local que ya estaba en el disco, y que el propio médico puede
   * descartar desde el cartel de recuperación.
   */
  const purgarAudio = () => { if (!r.audioSinTranscribir) limpiarAudioLocal() }

  /**
   * «NADIE TENÍA NADA QUE GUARDAR» NO ES «SE INTENTÓ Y FALLÓ» (Panel de Lujo
   * ASE-013 · REP-040).
   *
   * Las dos situaciones devolvían `todoGuardado: false`, y la prudencia pensada
   * para la consulta dictada se aplicaba al cierre más frecuente —Pacientes,
   * Agenda, Operaciones— donde no hay ninguna promesa que esperar. Resultado:
   * la caché IndexedDB de Firestore con los expedientes se quedaba en el equipo
   * compartido, mientras Operaciones prometía «nada del consultorio se queda
   * guardado aquí».
   *
   * Se purga cuando el trabajo está a salvo O cuando no había trabajo: sin
   * oyentes no hay borrador ni cola pendiente que proteger. La caché sólo se
   * conserva cuando alguien SÍ intentó guardar y no se pudo confirmar.
   */
  const seguroPurgar = r.todoGuardado || !r.huboAcuse

  if (seguroPurgar) {
    limpiarBorradoresLocales()
    try { await auth.signOut() } finally {
      purgarAudio()
      await limpiarCacheFirestore()
      window.location.href = destino
    }
    return
  }

  try {
    await auth.signOut()
  } finally {
    purgarAudio()
    const aviso: AvisoPendiente = r.seAgotoElTiempo ? 'guardado_lento' : 'guardado_fallido'
    window.location.href = `${destino}${destino.includes('?') ? '&' : '?'}${PARAMETRO_PENDIENTE}=${aviso}`
  }
}

/**
 * EL AVISO CON EL QUE SALE LA SESIÓN — Y QUIÉN LO LEE (Panel de Lujo ASE-014).
 *
 * `?pendiente=…` se emitía y NADIE lo leía: /login sólo mira `invite`. El
 * médico nunca se enteraba de que algo no se guardó. Aquí vive el catálogo
 * —parámetro, valores y texto en lenguaje de persona— para que la pantalla de
 * entrada lo pinte sin reinventarlo. `sin_confirmar` ya no se emite: sin
 * oyentes se purga (ASE-013); se conserva en el tipo por los enlaces viejos.
 */
export const PARAMETRO_PENDIENTE = 'pendiente'
export type AvisoPendiente = 'guardado_lento' | 'guardado_fallido' | 'sin_confirmar'
export const MENSAJE_PENDIENTE: Record<AvisoPendiente, string> = {
  guardado_lento:
    'Quedó trabajo sin confirmar en este equipo: el guardado tardó demasiado. Vuelve a entrar aquí mismo, en este navegador, para recuperarlo.',
  guardado_fallido:
    'Quedó trabajo sin guardar en este equipo. Vuelve a entrar aquí mismo, en este navegador, para recuperarlo antes de cerrar.',
  sin_confirmar:
    'No se pudo confirmar que todo quedara guardado. Si estabas a media consulta, vuelve a entrar en este navegador para recuperarla.',
}

/** Lee el aviso de una URL de entrada; `null` si no viene o no es de los nuestros. */
export function avisoPendienteDe(search: string): AvisoPendiente | null {
  const v = new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get(PARAMETRO_PENDIENTE)
  return v && v in MENSAJE_PENDIENTE ? (v as AvisoPendiente) : null
}

export const POR_QUE_NO_SE_PURGA_SI_FALLA =
  'Porque cuando el servidor no recibió la nota, el borrador del navegador es la ' +
  'única copia que queda. Borrarlo «por seguridad» convierte un problema de red ' +
  'en una pérdida definitiva. La sesión se cierra igual —eso sí es seguridad—, ' +
  'pero el trabajo se queda en el disco para la próxima entrada.'
