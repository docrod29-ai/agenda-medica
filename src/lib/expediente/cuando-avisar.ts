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
/**
 * Cuántos avisos del MISMO origen hacen falta para resumirlos en una línea.
 *
 * Tres, no dos: con dos, verlos enteros todavía informa. A partir de tres son
 * la misma frase repetida con distinto relleno, y lo que aporta es la CUENTA.
 */
const REPETIDOS_QUE_SE_RESUMEN = 3

/** Cómo se lee un grupo resumido. Sin esto, el resumen diría «3 sin_respaldo…». */
const EN_PLURAL: Partial<Record<AvisoConsulta['origen'], string>> = {
  sin_respaldo_en_el_dictado: 'frases de la nota no salieron del dictado',
}

/**
 * ── EL DIÁLOGO DE FIRMAR NO ES UN INFORME — REG-517 ─────────────────────────
 *
 * QUÉ PASABA. Esta función listaba ocho avisos ENTEROS y luego «…y N más». Con
 * una consulta larga eso son ocho párrafos de texto legal seguidos, y casi
 * todos la misma frase: «Esto no salió del dictado: «…». Nadie dijo: …».
 *
 * El dueño, viéndolo en su iPhone: «esta madre sale al final y no está bien […]
 * quiero quitarle, me caga». Y tenía razón sobre el efecto, aunque el arreglo no
 * sea quitarlo: un muro de texto antes de firmar no se lee — se salta. Un aviso
 * que nadie lee no protege a nadie, que es el mismo fallo que este repositorio
 * ya reparó en los avisos clínicos.
 *
 * LA REGLA. Lo que se repite se cuenta; lo que es único se dice entero. Tres o
 * más avisos del mismo origen se colapsan en una línea con su número y a dónde
 * ir a verlos. Los demás siguen apareciendo literales, porque cada uno dice algo
 * distinto.
 *
 * LO QUE NO CAMBIA, y conviene decirlo: no se descarta ni un aviso. La cuenta
 * total sigue siendo la real, todos siguen estando en la nota con su ancla, y
 * ninguno bloqueaba firmar antes ni bloquea ahora. Lo que cambia es cuánto hay
 * que leer para enterarse.
 */
export function comoSeDicenAlFirmar(avisos: readonly AvisoConsulta[]): string {
  const porOrigen = new Map<AvisoConsulta['origen'], AvisoConsulta[]>()
  for (const a of avisos) {
    const g = porOrigen.get(a.origen) ?? []
    g.push(a)
    porOrigen.set(a.origen, g)
  }

  const lineas: string[] = []
  for (const [origen, grupo] of porOrigen) {
    if (grupo.length >= REPETIDOS_QUE_SE_RESUMEN && EN_PLURAL[origen]) {
      lineas.push(`· ${grupo.length} ${EN_PLURAL[origen]} — revísalas en la nota.`)
    } else {
      for (const a of grupo) lineas.push(`· ${a.texto}`)
    }
  }

  const lista = lineas.slice(0, 8).join('\n')
  const mas = lineas.length > 8 ? `\n…y ${lineas.length - 8} más.` : ''
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
