/**
 * QUÉ CAMBIÓ DE VERDAD, Y QUÉ SÓLO CAMBIÓ DE NÚMERO.
 *
 * ── DE DÓNDE SALE ESTA POLÍTICA ──────────────────────────────────────────────
 *
 * REG-369 dejó esto como `NEEDS_CLINICAL_REVIEW`: cuánto tiene que moverse un
 * analito para que el cambio importe. **El dueño lo resolvió el 29-ago-2026**, y
 * lo primero que dijo es lo que este módulo protege:
 *
 *   **NO existe un porcentaje universal seguro para todos los analitos. No se
 *   implementa un umbral global del 10 %, del 20 % ni de ninguno.**
 *
 * Y después, en orden:
 *
 *   1. Usar primero los **umbrales clínicos ya definidos** para ese analito.
 *   2. Si existe **RCV / variación biológica validada** para ese analito, puede
 *      usarse.
 *   3. Importa **cruzar un límite de decisión** aunque el cambio porcentual sea
 *      pequeño.
 *   4. Si no hay regla específica validada: **mostrar delta absoluto y relativo,
 *      pero NO etiquetarlo como «clínicamente significativo»**.
 *   5. **No inventar umbrales.**
 *
 * ── DE DÓNDE SALEN LOS UMBRALES QUE SÍ SE USAN ───────────────────────────────
 *
 * De dos tablas que **ya existen en este repositorio**, cada una con su
 * procedencia y su sitio en el registro de motores clínicos:
 *
 *   · `ANALITOS[].refMin/refMax` (`laboratorio/analitos.ts`) — el rango de
 *     referencia por analito.
 *   · `CRITICOS` (`hospital/lab-criticos.ts`) — los valores de pánico, que además
 *     saben de unidades y distinguen «no evaluable» de «normal».
 *
 * Este módulo **no define ni uno solo**. Lee las que hay y dice qué línea cruzó
 * el valor. Que un número pase de un lado a otro de una línea que el sistema ya
 * tenía escrita es un **hecho**, no un juicio — y es exactamente el punto 3 de la
 * política: cruzar importa aunque el porcentaje sea pequeño.
 *
 * ── LO QUE NO HAY, Y SE DICE ─────────────────────────────────────────────────
 *
 * **No hay tabla de RCV / variación biológica en este repositorio.** El punto 2
 * de la política la permite «si existe validada», y no existe. El hueco queda
 * declarado —no relleno— y con su sitio marcado: el día que se incorpore una
 * tabla validada, entra por `RELEVANCIA_POR_RCV` y este módulo la consulta antes
 * de rendirse.
 *
 * Mientras tanto, sin cruce y sin RCV, lo que sale son **los dos deltas y nada
 * más**. Ninguna etiqueta.
 *
 * Módulo PURO.
 */
import { ANALITOS } from './analitos'
import { evaluarCriticoLab } from '@/lib/hospital/lab-criticos'

/** Qué línea se cruzó, y hacia dónde. */
export interface Cruce {
  /** `referencia` = rango normal del analito · `critico` = valor de pánico. */
  linea: 'referencia' | 'critico'
  /** `alto` o `bajo`: qué extremo. */
  extremo: 'alto' | 'bajo'
  /** Hacia dónde se cruzó, desde el punto de vista del paciente. */
  direccion: 'entra' | 'sale'
  /** El valor de la línea, tal como lo tiene la tabla que la define. */
  valor?: number
  /** Cómo se dice, ya redactado. */
  texto: string
}

export interface CambioDelAnalito {
  clave: string
  /** Siempre. Positivo si subió. */
  deltaAbsoluto: number
  /** Siempre, salvo que el valor previo sea cero. En tanto por ciento. */
  deltaRelativo: number | null
  /** Las líneas que cruzó, de las que este repositorio ya tenía definidas. */
  cruces: Cruce[]
  /**
   * `true` SÓLO si cruzó una línea ya definida (o si algún día hay RCV validado
   * para el analito). **Nunca por porcentaje.**
   */
  relevanciaDemostrada: boolean
  /**
   * `false` cuando no se pudo juzgar el cruce crítico —unidad desconocida o
   * distinta de la del umbral—. No es lo mismo que «no cruzó»: quien lo pinte
   * debe poder decirlo, en vez de dar por bueno lo que el motor no supo leer.
   */
  criticoEvaluable: boolean
}

/**
 * RCV / variación biológica validada, por analito.
 *
 * **Vacío a propósito.** El punto 2 de la política del dueño permite usarla «si
 * existe validada para ese analito», y en este repositorio **no existe ninguna**.
 * Rellenarla con valores de memoria sería inventar una cifra clínica (regla 1).
 *
 * Su sitio queda marcado: el día que entre una tabla con su fuente citada, este
 * módulo la consulta antes de rendirse, y los casos que hoy salen «sin regla
 * validada» pasarán a tenerla sin tocar nada más.
 */
export const RELEVANCIA_POR_RCV: Readonly<Record<string, never>> = Object.freeze({})

const analito = (clave: string) => ANALITOS.find(a => a.clave === clave)

/** ¿El valor está fuera del extremo? Con la línea ausente, no se opina. */
function fuera(valor: number, linea: number | undefined, extremo: 'alto' | 'bajo'): boolean | null {
  if (linea === undefined) return null
  return extremo === 'alto' ? valor > linea : valor < linea
}

/**
 * Los cruces del rango de REFERENCIA entre dos valores del mismo analito.
 *
 * «Entra» y «sale» se dicen desde el paciente: entrar al rango normal es
 * volver dentro; salir es pasarse. No se califica ninguno de los dos —volver al
 * rango puede ser mejoría o puede ser una transfusión—, sólo se nombra.
 */
function crucesDeReferencia(clave: string, previo: number, actual: number): Cruce[] {
  const a = analito(clave)
  if (!a) return []
  const salida: Cruce[] = []
  for (const extremo of ['alto', 'bajo'] as const) {
    const linea = extremo === 'alto' ? a.refMax : a.refMin
    const antes = fuera(previo, linea, extremo)
    const ahora = fuera(actual, linea, extremo)
    if (antes === null || ahora === null || antes === ahora) continue
    salida.push({
      linea: 'referencia',
      extremo,
      direccion: ahora ? 'sale' : 'entra',
      valor: linea,
      texto: ahora
        ? `cruzó el límite ${extremo} de referencia (${linea} ${a.unidad})`
        : `volvió dentro del rango de referencia (${extremo} ${linea} ${a.unidad})`,
    })
  }
  return salida
}

/**
 * El cruce del valor de PÁNICO, según `lab-criticos.ts`.
 *
 * Se usa el evaluador entero y no su tabla: sabe de unidades y distingue «no
 * evaluable» de «normal», que es justo la diferencia que no se puede perder.
 */
function cruceCritico(clave: string, previo: number, actual: number): { cruces: Cruce[]; evaluable: boolean } {
  const a = analito(clave)
  if (!a) return { cruces: [], evaluable: false }
  const antes = evaluarCriticoLab(a.etiqueta, previo, a.unidad)
  const ahora = evaluarCriticoLab(a.etiqueta, actual, a.unidad)
  const evaluable = antes.evaluable && ahora.evaluable
  if (!evaluable || antes.critico === ahora.critico) return { cruces: [], evaluable }
  return {
    evaluable,
    cruces: [{
      linea: 'critico',
      extremo: actual > previo ? 'alto' : 'bajo',
      direccion: ahora.critico ? 'sale' : 'entra',
      texto: ahora.critico
        ? 'entró en rango crítico (valor de pánico)'
        : 'salió del rango crítico',
    }],
  }
}

/**
 * Qué cambió entre dos mediciones del mismo analito.
 *
 * Devuelve **siempre** los dos deltas. `relevanciaDemostrada` sólo es `true` si
 * cruzó una línea que este repositorio ya tenía definida — nunca por un
 * porcentaje.
 */
export function queCambio(clave: string, previo: number, actual: number): CambioDelAnalito {
  const deltaAbsoluto = actual - previo
  const critico = cruceCritico(clave, previo, actual)
  const cruces = [...critico.cruces, ...crucesDeReferencia(clave, previo, actual)]
  return {
    clave,
    deltaAbsoluto,
    /* Sin previo no hay porcentaje que calcular; dividir entre cero daría un
       infinito con cara de dato. */
    deltaRelativo: previo === 0 ? null : (deltaAbsoluto / Math.abs(previo)) * 100,
    cruces,
    /* Ninguna rama mira el porcentaje. Ésa es la política entera. */
    relevanciaDemostrada: cruces.length > 0 || clave in RELEVANCIA_POR_RCV,
    criticoEvaluable: critico.evaluable,
  }
}

/** Los deltas, dichos. Siempre salen; nunca afirman relevancia. */
export function comoSeDicenLosDeltas(c: CambioDelAnalito): string {
  const signo = c.deltaAbsoluto > 0 ? '+' : ''
  const abs = `${signo}${Math.round(c.deltaAbsoluto * 100) / 100}`
  if (c.deltaRelativo === null) return abs
  return `${abs} (${signo}${Math.round(c.deltaRelativo)} %)`
}

/**
 * La frase entera de un cambio: deltas siempre, y la línea cruzada cuando la
 * hay.
 *
 * **Nunca dice «clínicamente significativo».** Cuando no hay cruce ni RCV
 * validado, lo que sale son los dos números: la política del dueño dice
 * mostrarlos y no etiquetarlos.
 */
export function comoSeDiceElCambio(c: CambioDelAnalito): string {
  const deltas = comoSeDicenLosDeltas(c)
  if (!c.cruces.length) return deltas
  return `${deltas} · ${c.cruces.map(x => x.texto).join(' · ')}`
}

export const DE_QUIEN_ES_ESTA_POLITICA =
  'Del dueño, el 29-ago-2026, resolviendo el NEEDS_CLINICAL_REVIEW que abrió ' +
  'REG-369: no existe un porcentaje universal seguro para todos los analitos, ' +
  'así que no se implementa ningún umbral global. Primero los umbrales clínicos ' +
  'ya definidos; el RCV validado si existe; cruzar un límite de decisión importa ' +
  'aunque el porcentaje sea pequeño; y sin regla específica validada se muestran ' +
  'los deltas SIN etiquetarlos como clínicamente significativos.'

export const POR_QUE_NO_HAY_TABLA_DE_RCV =
  'Porque en este repositorio no existe ninguna validada, y rellenarla de ' +
  'memoria sería inventar una cifra clínica. El hueco queda declarado con su ' +
  'sitio marcado: `RELEVANCIA_POR_RCV`. El día que entre una tabla con su fuente ' +
  'citada, los casos que hoy salen «sin regla validada» pasarán a tenerla sin ' +
  'tocar nada más.'
