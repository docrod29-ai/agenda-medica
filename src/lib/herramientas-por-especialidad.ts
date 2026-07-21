/**
 * QUÉ HERRAMIENTAS VE CADA ESPECIALIDAD EN LA CONSULTA
 *
 * EL PROBLEMA: la consulta muestra las mismas ocho herramientas a todo el mundo.
 * Un internista no atiende partos ni calcula dosis pediátricas por peso, pero
 * tiene "Gineco-obstetricia" y "Pediatría" ocupando espacio en cada consulta. Un
 * pediatra tiene delante calculadoras de riesgo cardiovascular a 10 años que no
 * usará nunca. Esa saturación cuesta tiempo: hay que leerlas para descartarlas, en
 * cada paciente.
 *
 * EL CRITERIO: se muestran por defecto las de su especialidad. NINGUNA
 * desaparece — todas siguen accesibles desde el buscador de herramientas, y al
 * abrirlas se integran a la nota igual que las demás. Filtrar no es quitar.
 *
 * LA REGLA CLÍNICA QUE HACE QUE ESTO FUNCIONE: las subespecialidades heredan el
 * juego de su TRONCO. Un infectólogo, un gastroenterólogo y un cardiólogo son
 * internistas antes que subespecialistas y atienden al mismo adulto complejo:
 * necesitan la misma base. Igual un cirujano de tórax y uno de colon respecto a
 * cirugía general. Por eso esto se organiza por troncos y no como lista plana de
 * sesenta especialidades, que sería imposible de mantener al día.
 *
 * Se apoya en el catálogo de nombres que ya existe (`especialidades.ts`), que es
 * la fuente de verdad del alta de equipo y de las interconsultas. Aquí solo se
 * añade la capa de "qué herramientas le tocan".
 *
 * Puro y determinista → testeable.
 */

/** Identificadores de las herramientas de la consulta. */
export type HerramientaId =
  | 'copiloto'
  | 'cirugia'
  | 'gineco'
  | 'pediatria'
  | 'calculadoras'
  | 'cardiometabolico'
  | 'preventivo'
  | 'antibiograma'
  | 'fotos'
  | 'laboratorios'

export type Tronco =
  | 'medicina-interna'
  | 'pediatria'
  | 'gineco-obstetricia'
  | 'cirugia'
  | 'primer-contacto'
  | 'otra'

/** Normaliza para comparar: minúsculas, sin acentos, sin espacios de sobra. */
function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/**
 * A qué tronco pertenece una especialidad, a partir de su NOMBRE.
 *
 * Se trabaja sobre el nombre y no sobre un id nuevo porque la especialidad ya se
 * guarda así en la configuración de los consultorios que están en producción:
 * pedirles que vuelvan a capturarla para estrenar esto sería absurdo.
 *
 * El orden de las comprobaciones importa. "Cirugía pediátrica" es del tronco
 * QUIRÚRGICO aunque diga pediátrica —opera— y "Oncología ginecológica" es
 * ginecológica aunque diga oncología. Por eso los casos compuestos van primero.
 */
export function troncoDe(especialidad: string | undefined | null): Tronco {
  const e = norm(especialidad ?? '')
  if (!e) return 'otra'

  // Compuestos primero: la palabra que manda es la que define el trabajo diario.
  if (/cirugia pediatrica/.test(e)) return 'cirugia'
  if (/ortopedia pediatrica/.test(e)) return 'cirugia'
  if (/oncologia ginecologica/.test(e)) return 'gineco-obstetricia'
  if (/(infectologia|cardiologia|neurologia|neumologia) pediatrica/.test(e)) return 'pediatria'

  if (/gineco|obstetricia|materno.?fetal|reproduccion/.test(e)) return 'gineco-obstetricia'
  if (/pediatr|neonat|paidopsiquiatria/.test(e)) return 'pediatria'
  /**
   * FRONTERA DE PALABRA, no subcadena.
   *
   * Sin el `\b`, «neurología» casaba «urología» —ne-UROLOGIA— y un neurólogo
   * acababa clasificado como cirujano, con la valoración perioperatoria en vez de
   * sus herramientas de internista. Es exactamente el mismo defecto que se
   * encontró en el motor de antibiograma, donde «meropenem» casaba
   * «meropenem-vaborbactam».
   */
  if (/\b(cirug|ortopedia|traumatolog|urologia|otorrino|oftalmolog|neurocirug|angiolog|coloproctolog|maxilofacial|trasplante|anestesiolog)/.test(e)) return 'cirugia'
  if (/medicina general|medicina familiar|urgencias/.test(e)) return 'primer-contacto'
  if (/medicina interna|cardiolog|neumolog|gastroenterolog|hepatolog|endocrinolog|nefrolog|reumatolog|hematolog|infectolog|oncologia|geriatr|neurolog|dermatolog|alergolog|critica|terapia intensiva|genetica|internista/.test(e)) return 'medicina-interna'

  return 'otra'
}

/**
 * `copiloto` va SIEMPRE: no es una herramienta que se abre, es la vigilancia
 * silenciosa (alergia contra prescripción, dosis contra peso, ajuste renal).
 * Apagarla por especialidad sería quitar una red de seguridad.
 *
 * `fotos` también va siempre: cualquier especialidad documenta una lesión.
 */
const POR_TRONCO: Record<Tronco, HerramientaId[]> = {
  // El adulto complejo: riesgo cardiovascular, prevención, cultivos.
  'medicina-interna': ['copiloto', 'cardiometabolico', 'preventivo', 'antibiograma', 'calculadoras', 'fotos', 'laboratorios'],

  // Dosis por peso y percentiles; el riesgo cardiovascular a 10 años no aplica.
  'pediatria': ['copiloto', 'pediatria', 'calculadoras', 'antibiograma', 'preventivo', 'fotos', 'laboratorios'],

  'gineco-obstetricia': ['copiloto', 'gineco', 'calculadoras', 'preventivo', 'fotos', 'laboratorios'],

  // La valoración perioperatoria es su herramienta central: ASA, RCRI, Caprini,
  // Apfel, profilaxis con re-dosis. Trauma comparte tronco por lo mismo.
  'cirugia': ['copiloto', 'cirugia', 'calculadoras', 'antibiograma', 'fotos', 'laboratorios'],

  /**
   * PRIMER CONTACTO VE TODO. Indicación explícita del médico.
   *
   * Y es lo correcto: el médico general o familiar atiende al niño, a la
   * embarazada, al adulto con diabetes y al que llega con una herida, muchas veces
   * el mismo día. Filtrarle herramientas no le ahorra tiempo — se lo quita,
   * porque la que necesita siempre está en el buscador y no en pantalla.
   *
   * El filtrado tiene sentido para el subespecialista, cuyo día es predecible. No
   * para quien ve de todo.
   */
  'primer-contacto': ['copiloto', 'cirugia', 'gineco', 'pediatria', 'calculadoras', 'cardiometabolico', 'preventivo', 'antibiograma', 'fotos', 'laboratorios'],

  // Sin especialidad reconocida NO se adivina: se muestra todo, como hasta ahora.
  // Esconderle herramientas a alguien de quien no sabemos qué hace es peor que
  // mostrarle de más.
  'otra': ['copiloto', 'cirugia', 'gineco', 'pediatria', 'calculadoras', 'cardiometabolico', 'preventivo', 'antibiograma', 'fotos', 'laboratorios'],
}

/** Herramientas que se muestran por defecto para esta especialidad. */
export function herramientasDe(especialidad: string | undefined | null): HerramientaId[] {
  return POR_TRONCO[troncoDe(especialidad)]
}

/** ¿Esta herramienta se muestra por defecto para esta especialidad? */
export function muestraPorDefecto(especialidad: string | undefined | null, h: HerramientaId): boolean {
  return herramientasDe(especialidad).includes(h)
}

/**
 * Filtra la lista de herramientas de la consulta.
 *
 * `siempre` permite forzar la aparición de una herramienta aunque no sea de la
 * especialidad: lo usa el caso quirúrgico detectado en la propia nota —si el
 * diagnóstico dictado es una hernia, el panel de cirugía aparece aunque el médico
 * sea internista— y así el contexto del paciente pesa más que la configuración.
 */
export function filtrarHerramientas<T extends { id: string }>(
  items: T[],
  especialidad: string | undefined | null,
  siempre: string[] = [],
): T[] {
  const permitidas = new Set<string>([...herramientasDe(especialidad), ...siempre])
  return items.filter(i => permitidas.has(i.id))
}
