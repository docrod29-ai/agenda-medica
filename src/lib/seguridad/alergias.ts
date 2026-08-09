/**
 * Alergias estructuradas — normalización para el cruce de seguridad y FHIR.
 *
 * Mantiene compatibilidad total: si el paciente tiene `alergiasEstructuradas`, se
 * usan; si solo tiene el texto libre `alergias`, se parsea a la misma forma. Así el
 * cruce alergia↔medicamento y el AllergyIntolerance FHIR trabajan siempre sobre una
 * lista estructurada, sin obligar a re-capturar.
 *
 * PURO → testeable.
 */

import type { AlergiaEstructurada } from '@/types'

/**
 * NEGACIONES — «Niega alergia a penicilina» NO es una alergia a penicilina.
 *
 * El cruce alergia↔fármaco hace `alergia.includes(farmaco)` sobre el texto
 * libre. Con el campo escrito así —que es como lo escribe medio mundo— salía
 * una alerta CRÍTICA al prescribir amoxicilina, y esa alerta deshabilita el
 * botón de Firmar. La única salida que le quedaba al médico era BORRAR el texto
 * del expediente: exactamente el desenlace que el esquema de clasificación
 * describe como el fallo a evitar, y encima mutilando el registro.
 *
 * Esto no decide nada clínico: lee lo que el campo dice. Si dice que el paciente
 * niega la alergia, no se registra la alergia.
 */
const NEGADOR = /^(?:niega|niego|niegan|se\s+niegan|negad[ao]s?|sin|no\s+refiere|no\s+conocid[ao]s?|no\s+presenta|no\s+tiene|descartad[ao]s?|ningun[ao])\b/i

/**
 * ── EL ANCLA ERA EL FALLO (REG-248) ─────────────────────────────────────────
 *
 * `NEGADOR` está anclado al principio, y con razón: «Alérgico a penicilina,
 * niega sulfas» tiene que conservar la penicilina. Pero el ancla significa que
 * **cualquier palabra delante lo rompe**. Medido:
 *
 *     «negadas»            → negación reconocida ✓
 *     «alergias negadas»   → NO reconocida ✗   ← la frase natural en español
 *     «se niegan»          → NO reconocida ✗
 *     «NKDA»               → NO reconocida ✗   ← el estándar hospitalario
 *     «no» · «(-)»         → NO reconocidas ✗
 *
 * **La consecuencia.** Lo que no se reconoce como negación se registra como
 * ALÉRGENO. Un paciente cuyo campo dice «alergias negadas» quedaba con un
 * alérgeno llamado *«alergias negadas»* — y de aquí leen la receta impresa, la
 * nota, el recurso FHIR y el sesgo del reconocedor. **La receta con su cédula y
 * su firma salía diciendo que el paciente es alérgico a «alergias negadas».**
 *
 * ── LOS DOS ARREGLOS, Y POR QUÉ SON DOS ─────────────────────────────────────
 *
 * 1. **La cabecera se descuenta.** Si el fragmento empieza por «alergias» /
 *    «alergia» / «antecedentes alérgicos» (con o sin dos puntos), se quita esa
 *    cabecera y se vuelve a preguntar. Así «alergias negadas» se juzga por
 *    «negadas», que es lo que de verdad dice.
 *
 * 2. **Las formas COMPLETAS.** «NKDA», «(-)», «no», «ninguna» no llevan
 *    negador: son la negación entera. Se comparan con el fragmento **completo**,
 *    nunca como prefijo — «no» de prefijo convertiría «nogal» en una negación.
 */
const CABECERA_DE_ALERGIAS = /^(?:antecedentes?\s+)?al[ée]rgi\w*\s*:?\s*/i

/**
 * Formas que SON la negación entera, sin negador delante.
 *
 * `NKDA` = *No Known Drug Allergies*, y `NKA` = *No Known Allergies*: se dictan
 * en hospital y en UCI todos los días. `(-)` y `-` son como se marca en papel.
 */
const NEGACION_COMPLETA = new Set([
  'nkda', 'nka', 'nkma', '(-)', '-', '--', 'no', 'ninguna', 'ninguno', 'negativo',
  'negativa', 'negativas', 'negativos', 'niega', 'negadas', 'negados', 'negada',
  'negado', 'se niegan', 'interrogadas y negadas', 'interrogados y negados',
  'no conocidas', 'no conocidos', 'ninguna conocida', 'sd', 'n/a', 'na',
])

/** ¿Este fragmento afirma la ausencia de una alergia? */
export function esAlergiaNegada(fragmento: string): boolean {
  const t = String(fragmento ?? '').trim()
  if (!t) return false
  if (NEGADOR.test(t)) return true

  /* Comparación con el fragmento ENTERO: «no» de prefijo haría de «nogal» una
     negación, y de «naproxeno» —que es un alérgeno real— también. */
  const plano = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
  if (NEGACION_COMPLETA.has(plano)) return true

  /* «alergias negadas» → se descuenta la cabecera y se juzga «negadas». */
  const sinCabecera = t.replace(CABECERA_DE_ALERGIAS, '').trim()
  if (sinCabecera && sinCabecera !== t) {
    const planoSin = sinCabecera.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
    return NEGADOR.test(sinCabecera) || NEGACION_COMPLETA.has(planoSin)
  }
  return false
}

/**
 * Cómo se parte el texto libre. Una sola definición: dos splitters distintos
 * daban listas distintas del MISMO campo a la nota y a la receta.
 *
 * ── EL PUNTO, QUE FALTABA (4-ago-2026) ──────────────────────────────────────
 *
 * Sin el punto, «Niega penicilina. **Alérgico a sulfas**» era UN solo fragmento:
 * `esAlergiaNegada` lo filtraba entero y devolvía `[]`. **La alergia a sulfas
 * desaparecía** de la compuerta de la receta, de la nota, del recurso FHIR y del
 * sesgo del reconocedor — los cuatro leen de aquí.
 *
 * El camino hospitalario (`hospital/cds.ts`) ya partía por punto, y su comentario
 * decía por qué: «para no perder una alergia real que venga después de una
 * negada». Conocía el modo de fallo; el canónico no.
 *
 * Se exige **espacio detrás del punto** para no partir abreviaturas ni decimales:
 * «Dr.», «2.5 mg» y «c.s.p.» siguen enteros.
 */
/**
 * ── LA BARRA NO SEPARA: ESTÁ DENTRO DEL NOMBRE (5-ago-2026) ─────────────────
 *
 * Encontrado en el consultorio del Dr., leyendo sus pacientes reales: apareció
 * un alérgeno llamado **«SMX)»**. Venía de esto:
 *
 *     «Trimetoprima/sulfametoxazol (TMP/SMX)»
 *       → ['Trimetoprima', 'sulfametoxazol (TMP', 'SMX)']
 *
 * La barra estaba entre los separadores, y los antimicrobianos combinados —los
 * que él prescribe todos los días— se escriben con barra: TMP/SMX,
 * piperacilina/tazobactam, amoxicilina/clavulanato.
 *
 * ── POR QUÉ ES GRAVE ────────────────────────────────────────────────────────
 *
 * De aquí leen la compuerta de la receta, la nota, el recurso FHIR y el sesgo
 * del reconocedor. Un paciente alérgico a TMP/SMX quedaba registrado como
 * alérgico a «SMX)» — un texto que no coincide con ningún fármaco, así que **el
 * cruce alergia↔fármaco puede no dispararse** justo con el antibiótico al que
 * de verdad es alérgico.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * La barra sólo separa cuando tiene **espacio a algún lado** («penicilina /
 * sulfas» es una lista; «TMP/SMX» es un nombre). Es la misma solución que ya se
 * aplicó al punto: exigir el espacio para no partir lo que va junto.
 */
const SEPARADORES = /[,;\n]+|\s+\/\s*|\s*\/\s+|\.\s+|\sy\s/

/** Los fragmentos NEGADOS del campo, para poder mostrarlos en vez de esconderlos. */
export function negacionesEnTexto(texto: string | undefined): string[] {
  if (!texto?.trim()) return []
  return texto.split(SEPARADORES).map(a => a.trim()).filter(a => a && esAlergiaNegada(a))
}

/**
 * ── LA NEGACIÓN SE ESCRIBE UNA VEZ Y CUBRE TODA LA ENUMERACIÓN — REG-276 ────
 *
 * «Niega alergias a penicilina **y sulfas**» devolvía **`['sulfas']`**.
 *
 * El negador aparece una sola vez, en el primer fragmento, y `SEPARADORES`
 * parte también por « y » y por coma: el resto de la lista salía del separador
 * ya sin la negación que lo cubría, y se registraba como alergia REAL. Medido
 * con el motor el 9-ago-2026, sobre el árbol de producción:
 *
 *     «Niega alergias a penicilina y sulfas»        → ['sulfas']
 *     «Niega alergia a penicilina, sulfas y AINEs»  → ['sulfas', 'AINEs']
 *
 * ── POR QUÉ ES DE LOS CAROS ─────────────────────────────────────────────────
 *
 * Una alergia que **nadie afirmó** apaga el botón de Firmar, se imprime en el
 * recuadro rojo de la receta que va a la farmacia, y se sella dentro de una nota
 * firmada, que es inmutable. En un consultorio de infectología una etiqueta
 * falsa de betalactámicos o de sulfas empuja a segunda línea: **peor
 * tratamiento por un dato inventado**.
 *
 * Y al médico le dejaba como única salida la que este repositorio ya tiene
 * documentada como el fallo a evitar — borrar el texto del expediente, con lo
 * que se pierden a la vez el dato y la compuerta.
 *
 * ── LA REGLA, Y SUS DOS CORTES ──────────────────────────────────────────────
 *
 * Se parte en DOS niveles, porque el campo tiene dos:
 *
 *   · **oración** — un punto, un punto y coma o un salto CIERRAN el alcance de
 *     la negación. «Niega alergias. Alérgico a la penicilina.» son dos cosas.
 *   · **lista** — dentro de una oración, la coma, « y » y « ni » enumeran, y la
 *     negación del principio las cubre a todas.
 *
 * Los dos cortes existen para no cometer el error contrario, **que es el peor**:
 * llevarse por delante una alergia real escrita después de una negada.
 */
const FIN_DE_ORACION = /\.\s+|[;\n]+\s*/
const SEPARADOR_DE_LISTA = /,+|\s+\/\s*|\s*\/\s+|\sy\s|\sni\s/

/**
 * «Alérgico a», «alergia a», «alergias a» delante del primer elemento.
 *
 * Sin quitarlo, «Alérgico a penicilina y sulfas» daba
 * `['Alérgico a penicilina', 'sulfas']`: el primer alérgeno llevaba la frase
 * pegada y **no coincidía con ningún fármaco**, así que el cruce
 * alergia↔medicamento podía no dispararse justo con el que importa. Es
 * exactamente el daño de «SMX)», por otra puerta.
 */
const AFIRMA_ALERGIA = /^\s*(?:es\s+)?(?:al[eé]rgic[oa]\s+a|alergias?\s+a|refiere\s+alergias?\s+a)\s+(?:la\s+|el\s+|los\s+|las\s+)?/i

/** Divide un texto libre de alergias en alérgenos ("Penicilina, Sulfas; Mariscos"). */
export function parsearAlergiasTexto(texto: string | undefined): AlergiaEstructurada[] {
  if (!texto?.trim()) return []
  const fuera: AlergiaEstructurada[] = []

  for (const oracion of texto.split(FIN_DE_ORACION)) {
    if (!oracion.trim()) continue
    /**
     * ¿La ORACIÓN entera niega? Se juzga por su primer fragmento, que es donde
     * se escribe el negador, y la respuesta cubre toda la enumeración.
     */
    const trozos = oracion.split(SEPARADOR_DE_LISTA)
    const niega = esAlergiaNegada(trozos[0]?.trim() ?? '')

    for (const [i, bruto] of trozos.entries()) {
      /**
       * ── EL SEGUNDO CORTE: UN FRAGMENTO QUE AFIRMA ROMPE EL ALCANCE ────────
       *
       * «Niega alergia a penicilina, **alérgico a sulfas**» — la coma enumera,
       * pero el segundo fragmento **dice que sí**. Sin este corte, la negación
       * del principio se lo llevaba por delante y se perdía una alergia REAL:
       * el error contrario, y el peor de los dos.
       *
       * Lo cacé aquí, con las pruebas que ya existían: la primera versión de
       * esta reparación devolvía `[]` para esa frase. Un arreglo de seguridad
       * que borra el dato que protege es peor que el defecto.
       */
      if (niega && !AFIRMA_ALERGIA.test(bruto)) continue
      if (niega && i === 0) continue
      /* El prefijo afirmativo sólo puede ir en el primero de la lista. */
      /**
       * El punto FINAL del texto no lo quita `FIN_DE_ORACION`, que exige un
       * espacio detrás para no partir «2.5 mg». Sin esto, «Alérgico a la
       * penicilina.» daba el alérgeno «penicilina.» — con punto pegado, que no
       * casa con ningún fármaco del catálogo. El mismo daño que «SMX)».
       */
      const f = (i === 0 ? bruto.replace(AFIRMA_ALERGIA, '') : bruto).trim().replace(/[.\s]+$/, '')
      /* Y aun así cada fragmento se juzga: «penicilina, ninguna otra». */
      if (f && !esAlergiaNegada(f)) fuera.push({ alergeno: f })
    }
  }
  return fuera
}

/**
 * Devuelve las alergias estructuradas efectivas de un paciente: las explícitas si
 * existen, si no, las derivadas del texto libre. Deduplica por alérgeno.
 */
export function alergiasDe(p: { alergias?: string; alergiasEstructuradas?: AlergiaEstructurada[] }): AlergiaEstructurada[] {
  const base = (p.alergiasEstructuradas && p.alergiasEstructuradas.length)
    ? p.alergiasEstructuradas.filter(a => a?.alergeno?.trim())
    : parsearAlergiasTexto(p.alergias)
  const vistos = new Set<string>()
  const out: AlergiaEstructurada[] = []
  for (const a of base) {
    const k = a.alergeno.trim().toLowerCase()
    if (!k || vistos.has(k)) continue
    vistos.add(k)
    out.push({ ...a, alergeno: a.alergeno.trim() })
  }
  return out
}

/**
 * LOS ALÉRGENOS, EN TEXTO, PARA QUIEN SÓLO NECESITA LA LISTA.
 *
 * ── POR QUÉ HACE FALTA ESTA FUNCIÓN (v1031) ──────────────────────────────────
 *
 * `SEPARADORES` nació con una nota que decía que **dos splitters distintos daban
 * listas distintas del MISMO campo**. Aun así había **cuatro**: éste, el de las
 * opciones de dictado de la consulta (`/[,;\n]/`), el de UCI (`/[,;\n]+/` con su
 * propia heurística de negación) y el del extractor de entidades.
 *
 * Los tres de fuera perdían exactamente lo mismo:
 *
 * 1. **La barra y la «y».** «Penicilina / Sulfas» y «Penicilina y sulfas» salían
 *    como UN término. Al motor de voz eso le llega como una frase, y el alérgeno
 *    de en medio deja de sesgar nada.
 * 2. **Las negaciones.** «Niega alergias» viajaba como si fuera un alérgeno: se
 *    le enseñaba al reconocedor a esperar esa frase, gastando sitio del sesgo.
 * 3. **`alergiasEstructuradas`.** Un paciente con sus alergias bien capturadas y
 *    el texto libre vacío mandaba CERO — justo el mejor documentado.
 *
 * Y el sitio donde más duele es el sesgo del reconocedor: el cruce
 * alergia↔fármaco compara contra **lo que se oyó**, así que un alérgeno mal
 * transcrito es un cruce que **nunca salta**.
 *
 * Acepta el campo venga como venga —texto libre o ya en lista— porque en el
 * repositorio viene de las dos formas, y eso no lo arregla un llamador.
 */
export function alergenosDe(p: {
  alergias?: string | readonly unknown[]
  alergiasEstructuradas?: AlergiaEstructurada[]
}): string[] {
  const texto = Array.isArray(p.alergias)
    ? p.alergias.map(a => String(typeof a === 'object' && a
        ? ((a as { alergeno?: string }).alergeno ?? '')
        : a)).filter(Boolean).join(', ')
    : (p.alergias as string | undefined)
  return alergiasDe({ alergias: texto, alergiasEstructuradas: p.alergiasEstructuradas })
    .map(a => a.alergeno)
}

/** ¿Hay alguna alergia grave registrada? (para resaltar en la UI/receta). */
export function tieneAlergiaGrave(p: { alergias?: string; alergiasEstructuradas?: AlergiaEstructurada[] }): boolean {
  return alergiasDe(p).some(a => a.severidad === 'grave')
}

/**
 * Texto de alergias para los IMPRESOS (receta, orden, referencia, Word).
 *
 * Por qué existe este helper y por qué debe usarse en TODOS los caminos de
 * impresión: la verificación en pantalla usa `alergiasDe`, que prefiere
 * `alergiasEstructuradas` sobre el texto libre. Los impresos leían solo
 * `patient.alergias`. Un paciente con la alergia únicamente en el campo
 * estructurado veía una alerta roja en pantalla y un papel que decía "Negadas".
 *
 * Hoy ninguna ruta de escritura llena `alergiasEstructuradas`, así que la
 * divergencia no está activa — pero cualquier importación o mapeo desde otro
 * sistema la activa el mismo día. La pantalla y el papel tienen que leer de la
 * misma fuente.
 *
 * Devuelve cadena vacía cuando no hay dato: el impreso decide cómo redactarlo.
 * Lo que NUNCA debe hacer el impreso es afirmar "Negadas" a partir de un campo
 * que simplemente no se llenó — no es lo mismo "el paciente negó alergias" que
 * "nadie preguntó".
 */
export function alergiasParaImpreso(
  p: { alergias?: string; alergiasEstructuradas?: AlergiaEstructurada[] } | null | undefined,
): string {
  if (!p) return ''
  const lista = alergiasDe(p)
  if (!lista.length) return (p.alergias ?? '').trim()
  return lista.map(a => a.alergeno).join(', ')
}

export const POR_QUE_LA_NEGACION_IMPORTA =
  'Porque «Niega alergia a penicilina» hacía saltar la alerta crítica al ' +
  'prescribir amoxicilina, y esa alerta deshabilita Firmar. La única salida del ' +
  'médico era borrar el texto del expediente: se pierde el dato y se pierde la ' +
  'compuerta. Leer lo que el campo dice no es una decisión clínica.'
