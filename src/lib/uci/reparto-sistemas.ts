/**
 * REPARTO DEL PASE POR SISTEMAS — cada cosa bajo su aparato.
 *
 * ── EL PROBLEMA QUE RESUELVE ─────────────────────────────────────────────────
 *
 * La nota de UCI ponía el dictado ENTERO dentro de «Plan por sistema». Y el pase
 * de un intensivista ya viene ordenado por aparatos —«1. Neurológico»,
 * «2. Cardiovascular», «5. Respiratorio»…—, así que la nota terminaba diciendo
 * cada sistema DOS VECES: una con los valores del panel y sus cálculos, y otra
 * con el texto crudo repetido al final.
 *
 * Además «Plan por sistema» decía otra cosa de la que hacía: un plan es lo que se
 * va a HACER, no la lista de lo que se encontró.
 *
 * ── CÓMO REPARTE ────────────────────────────────────────────────────────────
 *
 * Por los encabezados que el propio médico escribió. No hay interpretación
 * semántica ni modelo de lenguaje: se busca una línea que sea un encabezado de
 * sistema, y todo lo que va debajo pertenece a ese sistema hasta el siguiente
 * encabezado.
 *
 * Lo que no cae bajo ningún encabezado se queda en el plan. Es lo correcto: si el
 * médico no dijo a qué aparato pertenece, el módulo no se lo inventa.
 *
 * Módulo PURO.
 */

/** Las secciones de la nota de UCI a las que se puede repartir. */
export type ClaveSistema =
  | 'neurologico' | 'respiratorio' | 'hemodinamico' | 'abdominodigestivo'
  | 'hidrometabolico' | 'hematoinfeccioso' | 'musculoesqueletico' | 'plan'

/**
 * Palabras que identifican el encabezado de cada aparato.
 *
 * Escritas a mano y en orden de ESPECIFICIDAD: lo más concreto arriba. «Gasometría
 * ECMO» tiene que ganarle a «gasometría» a secas, y «anticoagulación ECMO» a
 * «ECMO», o un bloque de coagulación acabaría en hemodinámica.
 */
const ENCABEZADOS: { clave: ClaveSistema; patrones: RegExp[] }[] = [
  { clave: 'neurologico', patrones: [
    /^neuro/i, /^sedoanalgesia/i, /^sedaci[oó]n/i, /^delirium/i, /^escala de coma/i,
  ] },
  { clave: 'respiratorio', patrones: [
    /^respiratori/i, /^ventilaci[oó]n/i, /^ventilador/i, /^mec[aá]nica ventilatoria/i,
    /^gasometr[ií]as?\s+ecmo/i, /^oxigenaci[oó]n/i, /^v[ií]a a[eé]rea/i, /^destete/i,
    /^sdra/i, /^pron/i,
  ] },
  { clave: 'hemodinamico', patrones: [
    /^cardiovascular/i, /^hemodin/i, /^ecocardiograf/i, /^marcadores de perfusi/i,
    /^perfusi[oó]n/i, /^vasopresor/i, /^inotr[oó]pic/i, /^swan/i,
    /^vigilancia espec[ií]fica/i, /^evoluci[oó]n hemodin/i, /^ecmo\b/i, /^par[aá]metros va-?ecmo/i,
    /^canulaci[oó]n/i,
  ] },
  { clave: 'abdominodigestivo', patrones: [
    /^abdomin/i, /^digestiv/i, /^gastrointestinal/i, /^nutrici[oó]n/i, /^hep[aá]tic/i,
  ] },
  { clave: 'hidrometabolico', patrones: [
    /^metab[oó]lic/i, /^endocrin/i, /^[aá]cido-?\s?base/i, /^renal/i, /^electrol/i,
    /^balance h[ií]drico/i, /^ckrt/i, /^prisma/i, /^diuresis/i, /^gasometr[ií]a\b/i,
  ] },
  { clave: 'hematoinfeccioso', patrones: [
    /^hematol/i, /^anticoagulaci[oó]n/i, /^hem[oó]lisis/i, /^coagulaci[oó]n/i,
    /^infeccios/i, /^microbiol/i, /^antimicrobian/i, /^transfusi/i, /^circuito/i,
  ] },
  { clave: 'musculoesqueletico', patrones: [
    /^musculoesquel/i, /^piel/i, /^[uú]lceras/i, /^movilizaci[oó]n/i, /^accesos y dispositiv/i,
    /^dispositiv/i,
  ] },
]

/**
 * ¿Esta línea es un encabezado de sistema?
 *
 * Un encabezado es CORTO y no lleva datos: «5. Respiratorio» sí; «Respiratorio:
 * FiO₂ 60%, PEEP 8» no —ésa es una línea de datos que empieza con la palabra—.
 * La cota de longitud es lo que separa un rótulo de una frase.
 */
export function claveDeEncabezado(linea: string): ClaveSistema | null {
  const l = linea.trim()
  if (!l || l.length > 60) return null
  // Se le quita la numeración del pase: «7. Gasometrías ECMO» → «Gasometrías ECMO».
  const sinNumero = l.replace(/^\s*\d+\s*[.)–-]?\s*/, '').replace(/[:.]\s*$/, '').trim()
  if (!sinNumero || sinNumero.length > 55) return null
  // Una línea con cifras casi nunca es un rótulo: es un dato.
  if (/\d/.test(sinNumero) && !/^ecmo|^va-?ecmo|^vv-?ecmo/i.test(sinNumero)) return null
  for (const { clave, patrones } of ENCABEZADOS) {
    if (patrones.some(p => p.test(sinNumero))) return clave
  }
  return null
}

/**
 * Frases que hablan DEL SISTEMA, no del paciente.
 *
 * En el pase real del Dr. apareció, dentro de la nota de un enfermo:
 *
 *   «Debe permitirse que los objetivos sean configurables por protocolo
 *    institucional, no hardcodearlos como un único rango universal.»
 *
 * Eso es una especificación de software que él me estaba dictando a mí, y acabó
 * en el expediente de un paciente. Una nota clínica no habla de la aplicación.
 *
 * El filtro es DELIBERADAMENTE estrecho: sólo saca frases que nombran al sistema
 * como sujeto. Un «el sistema respiratorio» o «el sistema nervioso» no cae aquí
 * —se exige un verbo de requisito— porque sacar una frase clínica de la nota
 * sería mucho peor que dejar una de software.
 */
const INSTRUCCION_AL_SISTEMA: RegExp[] = [
  /\bhardcode/i,
  /\b(debe|deberia|habria que|hay que)\s+(permitirse|permitir|poder|mostrarse|mostrar|registrar|guardar|calcular|configurar)\b/i,
  /\bel sistema\s+(debe|deberia|tiene que|no debe)\b/i,
  /\b(la app|la aplicaci[oó]n|el motor|la pantalla|el panel)\s+(debe|deberia|tiene que|no debe)\b/i,
  /\bconfigurables?\s+por\s+protocolo\b/i,
  /\brango universal\b/i,
]

/** ¿Esta línea le habla al software en vez de al expediente? */
export function esInstruccionAlSistema(linea: string): boolean {
  return INSTRUCCION_AL_SISTEMA.some(re => re.test(linea))
}

export type RepartoSistemas = Record<ClaveSistema, string>

const VACIO = (): RepartoSistemas => ({
  neurologico: '', respiratorio: '', hemodinamico: '', abdominodigestivo: '',
  hidrometabolico: '', hematoinfeccioso: '', musculoesqueletico: '', plan: '',
})

/**
 * Reparte el pase dictado entre los aparatos, por sus propios encabezados.
 *
 * @param texto el pase tal como lo escribió o dictó el médico.
 * @returns el texto de cada sistema. Lo que no cayó bajo ningún encabezado se
 *   queda en `plan` — si el médico no dijo a qué aparato pertenece, no se adivina.
 */
/**
 * ── EL PASE DICTADO NO TIENE SALTOS DE LÍNEA (REG-264) ──────────────────────
 *
 * Éste era el hueco 2 entero. `repartirPorSistemas` parte por `\n`, lo cual es
 * correcto para un pase **escrito o pegado**. Pero un pase **dictado** llega
 * como un párrafo corrido:
 *
 *   «Neurológico, RASS menos dos, pupilas isocóricas. Respiratorio, PEEP diez,
 *    FiO2 sesenta. Hemodinámico, norepinefrina cero punto uno…»
 *
 * Sin un solo `\n`, el reparto **no encontraba ni un encabezado** y el pase
 * caía ENTERO en el plan. El corazón de la nota de UCI —la nota por aparatos y
 * sistemas, que es justo lo que ningún producto del mercado cubre— **no corría
 * sobre voz**.
 *
 * ── LA REGLA, Y ES DELIBERADAMENTE ESTRECHA ─────────────────────────────────
 *
 * Se inserta un salto **sólo** cuando el nombre del aparato aparece:
 *
 *   1. al principio del texto o después de un punto/punto y coma, **y**
 *   2. seguido inmediatamente de `,` o `:`
 *
 * «Respiratorio, PEEP diez» parte. «El sistema respiratorio está comprometido»
 * **no**: ni empieza frase ni lleva separador detrás. «Hemodinámicamente
 * estable» tampoco.
 *
 * Partir de más sería peor que no partir: metería medio párrafo del aparato
 * anterior en el siguiente, y eso es un dato clínico en la sección equivocada.
 */
const INICIO_DE_APARATO = new RegExp(
  /*
    `[ \t]+` y NO `\s+`: el separador tiene que estar en la MISMA línea.
    Con `\s+` la expresión también casaba «.\nRespiratorio:» —lo que ella
    misma acababa de escribir— y cada nueva pasada añadía otro salto. Un pase
    guardado y vuelto a procesar se habría ido partiendo en pedazos.
  */
  '(^|[.;][ \\t]+)(' + [
    'neurol[oó]gic[oa]', 'sedoanalgesia', 'sedaci[oó]n', 'delirium',
    'respiratori[oa]', 'ventilaci[oó]n', 'ventilador', 'v[ií]a a[eé]rea', 'destete',
    'cardiovascular', 'hemodin[aá]mic[oa]', 'hemodinamia', 'perfusi[oó]n',
    'abdominal', 'digestivo', 'nutrici[oó]n',
    'renal', 'hidroelectrol[ií]tic[oa]', 'metab[oó]lic[oa]',
    'hematol[oó]gic[oa]', 'infeccios[oa]', 'antimicrobian[oa]s?',
    'musculoesquel[eé]tic[oa]', 'piel y faneras', 'movilizaci[oó]n',
    /*
      El separador se consume ENTERO, incluido el espacio o el salto que venga
      detrás: así la segunda pasada reemplaza lo que la primera escribió en vez
      de añadirle otro salto. Es lo que hace la función idempotente.
    */
  ].join('|') + ')(\\s*[,:]\\s*)',
  'gi',
)

/**
 * Devuelve el pase con un salto de línea antes de cada aparato nombrado.
 *
 * Es idempotente: sobre un texto que ya trae saltos no cambia nada, porque el
 * nombre ya está a principio de línea y el `(^|[.;])` no casa dentro de ella.
 */
export function conSaltosAntesDeCadaAparato(texto: string): string {
  /**
   * El salto va ANTES **y DESPUÉS** del rótulo, y ésa es la parte que costó.
   *
   * Con sólo el salto de delante, la línea quedaba «Neurológico, RASS menos
   * dos, pupilas isocóricas.» — el detector la reconocía ENTERA como rótulo y
   * **descartaba el contenido**, porque el encabezado no se copia. Sólo
   * sobrevivía el primer aparato.
   *
   * El separador se normaliza a `:` porque `claveDeEncabezado` ya lo recorta.
   * No se pierde nada: el rótulo se descarta de todas formas; lo que viaja es
   * lo que viene detrás.
   */
  return String(texto ?? '').replace(INICIO_DE_APARATO, (_m, antes, nombre) =>
    `${antes === '' ? '' : antes.trimEnd() + '\n'}${nombre}:\n`)
}

export function repartirPorSistemas(texto: string): RepartoSistemas {
  const out = VACIO()
  if (!texto?.trim()) return out

  /* El pase dictado viene sin saltos: se los ponemos antes de partir (REG-264). */
  const lineas = conSaltosAntesDeCadaAparato(texto).split('\n')
  const descartadas: string[] = []
  let actual: ClaveSistema = 'plan'
  const buffers: Record<ClaveSistema, string[]> = {
    neurologico: [], respiratorio: [], hemodinamico: [], abdominodigestivo: [],
    hidrometabolico: [], hematoinfeccioso: [], musculoesqueletico: [], plan: [],
  }

  for (const linea of lineas) {
    const clave = claveDeEncabezado(linea)
    if (clave) {
      actual = clave
      // El encabezado NO se copia: la nota ya rotula la sección.
      continue
    }
    // Lo que le habla al software no entra en el expediente de un paciente.
    if (esInstruccionAlSistema(linea)) { descartadas.push(linea.trim()); continue }
    buffers[actual].push(linea)
  }

  for (const k of Object.keys(buffers) as ClaveSistema[]) {
    out[k] = buffers[k].join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }
  return out
}

/** ¿El reparto encontró estructura, o el texto no traía encabezados? */
export function tuvoEstructura(r: RepartoSistemas): boolean {
  return (Object.keys(r) as ClaveSistema[]).some(k => k !== 'plan' && r[k].length > 0)
}

export const POR_QUE_SE_REPARTE =
  'El pase de un intensivista ya viene ordenado por aparatos. Volcarlo entero al ' +
  'final hacía que la nota dijera cada sistema DOS VECES: una con los valores del ' +
  'panel y otra con el texto crudo. Se reparte por los encabezados que el propio ' +
  'médico escribió; lo que no cae bajo ninguno se queda en el plan, porque si él ' +
  'no dijo a qué aparato pertenece, no se adivina.'
