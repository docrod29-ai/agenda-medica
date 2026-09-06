/**
 * GOLDEN — el módulo decía «un riesgo declarado se puede vigilar», y nadie lo vigilaba.
 *
 * ── QUÉ FALLABA (WS-03.documentos-que-crecen) ───────────────────────────────
 *
 * REG-572 topó `administraciones` y dejó tres arrays SIN tope —`movimientos`,
 * `indicaciones`, `interconsultas`— con la razón bien argumentada: el documento
 * del episodio es su **única copia**, y recortarlas borraría traslados u órdenes
 * vivas.
 *
 * Y terminaba así, con estas palabras: *«Quedan como riesgo NOMBRADO en vez de
 * uno que nadie ha mirado. Un riesgo declarado **se puede vigilar**; uno que vive
 * en la forma de un documento, no.»*
 *
 * **Nadie lo vigilaba.** No había un solo medidor. El riesgo estaba nombrado,
 * clasificado, con guardián de CI para que no aparezcan arrays nuevos sin
 * clasificar… y sin nadie que mirara cuánto ocupaba un episodio real.
 *
 * ── POR QUÉ AQUÍ IMPORTA MÁS QUE EN NINGUNA PARTE ───────────────────────────
 *
 * Todas las mutaciones del episodio son un solo `tx.update` sobre el mismo
 * documento. Al pasar de 1 MB, Firestore rechaza la escritura entera: no falla
 * lo último que se añadió, **falla egresar al paciente**.
 *
 * Un aviso que llega después de eso no es un aviso.
 *
 * ── CAUSA RAÍZ, POR QUINTA VEZ ESTE MES ─────────────────────────────────────
 *
 * Con REG-572, REG-576, REG-586 y REG-589 son cinco: **cuanto mejor explicada
 * está una garantía, menos probable es que alguien vaya a comprobar si el código
 * la cumple.** Aquí la promesa estaba escrita en el módulo que la incumplía, dos
 * párrafos por encima del código.
 *
 * ── DÓNDE SE MIDE, Y POR QUÉ AHÍ ────────────────────────────────────────────
 *
 * En la transacción del gateway, que ya tiene el documento en la mano: no cuesta
 * ni una lectura más. Y sobre el documento que se va a **escribir**, no sobre el
 * que se leyó — el que puede ser rechazado es el primero.
 *
 * ── A QUIÉN SE LE DICE, Y POR QUÉ NO AL MÉDICO ──────────────────────────────
 *
 * A operaciones. Se pensó devolverlo en la respuesta para pintarlo en la
 * pantalla del episodio y se **descartó**: el médico no puede hacer nada con
 * «tu episodio ocupa el 82 %» en mitad de una mutación clínica, y lo que lo
 * arregla —sacar los arrays a subcolección— no está en su mano. Además los
 * quince llamadores del gateway descartan la respuesta, así que el campo habría
 * viajado hasta el navegador para que nadie lo leyera.
 *
 * **No bloquea.** Frenar una mutación clínica por un umbral de tamaño sería peor
 * que el riesgo que evita.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No topa nada nuevo**: los tres siguen sin techo, por la razón de REG-572.
 * · **No mide lo que Firestore cobra de verdad** (nombres de campo, índices,
 *   sobrecarga por documento). La cifra queda POR DEBAJO de la real, así que el
 *   aviso llega antes — nunca después, que es el error que importaría.
 * · **No migra a subcolección**, que es lo que cerraría el riesgo: toca
 *   `firestore.rules` y desplegarlas es del dueño.
 * · **El canal de operaciones no tiene destino** hasta que el dueño configure
 *   `OPS_ALERTA_WEBHOOK`; hasta entonces lo DECLARA en vez de fingir que avisó.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  tamanoDelEpisodio, LIMITE_FIRESTORE, FRACCION_VIGILAR, FRACCION_CRITICO,
  ARRAYS_DEL_EPISODIO, POR_QUE_SE_MIDE_ANTES_DE_ESCRIBIR,
  POR_QUE_LOS_UMBRALES_NO_SON_CLINICOS, LO_QUE_ESTA_MEDIDA_NO_HACE,
} from '@/lib/hospital/lo-que-cabe-en-un-episodio'

const RUTA = readFileSync('src/app/api/hospital/mutar/route.ts', 'utf8')

/**
 * La ruta SIN comentarios.
 *
 * Tercera vez en esta serie —con REG-585 y REG-588— que un guardián de fuente
 * casa con **su propia explicación**: el comentario de la alerta dice «sin PHI:
 * ni paciente, ni cama, ni servicio» y contiene las tres palabras que el
 * guardián busca. Un guardián que se dispara con la prosa que justifica el
 * código no vigila el código.
 */
const RUTA_SOLO_CODIGO = RUTA
  .split('\n')
  .filter(l => {
    const t = l.trim()
    return t && !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*')
  })
  .join('\n')

/** Un episodio de `n` indicaciones con texto, que es lo que de verdad pesa. */
const episodioDe = (n: number) => ({
  pacienteId: 'p1',
  indicaciones: Array.from({ length: n }, (_, i) => ({
    id: `ind-${i}`,
    texto: 'x'.repeat(400),
    administraciones: [],
  })),
})

describe('la medida, que no existía', () => {
  it('un episodio recién abierto está holgado y no dice nada', () => {
    const t = tamanoDelEpisodio({ pacienteId: 'p1', movimientos: [] })
    expect(t.estado).toBe('holgado')
    expect(t.aviso, 'decirlo en cada mutación sería ruido').toBe('')
  })

  it('uno que se acerca al límite lo dice, y con el porcentaje', () => {
    const t = tamanoDelEpisodio(episodioDe(1700))
    expect(t.estado).not.toBe('holgado')
    expect(t.aviso).toMatch(/% del máximo por documento/)
  })

  it('y uno crítico nombra la consecuencia real, no «documento grande»', () => {
    const t = tamanoDelEpisodio(episodioDe(2200))
    expect(t.estado).toBe('critico')
    expect(t.aviso, 'lo que importa no es el tamaño: es que no se puede egresar')
      .toMatch(/EGRESAR AL PACIENTE/)
  })

  it('dice QUÉ lo llena: sin eso el aviso no es accionable', () => {
    const t = tamanoDelEpisodio(episodioDe(2200))
    expect(t.queLoLlena[0].campo).toBe('indicaciones')
    expect(t.queLoLlena[0].elementos).toBe(2200)
    expect(t.aviso).toMatch(/indicaciones/)
  })

  it('y distingue los topados de los que crecen sin techo', () => {
    const t = tamanoDelEpisodio({
      indicaciones: [{ texto: 'x'.repeat(5000) }],
      sbar: [{ texto: 'y'.repeat(100) }],
    })
    const porCampo = Object.fromEntries(t.queLoLlena.map(c => [c.campo, c.topado]))
    expect(porCampo).toEqual({ indicaciones: false, sbar: true })
  })

  it('un documento vacío o nulo no revienta ni inventa un tamaño', () => {
    for (const d of [null, undefined, {}]) {
      const t = tamanoDelEpisodio(d)
      expect(t.estado, JSON.stringify(d)).toBe('holgado')
      expect(t.bytes).toBeLessThan(10)
    }
  })
})

describe('los umbrales son de operación, no clínicos', () => {
  it('el límite es el de Firestore, no una elección nuestra', () => {
    expect(LIMITE_FIRESTORE).toBe(1024 * 1024)
  })

  it('se vigila con margen para reaccionar, y se dice por qué', () => {
    expect(FRACCION_VIGILAR).toBeLessThan(FRACCION_CRITICO)
    expect(FRACCION_CRITICO).toBeLessThan(1)
    /* Del 90 % al 100 % puede haber una sola escritura: una indicación con su
       texto no es un elemento pequeño. */
    expect(FRACCION_VIGILAR).toBeLessThanOrEqual(0.7)
    expect(POR_QUE_LOS_UMBRALES_NO_SON_CLINICOS).toMatch(/hecho del proveedor/)
  })

  it('la medida se queda CORTA a propósito, y está declarado', () => {
    /* Firestore cobra además los nombres de campo, los índices y una sobrecarga
       por documento. Quedarse corto hace que el aviso llegue antes; pasarse lo
       haría llegar tarde, que es el error que importaría. */
    expect(LO_QUE_ESTA_MEDIDA_NO_HACE.join(' ')).toMatch(/POR DEBAJO de la real/)
  })
})

describe('y alguien la MIRA — que era todo el problema', () => {
  it('el gateway mide sobre el documento que se va a escribir', () => {
    expect(RUTA).toMatch(/tamanoDelEpisodio\(\{ \.\.\.\(inter as Any\), \.\.\.cambios \}\)/)
    expect(POR_QUE_SE_MIDE_ANTES_DE_ESCRIBIR).toMatch(/el que se va a escribir/)
  })

  it('lo devuelve la transacción, no un `let` que el compilador no ve', () => {
    expect(RUTA).toMatch(/const tamano: TamanoDelEpisodio \| null = await adminDb\.runTransaction/)
  })

  it('avisa a operaciones cuando es crítico, sin PHI', () => {
    const i = RUTA_SOLO_CODIGO.indexOf('enviarAlertaOps({')
    /* Sólo el objeto de la alerta, hasta su cierre: un margen fijo de caracteres
       arrastraba el código de camas de más abajo y hacía saltar el guardián por
       una palabra que no está EN la alerta. */
    const bloque = RUTA_SOLO_CODIGO.slice(i, RUTA_SOLO_CODIGO.indexOf('})', i))
    expect(bloque).toMatch(/gravedad: 'grave'/)
    /* Ni paciente, ni cama, ni servicio: quien opera necesita saber qué campo lo
       llena y en qué consultorio, no de quién es el episodio. */
    for (const phi of ['pacienteId', 'pacienteNombre', 'cama', 'servicio']) {
      expect(bloque, phi).not.toContain(phi)
    }
  })

  it('NO bloquea la mutación clínica', () => {
    /* Frenar una mutación clínica por un umbral de tamaño sería peor que el
       riesgo que evita. El aviso va después del `tx.update`, no antes. */
    expect(RUTA.indexOf('tx.update(ref, cambios)'))
      .toBeLessThan(RUTA.indexOf('enviarAlertaOps({'))
    expect(RUTA).not.toMatch(/if \(tamano[^)]*\) return NextResponse\.json\(\{ ok: false/)
  })
})

describe('lo que sigue sin topar, y por qué', () => {
  it('los tres siguen sin tope, con su razón escrita', () => {
    const sinTope = ARRAYS_DEL_EPISODIO.filter(a => a.tope === null).map(a => a.campo)
    expect(sinTope).toContain('movimientos')
    expect(sinTope).toContain('indicaciones')
    expect(sinTope).toContain('interconsultas')
    for (const a of ARRAYS_DEL_EPISODIO.filter(x => x.tope === null)) {
      expect(a.porQue.length, a.campo).toBeGreaterThan(60)
    }
  })

  it('y esta medida NO pretende cerrarlo: lo declara', () => {
    expect(LO_QUE_ESTA_MEDIDA_NO_HACE.join(' ')).toMatch(/No topa nada nuevo/)
    expect(LO_QUE_ESTA_MEDIDA_NO_HACE.join(' ')).toMatch(/desplegarlas es del dueño/)
  })
})
