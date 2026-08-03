/**
 * PUENTE ENTRE EL FORMULARIO Y EL MOTOR DE DOSIFICACIÓN.
 *
 * `motor.ts` es puro y no sabe nada de pantallas: recibe un `ContextoPaciente`
 * con tipos exactos y devuelve la regla que aplica. Un formulario, en cambio,
 * devuelve **cadenas de texto**, y ahí es donde se cuelan los errores caros:
 * un campo vacío que se convierte en `0`, un `Number('')` que da `0` y no `NaN`,
 * un desplegable sin elegir que se toma por «ninguno».
 *
 * ── LA REGLA DE ESTE ARCHIVO ─────────────────────────────────────────────────
 *
 * **Un campo vacío es `undefined`, nunca un cero.** Un peso vacío leído como
 * `0 kg` no manda a `SPECIALIST_REVIEW`: manda a una dosis en mg/kg calculada
 * sobre cero. Un CrCl vacío leído como `0 mL/min` elige la rama renal más
 * agresiva del dataset para un paciente con riñón sano.
 *
 * Es el mismo error de siempre —convertir «no sé» en un número— y el contrato
 * del Dr. lo prohíbe explícitamente: si falta un dato, se declara.
 *
 * ── Y LA VALIDACIÓN, QUE EL MOTOR NO PUEDE SABER ─────────────────────────────
 *
 * `recomendar()` devuelve SIEMPRE `validacion: 'sin_validar'`, y hace bien: es
 * un módulo puro, no puede leer las firmas del consultorio. Pero eso convierte
 * ese campo en un **piso**, no en un veredicto: dice «como mínimo, sin validar».
 *
 * `conValidacionDelMedico` lo levanta cuando el médico SÍ firmó esa regla para
 * esta versión exacta del dataset. Una firma caducada no cuenta: describe unos
 * números que ya no son los que están en pantalla.
 *
 * Módulo PURO.
 */

import type { ContextoPaciente, Recomendacion, ModalidadRRT, EscalarPeso } from '@/lib/dosing/motor'
import type { ResultadoValidacion } from '@/lib/dosing/validacion'
import { AVISO_SIN_VALIDAR } from '@/lib/dosing/dataset'

/** Lo que devuelve el formulario: todo texto, todo opcional. */
export interface CamposConsulta {
  farmaco: string
  indicacion?: string
  gravedad?: string
  pesoKg?: string
  escalarPeso?: string
  crClMlMin?: string
  renalInestable?: string
  rrt?: string
  efluenteCrrtLh?: string
  organismo?: string
  micMgL?: string
  esNeumonia?: string
  sedacionYVentilacionAseguradas?: string
}

const GRAVEDAD = ['no_grave', 'grave', 'choque'] as const
const ESCALARES: EscalarPeso[] = ['TBW', 'IBW', 'AdjBW', 'no_documentado']
const MODALIDADES: ModalidadRRT[] =
  ['ninguna', 'IHD', 'SLED_PIRRT', 'CVVH', 'CVVHD', 'CVVHDF', 'desconocida']

/**
 * Un número de formulario. Vacío, en blanco o no numérico → `undefined`.
 *
 * `Number('')` es `0` y `Number('  ')` también: por eso no se usa a secas.
 * Los negativos tampoco pasan — un peso o un CrCl negativo es un dedazo, y
 * dejarlo entrar elegiría la rama renal más agresiva del dataset.
 */
export function numeroOpcional(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  const t = v.trim()
  if (t === '') return undefined
  const x = Number(t)
  return Number.isFinite(x) && x >= 0 ? x : undefined
}

/** Un sí/no de formulario. Sin elegir → `undefined`, que NO es «no». */
export function boolOpcional(v: string | undefined): boolean | undefined {
  if (v === 'si') return true
  if (v === 'no') return false
  return undefined
}

const texto = (v?: string) => {
  const t = (v ?? '').trim()
  return t === '' ? undefined : t
}

/**
 * Traduce el formulario al contexto que entiende el motor.
 *
 * Nada se rellena por defecto: lo que el médico no declaró llega como
 * `undefined` y el motor lo pone en `faltantes`. Es más lento de llenar y es la
 * única forma honesta.
 */
export function construirContexto(c: CamposConsulta): ContextoPaciente {
  const gravedad = GRAVEDAD.find(g => g === c.gravedad)
  const escalar = ESCALARES.find(e => e === c.escalarPeso)
  const rrt = MODALIDADES.find(m => m === c.rrt)
  return {
    farmaco: c.farmaco.trim(),
    indicacion: texto(c.indicacion),
    gravedad,
    pesoKg: numeroOpcional(c.pesoKg),
    escalarPeso: escalar,
    crClMlMin: numeroOpcional(c.crClMlMin),
    renalInestable: boolOpcional(c.renalInestable),
    rrt,
    efluenteCrrtLh: numeroOpcional(c.efluenteCrrtLh),
    organismo: texto(c.organismo),
    micMgL: numeroOpcional(c.micMgL),
    esNeumonia: boolOpcional(c.esNeumonia),
    sedacionYVentilacionAseguradas: boolOpcional(c.sedacionYVentilacionAseguradas),
  }
}

/**
 * Levanta el estado de validación con lo que el médico firmó en ESTE consultorio.
 *
 * Sólo una firma vigente cuenta. Una caducada —la que se hizo sobre otra versión
 * del dataset— deja la salida en `sin_validar` y lo explica, porque arrastrarla
 * sería dar por comprobados unos números que nadie miró.
 */
export function conValidacionDelMedico(
  rec: Recomendacion,
  val: ResultadoValidacion,
): Recomendacion {
  if (val.estado === 'validado') {
    return {
      ...rec,
      validacion: 'validado_por_medico',
      avisoValidacion:
        `Regla validada por ${val.firma.validadoPorNombre} el `
        + `${val.firma.fecha.slice(0, 10)} contra la versión ${val.firma.versionDataset} `
        + 'del dataset, que es la que está cargada.',
    }
  }
  if (val.estado === 'caducada') {
    return { ...rec, validacion: 'sin_validar', avisoValidacion: `${val.porQue} ${AVISO_SIN_VALIDAR}` }
  }
  return rec
}

/**
 * Cómo se presenta cada estado. El texto NO es clínico: describe qué hizo el
 * motor, para que nadie confunda «no lo sé» con «no hace falta».
 */
export const COMO_SE_LEE: Record<Recomendacion['estado'], { titulo: string; explicacion: string }> = {
  CLEAR: {
    titulo: 'Regla encontrada',
    explicacion: 'El contexto coincide con una de las reglas del fármaco y no se disparó '
      + 'ninguna regla dura. La cifra es la del dataset, tal cual: el motor eligió cuál '
      + 'aplica, no la recalculó.',
  },
  BLOCKED: {
    titulo: 'Bloqueado',
    explicacion: 'Una regla dura impide dosificar en este contexto, así que NO se enseña '
      + 'ninguna cifra. Enseñar el número y añadir «pero no» es invitar a que alguien lea '
      + 'sólo el número.',
  },
  SPECIALIST_REVIEW: {
    titulo: 'Revisión de especialista',
    explicacion: 'Falta un dato o el contexto no coincide con ninguna rama. No se interpola, '
      + 'no se deduce de un fármaco parecido y no se ofrece «la mitad de la dosis normal». '
      + 'Lo que falta está listado abajo.',
  },
}
