/**
 * QUÉ MODELO SE ELIGIÓ, Y SI ESO FUE UNA DEGRADACIÓN.
 *
 * ── QUÉ FALLABA (WS-12.router) ──────────────────────────────────────────────
 *
 * El censo pedía «probar el respaldo del router ante caída de proveedor, y que
 * no degrade calidad clínica en silencio». El respaldo ante caída está bien: si
 * `/v1/models` no contesta, se devuelve `candidatos[0]` —el modelo de ARRIBA— y
 * si no existe, el 404 redescubre. Eso no degrada.
 *
 * Lo que sí degradaba, en silencio, era la elección cuando la lista SÍ llega:
 *
 *     candidatos.find(c => ids.includes(c))
 *       ?? ids.find(id => id.includes('sonnet'))
 *       ?? ids[0]
 *
 * El último ramal se queda con **el primer modelo que la cuenta tenga**, sea
 * cual sea. Para el perfil `premium` —la nota que el dueño decidió que usa el
 * razonamiento máximo, «no escatimar»— eso puede ser Haiku. Y nadie se entera:
 * el modelo viaja como procedencia y **nadie lo compara con lo que se pidió**.
 *
 * Peor: `modeloResuelto` se cacheaba por instancia y sólo se limpiaba con un
 * 404. Una elección de último recurso hecha durante una caída parcial quedaba
 * **clavada** para toda la vida de la instancia caliente: todas las notas de
 * todos los médicos de esa instancia, con el modelo equivocado, sin aviso.
 *
 * ── LA REGLA QUE ESTO HACE CUMPLIR ──────────────────────────────────────────
 *
 * Es una decisión del dueño escrita en `CLAUDE.md`: *«La nota usa el
 * razonamiento premium (no escatimar); no bajar de modelo por velocidad sin
 * avisar»*. Y la regla 3 de seguridad clínica: **nada cambia en silencio**.
 *
 * Este módulo NO bloquea la nota cuando hay degradación. Bloquear es política y
 * la decide el médico —ver `LA_PREGUNTA_PARA_EL_DUENO`—; lo que este módulo
 * garantiza es que la degradación **se vea y se pueda contar**.
 *
 * ── HERMANO DE UN DEFECTO QUE YA COSTÓ SEMANAS ──────────────────────────────
 *
 * REG-167: una petición que el proveedor rechazaba y que, «al venir junto a una
 * lista de modelos, degradaba el motor al modelo viejo sin error ni aviso.
 * Semanas así». Es el mismo ramal, con el mismo silencio.
 *
 * Módulo PURO.
 */

/** Cómo se llegó al modelo que se va a usar. */
export type ComoSeEligio =
  /** Uno de los candidatos declarados para este perfil. Lo normal. */
  | 'candidato'
  /** Ninguno estaba, pero la cuenta tiene algo de la misma familia grande. */
  | 'respaldo_de_familia'
  /** Ni eso: se tomó el primero que la cuenta tenga. DEGRADACIÓN. */
  | 'ultimo_recurso'
  /** No hubo lista que mirar (el descubrimiento falló): el de arriba. */
  | 'sin_lista'
  /** La cuenta no declaró ningún modelo. No hay nada que elegir. */
  | 'sin_modelos'

export interface Eleccion {
  /** El modelo a usar. `null` sólo cuando no hay ninguno. */
  readonly modelo: string | null
  readonly comoSeEligio: ComoSeEligio
  /**
   * ¿Es peor de lo que este perfil pidió?
   *
   * `sin_lista` NO es degradación: se usa el candidato de arriba, que es el
   * mejor. Lo es `ultimo_recurso`, donde se sirve lo que haya.
   */
  readonly degradado: boolean
  /** Qué decirle al médico. Vacío cuando no hay nada que decir. */
  readonly aviso: string
}

/**
 * La familia de respaldo. Es la que estaba en el código y no se cambia aquí:
 * cambiar a qué modelo se cae es una decisión de producto, no una limpieza.
 */
const FAMILIA_DE_RESPALDO = 'sonnet'

/**
 * Elige el modelo y **dice cómo llegó a él**.
 *
 * `idsDeLaCuenta` vacío o `null` significa que el descubrimiento no contestó —no
 * que la cuenta esté vacía—. Los dos casos existen y se distinguen: sin lista se
 * usa el candidato de arriba (y el 404 lo corregirá si no existe); con lista
 * vacía no hay nada que usar.
 */
export function elegirModelo(
  candidatos: readonly string[],
  idsDeLaCuenta: readonly string[] | null | undefined,
): Eleccion {
  const arriba = candidatos[0] ?? null
  if (idsDeLaCuenta == null) {
    return { modelo: arriba, comoSeEligio: 'sin_lista', degradado: false, aviso: '' }
  }
  const ids = idsDeLaCuenta.filter(Boolean)
  if (ids.length === 0) {
    return { modelo: null, comoSeEligio: 'sin_modelos', degradado: true, aviso: AVISO_SIN_MODELOS }
  }

  const exacto = candidatos.find(c => ids.includes(c))
  if (exacto) return { modelo: exacto, comoSeEligio: 'candidato', degradado: false, aviso: '' }

  const deFamilia = ids.find(id => id.includes(FAMILIA_DE_RESPALDO))
  if (deFamilia) {
    /**
     * No cuenta como degradación **si el perfil ya pedía esa familia**. Para
     * `pro`, cuyos candidatos son todos sonnet, caer en otro sonnet es el
     * respaldo previsto; para `premium`, que pedía opus, es bajar un escalón —
     * pero es un escalón declarado, no «lo que haya», así que se avisa sin
     * llamarlo degradación silenciosa.
     */
    const pedidoDeEsaFamilia = candidatos.some(c => c.includes(FAMILIA_DE_RESPALDO))
    return {
      modelo: deFamilia,
      comoSeEligio: 'respaldo_de_familia',
      degradado: false,
      aviso: pedidoDeEsaFamilia ? '' : avisoDeRespaldo(deFamilia),
    }
  }

  /* El ramal que degradaba en silencio. */
  return {
    modelo: ids[0],
    comoSeEligio: 'ultimo_recurso',
    degradado: true,
    aviso: avisoDeUltimoRecurso(ids[0]),
  }
}

/**
 * ¿Se puede recordar esta elección para las siguientes peticiones?
 *
 * **No se cachea una degradación.** Una elección de último recurso hecha durante
 * una caída parcial quedaría clavada toda la vida de la instancia caliente, y
 * las notas siguientes la heredarían sin que nada volviera a preguntar. Volver a
 * descubrir cuesta una petición; heredar el modelo equivocado cuesta la nota.
 */
export function sePuedeRecordar(e: Eleccion): boolean {
  return !e.degradado && e.comoSeEligio !== 'sin_lista' && Boolean(e.modelo)
}

function avisoDeRespaldo(modelo: string): string {
  return `Esta nota se generó con un modelo de respaldo (${modelo}): el nivel pedido no está disponible en esta cuenta.`
}

function avisoDeUltimoRecurso(modelo: string): string {
  return `Esta nota se generó con ${modelo}, que NO es ninguno de los modelos previstos para este nivel. Revísala con más cuidado del habitual.`
}

export const AVISO_SIN_MODELOS =
  'La cuenta de IA no declara ningún modelo disponible. La nota no pudo generarse '
  + 'con el nivel pedido.'

export const POR_QUE_NO_SE_CACHEA_UNA_DEGRADACION =
  'Porque una elección de último recurso hecha durante una caída parcial quedaría '
  + 'clavada toda la vida de la instancia caliente, y las notas siguientes la '
  + 'heredarían sin que nada volviera a preguntar. Volver a descubrir cuesta una '
  + 'petición; heredar el modelo equivocado cuesta la nota.'

export const POR_QUE_NO_SE_BLOQUEA =
  'Porque negarse a generar la nota cuando el modelo previsto no está es política '
  + 'clínica, y fijarla está prohibido sin el médico. Lo que sí es obligatorio es '
  + 'que no cambie en silencio: la decisión del dueño dice «no bajar de modelo por '
  + 'velocidad sin avisar», y la regla 3 dice que nada cambia en silencio. Este '
  + 'módulo garantiza que se vea; qué hacer con ello, no.'

/**
 * LA DECISIÓN, TOMADA — 31-ago-2026, por el médico dueño.
 *
 * Sustituye a `LA_PREGUNTA_PARA_EL_DUENO`. La conducta **no cambia**: se
 * confirma la que había. Lo que cambia es su estatus — dejaba de regir por
 * conservación y pasa a regir por decisión, que no es lo mismo aunque el código
 * sea idéntico: un valor por omisión que nadie eligió acaba pareciendo elegido.
 */
export const LA_DECISION_DEL_DUENO =
  'DECIDIDO por el médico dueño el 31-ago-2026, opción A: cuando el modelo '
  + 'previsto para el nivel pedido no está disponible, la nota SE GENERA con lo '
  + 'que haya y se MARCA. No se niega. Razón: negarse deja al médico sin nota en '
  + 'una consulta real, y desde REG-539 el aviso sí llega a la pantalla como '
  + 'texto visible — que era el defecto de verdad, no la degradación en sí. Se '
  + 'descartaron la opción B (negarse sólo en premium) y la C (negarse siempre).'

export const LO_QUE_SIGUE_SIN_DECIDIRSE =
  'Si el modelo elegido SE COMPORTA como el pedido. Esto compara '
  + 'identificadores, no calidad, y comprobarlo necesita los conjuntos de '
  + 'referencia y los umbrales de `WS-12.contratos-de-evaluacion`, que siguen '
  + 'esperando al médico.'

export const LO_QUE_NO_SE_VIGILA: readonly string[] = [
  'Que el modelo elegido SE COMPORTE como el pedido. Esto compara identificadores, no calidad: un modelo de la lista puede rendir peor un martes y esto no lo ve.',
  'Los demás consumidores de IA. Este módulo es del router de la NOTA; el consultor, el copiloto de UCI y la transcripción eligen su modelo por su cuenta.',
  'Si el aviso llega a los ojos del médico: eso depende de la ruta y de la pantalla, y se comprueba aparte.',
]
