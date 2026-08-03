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
import { fetchConTimeout, TiempoAgotado, TIMEOUT } from '@/lib/fetch-con-timeout'
import { reservarParaClinica, confirmarCreditos, devolverCreditos } from '@/lib/finanzas/cartera-server'
import {
  cuerpoAnthropic, cuerpoOpenAI, falloHttp, leerAnthropic, leerOpenAI,
  siguienteModelo, type Peticion, type Proveedor, type Resultado,
} from '@/lib/ia/protocolo'

const ANTHROPIC_VERSION = '2023-06-01'

/**
 * A dónde va la petición de cada proveedor.
 *
 * AssemblyAI queda en blanco a propósito: no es una API de mensajes sino una
 * cola de trabajos con su propio ciclo (enviar → sondear → recoger), así que no
 * pasa por esta puerta. Sí puede ANOTARSE en el libro con `anotarLlamada`, que
 * es lo único que necesita de aquí. Se deja en el mapa —en vez de dejar el tipo
 * fuera— para que el compilador obligue a decidir qué hacer con el siguiente
 * proveedor que aparezca, en lugar de olvidarlo en silencio.
 */
const URL: Record<Proveedor, string> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  assemblyai: '',
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
  // AssemblyAI no habla este protocolo: es una cola de trabajos, no una API de
  // mensajes. Se corta AQUÍ, con un motivo legible, en vez de dejar que salga un
  // `fetch('')` cuyo error no diría nada de lo que pasó de verdad.
  if (!URL[o.proveedor]) {
    return { ok: false, clase: 'respuesta', motivo: `${o.proveedor} no se llama por esta puerta; anótalo con anotarLlamada.` }
  }
  if (!o.clave) {
    return { ok: false, clase: 'llave', motivo: `${o.proveedor === 'anthropic' ? 'Anthropic' : 'OpenAI'}: no hay llave configurada.` }
  }
  /**
   * Se APARTAN los créditos antes de llamar (§AA–AF).
   *
   * Antes se preguntaba «¿le quedan?», se llamaba, y al final se incrementaba el
   * contador: entre la pregunta y el incremento caben treinta segundos, y en ese
   * hueco dos notas simultáneas del mismo consultorio pasan las dos con el saldo
   * de una. Aquí la decisión de gastar y el descuento ocurren en el mismo paso.
   *
   * Sólo aplica sobre la llave del dueño; con llave propia del consultorio el
   * gasto es suyo y descontarle de nuestra bolsa sería cobrarle dos veces.
   */
  const reserva = await reservarParaClinica(ctx.clinicId, ctx.fuente, ctx.creditos, ctx.esFundador)
  if (!reserva.ok) {
    return { ok: false, clase: 'limite', motivo: reserva.motivo ?? 'Sin créditos de IA este mes.' }
  }

  const lista = o.modelos.length > 0 ? o.modelos : ['']
  const t0 = Date.now()
  let ultimo: Resultado = { ok: false, clase: 'modelo', motivo: 'No se intentó ningún modelo.' }

  for (const modelo of lista) {
    const p: Peticion = { ...o, modelo }
    let res: Response
    try {
      /**
       * CON TIEMPO MÁXIMO. Aquí no lo había.
       *
       * Éste es el módulo que centraliza TODAS las llamadas a Anthropic y
       * OpenAI, y lo usan rutas con `maxDuration = 300`. Un socket colgado del
       * proveedor inmovilizaba el lambda los trescientos segundos completos,
       * facturados por GB-segundo — y el único módulo que existía para
       * centralizar las llamadas era justo el que no tenía la protección.
       */
      res = await fetchConTimeout(URL[o.proveedor], {
        method: 'POST',
        headers: o.proveedor === 'anthropic'
          ? { 'x-api-key': o.clave, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' }
          : { Authorization: `Bearer ${o.clave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(o.proveedor === 'anthropic' ? cuerpoAnthropic(p) : cuerpoOpenAI(p)),
      }, TIMEOUT.ia)
    } catch (e) {
      safeLog.error(`[gateway] ${o.proveedor} red`, e)
      /**
       * «Se agotó el tiempo» y «no se pudo conectar» NO son lo mismo, y decir lo
       * segundo por lo primero manda al médico a revisar su internet cuando el
       * que no contesta es el proveedor.
       */
      const proveedor = o.proveedor === 'anthropic' ? 'Anthropic' : 'OpenAI'
      ultimo = e instanceof TiempoAgotado
        ? { ok: false, clase: 'red', motivo: `${proveedor}: tardó más de ${Math.round(TIMEOUT.ia / 1000)} s y se cortó la espera.` }
        : { ok: false, clase: 'red', motivo: `${proveedor}: no se pudo conectar.` }
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
    // Se cobra lo apartado si contestó; si su salida no se pudo leer, no.
    if (r.ok) void confirmarCreditos(reserva, ctx.creditos)
    else void devolverCreditos(reserva)
    return r
  }

  // Ningún modelo contestó: los créditos vuelven a la bolsa. Un médico al que se
  // le cobra una nota que nunca salió pierde dos veces: el crédito y la
  // confianza en el contador.
  void devolverCreditos(reserva)
  return ultimo
}

/**
 * Escribe el asiento sin que nadie lo espere.
 *
 * `void` a propósito: la contabilidad no puede meterse en el camino de una nota
 * clínica. `registrarCosto` ya traga sus propios errores.
 */
export function anotarLlamada(
  ctx: Contexto, proveedor: Proveedor, modelo: string,
  respuesta: unknown, latenciaMs: number, fallo = false,
): void {
  anotar(ctx, proveedor, modelo, respuesta, latenciaMs, fallo)
}

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

/**
 * ── POR QUÉ EXISTE `anotarLlamada` SI YA ESTÁ EL GATEWAY ─────────────────────
 *
 * Porque hay rutas que todavía no se pueden enrutar y no pueden esperar a que se
 * puedan. `expediente/procesar` —la nota de consulta, la llamada MÁS CARA de la
 * plataforma— hace descubrimiento de modelos contra `/v1/models`, usa
 * razonamiento extendido y reintenta sin él ante un 400: migrarla entera de
 * madrugada cambiaría de callado cómo razona la nota que el médico firma.
 *
 * El objetivo de la auditoría era VER el costo; el gateway es el medio. Anotar
 * sin enrutar deja la visibilidad completa hoy y el refactor para cuando se
 * pueda revisar despierto. Es una parada intermedia declarada, no el destino:
 * una ruta que anota sigue teniendo su propia cascada y su propio `max_tokens`,
 * que es de donde salió el fallo de los 4 000 tokens.
 */
export const POR_QUE_UNA_SOLA_PUERTA =
  'Porque el libro de costos deja de depender de que alguien se acuerde. ' +
  'Cablearlo ruta por ruta son dieciséis oportunidades de olvidarlo, y luego ' +
  'una más por cada ruta nueva; una llamada sin asiento no se ve como un error, ' +
  'se ve como una plataforma que gasta menos de lo que gasta.'
