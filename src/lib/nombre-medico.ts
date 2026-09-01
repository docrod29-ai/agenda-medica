/**
 * EL NOMBRE DEL MÉDICO SE ENSEÑA COMO ÉL LO ESCRIBIÓ.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El armazón de la aplicación —barra lateral y riel de flujo— anteponía
 * `Dr. ` cuando el nombre configurado no traía prefijo:
 *
 *     const yaTienePrefijo = /^Dr\.?\s+|^Dra\.?\s+/i.test(config.nombreMedico)
 *     return yaTienePrefijo ? config.nombreMedico : `Dr. ${config.nombreMedico}`
 *
 * Con una médica cuyo `config.nombreMedico` es «Ximena Alcántara Robledo», la
 * aplicación entera la llamaba **«Dr. Ximena Alcántara Robledo»** — mientras el
 * portal del paciente, que lee el nombre de otro sitio donde sí venía escrito,
 * la llamaba «Dra. Ximena Alcántara Robledo».
 *
 * El mismo médico con dos títulos según la pantalla, y uno de los dos
 * inventado. Se vio en el arnés visual, con el consultorio sintético delante.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * **El software no adivina el género de nadie.** Si el médico escribió «Dra.»,
 * se enseña «Dra.»; si escribió «Dr.», «Dr.»; si no escribió ninguno, se enseña
 * su nombre. No hay ningún dato del que deducirlo, y deducirlo mal es
 * equivocarse con la mitad de los médicos de México.
 *
 * Es la misma regla que gobierna todo lo clínico aquí —«ante la duda se
 * pregunta, no se adivina»— aplicada a cómo se llama a la persona que usa el
 * producto.
 *
 * ── LA DECISIÓN, DICHA PARA QUE SE PUEDA REVERTIR ────────────────────────────
 *
 * El coste es que quien escribió sólo su nombre deja de ver un título. Se
 * prefiere un nombre sin título a un título equivocado. Si el dueño quiere un
 * valor de fábrica, se pone aquí, en un sitio, y no en las dos copias que
 * había.
 *
 * ── POR QUÉ VIVE EN UN MÓDULO ────────────────────────────────────────────────
 *
 * Porque eran DOS copias de la misma expresión regular, en `Sidebar` y en
 * `FlowRail`. Dos sitios que hay que acordarse de mantener iguales se desfasan
 * siempre; ya pasó con el sello de versión y con la tabla del tema.
 */

/** Lo que se enseña como nombre del médico. Vacío ⇒ `null`, para que quien llame decida el respaldo. */
export function nombreMedicoParaMostrar(nombreMedico: string | null | undefined): string | null {
  const s = String(nombreMedico ?? '').trim()
  return s || null
}

/** ¿El nombre ya trae un título escrito por el médico? Útil para no duplicarlo al componer. */
export function traeTitulo(nombreMedico: string | null | undefined): boolean {
  return /^(dr|dra|dr\(a\)|med|lic|mtro|mtra)\.?\s+/i.test(String(nombreMedico ?? '').trim())
}
