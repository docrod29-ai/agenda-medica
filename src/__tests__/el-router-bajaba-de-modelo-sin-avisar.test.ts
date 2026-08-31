/**
 * GOLDEN — el router podía servir Haiku para una nota «no escatimar», y nadie se enteraba.
 *
 * ── QUÉ FALLABA (WS-12.router) ──────────────────────────────────────────────
 *
 * El censo pedía «probar el respaldo del router ante caída de proveedor, y que
 * no degrade calidad clínica en silencio».
 *
 * El respaldo ante CAÍDA está bien y se confirmó: si `/v1/models` no contesta se
 * usa `candidatos[0]` —el modelo de arriba— y si no existe, el 404 redescubre.
 * Eso no degrada nada.
 *
 * Lo que sí degradaba, en silencio, era la elección cuando la lista SÍ llega:
 *
 *     candidatos.find(c => ids.includes(c))
 *       ?? ids.find(id => id.includes('sonnet'))
 *       ?? ids[0]
 *
 * El último ramal se queda con **el primer modelo que la cuenta tenga**. Para el
 * perfil `premium` —la nota que el dueño decidió que usa el razonamiento máximo,
 * «no escatimar»— eso puede ser Haiku. El modelo viajaba al cliente como
 * procedencia y **nadie lo comparaba con lo que se había pedido**.
 *
 * Y peor: `modeloResuelto` se cacheaba por instancia y sólo se limpiaba con un
 * 404. Una elección de último recurso hecha durante una caída parcial quedaba
 * **clavada** toda la vida de la instancia caliente — todas las notas de todos
 * los médicos de esa instancia, con el modelo equivocado y sin aviso.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo el `queFalta` contra el árbol y siguiendo el ramal `?? ids[0]` hasta
 * ver quién lo consumía. Nadie lo consumía como decisión: sólo se pintaba como
 * un identificador que el médico no puede evaluar.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La elección vivía dentro de la función que hace la petición, así que **no se
 * podía probar sin red** y no había dónde poner la pregunta «¿esto es peor de lo
 * que se pidió?». Ahora la decisión vive en un módulo puro.
 *
 * ── LAS REGLAS QUE ESTO HACE CUMPLIR ────────────────────────────────────────
 *
 * · La decisión del dueño en `CLAUDE.md`: *«La nota usa el razonamiento premium
 *   (no escatimar); no bajar de modelo por velocidad sin avisar»*.
 * · La regla 3 de seguridad clínica: **nada cambia en silencio**.
 *
 * ── LO QUE NO SE CAMBIÓ, A PROPÓSITO ────────────────────────────────────────
 *
 * **El modelo elegido es el mismo en todos los casos.** Se midió antes y
 * después: cambiar a qué modelo se cae es una decisión de producto, no una
 * limpieza. Lo que cambia es que ahora se sabe, se dice, y no se recuerda.
 *
 * Tampoco se BLOQUEA la nota: negarse a generarla es política clínica y está
 * declarada en `LA_PREGUNTA_PARA_EL_DUENO`. Hoy rige «generar y marcar» por
 * conservación, no por decisión.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba que el modelo elegido SE COMPORTE como el pedido.** Compara
 *   identificadores, no calidad.
 * · **Sólo el router de la NOTA.** El consultor, el copiloto de UCI y la
 *   transcripción eligen su modelo por su cuenta.
 * · **No prueba el navegador.** Que el médico LEA el aviso se comprueba en el
 *   fuente de la pantalla, no en un píxel.
 * · **No cubre el 404 ni los reintentos**, que ya tienen su camino y su prueba.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  elegirModelo, sePuedeRecordar,
  POR_QUE_NO_SE_CACHEA_UNA_DEGRADACION, POR_QUE_NO_SE_BLOQUEA,
  LA_DECISION_DEL_DUENO, LO_QUE_SIGUE_SIN_DECIDIRSE, LO_QUE_NO_SE_VIGILA,
} from '@/lib/ia/que-modelo-se-eligio'

const leer = (r: string) => readFileSync(resolve(process.cwd(), r), 'utf8')
const RUTA = leer('src/app/api/expediente/procesar/route.ts')
const CONSULTA = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

const PREMIUM = ['claude-opus-4-8', 'claude-opus-4-6', 'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5']
const PRO = ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5']

/** La elección tal como la hacía la ruta antes de REG-436. */
const comoEraAntes = (c: readonly string[], ids: string[]) =>
  c.find(x => ids.includes(x)) ?? ids.find(id => id.includes('sonnet')) ?? ids[0]

/**
 * Los cinco van DESENROLLADOS, no en un bucle sobre una tabla.
 *
 * El sello de `invariantes-clinicos.json` cuenta los `it(` declarados a
 * principio de línea: cinco casos generados por un `for` cuentan como uno, así
 * que encoger la tabla los borraría sin que el trinquete de cobertura se
 * enterara. Un caso que puede desaparecer en silencio no está protegido.
 */
describe('el modelo elegido NO cambia — eso sería cambiar producto', () => {
  it('premium con la cuenta completa', () => {
    const ids = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5']
    expect(elegirModelo(PREMIUM, ids).modelo).toBe(comoEraAntes(PREMIUM, ids))
  })

  it('premium con sólo sonnet', () => {
    const ids = ['claude-sonnet-5', 'claude-haiku-4-5']
    expect(elegirModelo(PREMIUM, ids).modelo).toBe(comoEraAntes(PREMIUM, ids))
  })

  it('premium con SÓLO haiku — el caso que degradaba', () => {
    const ids = ['claude-haiku-4-5']
    expect(elegirModelo(PREMIUM, ids).modelo).toBe(comoEraAntes(PREMIUM, ids))
  })

  it('pro con sólo haiku', () => {
    const ids = ['claude-haiku-4-5']
    expect(elegirModelo(PRO, ids).modelo).toBe(comoEraAntes(PRO, ids))
  })

  it('pro con un candidato exacto', () => {
    const ids = ['claude-sonnet-4-6']
    expect(elegirModelo(PRO, ids).modelo).toBe(comoEraAntes(PRO, ids))
  })
})

describe('lo que sí cambia: se sabe que fue una degradación', () => {
  it('el ramal que degradaba en silencio ahora se llama por su nombre', () => {
    const e = elegirModelo(PREMIUM, ['claude-haiku-4-5'])
    expect(e.comoSeEligio).toBe('ultimo_recurso')
    expect(e.degradado).toBe(true)
    expect(e.aviso).toMatch(/NO es ninguno de los modelos previstos/)
  })

  it('un candidato exacto no avisa de nada — el aviso de cada nota sería ruido', () => {
    const e = elegirModelo(PREMIUM, ['claude-opus-4-8', 'claude-haiku-4-5'])
    expect({ como: e.comoSeEligio, degradado: e.degradado, aviso: e.aviso })
      .toEqual({ como: 'candidato', degradado: false, aviso: '' })
  })

  it('caer a sonnet cuando el perfil YA pedía sonnet no es una degradación', () => {
    /* `pro` tiene tres sonnets como candidatos: otro sonnet es el respaldo
       previsto, no «lo que haya». Marcarlo enseñaría a ignorar la marca. */
    const e = elegirModelo(PRO, ['claude-sonnet-4-2'])
    expect({ como: e.comoSeEligio, degradado: e.degradado, aviso: e.aviso })
      .toEqual({ como: 'respaldo_de_familia', degradado: false, aviso: '' })
  })

  it('pero para premium, que pedía opus, sí se dice — sin llamarlo degradación', () => {
    const e = elegirModelo(['claude-opus-4-8'], ['claude-sonnet-4-2'])
    expect(e.comoSeEligio).toBe('respaldo_de_familia')
    expect(e.degradado).toBe(false)
    expect(e.aviso).toMatch(/modelo de respaldo/)
  })

  it('el descubrimiento caído NO es una degradación: se usa el candidato de arriba', () => {
    const e = elegirModelo(PREMIUM, null)
    expect({ modelo: e.modelo, como: e.comoSeEligio, degradado: e.degradado })
      .toEqual({ modelo: 'claude-opus-4-8', como: 'sin_lista', degradado: false })
  })

  it('una cuenta SIN modelos no es lo mismo que un descubrimiento caído', () => {
    /* `null` = no contestó · `[]` = contestó y no tiene nada. Consecuencias
       opuestas, y pintarlas igual es el defecto que ya cazó REG-434. */
    expect(elegirModelo(PREMIUM, []).modelo).toBeNull()
    expect(elegirModelo(PREMIUM, null).modelo).toBe('claude-opus-4-8')
  })
})

describe('una degradación NO se recuerda', () => {
  it('el último recurso no se cachea — se clavaría toda la instancia caliente', () => {
    expect(sePuedeRecordar(elegirModelo(PREMIUM, ['claude-haiku-4-5']))).toBe(false)
  })

  it('ni el descubrimiento caído: no se aprendió nada de la cuenta', () => {
    expect(sePuedeRecordar(elegirModelo(PREMIUM, null))).toBe(false)
  })

  it('un candidato exacto sí, que es el caso normal y el que ahorra la petición', () => {
    expect(sePuedeRecordar(elegirModelo(PREMIUM, ['claude-opus-4-8']))).toBe(true)
  })

  it('la ruta respeta esa decisión en vez de cachear siempre', () => {
    expect(RUTA).toMatch(/if \(sePuedeRecordar\(eleccion\) && eleccion\.modelo\) modeloResuelto\[perfil\] = eleccion\.modelo/)
    /* AL REVÉS: la línea vieja guardaba cualquier elección. */
    expect(RUTA).not.toMatch(/if \(elegido\) \{ modeloResuelto\[perfil\] = elegido/)
  })
})

describe('y el aviso LLEGA — que es donde se rompe siempre', () => {
  it('la ruta lo devuelve', () => {
    expect(RUTA).toContain('_modeloDegradado: eleccion.degradado')
    expect(RUTA).toContain('_avisoModelo: eleccion.aviso')
  })

  it('la pantalla lo recibe y lo pinta como texto visible', () => {
    expect(CONSULTA).toMatch(/setAvisoModelo\(data\._modeloDegradado \? String\(data\._avisoModelo \?\? ''\) : ''\)/)
    expect(CONSULTA).toMatch(/>\{avisoModelo\}<\/div>/)
    expect(CONSULTA).toMatch(/Esta nota no usó el nivel de IA que pediste/)
  })
})

describe('lo que este módulo declara que no decide', () => {
  it('no bloquea, y ahora es por DECISIÓN y no por conservación', () => {
    /**
     * ACTUALIZADO EN REG-443. La conducta es la misma; lo que cambió es su
     * estatus. Aquí vivía `LA_PREGUNTA_PARA_EL_DUENO`, con sus tres opciones y
     * su `NEEDS_CLINICAL_REVIEW`, porque nadie la había elegido: regía por
     * conservación. El dueño eligió la A el 31-ago-2026.
     *
     * Un valor por omisión que nadie eligió acaba pareciendo elegido, y esa
     * confusión es lo que este caso impide.
     */
    expect(POR_QUE_NO_SE_BLOQUEA).toMatch(/política clínica/)
    expect(LA_DECISION_DEL_DUENO).toMatch(/^DECIDIDO/)
    expect(LA_DECISION_DEL_DUENO).toMatch(/31-ago-2026/)
    expect(LA_DECISION_DEL_DUENO).toMatch(/SE GENERA/)
    /* Y las que se descartaron quedan escritas: una decisión sin sus
       alternativas no se puede revisar dentro de seis meses. */
    expect(LA_DECISION_DEL_DUENO).toMatch(/opción B[\s\S]*C \(negarse siempre\)/)
  })

  it('y lo que sigue SIN decidirse queda aparte, no confundido con lo decidido', () => {
    expect(LO_QUE_SIGUE_SIN_DECIDIRSE).toMatch(/SE COMPORTA/)
    expect(LO_QUE_SIGUE_SIN_DECIDIRSE).toMatch(/contratos-de-evaluacion/)
  })

  it('y declara lo que no vigila', () => {
    expect(POR_QUE_NO_SE_CACHEA_UNA_DEGRADACION).toMatch(/instancia caliente/)
    expect(LO_QUE_NO_SE_VIGILA.join(' ')).toMatch(/SE COMPORTE/)
  })
})
