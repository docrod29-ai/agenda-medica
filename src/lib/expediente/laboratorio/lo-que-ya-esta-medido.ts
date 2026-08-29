/**
 * LOS LABORATORIOS QUE EL PACIENTE YA TIENE, DELANTE DE LOS MOTORES.
 *
 * ── EL MISMO DEFECTO DE REG-188, EN EL EJE QUE FALTABA ───────────────────────
 *
 * REG-188 encontró que los motores clínicos recibían **sólo la receta de hoy**:
 * un paciente con warfarina de marzo al que hoy se le receta ketorolaco no
 * disparaba la regla de sangrado, porque la warfarina no estaba en la nota de
 * hoy. Se arregló para la medicación y para los problemas (`cuadro-completo.ts`).
 *
 * Los laboratorios se quedaron fuera, y ahí el fallo es más callado:
 *
 *     entradaCopiloto.labs = labsDesdeEstudios(extraction.tests)
 *                            ↑ SÓLO lo que se dictó o se extrajo HOY
 *
 * Los paneles del paciente —creatinina, AST/ALT, plaquetas, LDL, potasio— viven
 * en `laboratorio/firestore.ts` y los leía **un solo componente**: el panel de
 * la pestaña de Laboratorios. Está en la misma pantalla de la consulta, con el
 * número a la vista, y **el motor que produce el aviso no lo veía**.
 *
 * ── LO QUE ESO SIGNIFICA EN LA CONSULTA ──────────────────────────────────────
 *
 *     paciente con creatinina 2.4 mg/dL en un panel del mes pasado
 *     + hoy se prescribe metformina, sin volver a dictar la creatinina
 *     → `ajusteRenal` no corre (no hay `labs.creatinina`)
 *     → no se estima TFG, no se avisa de la metformina por debajo de 30
 *
 * `AJUSTE_RENAL` existe, está probada y dice qué hacer. Simplemente no llegaba
 * el número. Es «escrito y sin conectar» sobre el dato que alimenta las fórmulas
 * que producen conducta.
 *
 * ── LA REGLA: HOY MANDA, Y LO DE ANTES DICE CUÁNDO ───────────────────────────
 *
 * Misma regla que `medicacionDelCuadro`: si el analito viene en el dictado de
 * hoy, vale el de hoy — el médico está mirando un resultado nuevo. Si no viene,
 * completa el panel más reciente que lo tenga.
 *
 * Y lo que viene del historial **viaja con su fecha**, siempre. Un motor que
 * dijera «TFG estimada 28 (creatinina 2.4)» sin decir que esa creatinina es de
 * hace ocho meses estaría afirmando una vigencia que nadie comprobó.
 *
 * ── LO QUE ESTE MÓDULO NO DECIDE — `NEEDS_CLINICAL_REVIEW` ───────────────────
 *
 * **Cuánto puede tener una creatinina para seguir sirviendo para dosificar.**
 * Eso es un umbral clínico y aquí no se inventa (regla 1): no hay filtro por
 * antigüedad. Lo que hay es la **fecha, dicha**, para que la juzgue quien puede.
 *
 * El día que el dueño fije ese umbral, se aplica aquí y en un solo sitio.
 *
 * ── LO QUE SÍ SE EXCLUYE, Y POR QUÉ ──────────────────────────────────────────
 *
 * Los valores **censurados** («>400», «<50»). El laboratorio no dijo un número:
 * dijo un límite. Meterlo en una fórmula sería afirmar un valor exacto que nadie
 * midió — el defecto que REG-204 y `el-valor-censurado-no-se-da-por-normal`
 * existen para impedir.
 *
 * Módulo PURO.
 */

/** Un panel, reducido a lo que hace falta aquí. */
export interface PanelParaMotores {
  /** YYYY-MM-DD. Ordena cuál es el más reciente. */
  fecha: string
  resultados?: readonly {
    clave?: string
    valor?: number
    /** Si viene, el laboratorio dio un límite y no un número. */
    censurada?: unknown
  }[]
}

export interface LabsDelCuadro {
  /** Lo que ven los motores: analito → valor. La misma forma que ya recibían. */
  labs: Record<string, number>
  /**
   * Cuándo se midió cada uno, **sólo para los que vienen del historial**.
   * Vacío para lo de hoy: un «medido el <hoy>» al lado de lo que el médico acaba
   * de dictar es ruido, y la ausencia del dato aquí significa «es de esta
   * consulta», que es lo que hay que poder distinguir.
   */
  medidoEn: Record<string, string>
}

/**
 * Los laboratorios que los motores tienen que ver: los de hoy **más** los del
 * expediente.
 *
 * @param deHoy   Lo extraído del dictado de esta consulta (`labsDesdeEstudios`).
 * @param paneles Los paneles del paciente, en cualquier orden.
 */
export function labsDelCuadro(
  deHoy: Readonly<Record<string, number>> | undefined,
  paneles: readonly PanelParaMotores[] | undefined,
): LabsDelCuadro {
  const labs: Record<string, number> = {}
  const medidoEn: Record<string, string> = {}

  for (const [k, v] of Object.entries(deHoy ?? {})) {
    if (Number.isFinite(v)) labs[k] = v
  }

  /* Del panel más NUEVO al más viejo: el primero que traiga un analito que hoy
     no se dictó es el que manda sobre ese analito. */
  const orden = [...(paneles ?? [])].sort((a, b) =>
    String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')))

  for (const panel of orden) {
    const fecha = String(panel.fecha ?? '').trim()
    if (!fecha) continue
    for (const r of panel.resultados ?? []) {
      const clave = String(r?.clave ?? '').trim()
      if (!clave || labs[clave] !== undefined) continue
      if (r?.censurada) continue                 // un límite no es un número
      if (typeof r?.valor !== 'number' || !Number.isFinite(r.valor)) continue
      labs[clave] = r.valor
      medidoEn[clave] = fecha
    }
  }

  return { labs, medidoEn }
}

export const POR_QUE_NO_HAY_UMBRAL_DE_ANTIGUEDAD =
  'NEEDS_CLINICAL_REVIEW — cuánto puede tener una creatinina para seguir ' +
  'sirviendo para dosificar es un umbral clínico, y aquí no se inventa. No se ' +
  'filtra por antigüedad: se dice la fecha y la juzga el médico. El día que el ' +
  'dueño lo fije, se aplica en este módulo y en ningún otro.'

export const POR_QUE_HOY_MANDA =
  'Porque si el médico acaba de dictar una creatinina es que está mirando un ' +
  'resultado nuevo, y la del panel del mes pasado ya no es la que decide. Misma ' +
  'regla que la medicación vigente en `cuadro-completo.ts`.'
