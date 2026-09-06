/**
 * GOLDEN — lo que revienta en el navegador tampoco gritaba.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/api/errores` recoge lo que falla en el cliente —mensaje, traza, ruta, quién—
 * y lo escribe en la colección `errores`. Está bien hecho: acepta **sin sesión**
 * (si exigiera una, el boundary global y los fallos de login serían justo lo
 * único no reportable) y redacta el texto antes de guardarlo, porque esa
 * colección es de nivel raíz y se lee desde fuera del consultorio.
 *
 * Y ahí se quedaba. Para enterarse había que **abrir el panel del dueño**, o sea
 * sospechar la avería antes de saber que existe.
 *
 * Es exactamente la forma que REG-396 cerró para los incidentes de IA, en la
 * colección de al lado, y que el propio vigilante lleva escrita: «anotaba la
 * incidencia en Firestore y ahí se quedaba».
 *
 * ── POR QUÉ NO HAY UMBRAL, Y SIN EMBARGO NO AVISA DE TODO ───────────────────
 *
 * Avisar de cada error convierte el canal en ruido y se aprende a ignorarlo —
 * este árbol ya lo sabe de las alertas clínicas falsas. Pero «avisar a partir de
 * N por hora» es inventarse un número: ¿por qué cinco y no tres?
 *
 * Hay una frontera que **no es un número inventado**, y es cualitativa:
 *
 *   · **un usuario** con un error puede ser su navegador, su red, su extensión o
 *     su sesión caducada — es un reporte;
 *   · **dos usuarios distintos con el MISMO error** ya no es de ninguno de los
 *     dos: es del producto.
 *
 * Lo que cae del lado del reporte **no desaparece**: sigue en la colección y en
 * el panel. Lo único que no hace es despertar a nadie a las tres de la mañana.
 *
 * ── LOS ANÓNIMOS SE CUENTAN APARTE, Y ESO ES LO DELICADO ────────────────────
 *
 * Un error sin sesión no trae `uid`. Contar todos los anónimos como «un solo
 * usuario» escondería la caída que impide entrar: **si el login revienta, nadie
 * puede identificarse para demostrarlo**. Se cuentan por separado y su repetición
 * basta.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **El canal sigue sin destino.** `OPS_ALERTA_WEBHOOK` es acción del dueño;
 *   sin él, `enviarAlertaOps` lo DECLARA y no marca nada como visto — que es lo
 *   correcto: una alerta que no salió no puede darse por entregada.
 * · **No cubre los 5xx del servidor ni las anomalías de autorización**, que el
 *   censo también nombra: hoy no se escriben en ninguna colección, así que no hay
 *   nada que leer. Eso es instrumentar antes que avisar.
 * · **No agrupa por traza**, sólo por mensaje y ruta: dos fallos distintos con el
 *   mismo mensaje en la misma ruta se cuentan juntos. Señala de menos.
 * · **No mide gravedad.** Todas las averías salen como `grave`, porque una que
 *   afecta a varias personas lo es; distinguir entre ellas exige criterio.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  averias, firmaDelError, comoSeCuenta, PERSONAS_PARA_SER_AVERIA,
  POR_QUE_DOS_Y_NO_UN_NUMERO, POR_QUE_LOS_ANONIMOS_CUENTAN, LO_QUE_NO_AVISA,
} from '@/lib/ops/lo-que-se-repite'

const VIGILANTE = readFileSync('src/app/api/cron/vigilante/route.ts', 'utf8')

const err = (over: Partial<{ mensaje: string; ruta: string; uid: string }> = {}) => ({
  mensaje: 'Cannot read properties of undefined', ruta: '/consulta/[id]', uid: 'u1', ...over,
})

describe('la frontera es cualitativa, no un número', () => {
  it('AL REVÉS: un solo usuario NO despierta a nadie', () => {
    /**
     * Puede ser su navegador, su red o su sesión. Avisar de esto convierte el
     * canal en ruido — y un canal ruidoso se ignora justo cuando trae lo bueno.
     */
    expect(averias([err(), err(), err()])).toEqual([])
  })

  it('pero DOS personas distintas con el mismo error, sí', () => {
    const rotas = averias([err({ uid: 'u1' }), err({ uid: 'u2' })])
    expect(rotas).toHaveLength(1)
    expect(rotas[0].personas).toBe(2)
    expect(rotas[0].veces).toBe(2)
  })

  it('la frontera es DOS, y está justificada por escrito', () => {
    expect(PERSONAS_PARA_SER_AVERIA).toBe(2)
    expect(POR_QUE_DOS_Y_NO_UN_NUMERO).toMatch(/es del producto/)
    expect(POR_QUE_DOS_Y_NO_UN_NUMERO).toMatch(/número inventado/)
  })

  it('y lo que no cruza NO desaparece', () => {
    /* Sigue en la colección y en el panel. La diferencia es a quién despierta. */
    expect(LO_QUE_NO_AVISA).toMatch(/sigue en la colección/)
  })

  it('dos errores DISTINTOS de dos personas no se suman entre sí', () => {
    /**
     * El caso que impide la falsa avería: dos personas con dos problemas propios
     * son dos reportes, no una caída. Sin firma, cualquier par de errores en la
     * misma hora habría disparado el aviso.
     */
    expect(averias([
      err({ uid: 'u1', mensaje: 'A' }),
      err({ uid: 'u2', mensaje: 'B' }),
    ])).toEqual([])
  })
})

describe('la firma agrupa lo que es el mismo fallo', () => {
  it('ignora las cifras que cambian entre ocurrencias', () => {
    /**
     * «falló tras 3 intentos» y «falló tras 5 intentos» son el mismo fallo. Sin
     * normalizar, cada aparición parecería única y ninguna llegaría a dos
     * personas — el aviso no saltaría nunca.
     */
    expect(firmaDelError(err({ mensaje: 'falló tras 3 intentos' })))
      .toBe(firmaDelError(err({ mensaje: 'falló tras 5 intentos' })))
  })

  it('pero NO junta rutas distintas', () => {
    /* El mismo mensaje en dos pantallas son dos averías, y se arreglan en sitios
       distintos. */
    expect(firmaDelError(err({ ruta: '/consulta/[id]' })))
      .not.toBe(firmaDelError(err({ ruta: '/agenda' })))
  })

  it('y agrupa aunque cambie el espaciado o las mayúsculas', () => {
    expect(firmaDelError(err({ mensaje: 'Error  RARO' })))
      .toBe(firmaDelError(err({ mensaje: 'error raro' })))
  })
})

describe('los anónimos son los que más importan', () => {
  it('dos errores SIN sesión bastan, aunque no haya uid', () => {
    /**
     * Si el login revienta, nadie puede identificarse para demostrarlo. Contarlos
     * como «una sola persona» escondería exactamente la caída que impide entrar.
     */
    const rotas = averias([err({ uid: '' }), err({ uid: '' })])
    expect(rotas).toHaveLength(1)
    expect(rotas[0].personas).toBe(0)
    expect(rotas[0].anonimos).toBe(2)
  })

  it('uno solo sin sesión sigue siendo un reporte', () => {
    expect(averias([err({ uid: '' })])).toEqual([])
  })

  it('la razón está escrita', () => {
    expect(POR_QUE_LOS_ANONIMOS_CUENTAN).toMatch(/nadie puede identificarse/)
  })

  it('el mismo usuario dos veces NO son dos personas', () => {
    /* Recargar la página con el mismo bug es un reporte repetido, no una avería
       repartida. Contar ocurrencias en vez de personas lo habría confundido. */
    expect(averias([err({ uid: 'u1' }), err({ uid: 'u1' }), err({ uid: 'u1' })])).toEqual([])
  })
})

describe('el aviso dice lo que hace falta para actuar', () => {
  it('nombra el error, la ruta y a cuánta gente le pasó', () => {
    const texto = comoSeCuenta(averias([err({ uid: 'u1' }), err({ uid: 'u2' })]))
    expect(texto).toMatch(/Cannot read properties/)
    expect(texto).toMatch(/\/consulta\/\[id\]/)
    expect(texto).toMatch(/2 personas/)
  })

  it('sin averías no dice nada', () => {
    /* Un aviso vacío es ruido con formato. */
    expect(comoSeCuenta([])).toBe('')
  })

  it('lo que más gente ve va primero', () => {
    const rotas = averias([
      err({ uid: 'a', mensaje: 'poca' }), err({ uid: 'b', mensaje: 'poca' }),
      err({ uid: 'c', mensaje: 'mucha' }), err({ uid: 'd', mensaje: 'mucha' }),
      err({ uid: 'e', mensaje: 'mucha' }),
    ])
    expect(rotas[0].personas).toBe(3)
  })
})

describe('el dato LLEGA al vigilante, que es quien despierta a alguien', () => {
  it('el vigilante lo lee y lo avisa', () => {
    expect(VIGILANTE).toMatch(/averias\(recientes as never\)/)
    expect(VIGILANTE).toMatch(/enviarAlertaOps\(\{[\s\S]{0,200}avería\(s\) en el navegador/)
  })

  it('acota la lectura: esto corre cada hora', () => {
    /* Sin tope, el vigilante descargaría la colección de errores entera cada
       hora — la lectura sin cota que WS-03 persigue, en el cron. */
    expect(VIGILANTE).toMatch(/\.limit\(TOPE_ERRORES\)/)
    expect(VIGILANTE).toMatch(/VENTANA_DE_ERRORES_MS/)
  })

  it('marca como vistas SÓLO si el aviso salió', () => {
    /**
     * Marcarlas antes convertiría una caída del webhook en un silencio
     * permanente: quedarían como avisadas sin que nadie las hubiera recibido. Es
     * la misma regla que REG-396 dejó para las incidencias.
     */
    expect(VIGILANTE).toMatch(/if \(r\.enviada\) \{[\s\S]{0,400}visto: true/)
  })

  it('y un fallo suyo no se lleva por delante el resto del vigilante', () => {
    /* Es un aviso, no un diagnóstico: si no se puede leer la colección, el cron
       tiene que seguir comprobando los crons y el saldo. */
    const i = VIGILANTE.indexOf('averiasAvisadas = 0')
    const bloque = VIGILANTE.slice(i, i + 2600)
    expect(bloque).toMatch(/catch \(e\) \{/)
    expect(bloque).toMatch(/safeLog\.warn/)
  })
})
