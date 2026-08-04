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

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Marcas de que la frase habla del PASADO.
 *
 * Dos familias, porque se dice de las dos maneras:
 *
 * · El verbo en pretérito o copretérito: «tuvo», «tenía», «padeció», «le
 *   operaron», «se le quitó».
 * · La marca de cuándo: «hace tres años», «en 2019», «de niño».
 *
 * Que falte una forma significa que ese caso no se vigila — no que se dé por
 * bueno. Este motor sólo puede señalar de menos, nunca de más.
 */
const PASADO = new RegExp([
  '\\b(?:tuvo|tuve|tenia|tenian|padecio|padeci|padecia|sufrio|sufri|presento)\\b',
  '\\b(?:le\\s+)?(?:operaron|extirparon|quitaron|resecaron)\\b',
  '\\b(?:ya\\s+)?se\\s+le\\s+(?:quito|curo|resolvio)\\b',
  '\\bhace\\s+(?:\\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|varios|muchos|algunos)\\s*(?:anos?|meses?|semanas?|dias?)\\b',
  '\\ben\\s+(?:19|20)\\d{2}\\b',
  '\\b(?:de|en\\s+la)\\s+(?:nino|nina|infancia|juventud)\\b',
  '\\banos\\s+atras\\b',
  '\\banteriormente\\b',
  '\\ben\\s+el\\s+pasado\\b',
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

/** ¿Esta frase encuadra lo que dice en el pasado? */
export function esFrasePasada(frase: string): boolean {
  const t = sinAcentos(frase)
  if (PRESENTE.test(t)) return false
  return PASADO.test(t)
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
    for (const c of cronicasEn(f)) {
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
 */
export function desajustesTemporales(
  pasadas: readonly MencionPasada[],
  textoNota: string,
): DesajusteTemporal[] {
  const t = sinAcentos(textoNota)
  const out: DesajusteTemporal[] = []
  for (const m of pasadas) {
    const formas = CRONICAS.find(c => c.canonica === m.condicion)?.formas ?? [m.condicion]
    for (const forma of formas) {
      const idx = t.indexOf(sinAcentos(forma))
      if (idx < 0) continue
      /**
       * La ventana hacia atrás es de 60 caracteres, la misma que usan las
       * negaciones y por la misma razón: es lo que mide «antecedente de …» o
       * «tuvo …» en la misma oración. Más larga leería la oración anterior y un
       * «antecedente» ajeno taparía una afirmación en presente, que es el fallo
       * que importa.
       */
      const antes = textoNota.slice(Math.max(0, idx - 60), idx)
      if (YA_ES_ANTECEDENTE.test(sinAcentos(antes))) continue
      out.push({ ...m, enLaNota: textoNota.slice(Math.max(0, idx - 40), idx + 60).trim() })
      break
    }
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
