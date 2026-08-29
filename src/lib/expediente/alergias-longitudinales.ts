/**
 * LAS ALERGIAS DEL PACIENTE SEGÚN **TODO** LO QUE SE HA ESCRITO DE ÉL.
 *
 * ── LA TERCERA PROYECCIÓN, Y LA QUE NO PODÍA SEGUIR FALTANDO ─────────────────
 *
 * `ordenes-medicamento.ts` contesta qué toma y `problemas-activos.ts` contesta
 * qué tiene, los dos recorriendo el expediente entero. La alergia —el dato más
 * letal de la aplicación, el que apaga el botón de Firmar y el que sale impreso
 * en el recuadro rojo de la receta— **no tenía proyección ninguna**: se lee de
 * un campo de texto libre de `Patient`, editable en línea, que **la última
 * escritura pisa entera**.
 *
 * ── QUÉ SE REPRODUJO ────────────────────────────────────────────────────────
 *
 * Cada nota firmada sella `alergias: alergiasDe(patient)` — una COPIA de la
 * lista tal como estaba ese día. Así que el expediente sí guarda la alergia,
 * dentro de documentos inmutables, tantas veces como consultas hubo. Y **nadie
 * la vuelve a leer**: los 20 llamadores de `alergiasDe`/`alergenosDe`/
 * `alergiasParaImpreso` leen `patient`, ninguno mira las notas. Medido sobre el
 * árbol: `nota.alergias` sólo lo consumen `nom004.ts` (la compuerta de ESA
 * nota), `integrity.ts` (su hash) y `procedencia.ts` (su manifiesto). Ninguno
 * cruza notas.
 *
 * Consecuencia, con la secuencia real que este repositorio ya documenta en
 * REG-323 y en el `logAudit({ vaciado: true })` de `firestore.ts:656`:
 *
 *     2024-03  nota firmada · alergias: [{ alergeno: 'Penicilina',
 *                                          severidad: 'anafilaxia' }]
 *     2024-11  nota firmada · la misma alergia, sellada otra vez
 *     2026-08  alguien vacía el campo — un import de CSV, una migración, un
 *              médico que quiere que le deje firmar, un dedo en el móvil
 *     2026-08  la pantalla dice «No registradas», la receta imprime «Negadas /
 *              no referidas», y el cruce alergia↔fármaco **no salta con
 *              amoxicilina**
 *
 * Las dos notas firmadas siguen ahí, diciendo «anafilaxia por penicilina», y el
 * producto entero se comporta como si nunca se hubieran escrito. La bitácora
 * registra el vaciado —eso ya se arregló— pero **nadie lee la bitácora en la
 * consulta**, y una alergia que hay que ir a buscar a un registro de auditoría
 * es una alergia que no llega. («El dato tiene que LLEGAR».)
 *
 * ── LA REGLA, Y POR QUÉ NO ES LA DE LOS OTROS DOS MÓDULOS ───────────────────
 *
 * Los problemas y la medicación siguen «manda la última palabra sobre CADA
 * entidad». Aquí eso sería un defecto, porque **el sello no es una palabra: es
 * una copia**. La nota no dice «hoy el paciente ya no es alérgico a la
 * penicilina»; dice «el campo de alergias decía esto cuando firmé». Tratar una
 * copia vacía como una retractación convertiría cualquier borrado accidental en
 * una decisión clínica retroactiva.
 *
 * Así que la regla aquí es **asimétrica, y a propósito**:
 *
 *   · afirmar SUMA — una alergia sellada en una nota firmada entra en el estado
 *     y ya no sale por sí sola;
 *   · el silencio NO RESTA — no estar en la lista de hoy no la retracta;
 *   · una negación explícita de hoy tampoco la borra: **la pone en conflicto**,
 *     que es una pregunta para el médico, no una respuesta del sistema
 *     (regla 6 de seguridad clínica: se pregunta, no se adivina).
 *
 * ── LO QUE ESTE MÓDULO NO HACE, Y NO DEBE HACER ─────────────────────────────
 *
 * **No alimenta la compuerta.** La compuerta que bloquea la firma sigue leyendo
 * `alergiasDe(patient)` y sólo eso. Meter aquí una segunda fuente de verdad
 * haría que una nota de 2024 pisara una corrección que el médico hizo hoy a
 * conciencia — y crearía exactamente el defecto que ADR-001 y REG-034/035/171
 * describen: dos lecturas del mismo campo.
 *
 * Lo que hace es **enseñar lo que la compuerta no está mirando**, con la fecha
 * de la nota que lo dice, para que el médico decida. Devolver la alergia a la
 * lista es un acto suyo, visible y reversible.
 *
 * No infiere severidad, no traduce, no agrupa familias de fármacos, no decide
 * que una alergia sea real y no resuelve el conflicto.
 *
 * Módulo PURO.
 */
import type { Alergia } from '@/types/expediente'
import type { AlergiaEstructurada } from '@/types'
import { alergiasDe, negacionesEnTexto } from '@/lib/seguridad/alergias'

/** Sube cuando cambia lo que esta proyección SIGNIFICA, no cuando se refactoriza. */
export const VERSION_PROYECCION_ALERGIAS = 1

/** Una nota, reducida a lo que hace falta aquí. */
export interface NotaConAlergias {
  /** ISO. Ordena cuál fue la última nota que la selló. */
  fecha: string
  alergias?: Alergia[]
  /** Sólo cuentan las firmadas: un borrador todavía se está escribiendo. */
  estado?: string
}

/** Un sello: lo que UNA nota firmada dijo de esta alergia, con su fecha. */
export interface SelloDeAlergia {
  /** ISO de la nota que lo selló. */
  fecha: string
  /** Lo que esa nota dijo, entero y sin rellenar nada. */
  alergia: Alergia
}

export interface AlergiaEnElExpediente {
  /** Tal como se escribió en la nota más reciente que la selló, o en la lista de hoy. */
  alergeno: string
  /**
   * TODOS los sellos, de la nota más nueva a la más vieja.
   *
   * No se fusionan. La nota de noviembre decía «anafilaxia» a secas y la de
   * marzo decía «anafilaxia, edema de glotis»: quedarse sólo con la más
   * reciente perdía «edema de glotis», que es justo lo que distingue una
   * anafilaxia de un exantema. Y componer un registro con campos de dos notas
   * distintas fabricaría un registro que **nadie escribió** — que es la otra
   * mitad del mismo error. Se enseñan los dos, cada uno con su fecha.
   */
  registros: SelloDeAlergia[]
  /** El sello más RECIENTE, sin componer nada. Ausente si sólo está en la lista de hoy. */
  registro?: Alergia
  /** ISO de la nota firmada MÁS RECIENTE que la afirma. Vacío si nunca se selló. */
  selladaEn: string
  /** ISO de la PRIMERA nota firmada que la afirma. Vacío si nunca se selló. */
  desde: string
  /** Cuántas notas FIRMADAS la afirman. */
  notasQueLaAfirman: number
  /** ¿La compuerta de hoy la está mirando? */
  enLaListaDeHoy: boolean
  /** ¿El campo de hoy la NIEGA con todas las letras? Conflicto, no resolución. */
  negadaHoy: boolean
}

export interface EstadoDeAlergias {
  /** ISO del instante al que corresponde esta proyección. Se pasa; no se lee el reloj. */
  asOf: string
  version: number
  /** Todo: lo sellado en notas firmadas y lo que hay hoy en la lista. */
  alergias: AlergiaEnElExpediente[]
  /**
   * Selladas en nota firmada y AUSENTES de la lista de hoy. Es exactamente lo
   * que la compuerta alergia↔fármaco NO está mirando en esta consulta.
   */
  ausentesDeLaListaDeHoy: AlergiaEnElExpediente[]
  /** Selladas en nota firmada y NEGADAS por el campo de hoy. No se resuelve solo. */
  enConflicto: AlergiaEnElExpediente[]
  /**
   * true = el historial del que sale esto vino recortado (REG-350). Entonces
   * «no encontré más» NO significa «no hay más», y la pantalla tiene que decirlo.
   */
  historialIncompleto: boolean
}

/** Clave para reconocer «el mismo alérgeno» escrito de dos formas. */
function claveAlergeno(nombre: string): string {
  return String(nombre ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * ¿Alguno de los fragmentos NEGADOS de hoy habla de este alérgeno?
 *
 * Se compara por PALABRAS COMPLETAS, nunca por subcadena: «sal» dentro de
 * «sulfas» daría un conflicto que nadie escribió, y un conflicto inventado
 * gasta la atención que hace falta para los de verdad.
 */
function negadaEn(clave: string, negaciones: readonly string[]): boolean {
  if (!clave) return false
  const palabras = clave.split(' ').filter(Boolean)
  if (!palabras.length) return false
  return negaciones.some(frag => {
    const t = ` ${claveAlergeno(frag)} `
    return palabras.every(p => t.includes(` ${p} `))
  })
}

/**
 * El estado de alergias del paciente según el expediente entero.
 *
 * @param notas    Las notas del paciente. Sólo se leen las FIRMADAS.
 * @param hoy      El paciente tal como está ahora — el campo que hoy gobierna la compuerta.
 * @param asOf     ISO del momento de la proyección. Se pasa para que la función sea pura.
 * @param opciones `historialIncompleto` cuando las notas vinieron recortadas.
 */
export function estadoDeAlergias(
  notas: readonly NotaConAlergias[],
  hoy: { alergias?: string; alergiasEstructuradas?: AlergiaEstructurada[] } | null | undefined,
  asOf: string,
  opciones?: { historialIncompleto?: boolean },
): EstadoDeAlergias {
  const listaDeHoy = alergiasDe(hoy ?? {})
  const clavesDeHoy = new Set(listaDeHoy.map(a => claveAlergeno(a.alergeno)))
  const negaciones = negacionesEnTexto(hoy?.alergias)

  const acumulado = new Map<string, AlergiaEnElExpediente>()

  /* De la más NUEVA a la más vieja: la primera vez que se ve un alérgeno trae
     el registro más reciente que se selló de él —el que más se parece a lo que
     hoy se sabe— y la última que se ve fija `desde`. */
  const orden = [...notas].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
  for (const nota of orden) {
    if (nota.estado !== 'firmada') continue
    for (const al of nota.alergias ?? []) {
      const k = claveAlergeno(al.alergeno)
      if (!k) continue
      const previo = acumulado.get(k)
      if (previo) {
        previo.notasQueLaAfirman += 1
        previo.registros.push({ fecha: nota.fecha, alergia: al })
        previo.desde = nota.fecha          // vamos hacia atrás: la última vista es la primera
        continue
      }
      acumulado.set(k, {
        alergeno: String(al.alergeno).trim(),
        registros: [{ fecha: nota.fecha, alergia: al }],
        registro: al,
        selladaEn: nota.fecha,
        desde: nota.fecha,
        notasQueLaAfirman: 1,
        enLaListaDeHoy: clavesDeHoy.has(k),
        negadaHoy: negadaEn(k, negaciones),
      })
    }
  }

  /* Lo que hoy está en la lista y ninguna nota firmada llegó a sellar todavía
     —lo que se acaba de escribir en esta consulta— también es estado del
     paciente. Sin esto, la proyección sería «el pasado», no «el estado». */
  for (const a of listaDeHoy) {
    const k = claveAlergeno(a.alergeno)
    if (!k || acumulado.has(k)) continue
    acumulado.set(k, {
      alergeno: a.alergeno.trim(),
      registros: [],
      selladaEn: '',
      desde: '',
      notasQueLaAfirman: 0,
      enLaListaDeHoy: true,
      negadaHoy: false,
    })
  }

  const todas = [...acumulado.values()].sort((a, b) =>
    claveAlergeno(a.alergeno).localeCompare(claveAlergeno(b.alergeno)))

  return {
    asOf,
    version: VERSION_PROYECCION_ALERGIAS,
    alergias: todas,
    /* Negada y ausente son cosas distintas y se cuentan aparte: una es «alguien
       dijo que no» y la otra es «nadie dijo nada». Mezclarlas volvería a hacer
       de la ausencia un dato. */
    ausentesDeLaListaDeHoy: todas.filter(a => a.notasQueLaAfirman > 0 && !a.enLaListaDeHoy && !a.negadaHoy),
    enConflicto: todas.filter(a => a.notasQueLaAfirman > 0 && a.negadaHoy),
    historialIncompleto: !!opciones?.historialIncompleto,
  }
}

/**
 * Orden de gravedad. Sólo para ELEGIR CUÁL ENSEÑAR, nunca para asignar ninguna.
 */
const GRAVEDAD: Record<string, number> = {
  leve: 1, moderada: 2, grave: 3, anafilaxia: 4,
}

/**
 * LA PEOR SEVERIDAD QUE ALGUNA NOTA FIRMADA LLEGÓ A SELLAR, CON SU FECHA.
 *
 * Por qué la peor y no la más reciente: la más reciente puede no llevar
 * severidad —el campo es opcional justamente para no obligar a inventar— y
 * entonces una anafilaxia sellada en 2024 se enseñaría como una alergia sin
 * gravedad conocida. Sub-declarar la gravedad de una alergia es la dirección
 * cara del error.
 *
 * Esto NO inventa nada y NO compone: devuelve lo que dice UNA nota concreta,
 * con la fecha de esa nota, para que el médico pueda ir a leerla. Si ninguna
 * nota selló severidad, devuelve `null` — «no se sabe» es un estado real.
 */
export function peorSeveridadRegistrada(
  a: Pick<AlergiaEnElExpediente, 'registros'>,
): { severidad: NonNullable<Alergia['severidad']>; fecha: string } | null {
  let mejor: { severidad: NonNullable<Alergia['severidad']>; fecha: string } | null = null
  for (const r of a.registros) {
    const s = r.alergia.severidad
    if (!s) continue
    if (!mejor || (GRAVEDAD[s] ?? 0) > (GRAVEDAD[mejor.severidad] ?? 0)) {
      mejor = { severidad: s, fecha: r.fecha }
    }
  }
  return mejor
}

/**
 * LA REACCIÓN QUE ALGUNA NOTA FIRMADA DESCRIBIÓ, CON SU FECHA.
 *
 * Mismo criterio: la más reciente que la tenga. «Edema de glotis» escrito en
 * marzo no deja de ser cierto porque la nota de noviembre no lo repitiera —
 * repetir no es afirmar de nuevo, y omitir no es desdecirse.
 */
export function reaccionRegistrada(
  a: Pick<AlergiaEnElExpediente, 'registros'>,
): { reaccion: string; fecha: string } | null {
  for (const r of a.registros) {
    const t = String(r.alergia.reaccion ?? '').trim()
    if (t) return { reaccion: t, fecha: r.fecha }
  }
  return null
}

/**
 * Cómo se le dice al médico, en una línea, que la compuerta está ciega a algo.
 *
 * Devuelve cadena vacía cuando no hay nada que decir: la pantalla no debe
 * pintar un aviso vacío, y un aviso que sale siempre deja de leerse.
 */
export function avisoDeAlergiasQueNoSeVen(estado: EstadoDeAlergias): string {
  const partes: string[] = []
  for (const a of estado.ausentesDeLaListaDeHoy) {
    const n = a.notasQueLaAfirman
    /* La gravedad va en el aviso: «Penicilina» y «Penicilina — anafilaxia» no
       son la misma frase para quien está a punto de prescribir. */
    const peor = peorSeveridadRegistrada(a)
    const grav = peor ? `, ${peor.severidad}` : ''
    partes.push(`${a.alergeno} (${n} nota${n === 1 ? '' : 's'} firmada${n === 1 ? '' : 's'}${grav})`)
  }
  for (const a of estado.enConflicto) {
    partes.push(`${a.alergeno} — hoy el campo la NIEGA`)
  }
  if (!partes.length) return ''
  return `El expediente registra alergia a ${partes.join(' · ')}, y la lista de hoy no la tiene. ` +
    'La alerta al prescribir NO la está mirando.'
}

export const POR_QUE_EL_SELLO_NO_RETRACTA =
  'Porque la nota no dice «ya no es alérgico»: dice «el campo de alergias ' +
  'decía esto cuando firmé». Es una copia, no una palabra. Tratar una copia ' +
  'vacía como retractación convertiría cualquier borrado accidental —un import, ' +
  'una migración, un dedo en el móvil— en una decisión clínica retroactiva, y ' +
  'apagaría el cruce alergia↔fármaco sin que nadie lo hubiera decidido.'
