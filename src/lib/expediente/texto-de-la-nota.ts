/**
 * EL TEXTO DE LA NOTA, EN UN SOLO SITIO.
 *
 * ── POR QUÉ SALE DE LA PANTALLA ─────────────────────────────────────────────
 *
 * Esta función vivía dentro del monolito de `/consulta` como función privada.
 * Mientras sólo la usaba esa pantalla no era deuda; en cuanto una SEGUNDA
 * superficie necesita contrastar la nota contra el dictado (§21 en
 * `/expediente`), copiarla sería tener **dos definiciones de qué es «la nota»**
 * para el mismo motor de trazabilidad — y la que se quedara atrás mentiría en
 * silencio, que es el modo en que este repositorio pierde datos.
 *
 * Es el mismo movimiento que hizo `siguientePaso` al mudarse de `/pendientes`
 * a `lib/tareas-clinicas/por-que-esta-aqui.ts`.
 *
 * ── EL DEFECTO QUE LA HIZO EXISTIR (y que sigue vigente) ────────────────────
 *
 * El texto NO es sólo la prosa de las secciones. Un antecedente que el paciente
 * NEGÓ y que la nota guarda **sólo como diagnóstico estructurado** —sin
 * repetirlo en la prosa— era invisible para todo lo que leía «la nota»: la
 * alerta de negaciones lo citaba como
 * «…Diabetes mellitus tipo 2. [object Object] [object Object]…».
 *
 * Y el diagnóstico estructurado es justo el que se arrastra a la receta, al
 * resumen de la próxima consulta y al expediente. Por eso el resumen y los
 * diagnósticos entran ANTES que las secciones, y por eso el diagnóstico se
 * aplana a `descripción + CIE-10` y no a `String(objeto)`.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No ordena por relevancia clínica, no resume, no interpreta y no toca cifras:
 * concatena lo que ya está escrito. Es un adaptador de presentación (§1 del
 * Master Loop V15 lo permite por su nombre), no un motor clínico.
 */
/**
 * Los parámetros se tipan por lo que la función LEE, no por `Diagnostico[]` y
 * `NotaSeccion[]`. No es laxitud: exigir el tipo completo obliga a cada
 * llamador —y a cada prueba— a fabricar `tipo`, `estado` y `label` que esto no
 * mira, y ése es justo el peaje que empujó a la prueba
 * `la-nota-entera-se-contrasta` a **replicar la función** en vez de importarla.
 * Una copia en una prueba es la peor de todas: pasa en verde para siempre
 * aunque el original cambie.
 */
export function textoDeLaNota(
  resumen: string,
  diagnosticos: readonly { descripcion?: string; codigoCIE10?: string }[],
  secciones: readonly { value?: string }[],
): string {
  return [
    resumen,
    ...(diagnosticos ?? []).map(d => [d?.descripcion, d?.codigoCIE10].filter(Boolean).join(' ')),
    ...(secciones ?? []).map(s => s?.value),
  ].filter(Boolean).join('\n')
}

export const POR_QUE_LOS_DIAGNOSTICOS_VAN_APARTE =
  'Un diagnóstico que la nota guarda SÓLO como dato estructurado —sin repetirlo ' +
  'en la prosa— era invisible para todo lo que leía «la nota», y es justo el que ' +
  'se arrastra a la receta y a la consulta siguiente.'
