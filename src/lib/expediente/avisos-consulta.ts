/**
 * TRES NIVELES, NO OCHO RECUADROS.
 *
 * ── LA PANTALLA QUE MANDÓ EL DR. (5-ago-2026) ────────────────────────────────
 *
 * Después de dictar, antes de ver su nota, se encontró **ocho bloques de aviso
 * apilados** con unos cuarenta elementos. Tuvo que leerlos todos para descubrir
 * que **sólo uno le impedía firmar**. Su palabra fue «esto nomás confunde… sin
 * tanta mamada que desubique y confunda a los médicos».
 *
 * El diagnóstico no era que sobraran avisos: era que **estaban todos al mismo
 * volumen**. Había tres recuadros rojos y dos de ellos no bloqueaban nada.
 * Cuando todo grita, nada se oye — y lo que se acaba ignorando es el que sí
 * importaba.
 *
 * ── LA REGLA QUE LO GOBIERNA ─────────────────────────────────────────────────
 *
 * Cada aviso declara **un solo nivel**, y el nivel responde a una pregunta
 * concreta, no a una intuición sobre su gravedad:
 *
 *   BLOQUEA  — ¿es la razón por la que el botón Firmar no responde?
 *   REVISA   — ¿le pide una decisión antes de firmar, aunque no lo impida?
 *   CONTEXTO — ¿es contenido que ya está en la nota?
 *
 * `bloquea` NO es «es grave». El cruce alergia ↔ medicamento es lo más grave de
 * esta pantalla y **no** bloquea: esa decisión es del médico dueño y no mía. Lo
 * que hace es no plegarse nunca.
 *
 * ── POR QUÉ ESTO ES UN MÓDULO PURO Y NO ESTÁ EN LA PANTALLA ──────────────────
 *
 * Si el nivel se decide dentro del JSX, degradar un riesgo real es cambiar una
 * palabra en una línea de estilo y nadie lo nota — porque ya no hay un bloque
 * propio que lo delate. Aquí la tabla `NIVEL` está a la vista, y una prueba la
 * recorre entera.
 *
 * ── Y POR QUÉ SIGUEN SIENDO TRES ─────────────────────────────────────────────
 *
 * El próximo motor va a querer su renglón, y en seis meses hay ocho otra vez.
 * La regla es dura: **tres niveles, punto**. Un motor nuevo declara su origen en
 * `NIVEL` y entra en una lista que ya existe. No se añaden recuadros.
 *
 * Módulo PURO.
 */

/** Los tres niveles. No hay un cuarto. */
export type NivelAviso = 'bloquea' | 'revisa' | 'contexto'

/** De qué motor viene cada aviso. Añadir uno OBLIGA a declarar su nivel. */
export type OrigenAviso =
  | 'dosis_incompleta'
  | 'alergia_medicamento'
  | 'contradiccion_negacion'
  | 'desajuste_temporal'
  | 'via_asumida'
  | 'interaccion'
  | 'controlado'
  | 'conflicto_extraccion'
  | 'dato_no_precisado'

/**
 * La tabla. Explícita y a la vista **a propósito**: es el único sitio donde se
 * puede degradar un riesgo, así que tiene que ser el sitio donde más se mira.
 */
export const NIVEL: Readonly<Record<OrigenAviso, NivelAviso>> = {
  /** Es literalmente la razón por la que `firmar()` no deja pulsar (REG-174/175). */
  dosis_incompleta:       'bloquea',
  /** Lo más grave de la pantalla — y NO bloquea: esa decisión es del médico dueño. */
  alergia_medicamento:    'revisa',
  contradiccion_negacion: 'revisa',
  desajuste_temporal:     'revisa',
  via_asumida:            'revisa',
  interaccion:            'revisa',
  controlado:             'revisa',
  conflicto_extraccion:   'revisa',
  dato_no_precisado:      'revisa',
}

/**
 * Los que NO se pliegan jamás, aunque sean de nivel `revisa`.
 *
 * · **Alergia ↔ medicamento** es el único aviso de esta pantalla que puede matar
 *   al paciente con la receta que se está imprimiendo ahora mismo.
 * · **La nota afirma algo que se negó** mete un antecedente crónico falso que
 *   cambia el riesgo quirúrgico, cambia los fármacos y **se arrastra a todas las
 *   notas siguientes**. El costo de plegarlo no se paga hoy: se paga en las diez
 *   consultas que vienen.
 */
export const NO_SE_PLIEGAN: readonly OrigenAviso[] = [
  'alergia_medicamento',
  'contradiccion_negacion',
]

export interface AvisoConsulta {
  /** `${origen}:${clave}` — la MISMA clave que ya usa `marcarRevisado`. */
  id: string
  origen: OrigenAviso
  nivel: NivelAviso
  /** Una frase, ya redactada. */
  texto: string
  /**
   * El mensaje LITERAL del motor, cuando lo hay.
   *
   * No se parafrasea: `revisarUnidadDosis` explica el riesgo concreto —«100 se
   * leerá como 100 mg»— y resumirlo a una frase mía se lleva justo el porqué.
   */
  detalle?: string
  /** A dónde lleva el botón. El ancla es el NOMBRE, nunca el índice: la lista se reordena. */
  ancla?: { seccion: 'medicamentos' | 'diagnosticos' | 'nota'; nombre?: string }
  /** ¿Se le ofrece «Ya lo revisé»? Nunca sobre lo que bloquea: sería una promesa falsa. */
  descartable?: boolean
  /** El motor que lo emite está pendiente de validación y hay que decirlo. */
  sello?: 'farmacovigilancia'
}

export interface EntradaAvisos {
  dosisIncompletas?: readonly { med: string; mensaje: string; procedencia?: 'ya_lo_toma' | 'se_prescribe_hoy' }[]
  alergiaMedicamento?: readonly { mensaje: string; severidad: string }[]
  contradicciones?: readonly { condicion: string; mensaje: string }[]
  desajustes?: readonly { condicion: string; mensaje: string }[]
  viasAsumidas?: readonly string[]
  avisoDeVia?: string | null
  interacciones?: readonly { titulo: string; detalle: string; severidad: string }[]
  controlados?: readonly { farmaco: string; requisito: string }[]
  conflictos?: readonly string[]
  faltantesCriticos?: readonly string[]
  /** Lo ya descartado con «Ya lo revisé», con la misma clave `${tipo}:${clave}`. */
  revisados?: ReadonlySet<string>
}

const nivelDe = (o: OrigenAviso): NivelAviso => NIVEL[o]
const seDobla = (o: OrigenAviso) => !NO_SE_PLIEGAN.includes(o)

/**
 * ── LA DEDUPLICACIÓN, QUE ES MEDIA REPARACIÓN ────────────────────────────────
 *
 * De las nueve viñetas de «datos críticos no documentados» de su captura,
 * **cuatro eran ecos**: repetían la compuerta de dosis o la sección obligatoria
 * vacía, que ya tienen quien las diga y quien las bloquee.
 *
 * Nadie las cruzaba. Aquí se cae todo faltante que nombre un fármaco del que ya
 * se está avisando arriba: decir dos veces lo mismo no es insistir, es hacer que
 * se lea la mitad.
 */
function noEsEco(texto: string, yaAvisados: readonly string[]): boolean {
  const t = texto.toLowerCase()
  return !yaAvisados.some(n => n.length >= 4 && t.includes(n.toLowerCase()))
}

/** Construye la lista completa, ya clasificada, ordenada y sin ecos. */
export function construirAvisos(e: EntradaAvisos): AvisoConsulta[] {
  const revisados = e.revisados ?? new Set<string>()
  const vivo = (id: string) => !revisados.has(id)
  const out: AvisoConsulta[] = []

  const bloqueados: string[] = []
  for (const d of e.dosisIncompletas ?? []) {
    bloqueados.push(d.med)
    out.push({
      id: `dosis:${d.med}`,
      origen: 'dosis_incompleta',
      nivel: nivelDe('dosis_incompleta'),
      texto: d.med,
      /**
       * ── EL AVISO DICE DE CUÁL DE LOS DOS SE TRATA (REG-183) ─────────────
       *
       * «Toma algo para la presión y no sabe la dosis» y «le receto
       * levotiroxina sin cantidad» son cosas distintas, y hasta ahora se leían
       * igual. Lo que se añade es la INFORMACIÓN, no un cambio de compuerta:
       * qué bloquea lo decidió el médico dueño el 5-ago con el dato delante.
       *
       * Y si el modelo no supo cuál era, no se dice nada. Inventar la coletilla
       * sería el mismo error que rellenar un hueco con «No especificada».
       */
      detalle: d.procedencia === 'ya_lo_toma'
        ? `${d.mensaje} (medicación que el paciente ya toma)`
        : d.procedencia === 'se_prescribe_hoy'
          ? `${d.mensaje} (se prescribe en esta consulta)`
          : d.mensaje,
      ancla: { seccion: 'medicamentos', nombre: d.med },
      /** Nunca descartable: el aviso se iría y la firma seguiría sin dejarse pulsar. */
      descartable: false,
    })
  }

  for (const a of e.alergiaMedicamento ?? []) {
    out.push({
      id: `alergia:${a.mensaje}`,
      origen: 'alergia_medicamento',
      nivel: nivelDe('alergia_medicamento'),
      texto: a.mensaje,
      ancla: { seccion: 'medicamentos' },
      descartable: false,
    })
  }

  for (const c of e.contradicciones ?? []) {
    const id = `negacion:${c.condicion}`
    if (vivo(id)) out.push({
      id, origen: 'contradiccion_negacion', nivel: nivelDe('contradiccion_negacion'),
      texto: c.mensaje, ancla: { seccion: 'nota' }, descartable: true,
    })
  }

  for (const d of e.desajustes ?? []) {
    const id = `temporal:${d.condicion}`
    if (vivo(id)) out.push({
      id, origen: 'desajuste_temporal', nivel: nivelDe('desajuste_temporal'),
      texto: d.mensaje, ancla: { seccion: 'nota' }, descartable: true,
    })
  }

  /** Uno solo para todos los fármacos: uno por medicamento sería fatiga de alerta. */
  const vias = (e.viasAsumidas ?? []).filter(n => vivo(`via:${n}`))
  if (vias.length > 0 && e.avisoDeVia) {
    out.push({
      id: `via:${vias.join('|')}`,
      origen: 'via_asumida', nivel: nivelDe('via_asumida'),
      texto: e.avisoDeVia, ancla: { seccion: 'medicamentos' }, descartable: true,
    })
  }

  for (const it of e.interacciones ?? []) {
    out.push({
      id: `interaccion:${it.titulo}`,
      origen: 'interaccion', nivel: nivelDe('interaccion'),
      texto: `${it.titulo}${it.severidad === 'mayor' ? ' (mayor)' : ''} — ${it.detalle}`,
      ancla: { seccion: 'medicamentos' }, sello: 'farmacovigilancia',
    })
  }

  for (const c of e.controlados ?? []) {
    out.push({
      id: `controlado:${c.farmaco}`,
      origen: 'controlado', nivel: nivelDe('controlado'),
      texto: `${c.farmaco} — ${c.requisito}`,
      ancla: { seccion: 'medicamentos' }, sello: 'farmacovigilancia',
    })
  }

  for (const c of e.conflictos ?? []) {
    out.push({
      id: `conflicto:${c}`, origen: 'conflicto_extraccion',
      nivel: nivelDe('conflicto_extraccion'), texto: c, ancla: { seccion: 'nota' },
    })
  }

  for (const f of e.faltantesCriticos ?? []) {
    if (!noEsEco(f, bloqueados)) continue
    out.push({
      id: `faltante:${f}`, origen: 'dato_no_precisado',
      nivel: nivelDe('dato_no_precisado'), texto: f, ancla: { seccion: 'nota' },
    })
  }

  return out
}

/** ¿Cuántos bloquean y cuántos piden un vistazo? Para el encabezado. */
export function resumirAvisos(avisos: readonly AvisoConsulta[]) {
  const bloquean = avisos.filter(a => a.nivel === 'bloquea').length
  const revisar = avisos.filter(a => a.nivel === 'revisa').length
  return { bloquean, revisar }
}

/** Los de `revisa` que no se pliegan nunca. */
export function fijos(avisos: readonly AvisoConsulta[]): AvisoConsulta[] {
  return avisos.filter(a => a.nivel === 'revisa' && !seDobla(a.origen))
}

/** Los de `revisa` que sí se pliegan. */
export function plegables(avisos: readonly AvisoConsulta[]): AvisoConsulta[] {
  return avisos.filter(a => a.nivel === 'revisa' && seDobla(a.origen))
}

/**
 * ¿El grupo plegable nace abierto?
 *
 * Con tres o menos cabe sin empujar la nota fuera de la pantalla, y entonces
 * plegarlo sólo esconde. Con cuatro o más, el plegado es lo que devuelve la nota
 * a la vista — que es lo que el médico vino a leer.
 */
export const CABEN_SIN_ESTORBAR = 3
export function naceAbierto(cuantos: number): boolean {
  return cuantos > 0 && cuantos <= CABEN_SIN_ESTORBAR
}

export const POR_QUE_BLOQUEA_NO_ES_GRAVE =
  'El cruce alergia ↔ medicamento es lo más grave de esta pantalla y NO bloquea: ' +
  'esa decisión es del médico dueño. `bloquea` significa «es la razón por la que ' +
  'el botón Firmar no responde», no «es lo peor». Lo que se hace con lo grave que ' +
  'no bloquea es no plegarlo nunca.'

export const POR_QUE_TRES_Y_NO_MAS =
  'El próximo motor va a querer su recuadro y en seis meses hay ocho otra vez. ' +
  'Un motor nuevo declara su origen en NIVEL y entra en una lista que ya existe.'

export const POR_QUE_SE_DEDUPLICA =
  'De las nueve viñetas de «datos críticos no documentados» de su captura, cuatro ' +
  'repetían la compuerta de dosis. Decir dos veces lo mismo no es insistir: es ' +
  'hacer que se lea la mitad.'
