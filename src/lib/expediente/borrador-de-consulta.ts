/**
 * QUÉ ES UN BORRADOR DE CONSULTA — una sola definición, tres caminos que la usan.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El borrador de la consulta se escribía en **tres sitios distintos**, cada uno
 * con su propia lista de campos escrita a mano:
 *
 *   1. el respaldo con rebote de 1 500 ms → `localStorage`
 *   2. el espejo en memoria → `BorradorContext` (el que hace que volver de la
 *      agenda no parpadee)
 *   3. `flushRespaldo`, el volcado inmediato al desmontar, al ocultar la pestaña
 *      y al cerrar → `localStorage`, **la misma clave que 1**
 *
 * Y una cuarta lista, la condición «¿hay algo que guardar?», copiada **cuatro**
 * veces.
 *
 * `proximoSeguimiento` estaba en la lista 1 y faltaba en las otras dos. Como 3
 * escribe **la misma clave** que 1 y lo hace al salir de la pantalla, el volcado
 * de despedida **reescribía el respaldo sin el campo**: no es que no se
 * guardara, es que se guardaba y luego se borraba solo.
 *
 * ── POR QUÉ IMPORTA ESE CAMPO EN CONCRETO ───────────────────────────────────
 *
 * `proximoSeguimiento` alimenta la tarea «agendar el seguimiento» del worklist y
 * el contador de seguimientos vencidos. Perderlo no rompe nada visible: **la
 * consulta que nadie agenda simplemente no ocurre.**
 *
 * ── Y YA HABÍA PASADO ───────────────────────────────────────────────────────
 *
 * Con este mismo campo, en REG-193. Aquel arreglo cubrió **uno de los tres
 * caminos de escritura** y dejó los otros dos, con el comentario de la
 * reparación escrito justo encima del único sitio corregido. No fue descuido:
 * mientras la lista esté copiada tres veces, arreglar una copia **se ve
 * exactamente igual** que arreglar el problema.
 *
 * Por eso la reparación no es añadir el campo dos veces más: es que **haya una
 * sola lista**. Lo vigila `el-borrador-no-pierde-campos.test.ts`.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No es el guardado al SERVIDOR (`guardarBorrador` → Firestore), que tiene su
 *   propio esquema y su lista blanca de campos en la ruta. Esto es sólo la red
 *   local anti-pérdida.
 * - No decide CUÁNDO se escribe: eso sigue en la pantalla (rebote, volcado,
 *   espejo).
 * - No valida el contenido al restaurar — de eso se encargan `seccionesSanas`,
 *   `diagnosticosSanos` y `medicamentosSanos` en la pantalla, que sí saben de
 *   esquemas viejos.
 */

/**
 * Lo que la pantalla de consulta considera «el trabajo sin guardar».
 *
 * Los tipos son deliberadamente ANCHOS.
 *
 * Este módulo no sabe qué es un diagnóstico ni un signo vital, y no debe: su
 * único trabajo es que la LISTA DE CAMPOS sea una sola. Estrechar los tipos aquí
 * obligaría a importar el modelo clínico entero en una utilidad de persistencia
 * local, y a mantener dos declaraciones de lo mismo — el defecto que este
 * módulo existe para cerrar, cometido en otra capa.
 *
 * Quien valida la forma al restaurar es la pantalla, con `seccionesSanas`,
 * `diagnosticosSanos` y `medicamentosSanos`, que sí saben de esquemas viejos.
 */
export interface EstadoDeBorrador {
  tipo: string
  resumen: string
  secciones: Array<{ value?: string }>
  signos: unknown
  diagnosticos: unknown[]
  medicamentos: unknown[]
  estudiosOrden: string[]
  preop?: unknown
  /** Fecha de la próxima consulta. Ver la cabecera: se perdía dos veces. */
  proximoSeguimiento: string
  transcripcion: string
  firmada?: boolean
}

/**
 * LOS CAMPOS QUE VIAJAN EN EL BORRADOR, EN UN SOLO SITIO.
 *
 * Añadir un campo al borrador es añadirlo **aquí**, y entonces los tres caminos
 * lo llevan. Es la diferencia entre una lista y tres listas que se parecen.
 */
export const CAMPOS_DEL_BORRADOR = [
  'tipo',
  'resumen',
  'secciones',
  'signos',
  'diagnosticos',
  'medicamentos',
  'estudiosOrden',
  'preop',
  'proximoSeguimiento',
  'transcripcion',
] as const

export type CampoDelBorrador = (typeof CAMPOS_DEL_BORRADOR)[number]

/**
 * ¿Hay algo que merezca guardarse?
 *
 * Estaba copiada cuatro veces y las cuatro copias no coincidían: la del respaldo
 * con rebote contaba `proximoSeguimiento` y las del espejo y el volcado no. Con
 * la fecha de seguimiento como ÚNICO contenido, una copia decía «hay algo» y
 * otra «no hay nada» sobre el mismo borrador.
 *
 * `signosConValor` se inyecta porque vive en la pantalla y conoce la forma de
 * los signos vitales; aquí no se reimplementa para no tener dos criterios de
 * «un signo vital está lleno».
 */
export function hayQueGuardar<S>(
  e: Partial<EstadoDeBorrador> & { signos?: S },
  signosConValor: (s: S | undefined) => boolean,
): boolean {
  return Boolean(
    e.resumen?.trim() ||
    e.secciones?.some(s => s.value?.trim()) ||
    e.diagnosticos?.length ||
    e.medicamentos?.length ||
    e.transcripcion?.trim() ||
    signosConValor(e.signos as S | undefined) ||
    (e.estudiosOrden?.length ?? 0) > 0 ||
    !!e.preop ||
    e.proximoSeguimiento?.trim(),
  )
}

/**
 * La instantánea que se guarda, con `notaId` pegado.
 *
 * `notaId` no está en `CAMPOS_DEL_BORRADOR` porque no es contenido de la nota:
 * es la identidad del documento en el servidor. Sin él, restaurar dejaba
 * `notaIdRef` en null y el siguiente autoguardado **creaba una segunda nota** con
 * el mismo contenido.
 */
export function instantaneaDeBorrador(
  e: Partial<Record<CampoDelBorrador, unknown>>,
  notaId: string | null,
): Record<string, unknown> {
  const salida: Record<string, unknown> = {}
  for (const campo of CAMPOS_DEL_BORRADOR) salida[campo] = e[campo]
  salida.notaId = notaId
  return salida
}
