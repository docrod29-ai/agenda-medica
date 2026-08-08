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
 *
 * ── LA UNIÓN DE LOS DOS NEGADORES (7-ago-2026, REG-202) ─────────────────────
 *
 * REG-201 trajo el punto de orden hospitalario a este parser, y con la mudanza
 * se quedó atrás el negador que ese camino tenía: él conocía «nunca», «ausente»
 * y `descart` a secas; éste conocía «ninguna», «no conocidas» y «no tiene» —
 * pero no «no hay». El resultado fue que un campo que decía «nunca ha tenido
 * reacción a penicilina» dejó de estar negado y pasó a valer como alergia,
 * sacando una CRÍTICA en el punto de orden donde el hospital llevaba meses sin
 * sacarla. Unificar dos motores no puede empeorar a ninguno de los dos: el
 * negador canónico es la UNIÓN.
 *
 * Ninguna de las palabras añadidas puede encabezar el nombre de un alérgeno
 * —no hay fármaco que se llame «nunca» ni «ausente»—, que es la condición para
 * que ampliar un negador no esconda una alergia real. Ampliar sin esa condición
 * sería justo el error contrario, y aquí es el caro.
 */
const NEGADOR = /^(?:niega|niego|negad[ao]s?|sin|no\s+refiere|no\s+conocid[ao]s?|no\s+presenta|no\s+tiene|no\s+hay|descart\w*|ningun[ao]|nunca|ausentes?)\b/i

/** ¿Este fragmento afirma la ausencia de una alergia? */
export function esAlergiaNegada(fragmento: string): boolean {
  return NEGADOR.test(fragmento.trim())
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

/** Divide un texto libre de alergias en alérgenos ("Penicilina, Sulfas; Mariscos"). */
export function parsearAlergiasTexto(texto: string | undefined): AlergiaEstructurada[] {
  if (!texto?.trim()) return []
  return texto
    .split(SEPARADORES)
    .map(a => a.trim())
    .filter(Boolean)
    .filter(a => !esAlergiaNegada(a))
    .map(alergeno => ({ alergeno }))
}

/**
 * El campo reducido a texto. En el repositorio llega de las dos formas —cadena
 * del expediente y lista ya partida por quien lo leyó antes— y normalizarlo aquí
 * es lo que permite que todos entren por la misma puerta sin que cada llamador
 * se invente su conversión.
 */
export function textoDeAlergias(alergias?: string | readonly unknown[]): string | undefined {
  if (!Array.isArray(alergias)) return alergias as string | undefined
  return alergias
    .map(a => String(typeof a === 'object' && a ? ((a as { alergeno?: string }).alergeno ?? '') : a))
    .filter(Boolean)
    .join(', ')
}

/**
 * Devuelve las alergias estructuradas efectivas de un paciente: las explícitas si
 * existen, si no, las derivadas del texto libre. Deduplica por alérgeno.
 */
export function alergiasDe(p: {
  alergias?: string | readonly unknown[]
  alergiasEstructuradas?: AlergiaEstructurada[]
}): AlergiaEstructurada[] {
  const base = (p.alergiasEstructuradas && p.alergiasEstructuradas.length)
    ? p.alergiasEstructuradas.filter(a => a?.alergeno?.trim())
    : parsearAlergiasTexto(textoDeAlergias(p.alergias))
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
  return alergiasDe(p).map(a => a.alergeno)
}

/**
 * LO QUE UNA PANTALLA PUEDE AFIRMAR SOBRE EL CAMPO.
 *
 * ── LA FRANJA DEL INTERNAMIENTO NEGABA UNA ALERGIA QUE SÍ ESTABA (8-ago) ─────
 *
 * REG-201 llevó al punto de orden al parser canónico y amplió el guardián a
 * `src/` entero. La franja de alergias del internamiento —la que ve TODO el
 * equipo del piso durante todo el ingreso, enfermería que administra incluida—
 * se quedó con el suyo, y el guardián no la vio: **copia el campo a una variable
 * antes de partirlo**, así que la palabra «alergias» y el `.split(` quedan en
 * líneas distintas y el barrido pasa de largo.
 *
 * Partía por `/[,;\n]+/`. Sin el punto, «Niega penicilina. Alérgico a sulfas»
 * era UN fragmento; su regla de negación —«un solo fragmento que empiece por
 * niega/no/ninguna/sin»— daba entonces `negadas = true`, y la franja anunciaba:
 *
 *     «Alergias negadas por el paciente.»
 *
 * Sobre un paciente alérgico a sulfas. No es que faltara un aviso: es el sistema
 * **afirmando la ausencia**, y para quien prescribe a mano sin pasar por el punto
 * de orden era la única señal que había.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * `negadas` sólo es cierto cuando **no queda ningún alérgeno** y además hay al
 * menos un fragmento negado. Un campo vacío no niega nada: eso es «sin
 * registro», y se dice distinto. Ausencia de dato no es dato de ausencia.
 */
export interface EstadoAlergias {
  /** Los alérgenos efectivos, ya deduplicados. Vacío NO significa «no tiene». */
  alergenos: string[]
  /** El campo AFIRMA la ausencia: hay negación explícita y no queda alérgeno. */
  negadas: boolean
}

export function estadoAlergias(p: {
  alergias?: string | readonly unknown[]
  alergiasEstructuradas?: AlergiaEstructurada[]
}): EstadoAlergias {
  const alergenos = alergenosDe(p)
  return {
    alergenos,
    negadas: alergenos.length === 0 && negacionesEnTexto(textoDeAlergias(p.alergias)).length > 0,
  }
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
