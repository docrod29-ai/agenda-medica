/**
 * GUARDIÁN — ninguna proyección se convierte en una segunda verdad.
 *
 * ── QUÉ CUSTODIA ────────────────────────────────────────────────────────────
 *
 * El invariante de arquitectura del producto dice que hay **un** expediente
 * longitudinal y **muchas vistas según el contexto**. «Problemas activos»,
 * «medicación vigente» y «alergias del expediente» son vistas: se calculan de las
 * notas firmadas y no existen en ningún otro sitio.
 *
 * Hoy eso se cumple **porque no se persisten**. Y eso no es una garantía: es una
 * casualidad que dura hasta que alguien quiera ahorrarse el recálculo.
 *
 * ── LO QUE PASARÍA SI SE PERSISTIERAN SIN MÁS ───────────────────────────────
 *
 * Un documento con la lista de medicamentos vigentes es, desde el momento en que
 * existe, **una segunda respuesta a «qué toma este paciente»**. Las dos se
 * separan en cuanto se firma una nota que el caché no vio — y las dos se leen
 * igual de bien: la pantalla enseña la guardada, la comprobación de
 * interacciones usa la guardada, y las notas dicen otra cosa sin que nadie lo
 * note.
 *
 * Es el defecto más caro de los que este repositorio persigue, porque no rompe
 * nada.
 *
 * ── POR QUÉ SE ESCRIBE AHORA ────────────────────────────────────────────────
 *
 * Porque REG-405 acaba de dar a las tres proyecciones su sobre (`asOf`,
 * `version`, `historialRecortado`), que es **la precondición para poder
 * persistirlas**: acaba de quitarse el único obstáculo práctico que había. Un
 * guardián sobre una propiedad que todavía se cumple es barato; escribirlo
 * después del primer `setDoc` es tarde.
 *
 * Es el mismo razonamiento de REG-401 con la identidad de la revista: la unidad
 * anterior puso el arma sobre la mesa.
 *
 * ── POR QUÉ ESTO VIVE EN LA PRUEBA Y NO EN UN MÓDULO ────────────────────────
 *
 * Se intentó primero como `lib/expediente/la-proyeccion-no-manda.ts`, con la
 * política, el censo de proyecciones y una función `sirveParaDecidir` escrita de
 * antemano para el día que se persistan. **Tres guardianes de este repositorio
 * lo rechazaron a la vez** —`modulos-sin-conectar`, `los-motores-llegan-al-medico`
 * y `el-camino-del-medico-llega-entero`— y tenían razón: era código de tiempo de
 * ejecución que nadie llama, que es exactamente la familia «escrito y sin
 * conectar» que este árbol persigue. Escribir la lógica del caché antes de que
 * exista el caché es adivinar cómo será.
 *
 * La política SÍ es real, pero es una propiedad del árbol —«ningún módulo de
 * proyección escribe»—, no una función que alguien ejecute. Su sitio es el
 * guardián. Las tres condiciones quedan escritas aquí, que es donde las va a
 * leer quien vaya a persistirlas: para hacerlo tendrá que tocar este archivo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No impide persistir.** Impide persistir **en silencio**: el día que se haga
 *   esto se pone rojo hasta que se declaren las tres condiciones, que es
 *   exactamente cuando conviene mirarlo.
 * · **No cubre las proyecciones de UCI/Hospital**, que están en otro carril.
 * · **No comprueba que las tres se calculen bien**: eso es de sus propias
 *   pruebas. Esto comprueba que ninguna se convierta en la verdad.
 * · **No vigila un caché en el navegador.** `borradorMem` y compañía guardan lo
 *   que el médico escribe, no proyecciones derivadas; si alguna vez se memoriza
 *   una proyección en `localStorage`, esto no lo ve.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Las proyecciones sobre Clinical Truth. Añadir una es añadirla aquí.
 *
 * `suVerdad` no es decoración: si alguna deja de calcularse de las notas
 * firmadas, es otra arquitectura y hay que mirarlo, no un detalle.
 */
const PROYECCIONES = [
  {
    nombre: 'Alergias del expediente',
    modulo: 'src/lib/expediente/alergias-longitudinales.ts',
    sobre: 'EstadoDeAlergias',
    suVerdad: 'notas firmadas + la lista de alergias de hoy',
  },
  {
    nombre: 'Problemas activos',
    modulo: 'src/lib/expediente/problemas-activos.ts',
    sobre: 'EstadoDeProblemas',
    suVerdad: 'notas firmadas, última palabra sobre cada problema',
  },
  {
    nombre: 'Medicación vigente',
    modulo: 'src/lib/expediente/ordenes-medicamento.ts',
    sobre: 'EstadoDeMedicamentos',
    suVerdad: 'notas firmadas, última palabra sobre cada fármaco',
  },
] as const

/**
 * LAS TRES CONDICIONES PARA PODER PERSISTIR UNA PROYECCIÓN.
 *
 * No es que no se pueda: es que hay que decidir la autoridad ANTES y dejarla
 * escrita. Con estas tres, una proyección guardada es un caché y no una verdad.
 */
const LAS_TRES_CONDICIONES = [
  'La proyección NUNCA es autoridad: ante discrepancia manda la nota firmada. Siempre, sin excepción y sin «salvo que la proyección sea más reciente» — se calcula de las notas, así que una proyección que le gana a su origen es un error de cálculo, no un dato nuevo.',
  'Trae `asOf` y `version`: sin las dos no se puede saber si está vieja ni si la calculó un código que ya no existe.',
  'Una proyección anterior a la última nota firmada NO SE USA: se recalcula, o no se enseña. No se «refresca en segundo plano» ni se enseña con un aviso — un caché que se usa mientras se actualiza es un caché que a veces miente, y aquí «a veces» es una consulta.',
]

describe('las tres proyecciones están censadas y traen su sobre', () => {
  it('los tres módulos existen', () => {
    for (const p of PROYECCIONES) {
      expect(() => readFileSync(p.modulo, 'utf8'), `${p.nombre} → ${p.modulo}`).not.toThrow()
    }
  })

  it('cada una exporta su sobre, con `asOf` y `version`', () => {
    /**
     * Sin las dos, una proyección no se puede invalidar — así que no se puede
     * persistir con seguridad. REG-363 se lo dio a alergias y REG-405 a las
     * otras dos: ésta es la condición 2, comprobada.
     */
    for (const p of PROYECCIONES) {
      const src = readFileSync(p.modulo, 'utf8')
      const i = src.indexOf(`export interface ${p.sobre}`)
      expect(i, `${p.nombre} no exporta ${p.sobre}`).toBeGreaterThan(-1)
      const bloque = src.slice(i, i + 900)
      expect(bloque, `${p.sobre} sin asOf`).toMatch(/asOf/)
      expect(bloque, `${p.sobre} sin version`).toMatch(/version/)
    }
  })

  it('y ninguna lee el reloj: el instante se le pasa', () => {
    /* Una proyección que mira el reloj no es pura, no se puede probar dos veces
       con el mismo resultado, y su `asOf` deja de significar algo. */
    for (const p of PROYECCIONES) {
      const src = readFileSync(p.modulo, 'utf8')
      expect(src.includes('Date.now()'), `${p.nombre} lee el reloj`).toBe(false)
      expect(src.includes('new Date().toISOString()'), `${p.nombre} lee el reloj`).toBe(false)
    }
  })
})

describe('hoy ninguna se persiste, y no puede empezar a hacerlo en silencio', () => {
  it('ningún módulo de proyección escribe en Firestore', () => {
    /**
     * AL REVÉS: un `setDoc` con el estado calculado dentro de cualquiera de los
     * tres crea la segunda verdad, y este caso cae. Probado añadiendo uno.
     *
     * No prohíbe persistir — prohíbe persistir **en silencio**, sin las tres
     * condiciones de arriba declaradas y cumplidas.
     */
    for (const p of PROYECCIONES) {
      const src = readFileSync(p.modulo, 'utf8')
      for (const escritura of ['setDoc(', 'addDoc(', 'updateDoc(', 'writeBatch(']) {
        expect(
          src.includes(escritura),
          `${p.nombre} escribe (${escritura}): una proyección persistida es una segunda respuesta a la misma pregunta. `
          + `Si de verdad hace falta, cumple las tres condiciones de este archivo y actualiza este guardián a conciencia.`,
        ).toBe(false)
      }
    }
  })

  it('ni importa Firestore siquiera', () => {
    /* Los tres son módulos PUROS. Que dejen de serlo es el primer paso del
       camino equivocado, y se ve antes que la escritura. */
    for (const p of PROYECCIONES) {
      const src = readFileSync(p.modulo, 'utf8')
      expect(src.includes("from 'firebase/firestore'"), `${p.nombre} importa Firestore`).toBe(false)
    }
  })

  it('las tres condiciones están escritas, y dicen QUÉ manda', () => {
    /* Quien vaya a persistir una proyección tiene que tocar este archivo. Que
       las lea de camino es el punto. */
    expect(LAS_TRES_CONDICIONES).toHaveLength(3)
    expect(LAS_TRES_CONDICIONES[0]).toMatch(/manda la nota firmada/)
    expect(LAS_TRES_CONDICIONES[0]).toMatch(/error de cálculo, no un dato nuevo/)
    expect(LAS_TRES_CONDICIONES[2]).toMatch(/NO SE USA/)
  })
})

describe('las proyecciones siguen saliendo de las notas firmadas', () => {
  it('cada una declara su verdad, y es la misma para las tres', () => {
    for (const p of PROYECCIONES) {
      expect(p.suVerdad, p.nombre).toMatch(/notas firmadas/)
    }
  })

  it('y los borradores siguen sin contar en la medicación', () => {
    /**
     * Es la parte de «su verdad» que más fácil se pierde: incluir la nota que se
     * está escribiendo haría que la lista vigente cambiara mientras se teclea, y
     * entonces la proyección no sería una vista del expediente sino del
     * formulario.
     */
    const src = readFileSync('src/lib/expediente/ordenes-medicamento.ts', 'utf8')
    expect(src).toMatch(/estadoDeOrden\(med\) === 'borrador'/)
  })
})
