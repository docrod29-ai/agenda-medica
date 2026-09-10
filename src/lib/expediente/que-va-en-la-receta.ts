/**
 * QUÉ VA EN LA RECETA — y qué es sólo lo que el paciente ya tomaba.
 *
 * ── LA QUEJA, CON SUS PALABRAS ──────────────────────────────────────────────
 *
 *   «no me gusta que hagas la receta con lo que te digo de antecedentes,
 *    la receta es cuando ya te estén diciendo el plan»
 *
 * En el minuto dos de la consulta se recaban los antecedentes: «toma metformina
 * y losartán desde hace tres años». En el minuto veinte se dicta el plan: «le
 * doy amoxicilina 500 cada 8 por 7 días». Y la receta salía con los tres.
 *
 * ── LAS DOS CAUSAS, QUE SON DISTINTAS ───────────────────────────────────────
 *
 * **1. El eje de procedencia estaba escrito y sin conectar.**
 * `procedenciaClinica: 'ya_lo_toma' | 'se_prescribe_hoy'` existe en el tipo
 * (`types/expediente.ts`), en el esquema de extracción, en la regla 6-ter del
 * prompt y en una prueba sellada. El modelo lo rellena. Y se leía en UN sitio
 * —un aviso de dosis— y en ninguno más: ni al armar la lista, ni al imprimir.
 * La familia más cara de este repositorio, otra vez.
 *
 * **2. La lista de medicamentos se ACUMULABA.**
 * El pase en vivo corre cada 15 segundos. La lista hacía `[...previos, ...nuevos]`
 * y sólo descartaba el repetido si el nombre coincidía letra por letra. Lo que
 * entró en el minuto dos no salía nunca — ni cuando el pase final, que ya oyó
 * el plan completo, decidía otra cosa.
 *
 * Los diagnósticos recibieron este mismo arreglo (`fusionar-diagnosticos.ts`).
 * Los medicamentos se quedaron sin él.
 *
 * ── POR QUÉ NO SE DEJA DE EXTRAER DURANTE LA GRABACIÓN ──────────────────────
 *
 * Sería la lectura literal de «la receta es cuando ya te estén diciendo el
 * plan»: no tocar la lista hasta el pase final. **Y sería una regresión.**
 *
 * De esa lista cuelgan el cruce alergia ↔ fármaco, el de interacciones y el
 * motor de dosis, que tienen que avisar MIENTRAS la consulta ocurre. Llevarlos
 * al final es exactamente el defecto que ya se reparó dos veces (REG-173 y
 * REG-190, familia «llega tarde para servir»): el aviso correcto que aparece
 * después del momento en que habría servido.
 *
 * Así que se sigue extrayendo en vivo —los motores siguen protegiendo— y lo que
 * cambia es que la lista **se sustituye** en vez de acumularse, y que al papel
 * sólo baja lo de hoy.
 *
 * ── LA REGLA DE LA DUDA, SEGÚN QUIÉN CREÓ EL RENGLÓN ────────────────────────
 *
 * Un renglón que el médico agregó directamente en la lista sigue siendo una
 * acción explícita del médico, incluso en notas antiguas que todavía no traen
 * `procedenciaClinica`. No se puede borrar del papel retroactivamente.
 *
 * En cambio, un renglón que llega de la IA SIN declarar si es antecedente o
 * prescripción **no puede adquirir intención terapéutica por omisión**. En la
 * frontera `fusionarMedicamentos` se conserva para revisión y para los motores
 * de seguridad, pero se marca `estado:'borrador'`: el tipo ya define ese estado
 * precisamente como «se está capturando; todavía no es una prescripción».
 *
 * Así se falla cerrado donde sí sabemos que el origen es automático, sin
 * inventar que «ya lo toma» ni romper las prescripciones manuales históricas.
 *
 * Módulo PURO, sin dependencias de red ni de framework.
 */
import type { Medicamento } from '@/types/expediente'
import { estaVigente } from './ordenes-medicamento'

/** De dónde sale este renglón, una vez resuelto. */
export type DeDondeSale = 'ya_lo_toma' | 'se_prescribe_hoy' | 'no_se_sabe'

/**
 * ¿Este renglón es medicación previa, receta de hoy, o no se sabe?
 *
 * Sólo manda la etiqueta explícita. No se adivina por el nombre del fármaco ni
 * por su presencia en notas anteriores: renovar hoy lo que ya tomaba es una
 * receta perfectamente normal, y confundir las dos cosas borraría del papel un
 * tratamiento que el médico acaba de indicar.
 */
export function deDondeSale(m: Pick<Medicamento, 'procedenciaClinica'>): DeDondeSale {
  const p = m?.procedenciaClinica
  return p === 'ya_lo_toma' || p === 'se_prescribe_hoy' ? p : 'no_se_sabe'
}

/**
 * Lo que baja al papel.
 *
 * - `ya_lo_toma` nunca es una indicación de hoy.
 * - `estado:'borrador'` tampoco: el propio modelo de orden lo define como una
 *   captura todavía no convertida en prescripción.
 * - estados terminales no se vuelven a prescribir por aparecer en la nota.
 * - un renglón manual legado sin etiqueta ni estado se conserva por
 *   compatibilidad: fue creado por una acción directa del médico, no por la IA.
 */
export function loQueSeReceta<
  T extends Pick<Medicamento, 'procedenciaClinica' | 'estado' | 'speaker'>,
>(meds: readonly T[]): T[] {
  return (meds ?? []).filter(m =>
    deDondeSale(m) !== 'ya_lo_toma' &&
    loDijoElMedico(m) &&
    m.estado !== 'borrador' &&
    m.estado !== 'suspendida' &&
    m.estado !== 'terminada' &&
    m.estado !== 'cancelada'
  )
}

/**
 * ── LA ATRIBUCIÓN MANDA SOBRE LA OPINIÓN DEL MODELO — REG-515 ───────────────
 *
 * `procedenciaClinica` es lo que el modelo OPINA que es el renglón. `speaker`
 * es un hecho del audio: quién habló. Hasta hoy sólo se miraba la opinión, y
 * cuando el modelo etiquetaba un antecedente como `se_prescribe_hoy` no había
 * NADA que lo parara: bajaba al papel con cédula profesional.
 *
 * La regla del dueño, textual: «esos los tienes que captar del plan, y si no
 * escucha el plan que el médico los ponga manualmente». Un antecedente lo dice
 * el paciente; un plan lo dice el médico. Eso no es una heurística: es de quién
 * salió la frase.
 *
 * ── POR QUÉ LA AUSENCIA NO SE CASTIGA ───────────────────────────────────────
 *
 * Un renglón SIN `speaker` no viene del dictado: lo escribió el médico a mano,
 * o es de una nota anterior a este campo. Ésos siguen imprimiéndose, porque
 * borrarlos sería quitarle del papel algo que él mismo escribió — el error caro
 * en la otra dirección.
 *
 * Lo que se para es lo que SÍ trae atribución y NO es del médico. Ahí la
 * ausencia de dato no se convierte en permiso: se para, y el médico lo pone a
 * mano, que es exactamente lo que pidió.
 *
 * ── LO QUE ESTA FUNCIÓN NO ARREGLA ──────────────────────────────────────────
 *
 * Si la diarización atribuye mal la frase, esto hereda ese error. No es una
 * defensa contra un audio mal separado: es una defensa contra que la ETIQUETA
 * del modelo sea la única palabra sobre si algo se receta.
 */
function loDijoElMedico(m: Pick<Medicamento, 'speaker'>): boolean {
  return m.speaker === undefined || m.speaker === 'medico'
}

/**
 * LO QUE DE VERDAD BAJA A UNA RECETA — la única puerta, para todas las pantallas.
 *
 * ── POR QUÉ ESTA FUNCIÓN EXISTE (H-01) ──────────────────────────────────────
 *
 * `loQueSeReceta` contesta «¿el médico quiso indicar esto hoy?». `estaVigente`
 * contesta «¿la orden sigue en pie?». Hacen falta las DOS, y hasta hoy nadie las
 * juntaba en un sitio: la pantalla del médico las componía a mano, dentro de un
 * `useEffect`, y esa composición era todo lo que separaba el antecedente de la
 * prescripción.
 *
 * Una regla clínica que sólo existe dentro de un componente protege exactamente
 * a la pantalla que la escribió. La segunda superficie que arma una receta —el
 * portal del paciente, donde NO hay un médico mirando— nunca pasó por ahí, y
 * bajaba `nota.medicamentos` en crudo a un documento titulado «RECETA MÉDICA».
 *
 * Lo que `loQueSeReceta` sola dejaría pasar y esto no: `probablemente_terminada`
 * —la duración escrita venció y NADIE lo confirmó—. Reimprimirla como receta
 * activa sería afirmar una indicación vigente que el médico no ha revisado.
 *
 * ── LA FRONTERA, DICHA ENTERA ───────────────────────────────────────────────
 *
 *   historia ≠ medicación actual ≠ plan ≠ prescripción ≠ receta firmada
 *
 * Sólo una intención explícita, confirmada y atribuible al médico cruza esta
 * función. Lo que el paciente refirió, lo que la IA sugirió, lo que se suspendió
 * y lo que se está capturando se quedan de este lado — visibles en la nota, que
 * es donde tienen que estar, y fuera del papel.
 *
 * COROLARIO: una nota con medicamentos NO es, por eso, una receta. Puede llevar
 * sólo los antecedentes que el paciente refirió en el minuto dos. «Es una
 * receta» se contesta con `medicamentosDeLaReceta(...).length > 0`, nunca con
 * `medicamentos.length > 0`.
 */
export function medicamentosDeLaReceta<
  T extends Pick<Medicamento, 'procedenciaClinica' | 'estado' | 'speaker'>,
>(meds: readonly T[]): T[] {
  return loQueSeReceta(meds).filter(m => estaVigente(m))
}

/**
 * ── EL RENGLÓN QUE NO NOMBRA NINGÚN FÁRMACO (10-sep-2026, D-048) ────────────
 *
 * El médico dueño, probando en su iPhone: la lista de medicamentos traía
 * «Medicamento no especificado», «Medicamento previo (nombre no precisado)»,
 * «Antibiótico no especificado» y «medicamento de terminación reciente cuyo
 * nombre no fue precisado» — TRES renglones por la misma frase del paciente
 * («acabo de terminar un medicamento»). Cada uno sin dosis, cada uno
 * bloqueando la firma, y ninguno de ellos es un medicamento: son la frase
 * «no se sabe cuál» disfrazada de fila.
 *
 * La regla 19 del prompt ya lo prohíbe y el modelo la ignora. Ésta es la
 * defensa determinista: lo que no nombra un fármaco no entra a la lista. La
 * frase sigue en la prosa de la nota, que es donde la regla 22 la manda
 * («un medicamento cuyo nombre no fue posible precisar»), y ahí no bloquea
 * nada ni sale impreso en la receta.
 *
 * Señala de menos, nunca de más: sólo cae lo que DICE que no sabe el nombre
 * («no especificado», «no precisado», «sin nombre», «cuyo nombre…») o lo que es
 * puro nombre de clase («un antibiótico»). «Doxiciclina» pasa siempre.
 */
const DICE_QUE_NO_SABE_EL_NOMBRE =
  /no (?:fue |ha sido |pudo ser |se )?(?:especificad|precisad|identificad|refier|record)|sin (?:especificar|precisar|nombre|identificar)|nombre (?:desconocido|no (?:precisado|especificado|referido|identificado))|cuyo nombre|no (?:se )?(?:sabe|recuerda|supo) (?:el nombre|cu[aá]l)|\bdesconocid[oa]\b/i
const SOLO_UNA_CLASE =
  /^(?:un |una |el |la |otro |otra )?(?:medicamento|medicina|f[aá]rmaco|antibi[oó]tico|analg[eé]sico|antiinflamatorio|tratamiento|pastilla|inyecci[oó]n)s?(?: previo| anterior| actual| reciente| nuevo| habitual)?s?$/i

export function esNombreSinPrecisar(nombre: unknown): boolean {
  const n = String(nombre ?? '').trim()
  if (!n) return false
  return DICE_QUE_NO_SABE_EL_NOMBRE.test(n) || SOLO_UNA_CLASE.test(n)
}

/**
 * ── LO QUE SÓLO SE MENCIONÓ (10-sep-2026, D-048) ────────────────────────────
 *
 * El complemento exacto de `loQueSeReceta` entre los renglones con nombre: lo
 * que el paciente refirió, lo que la IA extrajo sin intención declarada, lo
 * suspendido. La pantalla lo enseña en UNA línea discreta, no como filas de
 * receta — y por eso no puede bloquear la firma: nada de esto sale en el papel.
 *
 * Sigue en `nota.medicamentos`: de la lista entera cuelgan el cruce de
 * alergias, el de interacciones y la reconciliación (REG-173/190). Una vista
 * distinta, la misma entidad.
 */
export function loQueSoloSeMenciono<
  T extends Pick<Medicamento, 'nombre' | 'procedenciaClinica' | 'estado' | 'speaker'>,
>(meds: readonly T[]): T[] {
  const receta = new Set<T>(loQueSeReceta(meds))
  return (meds ?? []).filter(m => String(m?.nombre ?? '').trim() && !receta.has(m))
}

/**
 * El médico lo pasa a la receta de hoy con un gesto explícito. Es SU intención,
 * dicha con el dedo: por eso se escribe `speaker:'medico'` —la atribución que
 * REG-515 exige— y se borra el `estado` de captura. Reversible: en la lista
 * tiene su botón de quitar.
 */
export function comoRecetaDeHoy(m: Medicamento): Medicamento {
  const { estado: _estado, motivoEstado: _motivo, ...resto } = m
  void _estado; void _motivo
  return { ...resto, procedenciaClinica: 'se_prescribe_hoy', speaker: 'medico' }
}

/** Lo que el paciente ya tomaba. Va en la nota; no va en la receta. */
export function loQueYaTomaba<T extends Pick<Medicamento, 'procedenciaClinica'>>(
  meds: readonly T[],
): T[] {
  return (meds ?? []).filter(m => deDondeSale(m) === 'ya_lo_toma')
}

/** Nombre comparable: sin acentos, sin mayúsculas, sin espacios de sobra. */
function clave(nombre: unknown): string {
  return String(nombre ?? '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim()
}

/** ¿Son el mismo fármaco? Por nombre normalizado: aquí no hay código que valga. */
export function esElMismoFarmaco(
  a: Pick<Medicamento, 'nombre'>, b: Pick<Medicamento, 'nombre'>,
): boolean {
  const ka = clave(a?.nombre), kb = clave(b?.nombre)
  return !!ka && ka === kb
}

export interface FusionDeMedicamentos {
  /** Lo que había en la lista antes de esta pasada. */
  previos: readonly Medicamento[]
  /** Lo que la IA acaba de producir. */
  nuevos: readonly Medicamento[]
  /**
   * Lo que la IA produjo en la pasada ANTERIOR.
   *
   * Es lo único que distingue lo suyo de lo que escribió el médico —y por tanto
   * lo único que hace seguro sustituir en vez de acumular.
   */
  deLaIaAnterior?: readonly Medicamento[]
}

/**
 * Un medicamento creado por IA sin intención explícita queda visible y
 * revisable, pero NO se convierte en orden por omisión.
 *
 * `borrador` ya es el estado canónico para «se está capturando y todavía no es
 * prescripción». No inventamos `ya_lo_toma`, porque la IA tampoco demostró eso.
 * Si el modelo sí declaró `se_prescribe_hoy` o `ya_lo_toma`, se respeta.
 */
function sinIntencionAutomaticaNoEsReceta(m: Medicamento): Medicamento {
  if (m.procedenciaClinica) return m
  if (m.estado === 'suspendida' || m.estado === 'terminada' || m.estado === 'cancelada') return m
  return m.estado === 'borrador' ? m : { ...m, estado: 'borrador' }
}

/**
 * Sustituye lo que puso la IA, conserva lo del médico, y no repite.
 *
 * Si no se sabe qué puso la IA antes (`deLaIaAnterior` ausente), **no se quita
 * nada**: el error caro es borrarle al médico un fármaco que él escribió, no
 * dejarle uno de más en la NOTA. La diferencia importante es que un renglón
 * automático sin intención explícita queda `borrador`, así que no cruza al
 * PAPEL hasta que exista intención terapéutica.
 *
 * Cuando el mismo fármaco viene por los dos lados, **gana el del médico** —
 * salvo en los datos que él dejó vacíos, donde se completa con lo de la IA. Si
 * escribió la dosis a mano, esa dosis no se pisa: es la única de las dos que
 * alguien decidió.
 */
export function fusionarMedicamentos(p: FusionDeMedicamentos): Medicamento[] {
  const previos = p.previos ?? []
  const nuevos = (p.nuevos ?? [])
    .filter(m => m?.nombre?.trim())
    // Un renglón que no nombra un fármaco no es un medicamento (ver abajo).
    .filter(m => !esNombreSinPrecisar(m.nombre))
    .map(sinIntencionAutomaticaNoEsReceta)
  const anteriores = p.deLaIaAnterior ?? []

  // 1 · Lo del médico: todo lo previo que la IA no había puesto.
  const delMedico = anteriores.length
    ? previos.filter(m => !anteriores.some(a => esElMismoFarmaco(a, m)))
    : previos

  // 2 · Lo del médico primero: ante un empate, manda lo suyo.
  const out: Medicamento[] = []
  for (const m of [...delMedico, ...nuevos]) {
    const i = out.findIndex(x => esElMismoFarmaco(x, m))
    if (i === -1) { out.push(m); continue }
    out[i] = completar(out[i], m)
  }
  return out
}

/** Rellena sólo los huecos del que ya estaba. Lo escrito no se pisa. */
function completar(sePuedeQuedar: Medicamento, otro: Medicamento): Medicamento {
  const vacio = (v: unknown) => !String(v ?? '').trim()
  return {
    ...sePuedeQuedar,
    dosis:       vacio(sePuedeQuedar.dosis)       ? otro.dosis       : sePuedeQuedar.dosis,
    via:         vacio(sePuedeQuedar.via)         ? otro.via         : sePuedeQuedar.via,
    frecuencia:  vacio(sePuedeQuedar.frecuencia)  ? otro.frecuencia  : sePuedeQuedar.frecuencia,
    duracion:    vacio(sePuedeQuedar.duracion)    ? otro.duracion    : sePuedeQuedar.duracion,
    indicacion:  vacio(sePuedeQuedar.indicacion)  ? otro.indicacion  : sePuedeQuedar.indicacion,
    // La procedencia la sabe el modelo, no el médico: si él no la puso, vale la suya.
    procedenciaClinica: sePuedeQuedar.procedenciaClinica ?? otro.procedenciaClinica,
    // Si lo que se conserva es un renglón manual legado, no le heredamos el
    // `borrador` automático de la IA sólo por completar un hueco. Si el primer
    // renglón ya traía estado, ése sí manda.
    estado: sePuedeQuedar.estado ?? (sePuedeQuedar.procedenciaClinica ? otro.estado : undefined),
  }
}

export const POR_QUE_LA_DUDA_SE_IMPRIME =
  'Un renglón creado directamente por el médico sigue siendo una indicación ' +
  'aunque sea legado y no tenga procedencia. La duda de origen automático no ' +
  'se imprime: queda como borrador hasta que exista intención clínica explícita.'

export const POR_QUE_SE_SIGUE_EXTRAYENDO_EN_VIVO =
  'De la lista cuelgan el cruce alergia ↔ fármaco, el de interacciones y el ' +
  'motor de dosis, que tienen que avisar MIENTRAS la consulta ocurre. Dejar de ' +
  'llenarla hasta el final sería REG-173 y REG-190 otra vez: el aviso correcto ' +
  'que llega después del momento en que habría servido.'

export const POR_QUE_NO_SE_ADIVINA_POR_EL_HISTORIAL =
  'Renovar hoy lo que el paciente ya tomaba es una receta normal. Marcarlo ' +
  '«previo» porque aparece en una nota anterior borraría del papel un ' +
  'tratamiento que el médico acaba de indicar.'

export const LA_AUTORIDAD_DE_PRESCRIPCION_ES_UNA_SOLA =
  'Historia, medicación actual, plan, prescripción y receta liberada son cinco ' +
  'cosas distintas. Sólo una intención explícita, confirmada y atribuible al ' +
  'médico cruza `medicamentosDeLaReceta`. Toda superficie que arme una receta ' +
  '—la del médico y la del paciente— pasa por esa misma puerta, en el servidor ' +
  'cuando el destinatario es el paciente: esconder un renglón en la pantalla no ' +
  'cierra la ruta HTTP que lo devuelve.'
