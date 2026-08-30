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
import { claveCircuito, permiteLlamar } from '@/lib/red/interruptor'
import { anotarResultado, type ClaseFalloIA } from '@/lib/ia/interruptor'
import { claveDeContrapresion, pedirSitio, soltarSitio } from '@/lib/ia/contrapresion'

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
  /**
   * LA TRAZA, QUE NO ES `requestId` (WS-13).
   *
   * `requestId` es la clave con la que se COBRA y el gateway le añade el
   * proveedor a propósito, para que dos intentos del mismo trabajo se cobren
   * aparte. `correlacion` es lo contrario: **el mismo identificador de punta a
   * punta**, del navegador del médico hasta esta llamada. Por eso son dos campos
   * y no uno — la causa raíz era justamente que uno hacía los dos trabajos.
   *
   * Opaco por forma: no lleva uid, ni correo, ni nada del paciente.
   */
  correlacion?: string
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

  /**
   * ── EL INTERRUPTOR (P1-15) ────────────────────────────────────────────────
   *
   * Se pregunta ANTES de apartar tiempo del médico. Con el proveedor caído, la
   * llamada 60 no tiene por qué volver a esperar sesenta segundos para llegar a
   * la misma conclusión que las 59 anteriores.
   *
   * Va DESPUÉS de reservar créditos y por eso los devuelve: la reserva ya
   * ocurrió, y un médico al que se le cobra una nota que ni siquiera se intentó
   * pierde dos veces.
   */
  const circuito = claveCircuito(o.proveedor, ctx.fuente, ctx.clinicId)
  const puerta = permiteLlamar(circuito)
  if (!puerta.pasa) {
    void devolverCreditos(reserva)
    const nombre = o.proveedor === 'anthropic' ? 'Anthropic' : 'OpenAI'
    /**
     * Clase `proveedor`, no `red`: es exactamente lo que pasa —el proveedor no
     * está— y así el mensaje que ve el médico sale por el mismo camino que
     * cualquier otra caída, incluida la regla de que con llave de la plataforma
     * jamás se le echa la culpa a él (`fallo-proveedor.ts`).
     */
    return {
      ok: false, clase: 'proveedor',
      motivo: `${nombre}: no está respondiendo. No se volvió a intentar para no hacerte esperar; se reintenta solo en unos segundos.`,
    }
  }

  /**
   * ── CONTRAPRESIÓN (WS-04) ─────────────────────────────────────────────────
   *
   * El interruptor de arriba resuelve un proveedor CAÍDO. Éste resuelve uno
   * LENTO: ahí cada llamada acaba contestando, el circuito nunca se abre, y
   * mientras tanto se acumulan peticiones en vuelo ocupando cada una su función
   * durante lo que dure. El precedente está documentado: un socket colgado
   * inmovilizó una lambda de 300 s, y esta ruta corre en 800.
   *
   * **No se encola, se rechaza.** Una nota que el médico espera, metida detrás
   * de otras cincuenta, es una espera sin fondo con el paciente enfrente: la
   * pantalla diría «procesando» y no habría nada procesándose. Se contesta ahora
   * y con la verdad. Ver `POR_QUE_NO_SE_ENCOLA`.
   *
   * Va DESPUÉS de reservar, y por eso devuelve los créditos: la reserva ya
   * ocurrió y cobrarle una nota que ni se intentó le hace perder dos veces —
   * exactamente el mismo razonamiento que el interruptor.
   */
  const claveCp = claveDeContrapresion(o.proveedor)
  const sitio = pedirSitio(claveCp)
  if (!sitio.pasa) {
    void devolverCreditos(reserva)
    const nombre = o.proveedor === 'anthropic' ? 'Anthropic' : 'OpenAI'
    return {
      ok: false, clase: 'proveedor',
      motivo: `${nombre}: hay ${sitio.enVuelo} peticiones en curso y no puedo atender otra ahora mismo. Vuelve a intentarlo en unos segundos.`,
    }
  }

  try {
  const lista = o.modelos.length > 0 ? o.modelos : ['']
  const t0 = Date.now()
  let ultimo: Resultado = { ok: false, clase: 'modelo', motivo: 'No se intentó ningún modelo.' }
  /**
   * PRESUPUESTO DE LA LLAMADA ENTERA, no de cada intento.
   *
   * `fetchConTimeout` acota UN `fetch`. Con una cascada de tres modelos y un
   * proveedor lento, tres timeouts seguidos son tres minutos — dentro de una
   * ruta que puede durar 300 s, así que nada la corta. El médico espera todo eso
   * con el paciente enfrente.
   *
   * El presupuesto es el timeout de un intento más un margen para un segundo:
   * pasar a otro modelo tiene sentido una vez, no tres.
   */
  const presupuestoMs = Math.round(TIMEOUT.ia * 1.6)

  for (const modelo of lista) {
    if (Date.now() - t0 > presupuestoMs) {
      anotarResultado(circuito, 'red')
      void devolverCreditos(reserva)
      return {
        ok: false, clase: 'red',
        motivo: `${o.proveedor === 'anthropic' ? 'Anthropic' : 'OpenAI'}: se agotó el tiempo de esta operación probando modelos. Tu trabajo está guardado.`,
      }
    }
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
      anotarResultado(circuito, 'red')
      break
    }

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '')
      safeLog.error(`[gateway] ${o.proveedor} ${ctx.feature}`, { status: res.status, cuerpo: cuerpo.slice(0, 300) })
      ultimo = falloHttp(o.proveedor, res.status)
      // Sólo un 5xx del proveedor cuenta para abrir el circuito. Una llave mala
      // o un 429 son de QUIEN llama, y apagarían a los demás: ver `interruptor.ts`.
      anotarResultado(circuito, ultimo.clase as ClaseFalloIA)
      // Una llamada rechazada puede haber consumido tokens; queda anotada.
      anotar(ctx, o.proveedor, modelo, null, Date.now() - t0, true)
      if (siguienteModelo(res.status)) continue
      break
    }

    const data = await res.json().catch(() => null)
    const r = o.proveedor === 'anthropic' ? leerAnthropic(data, modelo) : leerOpenAI(data, modelo)
    /**
     * Llegó una respuesta HTTP buena: el proveedor ESTÁ. Que su salida no se
     * pueda leer es otro problema —y no uno que se arregle dejando de llamar—,
     * así que el circuito se cierra igual.
     */
    anotarResultado(circuito, null)
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
  } finally {
    /**
     * SIEMPRE, también cuando la llamada falla o lanza.
     *
     * Es la trampa de todo contador de este tipo: soltarlo sólo en el camino de
     * éxito lo deja subiendo para siempre y, al cabo de un rato, la instancia
     * rechaza todo sin que haya nada en vuelo. La contrapresión se habría
     * convertido en una caída total, causada por la propia defensa.
     */
    soltarSitio(claveCp)
  }
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
    /* Se copia SIN tocar: mutarlo la convertiría en otra clave de costos y
       dejaría de correlacionar, que es su único trabajo. */
    ...(ctx.correlacion ? { correlacion: ctx.correlacion } : {}),
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
