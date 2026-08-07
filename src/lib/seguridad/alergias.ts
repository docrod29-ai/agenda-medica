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
const NEGADOR = /^(?:niega|niego|negad[ao]s?|sin|no\s+refiere|no\s+conocid[ao]s?|no\s+presenta|no\s+tiene|no\s+hay|nunca|ausentes?|descartad[ao]s?|ningun[ao])\b/i

/** ¿Este fragmento afirma la ausencia de una alergia? */
export function esAlergiaNegada(fragmento: string): boolean {
  return NEGADOR.test(fragmento.trim())
}

/**
 * MARCAS DE QUE EL FRAGMENTO AFIRMA — cortan el alcance de la negación anterior.
 *
 * «Niega alergia a penicilina, alérgico a sulfas» es un campo real y las dos
 * mitades dicen cosas opuestas. Sin esto, la segunda heredaría la negación de la
 * primera y **la alergia a sulfas desaparecería**, que es el fallo caro.
 */
const AFIRMADOR = /^(?:al[eé]rgic|alergi|hipersensib|reacci[oó]n|refiere|presenta|s[ií]\b)/i

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
const SEPARADORES = /([,]+|[;\n]+|\s+\/\s*|\s*\/\s+|\.\s+|\sy\s)/

/**
 * ── HASTA DÓNDE ALCANZA UNA NEGACIÓN (7-ago-2026, REG-192) ──────────────────
 *
 * `esAlergiaNegada` mira **el principio del fragmento**, y el negador sólo está
 * escrito una vez, en el primero:
 *
 *     «Niega alergias a penicilina y sulfas»
 *       → ['Niega alergias a penicilina', 'sulfas']
 *       → se descarta el primero y **«sulfas» queda como alergia**
 *
 * El paciente que NIEGA la alergia acaba con una alergia inventada. Y de ahí
 * salta la alerta crítica al prescribir TMP/SMX —la que deshabilita Firmar—,
 * se imprime «ALERGIAS: sulfas» en la receta que va a la farmacia y se sella en
 * una nota que ya no se puede tocar. La etiqueta falsa de alergia no es un
 * aviso de más: empuja a segunda línea en el consultorio de un infectólogo.
 *
 * Es exactamente el desenlace que `POR_QUE_LA_NEGACION_IMPORTA` describe como el
 * fallo a evitar. Aquello se arregló para «niega X»; **el campo enumerado se
 * quedó fuera**, y enumerar es como se escribe de verdad.
 *
 * ── LA REGLA, Y POR QUÉ NO ES MÁS AMPLIA ────────────────────────────────────
 *
 * La negación se hereda al fragmento siguiente **dentro de la misma frase**, y
 * deja de heredarse en cuanto aparece cualquiera de las dos cosas:
 *
 * 1. Un **fin de frase** —punto, punto y coma o salto de línea—. Es lo que hace
 *    que «Niega penicilina. Alérgico a sulfas» siga conservando las sulfas: ese
 *    caso se ganó el 4-ago y no se pierde hoy.
 * 2. Una **marca de que el fragmento afirma** (`AFIRMADOR`), para
 *    «Niega alergia a penicilina, alérgico a sulfas».
 *
 * La coma y la «y» heredan; el punto no. Esto no decide nada clínico: lee el
 * alcance de lo que el campo dice. Y lo heredado **no se esconde** — sale por
 * `negacionesEnTexto`, que es lo que existe para poder enseñarlo.
 */
const FIN_DE_FRASE = /^(?:[;\n]+|\.\s+)$/

interface FragmentoDeAlergia {
  texto: string
  /** Descartado por una negación: la suya propia o la de la frase que lo abre. */
  negado: boolean
}

/** Parte el campo y resuelve el alcance de cada negación. Interno: una sola pasada. */
function fragmentarAlergias(texto: string): FragmentoDeAlergia[] {
  // `split` con grupo de captura intercala los separadores: [frag, sep, frag, …].
  const partes = texto.split(SEPARADORES)
  const out: FragmentoDeAlergia[] = []
  let negando = false
  for (let i = 0; i < partes.length; i += 2) {
    if (i > 0 && FIN_DE_FRASE.test(partes[i - 1] ?? '')) negando = false
    const frag = (partes[i] ?? '').trim()
    if (!frag) continue
    if (esAlergiaNegada(frag)) {
      negando = true
      out.push({ texto: frag, negado: true })
      continue
    }
    if (AFIRMADOR.test(frag)) negando = false
    out.push({ texto: frag, negado: negando })
  }
  return out
}

/** Los fragmentos NEGADOS del campo, para poder mostrarlos en vez de esconderlos. */
export function negacionesEnTexto(texto: string | undefined): string[] {
  if (!texto?.trim()) return []
  return fragmentarAlergias(texto).filter(f => f.negado).map(f => f.texto)
}

/** Divide un texto libre de alergias en alérgenos ("Penicilina, Sulfas; Mariscos"). */
export function parsearAlergiasTexto(texto: string | undefined): AlergiaEstructurada[] {
  if (!texto?.trim()) return []
  return fragmentarAlergias(texto)
    .filter(f => !f.negado)
    .map(f => ({ alergeno: f.texto }))
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
