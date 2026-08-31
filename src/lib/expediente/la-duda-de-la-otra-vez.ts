/**
 * LA DUDA DE LA OTRA VEZ, DELANTE, EN LA CONSULTA SIGUIENTE.
 *
 * ── EL HUECO QUE REG-366 DEJÓ ABIERTO, Y LO DIJO ─────────────────────────────
 *
 * REG-366 hizo que los avisos que el médico revisó al firmar se queden sellados
 * en la nota, y que la pantalla de esa nota los enseñe. Y declaró lo que no
 * cerraba: **ninguna consulta posterior los lee**. Sellar algo que sólo se ve
 * abriendo el documento donde se selló es media reparación — hay que ir a
 * buscarlo, y nadie va a buscar lo que no sabe que está.
 *
 * ── LA FRASE QUE ESTE MÓDULO EXISTE PARA CONTRADECIR ─────────────────────────
 *
 * De `certeza.ts`, escrita por el propio repositorio:
 *
 *     «Lo que el paciente ofreció como duda queda en el expediente como
 *      diagnóstico. A partir de la SEGUNDA CONSULTA ya nadie sabe que era una
 *      duda: se lee igual que un dato confirmado y se arrastra a todas las notas
 *      siguientes.»
 *
 * La segunda consulta es exactamente este módulo. La lista de problemas dice
 * «Anemia»; en una nota firmada de hace dos años hay un aviso sellado que dice
 * «creo que me dijeron que tenía anemia». Las dos cosas ya están en la pantalla
 * — sólo que una de ellas no se veía.
 *
 * ── CÓMO SE EMPAREJA, Y POR QUÉ ASÍ ──────────────────────────────────────────
 *
 * Un aviso sellado lleva la FRASE del dictado; un problema lleva su descripción.
 * Se empareja cuando alguna palabra **larga** del diagnóstico aparece entera en
 * la frase. Es el mismo criterio que `copiloto.ts` usa para casar un fármaco con
 * lo que se dictó (`w.length > 5 && nm.includes(w)`), y no se inventa aquí uno
 * nuevo.
 *
 * Palabras largas y enteras porque las dos formas de fallar cuestan:
 * emparejar de más llena la consulta de dudas que no son de ese problema —y un
 * aviso que salta de más se aprende a cerrar—; emparejar de menos deja la duda
 * donde estaba. Ante la duda se **señala de menos y se declara** (regla 5).
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No cambia la lista de problemas, no quita nada de ella, no recalifica ningún
 * diagnóstico y no bloquea nada. Enseña una cita del expediente, con la fecha de
 * la nota que la contiene, para que el médico decida si aquella duda ya está
 * resuelta.
 *
 * Módulo PURO.
 */
import type { NotaMedica } from '@/types/expediente'
import { avisosSelladosDe } from './lo-que-se-aviso-al-firmar'

/** Longitud mínima para que una palabra del diagnóstico sirva para emparejar. */
export const MINIMO_PALABRA_UTIL = 6

/**
 * Qué orígenes de aviso valen aquí.
 *
 * Sólo los que dicen algo sobre **de dónde salió el dato**, que es lo que se
 * pierde entre consultas. Una dosis incompleta o un requisito NOM-004 son de
 * aquella consulta y ya se resolvieron allí; traerlos ahora sería ruido.
 */
export const ORIGENES_QUE_VIAJAN: readonly string[] = [
  'dato_incierto',
  'antecedente_del_familiar',
  'contradiccion_negacion',
  'desajuste_temporal',
  'sin_respaldo_en_el_dictado',
]

export interface DudaDeAntes {
  /** El problema de la lista de hoy con el que casa. */
  problema: string
  /** La frase que el médico leyó entonces, tal cual se selló. */
  texto: string
  origen: string
  /** ISO de la nota firmada que lo lleva. Sin esto sería una afirmación del sistema. */
  dichoEn: string
}

const norm = (s: string) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Las palabras del diagnóstico que sirven para reconocerlo dentro de una frase. */
function palabrasUtiles(descripcion: string): string[] {
  return norm(descripcion).split(/[^a-z0-9]+/).filter(w => w.length >= MINIMO_PALABRA_UTIL)
}

/**
 * ¿Aparece esta palabra ENTERA dentro de la frase?
 *
 * Con frontera de palabra de verdad y no comparando « palabra » con espacios a
 * los lados: el texto del aviso envuelve la frase del médico en comillas
 * angulares y termina con un punto —«…que tenía anemia». Confírmalo…»—, así que
 * la palabra que importa casi nunca tiene un espacio detrás. La primera versión
 * de este módulo listaba a mano los separadores que se le ocurrieron (espacio,
 * coma, punto) y **no encontraba el caso principal**: lo cazó su propio golden.
 *
 * Entera, no subcadena: «anemia» no puede casar dentro de «anemias».
 */
function apareceEntera(palabra: string, fraseNormalizada: string): boolean {
  return new RegExp(`(?<![a-z0-9])${palabra}(?![a-z0-9])`).test(fraseNormalizada)
}

/**
 * Los avisos sellados en notas FIRMADAS anteriores que hablan de un problema que
 * el paciente sigue teniendo hoy.
 *
 * @param notas     Las notas del paciente. Sólo cuentan las firmadas.
 * @param problemas Las descripciones de los problemas vigentes de hoy.
 * @param excluirNotaId  La nota que se está escribiendo ahora: sus propios
 *                       avisos ya están en pantalla y repetirlos sería contarle
 *                       al médico lo que acaba de leer.
 */
export function dudasQueSiguenEnPie(
  notas: readonly NotaMedica[],
  problemas: readonly string[],
  excluirNotaId?: string,
): DudaDeAntes[] {
  const buscables = problemas
    .map(p => ({ problema: String(p ?? '').trim(), palabras: palabrasUtiles(p) }))
    .filter(p => p.problema && p.palabras.length)
  if (!buscables.length) return []

  const fuera: DudaDeAntes[] = []
  const vistos = new Set<string>()

  /* De la más nueva a la más vieja: si la misma duda se selló dos veces, manda
     la última vez que se dijo — el mismo criterio que las otras proyecciones. */
  const orden = [...notas].sort((a, b) =>
    String(b.fechaConsulta ?? b.metadata?.fechaCreacion ?? '')
      .localeCompare(String(a.fechaConsulta ?? a.metadata?.fechaCreacion ?? '')))

  for (const nota of orden) {
    if (nota.estado !== 'firmada') continue
    if (excluirNotaId && nota.id === excluirNotaId) continue
    const sellados = avisosSelladosDe(nota)
    if (!sellados) continue
    const fecha = String(nota.fechaConsulta ?? nota.metadata?.fechaCreacion ?? '')

    for (const aviso of sellados.avisos) {
      if (!ORIGENES_QUE_VIAJAN.includes(aviso.origen)) continue
      const frase = norm(aviso.texto)
      for (const p of buscables) {
        if (!p.palabras.some(w => apareceEntera(w, frase))) continue
        const k = `${p.problema}|${aviso.texto}`
        if (vistos.has(k)) continue
        vistos.add(k)
        fuera.push({ problema: p.problema, texto: aviso.texto, origen: aviso.origen, dichoEn: fecha })
      }
    }
  }
  return fuera
}

export const POR_QUE_VUELVE_A_SALIR =
  'Porque la lista de problemas dice «Anemia» y en una nota firmada de hace dos ' +
  'años hay un aviso sellado que dice «creo que me dijeron que tenía anemia». ' +
  'Las dos cosas están en el expediente; sólo que una de ellas no se veía, y la ' +
  'que no se veía es la que dice que hay algo por comprobar.'
