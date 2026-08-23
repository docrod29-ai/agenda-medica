/**
 * LA COLA — dónde acaba el trabajo pesado para que no acabe en la consulta.
 *
 * ── QUÉ ES Y QUÉ NO ES ───────────────────────────────────────────────────────
 *
 * Esto **no es un proveedor de colas**. No hay SQS, no hay Pub/Sub, no hay
 * Redis y no se contrata nada — #310 lo prohíbe expresamente. Es el CONTRATO
 * que cualquier cola tendría que cumplir para poder llevar trabajo de Ausculta,
 * más una implementación en memoria que sirve para dos cosas honestas:
 *
 *  1. probar de forma determinista que las invariantes se cumplen (dedup,
 *     presupuesto de reintentos, carta muerta, resultado caduco, aislamiento);
 *  2. dar al arnés de carga un modelo de cola sobre el que medir profundidad y
 *     espera sin infraestructura de pago.
 *
 * Cuando exista una cola real, se implementa esta interfaz y las pruebas de
 * invariantes se reutilizan tal cual. Ése es el punto.
 *
 * ── LAS CINCO INVARIANTES ────────────────────────────────────────────────────
 *
 * 1. **Identidad.** Dos entregas del mismo trabajo son un trabajo. El
 *    proveedor de colas entrega «al menos una vez»; sin dedup, «al menos una»
 *    se convierte en dos notas, dos documentos o dos mensajes al paciente.
 * 2. **Presupuesto.** Reintentos acotados con retroceso y jitter (ver
 *    `reintentos.ts`). Sin tope, un trabajo envenenado se reintenta para siempre
 *    y se come la cola de todos los demás.
 * 3. **Carta muerta.** Lo que agota el presupuesto NO desaparece: pasa a un
 *    estado terminal visible. Un trabajo que se pierde en silencio es peor que
 *    uno que falla: nadie sabe que faltaba.
 * 4. **Resultado caduco.** Un resultado que llega después de que su encuentro
 *    avanzó (se firmó, se editó a mano, se canceló) **no se aplica**. Ésta es
 *    la invariante que impide que un reintento de la IA pise verdad clínica ya
 *    confirmada por el médico (#320 Golden Path B, punto 9).
 * 5. **Atadura.** Todo trabajo lleva `clinicId` y, cuando aplica, `encuentroId`.
 *    Un trabajo sin inquilino no se puede encaminar sin adivinar, y adivinar
 *    inquilino es fuga entre consultorios.
 *
 * ── CONTRAPRESIÓN ────────────────────────────────────────────────────────────
 *
 * La cola tiene fondo. Cuando se llena, se RECHAZA con un motivo explícito en
 * vez de crecer sin límite: una cola infinita no es resiliencia, es un fallo
 * más tarde y con más trabajo perdido. El rechazo es aceptable porque ninguna
 * de estas clases es del camino caliente — por construcción, ver
 * `clases-de-trabajo.ts`.
 *
 * Módulo PURO: el reloj se inyecta.
 */
import type { ClaseAsincrona } from './clases-de-trabajo'
import { esCaminoCaliente, presupuestoDe } from './clases-de-trabajo'
import { decidirReintento, POLITICA_POR_DEFECTO, type PoliticaDeReintentos, type VeredictoDeFallo } from './reintentos'

export type EstadoTrabajo = 'pendiente' | 'en-curso' | 'completado' | 'carta-muerta' | 'cancelado'

export interface Trabajo<P = unknown> {
  /** Identidad. Dos entregas con el mismo id son el mismo trabajo. */
  id: string
  clase: ClaseAsincrona
  clinicId: string
  /** Encuentro al que pertenece, cuando lo hay. Ata el resultado a su destino. */
  encuentroId?: string
  /**
   * Versión del encuentro cuando se encoló. Si al volver el resultado el
   * encuentro va por una versión mayor, el resultado está CADUCO.
   */
  versionAlEncolar?: number
  carga: P
  estado: EstadoTrabajo
  intentos: number
  gastadoMs: number
  encoladoEnMs: number
  /** Por qué acabó en carta muerta. Se conserva: es la mitad del diagnóstico. */
  motivoTerminal?: string
}

export interface LimitesDeCola {
  /** Fondo de la cola. Al llegar aquí se rechaza en vez de crecer. */
  profundidadMaxima: number
  politica: PoliticaDeReintentos
}

export const LIMITES_POR_DEFECTO: LimitesDeCola = {
  profundidadMaxima: 1_000,
  politica: POLITICA_POR_DEFECTO,
}

export type ResultadoEncolar =
  | { encolado: true }
  | { encolado: false; motivo: 'duplicado' }
  | { encolado: false; motivo: 'cola-llena' }
  | { encolado: false; motivo: 'clase-invalida' }
  | { encolado: false; motivo: 'sin-inquilino' }

/**
 * Cola en memoria que cumple el contrato. Determinista: no usa reloj propio ni
 * temporizadores; el que la usa avanza el tiempo.
 */
export class ColaEnMemoria<P = unknown> {
  private readonly trabajos = new Map<string, Trabajo<P>>()
  private readonly orden: string[] = []
  /** Profundidad máxima vista. Es lo que el informe de capacidad reporta. */
  maxProfundidadVista = 0
  /** Entregas duplicadas rechazadas. Un contador que debe poder enseñarse. */
  duplicadosRechazados = 0

  constructor(private readonly limites: LimitesDeCola = LIMITES_POR_DEFECTO) {}

  get profundidad(): number {
    return this.orden.length
  }

  encolar(t: Omit<Trabajo<P>, 'estado' | 'intentos' | 'gastadoMs'>): ResultadoEncolar {
    // Un `hot:` en una cola sería el bug que este módulo existe para impedir.
    // Se comprueba en tiempo de ejecución además de en tipos: el tipo no
    // protege de un `as` ni de un JSON que venga de fuera.
    if (esCaminoCaliente(t.clase as never)) return { encolado: false, motivo: 'clase-invalida' }
    if (!t.clinicId) return { encolado: false, motivo: 'sin-inquilino' }
    if (this.trabajos.has(t.id)) {
      this.duplicadosRechazados += 1
      return { encolado: false, motivo: 'duplicado' }
    }
    if (this.orden.length >= this.limites.profundidadMaxima) return { encolado: false, motivo: 'cola-llena' }

    this.trabajos.set(t.id, { ...t, estado: 'pendiente', intentos: 0, gastadoMs: 0 } as Trabajo<P>)
    this.orden.push(t.id)
    this.maxProfundidadVista = Math.max(this.maxProfundidadVista, this.orden.length)
    return { encolado: true }
  }

  /** Saca el siguiente pendiente. FIFO: sin prioridades, que son otra decisión. */
  tomar(): Trabajo<P> | null {
    const id = this.orden.shift()
    if (!id) return null
    const t = this.trabajos.get(id)
    if (!t) return null
    const enCurso = { ...t, estado: 'en-curso' as const, intentos: t.intentos + 1 }
    this.trabajos.set(id, enCurso)
    return enCurso
  }

  completar(id: string): void {
    const t = this.trabajos.get(id)
    if (t) this.trabajos.set(id, { ...t, estado: 'completado' })
  }

  /**
   * Falló un intento: o vuelve a la cola con su espera, o se va a carta muerta.
   *
   * Devuelve la espera para que quien orquesta decida cuándo reencolar. No se
   * duerme aquí: dormir dentro de la cola la haría imposible de probar y ataría
   * el módulo a un reloj concreto.
   */
  fallar(
    id: string,
    veredicto: VeredictoDeFallo,
    gastadoEsteIntentoMs: number,
    azar: () => number = Math.random,
  ): { reencolado: true; esperarMs: number } | { reencolado: false; motivo: string } {
    const t = this.trabajos.get(id)
    if (!t) return { reencolado: false, motivo: 'trabajo-desconocido' }

    const gastado = t.gastadoMs + gastadoEsteIntentoMs
    const maxDeLaClase = presupuestoDe(t.clase).reintentosMaximos
    const politica: PoliticaDeReintentos = {
      ...this.limites.politica,
      // El presupuesto de la CLASE manda sobre el de la cola: la clase sabe si
      // es una notificación (reintentar mucho) o un razonamiento (reintentar
      // poco, porque la nota se escribe igual sin él).
      reintentosMaximos: maxDeLaClase,
    }
    const decision = decidirReintento({ intentos: t.intentos, gastadoMs: gastado }, veredicto, politica, azar)

    if (!decision.reintentar) {
      this.trabajos.set(id, { ...t, estado: 'carta-muerta', gastadoMs: gastado, motivoTerminal: decision.motivo })
      return { reencolado: false, motivo: decision.motivo }
    }
    this.trabajos.set(id, { ...t, estado: 'pendiente', gastadoMs: gastado })
    this.orden.push(id)
    this.maxProfundidadVista = Math.max(this.maxProfundidadVista, this.orden.length)
    return { reencolado: true, esperarMs: decision.esperarMs }
  }

  ver(id: string): Trabajo<P> | undefined {
    return this.trabajos.get(id)
  }

  /** Los que agotaron su presupuesto. Deben ser visibles, no desaparecer. */
  cartaMuerta(): Trabajo<P>[] {
    return [...this.trabajos.values()].filter(t => t.estado === 'carta-muerta')
  }

  /** Estado agregado, con la forma que consume el informe de capacidad. */
  metricas(): { maxDepth: number; retryCount: number; duplicateCount: number; deadLetterCount: number } {
    let reintentos = 0
    for (const t of this.trabajos.values()) reintentos += Math.max(0, t.intentos - 1)
    return {
      maxDepth: this.maxProfundidadVista,
      retryCount: reintentos,
      duplicateCount: this.duplicadosRechazados,
      deadLetterCount: this.cartaMuerta().length,
    }
  }
}

/**
 * ¿Este resultado sigue sirviendo, o llegó tarde?
 *
 * La comprobación es `>=` a propósito: si el encuentro avanzó ni que sea una
 * versión, el resultado se calculó sobre un texto que ya no es el que hay. Y si
 * el encuentro está firmado, no hay versión que valga — la verdad clínica
 * firmada no la mueve un proveedor que contestó tarde.
 */
export function resultadoCaduco(
  trabajo: Pick<Trabajo, 'versionAlEncolar'>,
  versionActual: number,
  encuentroFirmado: boolean,
): boolean {
  if (encuentroFirmado) return true
  if (trabajo.versionAlEncolar === undefined) return false
  return versionActual > trabajo.versionAlEncolar
}
