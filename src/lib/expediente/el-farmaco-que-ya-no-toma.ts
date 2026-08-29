/**
 * LO QUE TOMÓ NO ES LO QUE TOMA.
 *
 * ── EL HUECO DE MODELO QUE ESTE MÓDULO CUBRE ─────────────────────────────────
 *
 * `estadoDeOrden()` trata la **ausencia** de `estado` como `activa`, y con razón:
 * todo lo prescrito antes de que el campo existiera no lo lleva, y suponer otra
 * cosa vaciaría de golpe la medicación de todos los expedientes históricos.
 *
 * Pero el esquema de extracción **no tiene campo `estado`**. Así que un fármaco
 * que el modelo saca del dictado entra con `estado` ausente, y por esa misma
 * regla se vuelve **medicación activa**:
 *
 *     «le dieron warfarina cuando la operaron, ya no la toma»
 *       → medicamento: Warfarina, sin estado
 *       → estadoDeOrden() → 'activa'
 *       → medicamentosVigentes() la incluye
 *       → sale en «Toma:», entra al cuadro de los motores, y dispara la regla
 *         de sangrado sobre un fármaco que el paciente dejó hace años
 *
 * **Una mención histórica se convirtió en medicación vigente.** Y el eje temporal
 * que este repositorio ya tiene —`temporalidad.ts`— sólo vigila **padecimientos**:
 * su vocabulario son `CRONICAS` y `AGUDAS_FRECUENTES`, no fármacos. Los
 * medicamentos no tenían ninguna defensa temporal.
 *
 * ── LO QUE ESTE MÓDULO HACE, Y LO QUE NO DEBE HACER ──────────────────────────
 *
 * **No reclasifica.** No pone `suspendida`, no saca nada de la lista y no decide
 * que el paciente dejó el fármaco. Eso es una decisión clínica y la toma el
 * médico —que ya tiene el botón «ya no» al lado de cada renglón vigente—.
 *
 * Lo que hace es **señalar la contradicción**: este fármaco está en la lista como
 * vigente y lo único que el dictado dice de él está en pasado. Es exactamente el
 * criterio de `desajustesTemporales`, aplicado al otro eje.
 *
 * Y **sólo mira lo que el dictado nombra**. Un fármaco crónico que viene del
 * expediente y hoy no se mencionó **no se toca**: el silencio no suspende nada
 * (`ordenes-medicamento.ts`), y confundir «hoy no se habló de él» con «lo dejó»
 * sería el defecto contrario, que es el caro.
 *
 * ── POR QUÉ SE AVISA Y NO SE CORRIGE ─────────────────────────────────────────
 *
 * Porque «ya no la toma» y «se la suspendimos y la vamos a reanudar» se dictan
 * igual de pasado, y la diferencia la sabe el médico. Un módulo que decidiera
 * por él estaría escribiendo el estado de una orden —de donde cuelgan la receta,
 * las interacciones y el ajuste renal— sin que nadie lo confirmara.
 *
 * Módulo PURO.
 */
import { frases, comoPalabra } from '@/lib/expediente/negaciones'

/**
 * Longitud mínima del nombre para buscarlo en el dictado.
 *
 * El mismo criterio que el resto de los emparejadores de este repositorio, y por
 * la misma razón: un nombre corto casa con cualquier cosa, y un aviso que salta
 * de más se aprende a cerrar.
 */
export const MINIMO_NOMBRE = 5

const sinAcentos = (s: string) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * ── PASADO GRAMATICAL ≠ FÁRMACO TERMINADO (REG-374) ──────────────────────────
 *
 * La primera versión de este módulo usaba `esFrasePasada`, que es la defensa
 * temporal de los PADECIMIENTOS. Ahí funciona: «tuvo neumonía hace tres días»
 * sigue siendo un antecedente. Con un fármaco es falso:
 *
 *     «le receté amoxicilina hace tres días por la faringitis»
 *
 * está en pasado gramatical y el paciente **la está tomando ahora mismo** — va a
 * mitad de un ciclo de siete días. Con la regla anterior, este módulo avisaba
 * sobre todos los antibióticos recién iniciados, que es el caso más frecuente de
 * la consulta. Un aviso que salta de más se aprende a cerrar, y entonces deja de
 * proteger del caso que sí importa.
 *
 * Lo que separa «lo tomó» de «lo toma» no es el tiempo verbal: es que alguien
 * diga que **acabó**, o que lo sitúe en un pasado que ya no puede ser hoy.
 *
 * Por eso NO hay ningún umbral de días aquí. «Hace cuántos días deja de estar
 * tomándolo» es una pregunta clínica y depende del fármaco; elegir un número
 * sería inventar una cifra (regla 1). Se exige una de dos cosas dichas:
 */

/** Alguien dijo que se acabó. Es la evidencia directa. */
const CESACION = new RegExp([
  '\\bya\\s+no\\s+(?:la|lo|las|los)?\\s*(?:toma|tomo|usa|uso|recibe|recibia)\\b',
  '\\bdej[oó]\\s+de\\s+(?:tomar|usar|recibir)\\b',
  '\\b(?:se\\s+(?:le|lo|la)\\s+)?suspend(?:i[oó]|imos|ieron|ida|ido)\\b',
  '\\b(?:se\\s+(?:le|lo|la)\\s+)?retir(?:[oó]|amos|aron|ado|ada)\\b',
  '\\b(?:ya\\s+)?(?:termin[oó]|acab[oó]|complet[oó])\\s+(?:el|la|con)?\\s*(?:ciclo|tratamiento|esquema)?\\b',
  '\\bno\\s+(?:la|lo|las|los)\\s+(?:toma|est[aá]\\s+tomando)\\b',
].join('|'), 'i')

/**
 * Lo sitúa en un pasado que ya no puede ser el tratamiento de hoy.
 *
 * Años y un año concreto, no días ni semanas: un fármaco de «hace tres días»
 * puede estar corriendo, y uno de «hace tres años» o «cuando la operaron» no es
 * el de esta consulta. La línea está en la UNIDAD de tiempo que se dijo, no en
 * un número que haya que elegir.
 */
const REMOTO = new RegExp([
  '(?<!desde\\s)\\bhace\\s+(?:\\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|varios|muchos|algunos)\\s*a[nñ]os?\\b',
  '\\ben\\s+(?:19|20)\\d{2}\\b',
  '\\b(?:le\\s+)?(?:operaron|oper[oó]|intervinieron)\\b',
  '\\b(?:de|en\\s+la)\\s+(?:ni[nñ]o|ni[nñ]a|infancia|juventud)\\b',
  '\\bcuando\\s+(?:lo|la|le)\\s+(?:internaron|hospitalizaron|operaron)\\b',
].join('|'), 'i')

/**
 * ¿Esta frase dice que el fármaco YA NO se está tomando?
 *
 * No basta el pasado gramatical: hace falta que alguien diga que acabó, o que lo
 * sitúe en un pasado que no puede ser el tratamiento de hoy.
 */
export function diceQueYaNoLoToma(frase: string): boolean {
  const t = sinAcentos(frase)
  return CESACION.test(t) || REMOTO.test(t)
}

export interface FarmacoSoloEnPasado {
  /** Tal como está en la lista vigente. */
  nombre: string
  /** La frase del dictado que lo sitúa en el pasado, para juzgar sin abrir el audio. */
  cita: string
}

/** La primera palabra larga del nombre — «Warfarina 5 mg» busca «warfarina». */
function palabraBuscable(nombre: string): string {
  return sinAcentos(nombre)
    .split(/[^a-z0-9]+/)
    .find(w => w.length >= MINIMO_NOMBRE) ?? ''
}

/**
 * Los fármacos de la lista VIGENTE que el dictado sólo nombra en pasado.
 *
 * @param vigentes      Lo que hoy figura como que el paciente toma.
 * @param transcripcion El dictado de esta consulta.
 */
export function farmacosSoloMencionadosEnPasado(
  vigentes: readonly { nombre?: string }[] | undefined,
  transcripcion: string,
): FarmacoSoloEnPasado[] {
  const texto = String(transcripcion ?? '')
  if (!texto.trim()) return []

  const oraciones = frases(texto)
  const fuera: FarmacoSoloEnPasado[] = []
  const vistos = new Set<string>()

  for (const m of vigentes ?? []) {
    const nombre = String(m?.nombre ?? '').trim()
    const buscable = palabraBuscable(nombre)
    /* Sin palabra buscable NO se opina: es preferible callar que avisar sobre
       algo que no se ha podido comprobar. Regla 5. */
    if (!nombre || !buscable || vistos.has(buscable)) continue
    vistos.add(buscable)

    const donde = oraciones.filter(f => comoPalabra(buscable).test(sinAcentos(f)))
    /**
     * El dictado no lo nombra: **no es asunto de este módulo**.
     *
     * Viene del expediente, y el silencio de hoy no suspende nada. Tratar la
     * ausencia como abandono es el defecto contrario, y es el caro: borraría
     * medicación crónica de la lista que el médico lee antes de prescribir.
     */
    if (!donde.length) continue

    /* Basta UNA mención que NO diga que acabó para que no haya nada que decir.
       Sólo cuando TODAS las menciones dicen que ya no lo toma hay contradicción
       con que figure como vigente. */
    if (donde.some(f => !diceQueYaNoLoToma(f))) continue

    fuera.push({ nombre, cita: donde[0].trim().slice(0, 200) })
  }
  return fuera
}

/** Cómo se le dice al médico. Nombra el fármaco y cita la frase. */
export function avisoDeFarmacoEnPasado(f: FarmacoSoloEnPasado): string {
  return `«${f.cita}» — y ${f.nombre} figura como medicación vigente. ` +
    'Si ya no lo toma, márcalo con «ya no»; si sigue tomándolo, déjalo.'
}

export const POR_QUE_NO_LO_SUSPENDE_SOLO =
  'Porque «ya no la toma» y «se la suspendimos y la vamos a reanudar» se dictan ' +
  'igual de pasado, y la diferencia la sabe el médico. Escribir el estado de una ' +
  'orden —de donde cuelgan la receta, las interacciones y el ajuste renal— sin ' +
  'que nadie lo confirme es decidir por él.'

export const POR_QUE_EL_PASADO_NO_BASTA =
  'Porque «le receté amoxicilina hace tres días» está en pasado gramatical y el ' +
  'paciente la está tomando ahora mismo, a mitad de un ciclo de siete días. Lo ' +
  'que separa «lo tomó» de «lo toma» no es el tiempo verbal: es que alguien diga ' +
  'que acabó, o que lo sitúe en un pasado que ya no puede ser hoy. Y no hay ' +
  'umbral de días: cuántos días deja de estar tomándolo es una pregunta clínica ' +
  'que depende del fármaco, y elegir un número sería inventar una cifra.'

export const POR_QUE_EL_SILENCIO_NO_CUENTA =
  'Porque un fármaco crónico que viene del expediente y hoy no se mencionó no ' +
  'está en pasado: es que hoy no se habló de él. Tratar esa ausencia como ' +
  'abandono borraría medicación crónica de la lista que el médico lee antes de ' +
  'prescribir, que es el error caro.'
