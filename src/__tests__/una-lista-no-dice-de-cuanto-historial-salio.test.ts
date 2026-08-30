/**
 * GOLDEN — «no encontré más» no es «no hay más», tampoco en problemas y fármacos.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `listarNotasCompat` devuelve `{ notas, truncada, techo }`, y su encabezado
 * explica exactamente por qué: se **borró** la puerta que devolvía «un array
 * pelado» porque *«un array no puede decir que viene recortado; quien lo recibe
 * no tiene forma de saberlo, y con un historial clínico el silencio se lee como
 * *no tiene*»*.
 *
 * Y a un paso de ahí, `problemasActivos(notas)` y `medicamentosVigentes(notas)`
 * volvían a ser esa misma puerta. Las dos pantallas que las llaman **tenían
 * `truncada` en la mano** —`/consulta` lo lee dos líneas antes, `/expediente` lo
 * pide a `useExpediente`— y no tenían dónde ponerlo.
 *
 * Con un historial largo, las dos listas se calculaban sobre una **ventana** y
 * se enseñaban como si fueran el expediente entero.
 *
 * ── POR QUÉ EN MEDICACIÓN CUESTA MÁS ────────────────────────────────────────
 *
 * Un fármaco recetado antes del techo desaparece de la lista vigente, y con él
 * desaparece de **todo lo que la usa**: la comprobación de interacciones no lo
 * mira, la reconciliación no lo echa en falta, y la nota nueva se escribe como
 * si el paciente no lo tomara. La ausencia no produce ningún error — produce una
 * lista más corta, que se lee igual de bien.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * **Ausencia de dato no es dato de ausencia** (seguridad clínica §4).
 *
 * `estadoDeAlergias` ya tenía este sobre —`asOf`, `version`,
 * `historialRecortado`— desde REG-363. Aquí **no se inventa uno nuevo**: se usa
 * el mismo, que es lo que pedía el censo («falta persistencia y asOf/version en
 * los tres») y lo que evita tener tres formas de decir lo mismo.
 *
 * ── LO QUE DELIBERADAMENTE NO SE HIZO ───────────────────────────────────────
 *
 * **Persistir la proyección.** El censo lo pide en la misma línea, y
 * `WS-10.proyeccion-no-es-segunda-verdad` avisa de por qué no se puede hacer sin
 * más: guardar una proyección sin decidir quién manda cuando el caché y las
 * notas discrepan crea la segunda fuente de verdad que el invariante de
 * arquitectura prohíbe.
 *
 * El sobre es la **precondición** de poder persistirla: una proyección sin
 * `asOf`, sin `version` y sin saber si salió de un recorte no se puede guardar
 * de forma segura ni invalidar. Eso es lo que se cierra aquí.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No pinta el aviso.** Que la pantalla DIGA «esta lista sale de las últimas N
 *   notas» es trabajo de la vista; aquí el dato llega hasta ella y deja de
 *   caerse en la puerta.
 * · **No persiste nada**, por lo de arriba.
 * · **No cambia el núcleo.** `problemasActivos` y `medicamentosVigentes` siguen
 *   siendo las mismas funciones puras, con sus pruebas: lo que se añade es el
 *   sobre, no otra regla de vigencia.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  problemasActivos, estadoDeProblemas, VERSION_PROYECCION_PROBLEMAS,
  POR_QUE_LA_LISTA_NO_BASTA,
} from '@/lib/expediente/problemas-activos'
import {
  medicamentosVigentes, estadoDeMedicamentos, VERSION_PROYECCION_MEDICAMENTOS,
  POR_QUE_IMPORTA_MAS_EN_MEDICAMENTOS,
} from '@/lib/expediente/ordenes-medicamento'

const ASOF = '2026-08-30T12:00:00.000Z'

const NOTAS = [
  {
    fecha: '2026-06-01',
    diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2', estado: 'activo' }],
    medicamentos: [{ nombre: 'Metformina', dosis: '850 mg', frecuencia: 'cada 12 h' }],
  },
] as unknown as Parameters<typeof problemasActivos>[0] & Parameters<typeof medicamentosVigentes>[0]

describe('la proyección dice de cuánto historial salió', () => {
  it('sobre un historial COMPLETO, el recorte es falso', () => {
    const p = estadoDeProblemas(NOTAS, ASOF)
    expect(p.historialRecortado).toBe(false)
    expect(p.asOf).toBe(ASOF)
    expect(p.version).toBe(VERSION_PROYECCION_PROBLEMAS)
  })

  it('y sobre uno RECORTADO lo dice', () => {
    /**
     * AL REVÉS del estado anterior: con una lista pelada, estas dos situaciones
     * son indistinguibles, y la segunda se lee como la primera.
     */
    const p = estadoDeProblemas(NOTAS, ASOF, { historialIncompleto: true })
    expect(p.historialRecortado).toBe(true)
    const m = estadoDeMedicamentos(NOTAS, ASOF, { historialIncompleto: true })
    expect(m.historialRecortado).toBe(true)
  })

  it('el sobre es el MISMO que ya usaba la proyección de alergias', () => {
    /* Tres formas de decir «esto salió de una ventana» serían tres sitios donde
       arreglarlo. `estadoDeAlergias` lo tiene desde REG-363. */
    const ALERGIAS = readFileSync('src/lib/expediente/alergias-longitudinales.ts', 'utf8')
    expect(ALERGIAS).toMatch(/asOf: string/)
    expect(ALERGIAS).toMatch(/historialIncompleto/)
    const m = estadoDeMedicamentos(NOTAS, ASOF)
    expect(m.asOf).toBe(ASOF)
    expect(m.version).toBe(VERSION_PROYECCION_MEDICAMENTOS)
  })

  it('no lee el reloj: el instante se pasa', () => {
    /* Una proyección que mira el reloj no es pura y no se puede probar dos veces
       con el mismo resultado. */
    expect(estadoDeProblemas(NOTAS, '2020-01-01T00:00:00.000Z').asOf).toBe('2020-01-01T00:00:00.000Z')
  })
})

describe('el núcleo no cambió', () => {
  it('la lista es exactamente la que devolvía la función pura', () => {
    /**
     * El sobre añade contexto; no toca la regla de vigencia. Si esto se
     * separara, habría dos respuestas a «qué toma el paciente».
     */
    expect(estadoDeProblemas(NOTAS, ASOF).problemas).toEqual(problemasActivos(NOTAS))
    expect(estadoDeMedicamentos(NOTAS, ASOF).vigentes).toEqual(medicamentosVigentes(NOTAS))
  })

  it('y sigue habiendo algo que proyectar (si no, esto pasaría vacío)', () => {
    expect(estadoDeProblemas(NOTAS, ASOF).problemas.length).toBeGreaterThan(0)
    expect(estadoDeMedicamentos(NOTAS, ASOF).vigentes.length).toBeGreaterThan(0)
  })
})

describe('el recorte LLEGA desde donde ya se sabía', () => {
  const CONSULTA = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
  const EXPEDIENTE = readFileSync('src/app/(dashboard)/expediente/[patientId]/page.tsx', 'utf8')

  it('/consulta lo pasa: lo tenía dos líneas antes', () => {
    /**
     * «El dato tiene que LLEGAR». `listarNotasCompat` ya devolvía `truncada` en
     * esa misma función y se caía en la llamada siguiente.
     */
    expect(CONSULTA).toMatch(/estadoDeMedicamentos\(firmadas, asOfProyeccion, \{ historialIncompleto: truncada \}\)/)
    expect(CONSULTA).toMatch(/estadoDeProblemas\(firmadas, asOfProyeccion, \{ historialIncompleto: truncada \}\)/)
  })

  it('/expediente también, con el que le da `useExpediente`', () => {
    expect(EXPEDIENTE).toMatch(/estadoDeProblemas\(firmadas, asOf, \{ historialIncompleto: historialTruncado \}\)/)
    expect(EXPEDIENTE).toMatch(/estadoDeMedicamentos\(firmadas, asOf, \{ historialIncompleto: historialTruncado \}\)/)
  })

  it('y ninguna de las dos llama ya a la puerta pelada', () => {
    /**
     * Éste es el que evita la recaída. Volver a `problemasActivos(firmadas)` en
     * una pantalla reabre el agujero exacto, y se ve igual de bien.
     */
    for (const [nombre, src] of [['consulta', CONSULTA], ['expediente', EXPEDIENTE]] as const) {
      expect(src, `${nombre} volvió a la lista pelada`).not.toMatch(/problemasActivos\(firmadas\)/)
      expect(src, `${nombre} volvió a la lista pelada`).not.toMatch(/medicamentosVigentes\(firmadas\)/)
    }
  })

  it('las razones están escritas donde se puedan leer', () => {
    expect(POR_QUE_LA_LISTA_NO_BASTA).toMatch(/array pelado/)
    expect(POR_QUE_IMPORTA_MAS_EN_MEDICAMENTOS).toMatch(/interacciones/)
  })
})
