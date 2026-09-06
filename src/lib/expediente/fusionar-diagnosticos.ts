/**
 * FUSIONAR DIAGNÓSTICOS SIN ACUMULAR BASURA.
 *
 * ── EL DEFECTO (7-ago-2026, reportado con captura) ──────────────────────────
 *
 * Una sola nota terminó con **19 diagnósticos**, con parejas que son el mismo
 * diagnóstico redactado distinto — y con el MISMO código CIE-10.
 *
 * La distinción correcta no es «viejo vs nuevo», es **«lo puso la IA» vs «lo puso
 * el médico»**: lo que produjo la IA en la pasada anterior se sustituye; lo que
 * escribió el médico se conserva siempre.
 *
 * ── GOLDEN PATH 6: SUGERIR NO ES CONFIRMAR ─────────────────────────────────
 *
 * `nuevos` es, por contrato de esta frontera, el lote que acaba de producir la
 * IA. Un CIE-10 o un `tipo: definitivo` producido por ese lote es una PROPUESTA,
 * no una decisión del médico. Por eso antes de entrar al estado estructurado:
 *
 *   · se deduplican las sugerencias usando el CIE que propuso la IA;
 *   · después se retira ese CIE de la sugerencia no confirmada;
 *   · un `definitivo` automático se degrada a `presuntivo`;
 *   · si ya existe un diagnóstico del médico equivalente, gana el del médico
 *     completo, incluido su CIE y su tipo.
 *
 * La acción explícita del médico sigue siendo el mecanismo que codifica: puede
 * escribir/agregar el diagnóstico y seleccionar o teclear el CIE en la UI. Este
 * módulo no inventa un estado paralelo ni eleva una sugerencia por sí solo.
 */
import type { Diagnostico } from '@/types/expediente'
import { estaVigente } from './problemas-activos'

/** Normaliza para comparar: sin acentos, sin plurales obvios, sin relleno. */
function clave(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(?:de|del|la|el|los|las|con|y|en|por|a)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Las palabras con contenido, en singular aproximado. */
function palabras(texto: string): Set<string> {
  return new Set(
    clave(texto).split(' ')
      .filter(w => w.length > 3)
      .map(w => w.replace(/(?:es|s)$/, '')),
  )
}

/**
 * ¿Son el mismo diagnóstico?
 * 1. Si los DOS tienen código CIE-10, manda el código.
 * 2. Si no, se comparan palabras de contenido.
 */
export function esElMismo(a: Diagnostico, b: Diagnostico): boolean {
  const ca = (a.codigoCIE10 || '').trim().toUpperCase()
  const cb = (b.codigoCIE10 || '').trim().toUpperCase()
  if (ca && cb) return ca === cb

  const ka = clave(a.descripcion)
  const kb = clave(b.descripcion)
  if (!ka || !kb) return false
  if (ka === kb) return true

  const pa = palabras(a.descripcion)
  const pb = palabras(b.descripcion)
  if (!pa.size || !pb.size) return false
  const [chico, grande] = pa.size <= pb.size ? [pa, pb] : [pb, pa]
  return [...chico].every(w => grande.has(w))
}

/** Se queda con la redacción más específica antes de perder la clave CIE propuesta. */
function elMejor(a: Diagnostico, b: Diagnostico): Diagnostico {
  const na = palabras(a.descripcion).size
  const nb = palabras(b.descripcion).size
  if (na !== nb) return na > nb ? a : b
  return (a.codigoCIE10 || '').trim() ? a : b
}

/**
 * Convierte una salida automática en sugerencia estructurada NO confirmada.
 * El texto sigue visible/revisable; lo que no cruza solo es la afirmación de
 * certeza (`definitivo`) y la codificación CIE.
 */
export function comoSugerenciaNoConfirmada(d: Diagnostico): Diagnostico {
  return {
    ...d,
    codigoCIE10: undefined,
    tipo: d.tipo === 'definitivo' ? 'presuntivo' : d.tipo,
  }
}

/** Deduplica el lote automático mientras todavía conserva el CIE propuesto. */
function deduplicarLoteIa(nuevos: readonly Diagnostico[]): Diagnostico[] {
  const out: Diagnostico[] = []
  for (const d of nuevos) {
    const i = out.findIndex(x => esElMismo(x, d))
    if (i === -1) out.push(d)
    else out[i] = elMejor(out[i], d)
  }
  return out
}

export interface FusionDeDiagnosticos {
  /** Lo que había en la nota antes de esta pasada. */
  previos: readonly Diagnostico[]
  /** Lo que la IA acaba de producir. */
  nuevos: readonly Diagnostico[]
  /** Lo que la IA produjo en la pasada ANTERIOR. */
  deLaIaAnterior?: readonly Diagnostico[]
}

/**
 * Sustituye lo que puso la IA, conserva lo del médico y no repite.
 *
 * Los diagnósticos del médico se apilan primero y nunca son reemplazados por el
 * lote automático equivalente. Las sugerencias nuevas se deduplican usando el
 * CIE propuesto y sólo después se vuelven no confirmadas/no codificadas.
 *
 * Si no se sabe qué puso la IA antes (`deLaIaAnterior` ausente), no se quita
 * nada de lo previo: ante la duda se conserva porque borrar un diagnóstico
 * capturado por el médico es el fallo de mayor costo.
 */
export function fusionarDiagnosticos(p: FusionDeDiagnosticos): Diagnostico[] {
  const previos = p.previos ?? []
  const nuevos = (p.nuevos ?? []).filter(d => d?.descripcion?.trim())
  const anteriores = p.deLaIaAnterior ?? []

  const delMedico = anteriores.length
    ? previos.filter(d => !anteriores.some(a => esElMismo(a, d)))
    : previos

  // Primero deduplicar lo del médico sin cambiar su certeza ni su codificación.
  const out: Diagnostico[] = []
  for (const d of delMedico) {
    const i = out.findIndex(x => esElMismo(x, d))
    if (i === -1) out.push(d)
    else out[i] = elMejor(out[i], d)
  }

  // El lote IA usa sus códigos SÓLO para deduplicar. Si coincide con una decisión
  // del médico, la decisión humana gana completa. Si no, entra como sugerencia.
  for (const sugerida of deduplicarLoteIa(nuevos)) {
    if (out.some(confirmada => esElMismo(confirmada, sugerida))) continue
    out.push(comoSugerenciaNoConfirmada(sugerida))
  }

  return out
}

export const POR_QUE_NO_SE_REEMPLAZA_A_SECAS =
  'La fusión existe porque reemplazar borraba lo que el médico escribía a mano ' +
  'mientras la IA corría. La distinción correcta no es viejo contra nuevo: es lo ' +
  'que puso la IA contra lo que puso el médico.'

export const POR_QUE_MANDA_EL_CODIGO =
  'Dos textos distintos con el mismo CIE-10 son el mismo diagnóstico: para eso ' +
  'existe el código. En un lote automático el CIE sirve para deduplicar, no para ' +
  'confirmar una codificación en nombre del médico.'

export const ANTE_LA_DUDA_SE_CONSERVA =
  'Si no se sabe qué puso la IA en la pasada anterior, no se quita nada. El ' +
  'error caro es borrarle un diagnóstico al médico, no dejarle uno de más.'

/**
 * ── EL DIAGNÓSTICO QUE VA IMPRESO — REG-516 ─────────────────────────────────
 *
 * QUÉ PASABA. El dueño, con la receta en la mano: «ahora no pones diagnóstico,
 * nomás dice CIE-10». Y tenía razón literal: la receta componía
 * `descripcion + " (" + codigoCIE10 + ")"`, así que un diagnóstico con código y
 * sin descripción salía impreso como « (A41.9)» — un paréntesis con un código
 * dentro y nada delante.
 *
 * UN CÓDIGO NO ES UN DIAGNÓSTICO. «A41.9» no le dice nada a quien surte la
 * receta ni al paciente. Es una clave para facturar y estadística; el
 * diagnóstico es la frase.
 *
 * ESTABA DUPLICADO, que es la mitad de por qué persistía. La misma composición
 * vivía copiada en `receta/[patientId]/[notaId]/page.tsx` y en
 * `orden/[patientId]/[notaId]/page.tsx`. Arreglar una dejaba la otra rota, y
 * nadie se enteraba hasta imprimir. Ahora es UNA función, y las dos pantallas
 * la llaman.
 *
 * LA REGLA DEL DUEÑO, textual: «sí quiero que lo infieras pero nomás el
 * principal; si hay que agregar, bueno, pero no repetir».
 *
 *   · UNO solo — el principal.
 *   · Se prefiere un `definitivo`; entre ellos, el que tenga descripción.
 *   · Un código SIN descripción no se imprime: no es un diagnóstico.
 *   · La descripción sola SÍ se imprime. El código es el adorno, no al revés.
 *
 * LO QUE NO HACE. No inventa la descripción a partir del código: eso exigiría
 * un catálogo CIE-10 con su fuente, y rellenar aquí un texto plausible sería
 * poner en la receta un diagnóstico que nadie escribió.
 */
export interface DxImprimible {
  descripcion?: string
  codigoCIE10?: string
  tipo?: string
  estado?: string
}

/**
 * El diagnóstico principal, listo para imprimir. Cadena vacía si no hay ninguno
 * con descripción — y entonces el campo se queda en blanco para que lo escriba
 * el médico, en vez de enseñarle un código huérfano.
 */
export function diagnosticoParaImprimir(dxs: readonly DxImprimible[] | undefined): string {
  const conTexto = (dxs ?? []).filter(d => String(d?.descripcion ?? '').trim())
  /**
   * ── LO QUE EL MÉDICO DESCARTÓ NO SE IMPRIME (PC-001 · PO-001) ──────────────
   *
   * Esto era `conTexto.find(d => d.tipo === 'definitivo') ?? conTexto[0]`: se
   * PREFERÍA el definitivo, pero si no había ninguno caía al primero con texto
   * — y ese primero podía ser un `descartado`, un `diferencial` o un problema
   * ya `resuelto`.
   *
   * El caso del esguince, medido por el equipo rojo: la única línea con texto
   * es «fractura descartada». La receta salía, con cédula y firma, diciendo que
   * el diagnóstico es una fractura que el médico acababa de descartar; y el
   * paciente la reenvía al trabajo para justificar la incapacidad.
   *
   * El criterio NO se inventa aquí: `estaVigente` es el mismo que usan la
   * proyección longitudinal, el resumen del expediente y `problemasDelCuadro`.
   * Este —el que IMPRIME— era el que no lo aplicaba.
   *
   * Un `presuntivo` SÍ se imprime: es el diagnóstico de trabajo con el que se
   * receta, y es lo que el médico escribió. Lo que no puede salir es lo que él
   * mismo marcó como descartado o resuelto.
   *
   * Si no queda ninguno vigente, se devuelve cadena vacía: el campo se queda en
   * blanco para que lo escriba el médico. Vacío es la respuesta honesta —
   * imprimir un descartado no lo es.
   */
  const vigentes = conTexto.filter(d => estaVigente({ tipo: d.tipo as never, estado: d.estado as never }))
  if (!vigentes.length) return ''
  const principal = vigentes.find(d => d.tipo === 'definitivo') ?? vigentes[0]
  const texto = String(principal.descripcion).trim()
  const codigo = String(principal.codigoCIE10 ?? '').trim()
  return codigo ? `${texto} (${codigo})` : texto
}

export const POR_QUE_UN_DESCARTADO_NO_SE_IMPRIME =
  'Porque un diagnóstico descartado impreso bajo una cédula profesional dice ' +
  'lo contrario de lo que el médico concluyó, y quien lo lee —la farmacia, el ' +
  'jefe del paciente, el propio paciente— no tiene cómo saberlo.'
