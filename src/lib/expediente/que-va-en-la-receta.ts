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
export function loQueSeReceta<T extends Pick<Medicamento, 'procedenciaClinica' | 'estado'>>(
  meds: readonly T[],
): T[] {
  return (meds ?? []).filter(m =>
    deDondeSale(m) !== 'ya_lo_toma' &&
    m.estado !== 'borrador' &&
    m.estado !== 'suspendida' &&
    m.estado !== 'terminada' &&
    m.estado !== 'cancelada'
  )
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
  T extends Pick<Medicamento, 'procedenciaClinica' | 'estado'>,
>(meds: readonly T[]): T[] {
  return loQueSeReceta(meds).filter(m => estaVigente(m))
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
