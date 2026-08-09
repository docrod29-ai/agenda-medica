/**
 * CUÁNDO AVISAR: MIENTRAS RECETA, O AL FIRMAR — I-7 del loop.
 *
 * ── LA QUEJA, REPETIDA ──────────────────────────────────────────────────────
 *
 * «los avisos rojos me tapan la nota desde el principio». Y medido: la barra se
 * pinta **por encima** de los signos vitales, de las secciones narrativas, de
 * los diagnósticos y de los medicamentos. Lo primero que ve al abrir la consulta
 * es una lista de lo que está mal en una nota que todavía no ha dictado.
 *
 * ── POR QUÉ NO SE MUEVE ENTERA AL FINAL ─────────────────────────────────────
 *
 * Porque **no todos los avisos son lo mismo**, y tratarlos igual es lo que hace
 * que estorben.
 *
 * Cinco de ellos son de PRESCRIPCIÓN: alergia ↔ fármaco, sobredosis, dosis
 * incompleta, interacción, vía asumida. Ésos tienen que llegar **mientras el
 * médico receta**, porque después de firmar la receta ya se imprimió. Llevarlos
 * al final es exactamente el defecto que este repositorio ya reparó **dos
 * veces** —REG-173 y REG-190, familia «llega tarde para servir»— y no se va a
 * reintroducir por comodidad visual.
 *
 * El resto son de REVISIÓN DEL TEXTO: una contradicción con lo dictado, un dato
 * incierto, un antecedente que era del familiar, un requisito de la NOM. Ésos no
 * cambian lo que se hace con el paciente: cambian lo que se lee antes de firmar.
 * Y ése es su momento.
 *
 * ── CÓMO SE DECIDE, SIN INVENTAR UNA CLASIFICACIÓN NUEVA ────────────────────
 *
 * Cada aviso ya trae `ancla.seccion`, que dice a dónde lleva su botón:
 * `medicamentos`, `diagnosticos` o `nota`. Ese campo YA distingue lo que hace
 * falta — sólo que nadie lo estaba usando para decidir *cuándo* enseñarlo.
 *
 * No hay lista nueva que mantener: si mañana nace un aviso anclado a
 * medicamentos, aparece durante la consulta sin que nadie lo apunte en ningún
 * sitio.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
 *
 * No decide si algo bloquea la firma —eso lo sigue decidiendo la tabla `NIVEL`
 * de `avisos-consulta.ts`— ni cambia el texto de ningún aviso. Sólo dice cuándo
 * se enseña cada uno.
 *
 * Módulo PURO, sin dependencias de red ni de framework.
 */
import type { AvisoConsulta } from './avisos-consulta'

/**
 * ¿Este aviso tiene que llegar MIENTRAS receta?
 *
 * Sí cuando su ancla es `medicamentos`: son los que cambian lo que se le da al
 * paciente, y después de firmar ya no sirven.
 *
 * **Ante la duda, durante la consulta.** Un aviso que llega pronto de más
 * estorba; uno que llega tarde no protege. Las dos molestias no cuestan lo
 * mismo, así que un aviso sin ancla se trata como de prescripción.
 */
export function esDePrescripcion(a: Pick<AvisoConsulta, 'ancla'>): boolean {
  const s = a?.ancla?.seccion
  return s === 'medicamentos' || s === undefined
}

/** Los que se enseñan durante la consulta, junto a lo que recetan. */
export function mientrasReceta(avisos: readonly AvisoConsulta[]): AvisoConsulta[] {
  return (avisos ?? []).filter(esDePrescripcion)
}

/** Los que esperan al momento de firmar: revisión del texto, no del tratamiento. */
export function alFirmar(avisos: readonly AvisoConsulta[]): AvisoConsulta[] {
  return (avisos ?? []).filter(a => !esDePrescripcion(a))
}

/**
 * El texto del diálogo de firma. Se escribe una vez y se usa donde haga falta.
 *
 * Cuenta y enumera; no juzga. El médico ya sabe qué hacer con cada uno — lo que
 * no tenía era el momento adecuado para verlos.
 */
export function comoSeDicenAlFirmar(avisos: readonly AvisoConsulta[]): string {
  const lista = avisos.slice(0, 8).map(a => `· ${a.texto}`).join('\n')
  const mas = avisos.length > 8 ? `\n…y ${avisos.length - 8} más.` : ''
  const n = avisos.length
  return `${n} ${n === 1 ? 'cosa por revisar' : 'cosas por revisar'} antes de firmar:\n\n${lista}${mas}`
}

export const POR_QUE_LOS_DE_RECETA_NO_ESPERAN =
  'Después de firmar, la receta ya se imprimió. Un aviso de alergia ↔ fármaco ' +
  'que llega ahí no es una protección: es el registro de que no la hubo. Ya se ' +
  'reparó dos veces (REG-173, REG-190) y no se reintroduce por comodidad visual.'

export const POR_QUE_ANTE_LA_DUDA_DURANTE =
  'Un aviso que llega pronto de más estorba; uno que llega tarde no protege. ' +
  'Las dos molestias no cuestan lo mismo, así que un aviso sin ancla se trata ' +
  'como de prescripción.'

export const DE_DONDE_SALE_LA_DISTINCION =
  'Del campo `ancla.seccion` que cada aviso ya traía para saber a dónde lleva su ' +
  'botón. No hay lista nueva que mantener: un aviso futuro anclado a ' +
  'medicamentos aparece durante la consulta sin que nadie lo apunte.'
