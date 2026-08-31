/**
 * QUÉ HAY QUE GUARDAR DEL BORRADOR, Y CUÁNDO — una sola declaración.
 *
 * ── LA HISTORIA, PORQUE ESTE MÓDULO ES SU TERCERA VUELTA ────────────────────
 *
 * La pregunta «¿hay algo que valga la pena guardar?» estaba escrita **cinco
 * veces** dentro de `consulta/[patientId]/page.tsx`, palabra por palabra:
 *
 *  1. el autoguardado al servidor, cada 30 s;
 *  2. el respaldo local con retardo de 1,5 s;
 *  3. el espejo en memoria;
 *  4. el volcado inmediato al salir de la pantalla;
 *  5. el oyente de `nx:guardar-todo`.
 *
 * REG-300 ya había pagado esto: `proximoSeguimiento` se añadió a unas copias y
 * no a otras, y **la fecha de la próxima consulta se perdía** — la nota parecía
 * vacía para la copia que no la miraba. Aquel arreglo unificó **tres** de las
 * cinco y dejó un guardián que contaba exactamente esas tres.
 *
 * Las otras dos siguieron sueltas, y son justo las que deciden **si el trabajo
 * del médico se guarda o no**: la que llama al servidor y la que escribe el
 * respaldo local. El guardián no las veía porque medía la parte reparada — que
 * es la forma en que una compuerta pasa a certificar el arreglo en vez de la
 * propiedad.
 *
 * Por eso la regla no se vuelve a copiar: se **importa**. Y por eso vive aquí y
 * no dentro del componente, donde una prueba sólo podía alcanzarla raspando el
 * texto del archivo con una expresión regular.
 *
 * ── LA OTRA MITAD: EL ALMACENAMIENTO QUE SE LLENA ───────────────────────────
 *
 * Las dos escrituras a `localStorage` acababan en:
 *
 *     } catch { }   // «almacenamiento lleno: no es crítico»
 *
 * No es cierto que no sea crítico. Cuando el navegador se queda sin cuota, el
 * respaldo local **deja de existir** y nadie se entera: el médico sigue
 * dictando, la pantalla no cambia, y la copia que le salvaría la consulta tras
 * una recarga ya no se está escribiendo. Es pérdida silenciosa, que es la
 * familia que menos se perdona.
 *
 * Aquí se devuelve **por qué** no se pudo guardar, para que la pantalla lo diga.
 * Nada cambia en silencio (seguridad clínica §3).
 *
 * ── QUÉ NO DECIDE ESTE MÓDULO ───────────────────────────────────────────────
 *
 * No lee ni escribe nada por su cuenta: recibe la función de escritura. No sabe
 * de React, de Firestore ni de ofuscación. No decide cuándo se BORRA un
 * borrador —eso es de `salir-seguro.ts`— ni si se ofrece restaurarlo, que es de
 * `recuperacion-consulta.ts`.
 *
 * Módulo PURO.
 */

/** Lo que la pantalla de consulta tiene vivo y puede perder. */
export interface EstadoDelBorrador {
  tipo?: unknown
  resumen?: string
  secciones?: { value?: string }[]
  /**
   * `object` y no `Record<string, unknown>` a propósito: `SignosVitales` es una
   * interfaz sin firma de índice, y exigirle una obligaría a quien llama a
   * moldear el tipo en cada sitio — que es cómo se cuela un `as any` en el
   * camino del guardado.
   */
  signos?: object | null
  diagnosticos?: unknown[]
  medicamentos?: unknown[]
  estudiosOrden?: unknown[]
  preop?: unknown
  proximoSeguimiento?: string
  transcripcion?: string
}

/**
 * Un campo del borrador.
 *
 * `cuenta` es lo que separa «se guarda» de «hace que haya algo que guardar»:
 * `tipo` viaja en el respaldo —sin él, al restaurar se pierde la modalidad de la
 * nota— pero una nota en la que sólo se eligió la modalidad está vacía. Esa
 * distinción estaba implícita en las cinco copias, y por eso se podía perder.
 */
export interface CampoDelBorrador {
  readonly nombre: keyof EstadoDelBorrador
  /** `null` = se persiste, pero por sí solo no es contenido. */
  readonly cuenta: ((e: EstadoDelBorrador) => boolean) | null
}

/** ¿Hay algún signo vital escrito? Un `0` cuenta; una cadena en blanco, no. */
export function signosConValor(sv: object | null | undefined): boolean {
  return !!sv && Object.values(sv as Record<string, unknown>)
    .some(v => v != null && String(v).trim() !== '')
}

/**
 * LA lista. Añadir un campo al borrador es añadirlo aquí, y con eso entra a la
 * vez en el respaldo y en la pregunta de si hay algo que perder.
 */
export const CAMPOS_DEL_BORRADOR: readonly CampoDelBorrador[] = Object.freeze([
  { nombre: 'tipo', cuenta: null },
  { nombre: 'resumen', cuenta: e => !!e.resumen?.trim() },
  { nombre: 'secciones', cuenta: e => !!e.secciones?.some(s => s.value?.trim()) },
  { nombre: 'signos', cuenta: e => signosConValor(e.signos) },
  { nombre: 'diagnosticos', cuenta: e => (e.diagnosticos?.length ?? 0) > 0 },
  { nombre: 'medicamentos', cuenta: e => (e.medicamentos?.length ?? 0) > 0 },
  { nombre: 'estudiosOrden', cuenta: e => (e.estudiosOrden?.length ?? 0) > 0 },
  { nombre: 'preop', cuenta: e => !!e.preop },
  /**
   * El campo de REG-300. Una nota cuyo único contenido es la fecha de la
   * próxima consulta SÍ tiene algo que perder: alimenta la tarea «agendar el
   * seguimiento» y el contador de seguimientos vencidos.
   */
  { nombre: 'proximoSeguimiento', cuenta: e => !!e.proximoSeguimiento?.trim() },
  { nombre: 'transcripcion', cuenta: e => !!e.transcripcion?.trim() },
])

/**
 * ¿Hay algo que valga la pena guardar?
 *
 * Sesgada a **conservar**: ante la duda se guarda. Los dos errores no cuestan lo
 * mismo —guardar de más deja un borrador que el médico descarta de un clic;
 * guardar de menos borra una consulta— y es el mismo criterio de
 * `recuperacion-consulta.ts`.
 */
export function hayAlgoQuePerder(e: EstadoDelBorrador): boolean {
  return CAMPOS_DEL_BORRADOR.some(c => c.cuenta?.(e) ?? false)
}

/**
 * El cuerpo que se persiste, derivado de la misma lista.
 *
 * `undefined` se conserva tal cual (`JSON.stringify` lo omite); lo que importa
 * es que ningún campo declarado pueda quedarse fuera por olvido.
 */
export function cuerpoDelRespaldo(
  e: EstadoDelBorrador, extra: { notaId: string | null; ts: number },
): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = {}
  for (const c of CAMPOS_DEL_BORRADOR) cuerpo[c.nombre] = e[c.nombre]
  cuerpo.notaId = extra.notaId
  cuerpo.ts = extra.ts
  return cuerpo
}

/** Por qué el respaldo quedó (o no quedó) escrito. */
export type ResultadoDelRespaldo =
  /** Quedó escrito. */
  | 'guardado'
  /** No había nada que perder. No es un fallo. */
  | 'nada_que_guardar'
  /** Sesión cerrada: escribir aquí resucitaría PHI que se acaba de purgar. */
  | 'sesion_cerrada'
  /** El navegador no tiene cuota. **Hay que decírselo al médico.** */
  | 'sin_espacio'
  /** Otro fallo del almacenamiento. También hay que decirlo. */
  | 'no_se_pudo'

/**
 * ¿Este error del almacenamiento es «no cabe»?
 *
 * Los navegadores lo dicen de tres formas distintas y ninguna es un tipo propio.
 * Se reconoce de las tres; lo que no se reconozca cae en `no_se_pudo`, que
 * también avisa — señalar de menos aquí sería volver al silencio.
 */
export function esFaltaDeEspacio(e: unknown): boolean {
  if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
    return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22
  }
  const nombre = (e as { name?: string } | null)?.name ?? ''
  return /quota/i.test(nombre)
}

/**
 * Guarda el respaldo local y **dice qué pasó**.
 *
 * `escribir` se inyecta —la pantalla le pone `localStorage.setItem` con su
 * ofuscación— para que esta decisión se pueda probar sin navegador y para que
 * el camino de fallo se pueda provocar de verdad, que es lo que nunca se probó.
 */
export function guardarRespaldoLocal(
  e: EstadoDelBorrador,
  extra: { notaId: string | null; ts: number; bloqueado: boolean },
  escribir: (cuerpo: Record<string, unknown>) => void,
): ResultadoDelRespaldo {
  if (extra.bloqueado) return 'sesion_cerrada'
  if (!hayAlgoQuePerder(e)) return 'nada_que_guardar'
  try {
    escribir(cuerpoDelRespaldo(e, { notaId: extra.notaId, ts: extra.ts }))
    return 'guardado'
  } catch (err) {
    return esFaltaDeEspacio(err) ? 'sin_espacio' : 'no_se_pudo'
  }
}

/** Qué se le dice al médico cuando el respaldo local no cabe. */
export const AVISO_SIN_ESPACIO =
  'No pude guardar la copia local de esta nota: el almacenamiento de este ' +
  'navegador está lleno. Tu nota sigue guardándose en el servidor, pero si ' +
  'recargas antes de que llegue podrías perder lo último. Cierra pestañas o ' +
  'libera espacio.'

export const POR_QUE_NO_SE_CALLA =
  'Un respaldo que dejó de escribirse sin avisar es pérdida silenciosa: el ' +
  'médico sigue dictando, la pantalla no cambia, y la copia que le salvaría la ' +
  'consulta tras una recarga ya no existe. Nada cambia en silencio.'

export const POR_QUE_UNA_SOLA_LISTA =
  'La regla estaba escrita cinco veces. REG-300 unificó tres y su guardián ' +
  'contaba exactamente esas tres, así que las dos que deciden si el trabajo se ' +
  'guarda —la del servidor y la del respaldo local— siguieron sueltas. Una ' +
  'compuerta que mide la parte reparada certifica el arreglo, no la propiedad.'
