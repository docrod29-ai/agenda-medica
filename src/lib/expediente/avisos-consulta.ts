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
import { pautasDeformadas } from '@/lib/seguridad/forma-de-la-pauta'


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
  | 'requisito_nom004'
  | 'dosis_peligrosa'
  | 'antecedente_del_familiar'
  | 'dato_incierto'
  | 'sin_respaldo_en_el_dictado'
  /**
   * Se oyó un procedimiento y la nota no lo recoge (REG-370).
   *
   * El extractor los reconoce con fecha y lateralidad desde hace tiempo, y no
   * los leía nadie: «le hicieron una colecistectomía en 2019» se pintaba en un
   * panel y desaparecía al cerrar la consulta.
   */
  | 'procedimiento_sin_escribir'
  /**
   * La frecuencia o la duración no tienen forma de lo que dicen ser.
   *
   * Nació de una nota YA FIRMADA del médico dueño: «cada 24 horas por 14
   * EDITAS», y en la misma nota «24 TRAS · 14 días». Ver `forma-de-la-pauta`.
   */
  | 'pauta_deformada'

/**
 * La tabla. Explícita y a la vista **a propósito**: es el único sitio donde se
 * puede degradar un riesgo, así que tiene que ser el sitio donde más se mira.
 */
export const NIVEL: Readonly<Record<OrigenAviso, NivelAviso>> = {
  /** Es literalmente la razón por la que `firmar()` no deja pulsar (REG-174/175). */
  dosis_incompleta:       'bloquea',
  /** Secciones obligatorias, cédula, diagnóstico: es lo que apaga el botón. */
  requisito_nom004:       'bloquea',
  /** Lo más grave de la pantalla — y NO bloquea: esa decisión es del médico dueño. */
  alergia_medicamento:    'revisa',
  contradiccion_negacion: 'revisa',
  desajuste_temporal:     'revisa',
  via_asumida:            'revisa',
  /**
   * NO bloquea, y es deliberado: «14 editas» puede ser una palabra mal oída o
   * una forma que este motor no conoce todavía. Apagar el botón por algo que
   * podría ser un falso positivo enseñaría a esquivar la compuerta.
   *
   * Sí es de PRESCRIPCIÓN —ancla en medicamentos— porque sale impreso en la
   * receta: tiene que verse MIENTRAS receta, no al firmar.
   */
  pauta_deformada:        'revisa',
  interaccion:            'revisa',
  controlado:             'revisa',
  conflicto_extraccion:   'revisa',
  /**
   * Sobredosis y error de decimal. NO bloquea: qué bloquea lo decidió el médico
   * dueño el 5-ago con el dato delante, y ampliarlo por mi cuenta sería decidir
   * por él. Pero cuando es CRÍTICA no se pliega (ver `NO_SE_PLIEGAN`).
   */
  dosis_peligrosa:        'revisa',
  dato_no_precisado:      'revisa',
  /**
   * «Esto lo dijo de su mamá, no de él» (§B8, REG-210).
   *
   * Nivel `revisa` y no `bloquea`: el motor señala de quién es la frase, pero
   * quién decide dónde va el antecedente es el médico. Bloquear la firma por
   * una atribución sería decidir por él.
   */
  antecedente_del_familiar: 'revisa',
  /**
   * «Lo dijo con duda» (§B6, REG-211). Nivel `revisa`: un dato incierto sigue
   * siendo un dato útil — lo que se pierde al aplanarlo es la información de
   * que hay que comprobarlo.
   */
  dato_incierto:          'revisa',
  /**
   * «Esto no salió del dictado» (§B10, SUP-001).
   *
   * Nivel `revisa` y no `bloquea`: el motor no sabe si la afirmación es falsa,
   * sabe que **nadie la dijo en voz alta**. Puede venir del expediente previo o
   * de la exploración física. Bloquear la firma por eso sería decidir por el
   * médico sobre algo que el motor no puede saber.
   */
  sin_respaldo_en_el_dictado: 'revisa',
  /**
   * `revisa`, no `bloquea`: puede ser una palabra mal oída, y apagar el botón de
   * Firmar por un posible falso positivo enseña a esquivar la compuerta. Es el
   * mismo criterio que `pauta_deformada`.
   */
  procedimiento_sin_escribir: 'revisa',
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
  /**
   * · **Dosis peligrosa** entra el 6-ago-2026 (REG-190). «500 mg donde iban 50»
   *   es del mismo orden de daño que recetar aquello a lo que el paciente es
   *   alérgico, y sale impreso en la receta igual de rápido.
   */
  'dosis_peligrosa',
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
  /** Sobredosis, techos por vía/edad y error de decimal (REG-190). */
  dosisPeligrosas?: readonly { med: string; mensaje: string; critica: boolean }[]
  /**
   * La frecuencia y la duración escritas, tal cual, para mirarles la FORMA.
   *
   * Se pasa la lista entera y `construirAvisos` decide: así la pantalla no
   * tiene que saber qué cuenta como frecuencia reconocible.
   */
  pautas?: readonly { nombre?: unknown; frecuencia?: unknown; duracion?: unknown }[]
  conflictos?: readonly string[]
  faltantesCriticos?: readonly string[]
  /**
   * Lo que `validarNOM004` ya bloquea por su cuenta (`errores`).
   *
   * De las nueve viñetas de su captura, «Exploración física no realizada» era un
   * DOBLE REPORTE: la sección obligatoria vacía ya impide firmar, con su propio
   * mensaje y su propio sitio. El recuadro sólo repetía, sin añadir una acción.
   */
  yaLoBloqueaNOM004?: readonly string[]
  /**
   * Frases del dictado que hablan de un FAMILIAR, no del paciente (§B8).
   *
   * «Mi mamá tuvo cáncer de mama» como antecedente personal deja una historia
   * clínica impecable afirmando un cáncer que el paciente nunca tuvo. No se ve
   * raro: por eso se señala aquí en vez de confiar en que se note al releer.
   */
  antecedentesDeFamiliar?: readonly { frase: string; parentesco?: string }[]
  /**
   * Frases que el paciente dijo SIN estar seguro (§B6).
   *
   * «Creo que me dijeron que tenía anemia» aplanado a «Anemia» convierte una
   * duda en un diagnóstico. A partir de la segunda consulta ya nadie sabe que
   * era una duda.
   */
  datosInciertos?: readonly { frase: string; matiz?: string; marca?: string }[]
  /**
   * Afirmaciones de la nota que NINGÚN fragmento del dictado sostiene (§B10).
   *
   * Es la respuesta a «¿de dónde sacó la IA esto?» — la pregunta que hoy sólo se
   * puede contestar reescuchando la consulta entera.
   */
  sinRespaldo?: readonly { afirmacion: string; huerfanas?: readonly string[] }[]
  /**
   * Procedimientos que el extractor oyó y la nota no recoge (REG-370).
   *
   * El texto ya viene redactado por `avisoDeProcedimientoSinEscribir`: quien
   * decide cómo se dice es el módulo que sabe qué es un procedimiento perdido,
   * no este constructor.
   */
  procedimientosSinEscribir?: readonly { texto: string; mensaje: string }[]
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

  /**
   * ── NOM-004 TAMBIÉN BLOQUEA, Y LA BARRA LO IGNORABA (REG-189) ─────────────
   *
   * La barra contaba sólo la dosis, así que con una sección obligatoria vacía
   * decía «nada te impide firmar» **junto a un botón apagado**. Ahora lo que
   * apaga el botón y lo que cuenta la barra salen del mismo sitio.
   */
  /**
   * ── «14 EDITAS» Y «24 TRAS» (REG-238) ────────────────────────────────────
   *
   * Salieron de una nota YA FIRMADA suya. Nadie comprobaba que una frecuencia
   * tuviera forma de frecuencia: sólo se exigía cifra y unidad en la DOSIS.
   *
   * Ancla en `medicamentos` a propósito — es de PRESCRIPCIÓN, y esas se ven
   * MIENTRAS receta, no al firmar (REG-173/REG-190).
   */
  for (const p of pautasDeformadas(e.pautas ?? [])) {
    for (const a of p.avisos) {
      const id = `pauta:${p.med}:${a.campo}`
      if (!vivo(id)) continue
      out.push({
        id,
        origen: 'pauta_deformada',
        nivel: nivelDe('pauta_deformada'),
        texto: `${p.med || 'Un medicamento'}: «${a.loEscrito}» no se entiende como ${a.campo === 'frecuencia' ? 'una frecuencia' : 'una duración'}`,
        /** El mensaje entero del motor: dice POR QUÉ importa —sale impreso—. */
        detalle: a.mensaje,
        ancla: { seccion: 'medicamentos', nombre: p.med || undefined },
        descartable: true,
      })
    }
  }

  for (const requisito of e.yaLoBloqueaNOM004 ?? []) {
    const texto = String(requisito ?? '').trim()
    if (!texto) continue
    out.push({
      id: `nom004:${texto}`,
      origen: 'requisito_nom004',
      nivel: nivelDe('requisito_nom004'),
      texto,
      ancla: { seccion: 'nota' },
      descartable: false,
    })
  }

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

  for (const d of e.dosisPeligrosas ?? []) {
    out.push({
      id: `dosis-peligrosa:${d.med}`,
      origen: 'dosis_peligrosa',
      nivel: nivelDe('dosis_peligrosa'),
      /** El mensaje del motor, literal: dice la cifra, el techo y el porqué. */
      texto: d.mensaje,
      ancla: { seccion: 'medicamentos', nombre: d.med },
      /** Lo crítico no se descarta con un botón: se corrige o se decide. */
      descartable: !d.critica,
    })
  }

  for (const c of e.conflictos ?? []) {
    out.push({
      id: `conflicto:${c}`, origen: 'conflicto_extraccion',
      nivel: nivelDe('conflicto_extraccion'), texto: c, ancla: { seccion: 'nota' },
    })
  }

  /**
   * Los faltantes se cruzan contra DOS cosas: los fármacos que ya bloquean
   * arriba, y lo que NOM-004 bloquea por su cuenta. Lo que ya tiene quien lo
   * diga y quien lo impida no necesita un tercer sitio donde decirlo.
   */
  const palabrasNOM = (e.yaLoBloqueaNOM004 ?? [])
    .map(x => x.replace(/^Falta:?\s*/i, '').trim())
    .filter(x => x.length >= 5)
  for (const f of e.faltantesCriticos ?? []) {
    if (!noEsEco(f, bloqueados)) continue
    if (!noEsEco(f, palabrasNOM)) continue
    out.push({
      id: `faltante:${f}`, origen: 'dato_no_precisado',
      nivel: nivelDe('dato_no_precisado'), texto: f, ancla: { seccion: 'nota' },
    })
  }

  /**
   * ¿De quién es la enfermedad? (§B8, REG-210)
   *
   * Se nombra el parentesco en el texto porque un aviso que dice sólo «revisa
   * la atribución» obliga al médico a releer el dictado entero. Con «lo dijo de
   * su mamá» se resuelve de un vistazo, que es la diferencia entre un aviso que
   * se atiende y uno que se aprende a cerrar.
   */
  for (const a of e.antecedentesDeFamiliar ?? []) {
    const dueno = a.parentesco ? `su ${a.parentesco}` : 'un familiar'
    out.push({
      id: `familiar:${a.frase.slice(0, 40)}`,
      origen: 'antecedente_del_familiar',
      nivel: nivelDe('antecedente_del_familiar'),
      texto: `Esto lo dijo de ${dueno}, no de él: «${a.frase}». Va a antecedentes heredo-familiares.`,
      ancla: { seccion: 'nota' },
    })
  }

  /**
   * Lo dicho con duda (§B6, REG-211).
   *
   * Se cita la palabra exacta que lo delató —«creo que», «a lo mejor»— porque un
   * aviso que sólo dice «hay un dato incierto» obliga a releer el dictado. Con
   * la marca delante se confirma o se descarta de un vistazo.
   */
  for (const d of e.datosInciertos ?? []) {
    out.push({
      id: `incierto:${d.frase.slice(0, 40)}`,
      origen: 'dato_incierto',
      nivel: nivelDe('dato_incierto'),
      texto: d.marca
        ? `Lo dijo con «${d.marca}», no como un hecho: «${d.frase}». Confírmalo antes de que quede como diagnóstico.`
        : `Lo dijo sin seguridad: «${d.frase}».`,
      ancla: { seccion: 'nota' },
    })
  }

  /**
   * Lo que no salió del dictado (§B10, SUP-001).
   *
   * Se nombran las palabras huérfanas porque son la parte accionable: en «se
   * documenta nefropatía diabética estadio 4» lo que nadie dijo es
   * «nefropatía, diabética, estadio», y verlo evita releer la consulta.
   */
  for (const r of e.sinRespaldo ?? []) {
    const que = r.huerfanas?.length ? ` Nadie dijo: ${r.huerfanas.join(', ')}.` : ''
    out.push({
      id: `respaldo:${r.afirmacion.slice(0, 40)}`,
      origen: 'sin_respaldo_en_el_dictado',
      nivel: nivelDe('sin_respaldo_en_el_dictado'),
      texto: `Esto no salió del dictado: «${r.afirmacion.trim()}».${que} Si viene del expediente o de la exploración, déjalo; si no, quítalo.`,
      ancla: { seccion: 'nota' },
    })
  }

  /**
   * ── LO QUE SE DIJO QUE LE HICIERON Y NO QUEDÓ ESCRITO (REG-370) ───────────
   *
   * Ancla en la nota, como el resto de los del texto: lo accionable es
   * escribirlo, y se escribe ahí.
   */
  for (const p of e.procedimientosSinEscribir ?? []) {
    out.push({
      id: `procedimiento:${p.texto.slice(0, 40)}`,
      origen: 'procedimiento_sin_escribir',
      nivel: nivelDe('procedimiento_sin_escribir'),
      texto: p.mensaje,
      ancla: { seccion: 'nota' },
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

export const POR_QUE_TAMBIEN_SE_CRUZA_CON_NOM004 =
  'De las nueve viñetas de su captura, «Exploración física no realizada» era un ' +
  'doble reporte: la sección obligatoria vacía ya impide firmar, con su mensaje ' +
  'y su sitio. El recuadro repetía sin añadir una acción — y un aviso que no ' +
  'añade nada gasta la atención que necesitan los que sí.'

export const POR_QUE_SE_DEDUPLICA =
  'De las nueve viñetas de «datos críticos no documentados» de su captura, cuatro ' +
  'repetían la compuerta de dosis. Decir dos veces lo mismo no es insistir: es ' +
  'hacer que se lea la mitad.'
