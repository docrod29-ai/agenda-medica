/**
 * EL PASADO NO ES EL PRESENTE — «tuvo neumonía hace 3 años» ≠ «tiene neumonía».
 *
 * ── DE DÓNDE SALE ESTO ───────────────────────────────────────────────────────
 *
 * De la propia auditoría de voz del charter, sección «lo que NO se mide»: la
 * negación ya tiene su motor determinista y su caso oro desde la v985, y **la
 * temporalidad no tiene nada**. Es el hueco hermano del que costó tres versiones
 * reparar: allí el interrogatorio nombraba la enfermedad en la PREGUNTA y el
 * extractor la cosechaba; aquí la nombra en PASADO y se cosecha igual.
 *
 * El daño es el mismo y se arrastra igual. Una neumonía de hace tres años
 * escrita como diagnóstico actual queda en el expediente, se copia a la nota
 * siguiente y cambia lo que otro médico lee dentro de seis meses.
 *
 * ── ESTO ES GRAMÁTICA, NO MEDICINA ───────────────────────────────────────────
 *
 * El motor mira **cómo se dijo la frase**: el tiempo del verbo y las marcas de
 * cuándo. No decide si una enfermedad sigue activa —eso es una decisión clínica
 * y no es suya—: decide si el dictado la puso en pasado y la nota la afirma en
 * presente. Es el mismo criterio de la intención de orden (REG-130): se juzga el
 * encuadre de la frase, no el hecho clínico.
 *
 * ── LA TRAMPA QUE HAY QUE EVITAR ─────────────────────────────────────────────
 *
 * «Hace tres años» **no** significa pasado por sí sola. «Desde hace tres años
 * tiene diabetes» es presente y es la forma normal de decirlo en la consulta
 * mexicana. Marcar eso sería peor que no mirar nada: un aviso que salta cuando
 * no debe se acaba ignorando, y con él se ignoran los que sí importan.
 *
 * Por eso el presente MANDA sobre la marca de tiempo, no al revés.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No borra, no reclasifica y no decide. Avisa de que el dictado y la nota no
 * concuerdan en el TIEMPO, con las dos frases delante, para que el médico lo
 * resuelva antes de firmar. Puede que la nota tenga razón: una neumonía de hace
 * tres años puede seguir importando como antecedente, y escribirla no es un
 * error. Lo que no puede es pasar en silencio.
 *
 * Módulo PURO.
 */
import { CRONICAS, frases, cronicasEn } from '@/lib/expediente/negaciones'
import { primeraMencionSinEscudo } from '@/lib/expediente/mencion-en-la-nota'

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Cantidades como llegan del dictado: en cifra o en letra.
 *
 * Se comparte entre «hace N años» y «a los N años» porque son la misma cuenta
 * dicha dos veces; tenerla escrita dos veces fue cómo se desincronizaron otras
 * listas de este repositorio.
 */
const NUMERO =
  '(?:\\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|varios|muchos|algunos)'

/**
 * Unidades de tiempo.
 *
 * ── EL DEFECTO QUE ESTO REPARA (REG-207) ─────────────────────────────────────
 *
 * Aquí decía `meses?`, que es «mese» con una ese opcional: casaba «meses» y
 * «mese», y **nunca «mes»**. Así que «hace un mes tuvo neumonía» —de las formas
 * más comunes de fechar algo en una consulta— no se veía. El plural de «mes» es
 * «meses», no «mes» + «es», y una `?` puesta por analogía con «años» se llevó
 * por delante todo un mes de historia clínica sin romper una sola prueba.
 */
const UNIDAD_TIEMPO = '(?:anos?|mes(?:es)?|semanas?|dias?)'

/**
 * EL VERBO en pasado — pretérito, copretérito, pasiva o infinitivo compuesto.
 *
 * Esta familia **manda**: un verbo en pasado sitúa la frase en el pasado aunque
 * más adelante aparezca un verbo de estado. «Tuvo neumonía» es pasado, punto.
 *
 * Que falte una forma significa que ese caso no se vigila — no que se dé por
 * bueno. Este motor sólo puede señalar de menos, nunca de más.
 */
const PASADO_VERBO = new RegExp([
  '\\b(?:tuvo|tuve|tenia|tenian|padecio|padeci|padecia|sufrio|sufri|presento)\\b',
  '\\b(?:le\\s+)?(?:operaron|extirparon|quitaron|resecaron)\\b',
  '\\b(?:ya\\s+)?se\\s+le\\s+(?:quito|curo|resolvio)\\b',
  /**
   * La pasiva es como se cuenta lo que le hicieron en un hospital —«fue operado
   * de apendicectomía»— y no tiene lectura en presente: «fue» ya es pretérito.
   */
  '\\bfue\\s+(?:operad|intervenid|hospitalizad|diagnosticad|tratad)[oa]\\b',
  /**
   * El infinitivo compuesto llega por el interrogatorio dirigido: el médico
   * dicta «refiere haber tenido…», y el verbo que manda («refiere») está en
   * presente aunque lo referido sea pasado. Lo que fecha la frase es el
   * «haber tenido».
   */
  '\\bhaber\\s+(?:tenido|padecido|sufrido|presentado|estado)\\b',
  '\\banteriormente\\b',
  '\\ben\\s+el\\s+pasado\\b',
].join('|'), 'i')

/**
 * LA MARCA DE CUÁNDO, sin verbo que la acompañe.
 *
 * Esta familia **cede** ante un verbo de estado en presente: ver
 * `PRESENTE_DE_ESTADO`, que es la reparación de fondo de REG-207.
 */
const PASADO_MARCA = new RegExp([
  `\\bhace\\s+${NUMERO}\\s*${UNIDAD_TIEMPO}\\b`,
  '\\ben\\s+(?:19|20)\\d{2}\\b',
  /**
   * `de la infancia` faltaba: la lista pedía «de» pegado al sustantivo o «en la»
   * delante, y «de la infancia» no es ninguno de los dos. Se dice de las cuatro
   * maneras, así que el artículo va suelto.
   */
  '\\b(?:de|en)\\s+(?:la\\s+)?(?:nino|nina|infancia|juventud|adolescencia)\\b',
  /** «el año pasado», «la semana pasada», «el invierno pasado». */
  '\\b(?:el|la)\\s+(?:ano|mes|semana|invierno|verano|primavera|otono|temporada)\\s+pasad[oa]\\b',
  /** La edad a la que ocurrió: «a los quince años», «a los 12 años». */
  `\\ba\\s+los\\s+${NUMERO}\\s*anos\\b`,
  '\\banos\\s+atras\\b',
].join('|'), 'i')

/**
 * Marcas de que, pese a todo, la frase habla del PRESENTE.
 *
 * Manda sobre `PASADO`. «Desde hace tres años tiene diabetes» trae una marca de
 * tiempo y es presente; «sigue con», «todavía» y «actualmente» dicen
 * explícitamente que continúa. Sin esta prioridad, el motor marcaría justo la
 * forma más común de contar un padecimiento crónico.
 */
const PRESENTE = new RegExp([
  '\\bdesde\\s+hace\\b',
  '\\bdesde\\s+(?:los\\s+)?(?:19|20)\\d{2}\\b',
  '\\b(?:sigue|continua|persiste|permanece)\\b',
  '\\b(?:todavia|aun|actualmente|hoy\\s+en\\s+dia|en\\s+la\\s+actualidad)\\b',
  '\\b(?:tiene|padece|cursa|presenta)\\s+(?:actualmente|todavia)\\b',
  '\\ben\\s+control\\b',
  '\\ben\\s+tratamiento\\b',
].join('|'), 'i')

/**
 * EL VERBO DE ESTADO en presente — «tiene», «presenta», «cursa con».
 *
 * ── EL DEFECTO QUE ESTO REPARA (REG-207) ─────────────────────────────────────
 *
 * El corpus oro destapó el falso positivo más caro que podía tener este motor:
 *
 *     «Hace tres días inició con fiebre y tiene neumonía.»
 *
 * La marca «hace tres días» lo mandaba al pasado, y esa frase es el
 * **padecimiento actual** — la forma en que se dicta SIEMPRE el motivo de
 * consulta, porque lo primero que se pregunta es cuánto lleva. El motor avisaba
 * de que la nota afirmaba como actual una neumonía que es actual.
 *
 * Es exactamente la trampa que el módulo ya tenía escrita para «desde hace», con
 * otra forma: la marca de tiempo mide la DURACIÓN de lo de ahora, no la fecha de
 * lo de antes. Y su daño es el de siempre — un aviso que salta donde no debe se
 * acaba ignorando, y con él se ignoran los que sí importan.
 *
 * ── POR QUÉ SÓLO VETA A LA MARCA, NO AL VERBO EN PASADO ──────────────────────
 *
 * «Tuvo neumonía hace tres años y tiene diabetes» tiene las dos cosas. Si el
 * verbo de estado venciera al pretérito, el titular del motor dejaría de
 * cazarse. Por eso el orden es: presente explícito → verbo en pasado → marca de
 * tiempo vetada por el verbo de estado.
 *
 * ── POR QUÉ «REFIERE» NO ESTÁ AQUÍ ───────────────────────────────────────────
 *
 * «Refiere tuberculosis hace diez años» es presente en la forma y pasado en el
 * hecho: «refiere» es lo que hace el paciente ahora, no lo que le pasa. Un verbo
 * de decir no es un verbo de estado, y meterlo aquí apagaría el interrogatorio
 * entero, que es justo donde se cuenta el pasado.
 */
const PRESENTE_DE_ESTADO = new RegExp([
  '\\b(?:tiene|tienen|padece|padecen|presenta|presentan|cursa|cursan|manifiesta)\\b',
  '\\besta\\s+con\\b',
].join('|'), 'i')

/**
 * VOCABULARIO PROPIO DE ESTE MOTOR — lo AGUDO, que es lo que más se cuenta en
 * pasado.
 *
 * ── EL DEFECTO QUE ESTO REPARA (v1030) ───────────────────────────────────────
 *
 * La v1027 reutilizó sólo el vocabulario de `negaciones.ts`, que es de
 * enfermedades **crónicas** —las del interrogatorio dirigido—. Y el ejemplo con
 * el que se bautizó el motor en todas partes, «tuvo neumonía hace tres años»,
 * **no lo cazaba**: «neumonía» no es una crónica y no estaba en ninguna lista.
 *
 * O sea que el motor funcionaba y no cubría su propio titular. Es el tipo de
 * hueco que no falla, no rompe una prueba y hace creer que algo está vigilado.
 *
 * Y es justo al revés de lo que pide el problema: lo que se cuenta en pasado es
 * lo AGUDO —una neumonía, una fractura, una cirugía—, mientras que lo crónico
 * casi siempre sigue activo.
 *
 * ── QUÉ ES ESTA LISTA, Y QUÉ NO ──────────────────────────────────────────────
 *
 * Es **vocabulario**, igual que `CRONICAS`: no es una lista de diagnósticos
 * válidos ni un criterio clínico, y no decide nada sobre ningún paciente. Que
 * falte un padecimiento significa que ese caso no se vigila — **no que se dé por
 * bueno**. Este motor sólo puede señalar de menos, nunca de más.
 */
export const AGUDAS_FRECUENTES: { canonica: string; formas: readonly string[] }[] = [
  { canonica: 'neumonía', formas: ['neumonía', 'neumonia', 'bronconeumonía', 'bronconeumonia'] },
  { canonica: 'COVID-19', formas: ['covid', 'covid-19', 'coronavirus', 'sars-cov-2'] },
  { canonica: 'fractura', formas: ['fractura', 'fracturas', 'fracturó', 'fracturo'] },
  /**
   * «Le operaron» entra como forma de «cirugía» a propósito: en la consulta se
   * cuenta así, con el verbo. «Lo van a operar» NO — ése es el futuro, y en el
   * futuro no hay nada que corregir.
   */
  { canonica: 'cirugía', formas: ['cirugía', 'cirugia', 'operación', 'operacion', 'operaron', 'operado', 'operada', 'apendicectomía', 'apendicectomia', 'colecistectomía', 'colecistectomia'] },
  { canonica: 'trombosis venosa', formas: ['trombosis', 'tvp', 'trombosis venosa'] },
  { canonica: 'embolia pulmonar', formas: ['embolia pulmonar', 'tromboembolia', 'tep'] },
  { canonica: 'evento vascular cerebral', formas: ['evento vascular', 'evc', 'embolia cerebral', 'derrame'] },
  { canonica: 'hemorragia digestiva', formas: ['hemorragia digestiva', 'sangrado de tubo digestivo', 'stda'] },
  { canonica: 'pancreatitis', formas: ['pancreatitis'] },
  { canonica: 'infección urinaria', formas: ['infección urinaria', 'infeccion urinaria', 'ivu', 'cistitis', 'pielonefritis'] },
  { canonica: 'dengue', formas: ['dengue'] },
  { canonica: 'hepatitis', formas: ['hepatitis'] },
]

/** El vocabulario completo que este motor mira: lo crónico y lo agudo. */
const VOCABULARIO = () => [...CRONICAS, ...AGUDAS_FRECUENTES]

/**
 * Qué padecimientos nombra esta frase, de los DOS vocabularios.
 *
 * `cronicasEn` sigue viviendo en `negaciones.ts` y no se toca: allí el
 * vocabulario es el del interrogatorio dirigido y ensancharlo cambiaría lo que
 * se considera una negación, que es otra defensa y otra decisión.
 */
export function padecimientosEn(frase: string): string[] {
  const t = sinAcentos(frase)
  const out = [...cronicasEn(frase)]
  for (const c of AGUDAS_FRECUENTES) {
    if (c.formas.some(f => t.includes(sinAcentos(f))) && !out.includes(c.canonica)) out.push(c.canonica)
  }
  return out
}

/**
 * ¿Esta frase encuadra lo que dice en el pasado?
 *
 * El orden de las tres preguntas ES la política, y está razonado arriba en cada
 * lista: el presente explícito manda sobre todo; el verbo en pasado manda sobre
 * la marca de tiempo; y la marca de tiempo sola cede ante un verbo de estado en
 * presente, que es lo que distingue el padecimiento actual de un antecedente.
 */
export function esFrasePasada(frase: string): boolean {
  const t = sinAcentos(frase)
  if (PRESENTE.test(t)) return false
  if (PASADO_VERBO.test(t)) return true
  if (!PASADO_MARCA.test(t)) return false
  return !PRESENTE_DE_ESTADO.test(t)
}

export interface MencionPasada {
  condicion: string
  /** La frase entera, para que el médico juzgue sin abrir el audio. */
  cita: string
}

/**
 * Lo que el dictado situó en el pasado.
 *
 * Se reutiliza el vocabulario de `negaciones.ts` a propósito: es el mismo
 * diccionario y mantener dos listas garantiza que se separen. Lo que falte no se
 * vigila —y así está declarado allí—, no se da por bueno.
 */
export function mencionesEnPasado(transcripcion: string): MencionPasada[] {
  const vistas = new Map<string, MencionPasada>()
  for (const f of frases(transcripcion)) {
    if (!esFrasePasada(f)) continue
    for (const c of padecimientosEn(f)) {
      if (!vistas.has(c)) vistas.set(c, { condicion: c, cita: f.trim().slice(0, 200) })
    }
  }
  return [...vistas.values()]
}

/** Cómo se escribe correctamente un padecimiento pasado en la nota. */
const YA_ES_ANTECEDENTE = new RegExp([
  '\\bantecedente[s]?\\s+(?:de|personal(?:es)?\\s+de|patologico[s]?\\s+de)?\\s*$',
  '\\bantecedente[s]?\\b',
  '\\b(?:tuvo|tenia|padecio|padecia)\\b',
  '\\bhistoria\\s+de\\b',
  '\\bprevio[s]?\\b|\\bprevia[s]?\\b',
  '\\bresuelto[s]?\\b|\\bresuelta[s]?\\b',
].join('|'), 'i')

export interface DesajusteTemporal extends MencionPasada {
  /** El fragmento de la nota que lo afirma en presente. */
  enLaNota: string
}

/**
 * Dónde la nota afirma en PRESENTE algo que el dictado puso en pasado.
 *
 * Igual que en las negaciones, una mención no basta: si la nota ya lo escribió
 * como antecedente —«antecedente de neumonía», «tuvo neumonía»—, está bien
 * escrito y no hay nada que avisar. Sólo importa cuando la nota lo presenta como
 * algo de ahora.
 *
 * Y se miran **todas** las apariciones: el antecedente bien escrito de arriba le
 * compraba el silencio a la impresión diagnóstica de abajo, que es la que cambia
 * la conducta de hoy (REG-192).
 */
export function desajustesTemporales(
  pasadas: readonly MencionPasada[],
  textoNota: string,
): DesajusteTemporal[] {
  const out: DesajusteTemporal[] = []
  for (const m of pasadas) {
    const formas = VOCABULARIO().find(c => c.canonica === m.condicion)?.formas ?? [m.condicion]
    const enc = primeraMencionSinEscudo(textoNota, formas, YA_ES_ANTECEDENTE)
    if (enc) out.push({ ...m, enLaNota: enc.cita })
  }
  return out
}

/**
 * El aviso, redactado para resolverse sin volver al audio.
 *
 * Dice lo que se oyó y lo que se escribió, en ese orden, y **no dice cuál es
 * correcta**: un padecimiento de hace años puede seguir importando como
 * antecedente y escribirlo no es un error. La que no vale es la versión que
 * nadie miró.
 */
export function avisoDeDesajuste(d: DesajusteTemporal): string {
  return `«${d.condicion}»: en el dictado se dijo en pasado (${d.cita}), pero la nota lo afirma como actual (…${d.enLaNota}…). Revisa si es antecedente o padecimiento actual antes de firmar.`
}

export const POR_QUE_EL_PRESENTE_MANDA =
  '«Desde hace tres años tiene diabetes» trae una marca de tiempo y es ' +
  'presente — es la forma normal de contar un padecimiento crónico en la ' +
  'consulta. Si la marca de tiempo pesara más que el verbo, el aviso saltaría ' +
  'justo en el caso más común, y un aviso que salta cuando no debe se acaba ' +
  'ignorando: con él se ignoran los que sí importan.'

export const POR_QUE_NO_DECIDE =
  'El motor no decide si una enfermedad sigue activa: eso es clínico y no es ' +
  'suyo. Decide si el dictado la puso en pasado y la nota la afirma en ' +
  'presente. Es el encuadre de la frase — gramática, no medicina — igual que la ' +
  'intención de orden.'

export const POR_QUE_IMPORTA =
  'Una neumonía de hace tres años escrita como diagnóstico actual se queda en ' +
  'el expediente, se copia a la nota siguiente y cambia lo que otro médico lee ' +
  'dentro de seis meses. Es el mismo arrastre que el antecedente inventado por ' +
  'la pregunta del interrogatorio.'

/**
 * ── LA MISMA DEFENSA EN EL EXTRACTOR DE ENTIDADES ────────────────────────────
 *
 * La nota no es la única puerta. El panel «Extraer entidades clínicas» corre
 * sobre EL MISMO texto y devuelve `conditions` con un `estado` que **nace en
 * `activo` por omisión del esquema**. Así que una neumonía dicha en pasado sale
 * como una condición activa — y una entidad estructurada tiene peor pinta que
 * una frase: parece un dato verificado.
 *
 * Es exactamente lo que ya pasó con las negaciones, y por eso allí se dejó
 * escrito que arreglarlo en una pantalla dejaría la otra rota.
 *
 * ── PERO AQUÍ NO SE RECLASIFICA ──────────────────────────────────────────────
 *
 * Con una negación se puede: el paciente dijo que no, y `descartado` es lo que
 * él afirmó. Aquí no hay nada equivalente. Pasar una condición a `resuelto`
 * porque la frase iba en pasado **sería una decisión clínica**: una neumonía de
 * hace tres años puede estar resuelta y una cardiopatía de hace tres años no lo
 * está por haberla contado en pretérito.
 *
 * Así que se **señala y no se toca**. Es menos vistoso y es lo único honesto.
 */
export interface CondicionExtraidaTemporal {
  texto?: unknown
  estado?: string
  [k: string]: unknown
}

export interface AvisoTemporalExtractor {
  texto: string
  condicion: string
  cita: string
}

/**
 * Qué condiciones extraídas como ACTIVAS venían dichas en pasado.
 *
 * No modifica ninguna: devuelve la lista para enseñarla. Si el extractor ya la
 * puso como `resuelto`, acertó — ni se anota ni se avisa.
 */
export function avisosTemporalesDelExtractor<T extends CondicionExtraidaTemporal>(
  conditions: readonly T[],
  pasadas: readonly MencionPasada[],
): AvisoTemporalExtractor[] {
  if (!pasadas.length) return []
  const out: AvisoTemporalExtractor[] = []
  for (const c of conditions) {
    if (c.estado === 'resuelto') continue
    const enc = padecimientosEn(String(c.texto ?? ''))
    const m = pasadas.find(x => enc.includes(x.condicion))
    if (!m) continue
    out.push({ texto: String(c.texto ?? ''), condicion: m.condicion, cita: m.cita })
  }
  return out
}

export const POR_QUE_AQUI_NO_SE_RECLASIFICA =
  'Con una negación se puede reclasificar: el paciente dijo que no, y ' +
  '«descartado» es lo que él afirmó. Aquí no hay nada equivalente — pasar una ' +
  'condición a «resuelto» porque la frase iba en pasado sería una decisión ' +
  'clínica: una neumonía de hace tres años puede estar resuelta y una ' +
  'cardiopatía de hace tres años no lo está por haberla contado en pretérito.'
