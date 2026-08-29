/**
 * GOLDEN — UNA MENCIÓN HISTÓRICA SE CONVERTÍA EN MEDICACIÓN VIGENTE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `estadoDeOrden()` trata la **ausencia** de `estado` como `activa`, y con razón:
 * todo lo prescrito antes de que el campo existiera no lo lleva, y suponer otra
 * cosa vaciaría de golpe la medicación de todos los expedientes históricos.
 *
 * Pero el esquema de extracción **no tiene campo `estado`**. Así que un fármaco
 * que el modelo saca del dictado entra con `estado` ausente y, por esa misma
 * regla, se vuelve medicación activa:
 *
 *     «le dieron warfarina cuando la operaron, ya no la toma»
 *       → medicamento: Warfarina, sin estado
 *       → estadoDeOrden() → 'activa'  →  medicamentosVigentes() la incluye
 *       → sale en «Toma:», entra al cuadro de los motores (REG-188), y dispara
 *         la regla de sangrado sobre un fármaco que el paciente dejó hace años
 *
 * Y el eje temporal que este repositorio ya tiene sólo vigila **padecimientos**:
 * el vocabulario de `temporalidad.ts` son `CRONICAS` y `AGUDAS_FRECUENTES`, no
 * fármacos. Los medicamentos **no tenían ninguna defensa temporal**.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Cerrando el segundo hueco de modelo que el tablero tenía escrito: «una mención
 * histórica no puede volverse medicación activa».
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Una regla correcta (`ausencia = activa`, para no vaciar el histórico) aplicada
 * a una fuente para la que no se escribió (el extractor, que nunca pone
 * `estado`). Familia «el sistema se contradice a sí mismo».
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **No reclasifica.** No pone `suspendida`, no saca nada de la lista y no decide
 * que el paciente dejó el fármaco: señala la contradicción y decide el médico,
 * que ya tiene el botón «ya no» al lado de cada renglón vigente. Porque «ya no la
 * toma» y «se la suspendimos y la vamos a reanudar» se dictan igual de pasado.
 *
 * **Y sólo mira lo que el dictado nombra.** Un fármaco crónico que viene del
 * expediente y hoy no se mencionó no se toca: el silencio no suspende nada, y
 * confundir «hoy no se habló de él» con «lo dejó» es el defecto contrario — el
 * caro, porque borra medicación crónica de la lista que se lee antes de
 * prescribir.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No añade `estado` al esquema de extracción** ni un valor «histórico» a
 *   `procedenciaClinica`. Que el modelo declare el estado de una orden es una
 *   decisión de modelo con consecuencias en la receta; esto defiende sin
 *   pedírselo.
 * · **No se sella con la nota.** Ancla en `medicamentos`, así que es de los que
 *   se ven MIENTRAS se receta y no al firmar (`esDePrescripcion`) — y REG-366
 *   sella los del momento de firmar. Es deliberado: un aviso que cambia la
 *   receta llegando después de firmar es el registro de que no hubo protección
 *   (REG-173/190).
 * · **No opina de un fármaco de nombre corto** (< 5 letras útiles): no hay con
 *   qué buscarlo sin casar con cualquier cosa. Señalar de menos, y declararlo.
 * · **No entiende «suspendida hasta el martes»**: para el módulo eso es pasado y
 *   avisa. Avisar de más aquí cuesta una frase; callar cuesta una interacción.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  farmacosSoloMencionadosEnPasado, avisoDeFarmacoEnPasado, MINIMO_NOMBRE,
  POR_QUE_NO_LO_SUSPENDE_SOLO, POR_QUE_EL_SILENCIO_NO_CUENTA,
} from '@/lib/expediente/el-farmaco-que-ya-no-toma'
import { estadoDeOrden, medicamentosVigentes } from '@/lib/expediente/ordenes-medicamento'
import { construirAvisos, NIVEL } from '@/lib/expediente/avisos-consulta'
import { mientrasReceta, alFirmar } from '@/lib/expediente/cuando-avisar'
import type { Medicamento } from '@/types/expediente'

const DICTADO = 'Le dieron warfarina cuando la operaron hace tres años. Toma metformina 850 desde hace cinco años.'

describe('el defecto: una mención histórica entra como vigente', () => {
  it('AL REVÉS — sin `estado`, el fármaco extraído se lee como activo', () => {
    /* La regla de `estadoDeOrden` es correcta para el histórico y no se toca:
       aquí se reproduce para fijar POR QUÉ hacía falta una defensa aparte. */
    const delDictado = { nombre: 'Warfarina', dosis: '5 mg' } as Medicamento
    expect(estadoDeOrden(delDictado)).toBe('activa')
    expect(medicamentosVigentes([{ fecha: '2026-08-29', medicamentos: [delDictado] }]))
      .toHaveLength(1)
  })

  it('y el eje temporal que ya existía no mira fármacos', () => {
    /* `temporalidad.ts` usa el vocabulario de padecimientos. Si algún día
       incluyera fármacos, este módulo sobra y hay que revisarlo. */
    const src = readFileSync('src/lib/expediente/temporalidad.ts', 'utf8')
    expect(src).toMatch(/CRONICAS|AGUDAS_FRECUENTES/)
    expect(src.toLowerCase()).not.toContain('warfarina')
  })
})

describe('el arreglo: se señala lo que sólo se dijo en pasado', () => {
  it('la warfarina de la operación se señala, con su cita', () => {
    const fuera = farmacosSoloMencionadosEnPasado([{ nombre: 'Warfarina' }], DICTADO)
    expect(fuera).toHaveLength(1)
    expect(fuera[0].cita).toMatch(/cuando la operaron/i)
    expect(avisoDeFarmacoEnPasado(fuera[0])).toMatch(/«ya no»/)
  })

  it('la metformina de «desde hace cinco años» NO se señala', () => {
    expect(farmacosSoloMencionadosEnPasado([{ nombre: 'Metformina 850 mg' }], DICTADO)).toEqual([])
  })

  it('basta UNA mención en presente para que no haya nada que decir', () => {
    const d = 'Le dieron warfarina hace tres años. Sigue con warfarina 5 mg.'
    expect(farmacosSoloMencionadosEnPasado([{ nombre: 'Warfarina' }], d)).toEqual([])
  })

  it('el nombre se busca por PALABRA, no por subcadena', () => {
    const d = 'Le dieron warfarinato hace tres años.'
    expect(farmacosSoloMencionadosEnPasado([{ nombre: 'Warfarina' }], d)).toEqual([])
  })

  it('acentos y caja no separan el mismo fármaco', () => {
    const d = 'Tomó AMOXICILINA hace tres años.'
    expect(farmacosSoloMencionadosEnPasado([{ nombre: 'Amoxicilina' }], d)).toHaveLength(1)
  })

  it('el mismo fármaco dos veces en la lista se señala una', () => {
    const fuera = farmacosSoloMencionadosEnPasado(
      [{ nombre: 'Warfarina 5 mg' }, { nombre: 'warfarina' }], DICTADO,
    )
    expect(fuera).toHaveLength(1)
  })
})

describe('lo que NO se toca, que es la mitad importante', () => {
  it('un fármaco que el dictado NO nombra no se señala nunca', () => {
    /* Viene del expediente y hoy no se habló de él. El silencio no suspende
       nada — es la regla de `ordenes-medicamento`, y romperla borraría
       medicación crónica de la lista que se lee antes de prescribir. */
    expect(farmacosSoloMencionadosEnPasado([{ nombre: 'Levotiroxina' }], DICTADO)).toEqual([])
    expect(POR_QUE_EL_SILENCIO_NO_CUENTA).toMatch(/hoy no se habló de él/)
  })

  it('sin dictado no se opina', () => {
    expect(farmacosSoloMencionadosEnPasado([{ nombre: 'Warfarina' }], '')).toEqual([])
    expect(farmacosSoloMencionadosEnPasado([{ nombre: 'Warfarina' }], '   ')).toEqual([])
  })

  it('un nombre demasiado corto no se busca', () => {
    expect(MINIMO_NOMBRE).toBeGreaterThan(3)
    expect(farmacosSoloMencionadosEnPasado([{ nombre: 'ASA' }], 'Tomó ASA hace tres años.')).toEqual([])
  })

  it('sin lista no revienta', () => {
    expect(farmacosSoloMencionadosEnPasado(undefined, DICTADO)).toEqual([])
    expect(farmacosSoloMencionadosEnPasado([{ nombre: '  ' }], DICTADO)).toEqual([])
  })

  it('NO reclasifica: no devuelve estados, sólo señala', () => {
    const fuera = farmacosSoloMencionadosEnPasado([{ nombre: 'Warfarina' }], DICTADO)
    expect(Object.keys(fuera[0]).sort()).toEqual(['cita', 'nombre'])
    expect(POR_QUE_NO_LO_SUSPENDE_SOLO).toMatch(/la vamos a reanudar/)
    const src = readFileSync('src/lib/expediente/el-farmaco-que-ya-no-toma.ts', 'utf8')
    expect(src).not.toContain("'suspendida'")
  })
})

describe('sale por el camino que ya existe, y en el momento correcto', () => {
  const avisos = construirAvisos({
    farmacosEnPasado: [{ nombre: 'Warfarina', mensaje: 'x — y Warfarina figura como vigente.' }],
  })

  it('`construirAvisos` lo emite con su origen declarado', () => {
    expect(avisos).toHaveLength(1)
    expect(avisos[0].origen).toBe('farmaco_solo_en_pasado')
    expect(avisos[0].id).toBe('pasado:Warfarina')
  })

  it('NO bloquea la firma', () => {
    expect(NIVEL.farmaco_solo_en_pasado).toBe('revisa')
  })

  it('se ve MIENTRAS receta, no al firmar', () => {
    /* Cambia la receta: llegando después de firmar sería el registro de que no
       hubo protección (REG-173/190). Y por eso NO lo sella REG-366, que sella
       los del momento de firmar. */
    expect(mientrasReceta(avisos)).toHaveLength(1)
    expect(alFirmar(avisos)).toHaveLength(0)
  })

  it('ancla en medicamentos, que es donde está el botón «ya no»', () => {
    expect(avisos[0].ancla?.seccion).toBe('medicamentos')
  })
})

describe('el dato tiene que LLEGAR a la consulta', () => {
  const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('la consulta mira lo de hoy Y lo vigente del expediente', () => {
    expect(src).toContain("from '@/lib/expediente/el-farmaco-que-ya-no-toma'")
    expect(src).toMatch(/\[\.\.\.medicamentos, \.\.\.vigentes\.map\(v => v\.medicamento\)\], dictado/)
  })

  it('entra a los avisos de prescripción', () => {
    expect(src).toMatch(/farmacosEnPasado: farmacosEnPasado\.map/)
  })

  it('la clave del aviso es la misma con la que se marca revisado', () => {
    expect(src).toContain('`pasado:${f.nombre.slice(0, 40)}`')
  })
})
