/**
 * NEXUS AI GATEWAY — una sola puerta a los proveedores de IA.
 *
 * Master Loop V3 §P–T. P1-1 de la auditoría: dieciséis rutas llaman a Anthropic
 * y OpenAI directamente, cada una con su propia cascada de modelos, su propia
 * traducción de errores y su propio `max_tokens`.
 *
 * ── LO QUE ESTE MÓDULO GARANTIZA Y UNA RUTA SUELTA NO PUEDE ──────────────────
 *
 * **Que el costo quede registrado.** Es lo único que de verdad justifica el
 * refactor. Cablear el libro de costos ruta por ruta significa acordarse
 * dieciséis veces, y luego otra vez con cada ruta nueva; lo que se puede olvidar
 * se olvida, y una llamada sin asiento no aparece como error sino como una
 * plataforma que gasta menos de lo que gasta. Aquí el asiento no es un paso que
 * el llamador ejecuta: es lo que pasa al volver de `fetch`.
 *
 * Y se registra **también cuando la llamada falla**. Un 500 después de que el
 * modelo generó 4 000 tokens se cobra igual; si sólo se anotaran los éxitos, el
 * costo real siempre saldría por debajo.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No decide QUÉ pedirle al modelo. El prompt, el formato y el uso clínico siguen
 * siendo de cada ruta: un gateway que además opinara sobre el contenido clínico
 * sería un sitio donde una sola persona puede cambiarle el razonamiento a las
 * dieciséis a la vez.
 *
 * No guarda nada clínico. Igual que el libro de costos: tokens, modelo, latencia
 * y precio. Ni el prompt, ni la respuesta, ni el paciente.
 */

import { registrarCosto } from '@/lib/finanzas/cost-ledger-server'
import { usoDe } from '@/lib/finanzas/medir-ia'
import type { FuenteLlave } from '@/lib/finanzas/cost-ledger'
import { safeLog } from '@/lib/security/sanitize'
import {
  cuerpoAnthropic, cuerpoOpenAI, falloHttp, leerAnthropic, leerOpenAI,
  siguienteModelo, type Peticion, type Proveedor, type Resultado,
} from '@/lib/ia/protocolo'

const ANTHROPIC_VERSION = '2023-06-01'

const URL: Record<Proveedor, string> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
}

/** Quién pide, para qué, y a cuenta de quién. Lo que el libro de costos necesita. */
export interface Contexto {
  /** `nota`, `copilot-uci`, `evidencia`… Dice qué se cobró sin decir de quién se habló. */
  feature: string
  requestId: string
  clinicId: string | null
  uid: string | null
  /** Créditos que se le cobran al consultorio por esta operación. */
  creditos: number
  fuente: FuenteLlave
  /** ¿El que ejecuta es el dueño probando módulos internos? Su gasto es I+D. */
  esFundador?: boolean
}

export interface Opciones extends Omit<Peticion, 'modelo'> {
  proveedor: Proveedor
  /**
   * Modelos a intentar, en orden.
   *
   * Sólo se pasa al siguiente cuando el problema es el MODELO (400/404): con una
   * llave revocada, recorrer la lista entera nada más retrasa el mismo 401.
   */
  modelos: readonly string[]
  clave: string
}

/**
 * Llama a un proveedor y deja el asiento en el libro de costos.
 *
 * El asiento se escribe pase lo que pase y NUNCA bloquea: si Firestore falla, la
 * respuesta del modelo sigue llegando al médico. Perder un renglón de
 * contabilidad es un problema; perder la nota que acaba de dictar es otro
 * tamaño de problema.
 */
export async function llamarIA(o: Opciones, ctx: Contexto): Promise<Resultado> {
  if (!o.clave) {
    return { ok: false, clase: 'llave', motivo: `${o.proveedor === 'anthropic' ? 'Anthropic' : 'OpenAI'}: no hay llave configurada.` }
  }
  const lista = o.modelos.length > 0 ? o.modelos : ['']
  const t0 = Date.now()
  let ultimo: Resultado = { ok: false, clase: 'modelo', motivo: 'No se intentó ningún modelo.' }

  for (const modelo of lista) {
    const p: Peticion = { ...o, modelo }
    let res: Response
    try {
      res = await fetch(URL[o.proveedor], {
        method: 'POST',
        headers: o.proveedor === 'anthropic'
          ? { 'x-api-key': o.clave, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' }
          : { Authorization: `Bearer ${o.clave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(o.proveedor === 'anthropic' ? cuerpoAnthropic(p) : cuerpoOpenAI(p)),
      })
    } catch (e) {
      safeLog.error(`[gateway] ${o.proveedor} red`, e)
      ultimo = { ok: false, clase: 'red', motivo: `${o.proveedor === 'anthropic' ? 'Anthropic' : 'OpenAI'}: no se pudo conectar.` }
      // Un fallo de red no dice nada del modelo: no tiene sentido recorrer la lista.
      break
    }

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '')
      safeLog.error(`[gateway] ${o.proveedor} ${ctx.feature}`, { status: res.status, cuerpo: cuerpo.slice(0, 300) })
      ultimo = falloHttp(o.proveedor, res.status)
      // Una llamada rechazada puede haber consumido tokens; queda anotada.
      anotar(ctx, o.proveedor, modelo, null, Date.now() - t0, true)
      if (siguienteModelo(res.status)) continue
      break
    }

    const data = await res.json().catch(() => null)
    const r = o.proveedor === 'anthropic' ? leerAnthropic(data, modelo) : leerOpenAI(data, modelo)
    anotar(ctx, o.proveedor, r.ok ? r.modelo : modelo, data, Date.now() - t0, !r.ok)
    return r
  }

  return ultimo
}

/**
 * Escribe el asiento sin que nadie lo espere.
 *
 * `void` a propósito: la contabilidad no puede meterse en el camino de una nota
 * clínica. `registrarCosto` ya traga sus propios errores.
 */
function anotar(
  ctx: Contexto, proveedor: Proveedor, modelo: string,
  respuesta: unknown, latenciaMs: number, fallo: boolean,
): void {
  void registrarCosto({
    requestId: fallo ? `${ctx.requestId}-${proveedor}-fallo` : `${ctx.requestId}-${proveedor}`,
    clinicId: ctx.clinicId,
    uid: ctx.uid,
    feature: ctx.feature,
    proveedor,
    modelo,
    uso: usoDe(respuesta),
    latenciaMs,
    creditos: fallo ? 0 : ctx.creditos,   // un fallo no le cobra créditos al médico
    fuente: ctx.fuente,
    esFundador: ctx.esFundador,
    fallo,
    ts: new Date().toISOString(),
  })
}

export const POR_QUE_UNA_SOLA_PUERTA =
  'Porque el libro de costos deja de depender de que alguien se acuerde. ' +
  'Cablearlo ruta por ruta son dieciséis oportunidades de olvidarlo, y luego ' +
  'una más por cada ruta nueva; una llamada sin asiento no se ve como un error, ' +
  'se ve como una plataforma que gasta menos de lo que gasta.'
