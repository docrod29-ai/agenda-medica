/**
 * EL AJUSTE RENAL LE LLEGA AL CONSULTOR YA CALCULADO — O LE LLEGA LA AUSENCIA.
 *
 * ── EL DEFECTO (Panel de Lujo, B-001, P1) ────────────────────────────────────
 *
 * El prompt del consultor de evidencia le ORDENABA al modelo «ajústala a
 * función renal/hepática y peso». El ajuste renal tiene motor determinista en
 * este repositorio (`prescripcion-segura.ts`, `funcion-renal.ts`) y ese camino
 * no lo usaba: la prosa del modelo bajaba a la nota como sección
 * «análisis_evidencia» y la compuerta de firma sólo mira medicamentos
 * estructurados, no esa prosa. La única defensa era otra frase del mismo
 * prompt — prompt contra prompt.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * clinical-safety §2: el modelo de lenguaje redacta y extrae; todo ajuste
 * renal, conversión o cálculo corre en un motor determinista con pruebas. Es la
 * misma doctrina del copiloto de UCI: «los valores YA los calcularon motores
 * deterministas y te llegan en el JSON; jamás recalcules».
 *
 * ── LO QUE ESTE MÓDULO HACE Y LO QUE NO ──────────────────────────────────────
 *
 * Arma el BLOQUE de texto que se le entrega al modelo en el mensaje de usuario:
 *  · si hay depuración plausible → lo que dice el catálogo `AJUSTE_RENAL` para
 *    cada fármaco detectado (conducta, contraindicación), y, para los fármacos
 *    que el catálogo NO tiene, lo dice: «no vigilado». Ausencia de regla no es
 *    ausencia de ajuste (clinical-safety §4-5).
 *  · si NO hay depuración → lo dice literalmente, para que el modelo no la
 *    estime a partir de la edad o del aspecto del paciente.
 *
 * NO calcula la depuración: eso es `evaluarFuncionRenal`, y el valor entra
 * desde la pantalla que tiene la creatinina, el peso y el sexo del paciente.
 * NO propone ninguna cifra que no esté en el catálogo.
 *
 * Módulo PURO.
 */
import { revisarListaRenal, AJUSTE_RENAL, coincideRenal } from '@/lib/expediente/prescripcion-segura'

/** Depuración plausible para dosificar, en mL/min. Fuera de esto no se usa. */
export const DEPURACION_MIN = 0
export const DEPURACION_MAX = 300

export function depuracionPlausible(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > DEPURACION_MIN && v <= DEPURACION_MAX
}

export interface AjusteRenalParaElPrompt {
  /** El bloque de texto listo para pegar al mensaje de usuario. */
  bloque: string
  /** `true` cuando el motor pudo decir algo (aunque sea «sin ajuste»). */
  calculado: boolean
  /** Fármacos detectados que el catálogo no conoce: no se vigilan. */
  noVigilados: string[]
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * @param farmacos  los fármacos que nombra la pregunta (ya detectados aguas arriba).
 * @param depuracion depuración para dosificar, mL/min; `undefined` si no se sabe.
 */
export function bloqueDeAjusteRenal(farmacos: readonly string[], depuracion: unknown): AjusteRenalParaElPrompt {
  const lista = farmacos.map(f => String(f ?? '').trim()).filter(f => f.length >= 3)
  if (lista.length === 0) return { bloque: '', calculado: false, noVigilados: [] }

  if (!depuracionPlausible(depuracion)) {
    return {
      calculado: false,
      noVigilados: lista,
      bloque:
        '\n\nAJUSTE RENAL (motor determinista): NO CALCULADO — no se conoce la depuración de ' +
        'creatinina de este paciente. No la estimes ni ajustes la dosis por tu cuenta: escribe que el ' +
        'ajuste renal queda pendiente de calcularse con la depuración y el peso reales del paciente.',
    }
  }

  const ajustes = revisarListaRenal(lista, depuracion)
  const noVigilados: string[] = []
  const lineas: string[] = []
  for (const f of lista) {
    const entrada = AJUSTE_RENAL.find(x => coincideRenal(x, norm(f)))
    if (!entrada) {
      noVigilados.push(f)
      lineas.push(`• ${f}: NO ESTÁ en el catálogo renal del sistema — no se vigila. No inventes un ajuste: di que debe verificarse en la ficha técnica.`)
      continue
    }
    const a = ajustes.find(x => x.farmaco === entrada.nombre)
    if (a) {
      lineas.push(`• ${f}: ${a.contraindicado ? 'CONTRAINDICADO a esta depuración — ' : ''}${a.conducta}${a.nota ? ` (${a.nota})` : ''}`)
    } else {
      lineas.push(`• ${f}: sin ajuste a ${Math.round(depuracion)} mL/min según el catálogo del sistema.`)
    }
  }

  return {
    calculado: true,
    noVigilados,
    bloque:
      `\n\nAJUSTE RENAL CALCULADO POR EL MOTOR (depuración ${Math.round(depuracion)} mL/min). ` +
      'Cítalo tal cual; no lo recalcules ni lo corrijas:\n' + lineas.join('\n'),
  }
}

export const POR_QUE_EL_MOTOR_Y_NO_EL_MODELO =
  'Una cifra que calcula un modelo generativo puede estar mal sin que nadie lo note, ' +
  'y baja a la nota como prosa que la compuerta de firma no mira. El catálogo renal ' +
  'tiene fuente y pruebas; el prompt lo cita, no lo repite ni lo sustituye.'
