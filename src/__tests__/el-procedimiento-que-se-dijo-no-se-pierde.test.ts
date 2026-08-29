/**
 * GOLDEN — LOS PROCEDIMIENTOS QUE EL EXTRACTOR OYE NO LOS LEÍA NADIE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `medical-ner.ts:62` reconoce **procedimientos** desde hace tiempo, con su
 * fecha, su lateralidad y la cita del dictado que los sostiene. El panel de
 * entidades los pinta.
 *
 * Y ahí se acaban. Medido sobre el árbol el 29-ago-2026: fuera del panel y de
 * las pruebas, **`entidades.procedures` no tenía un solo consumidor**. No hay
 * campo en `NotaMedica`, no entra a la nota, no se sella, no se proyecta.
 *
 * Así que «le hicieron una colecistectomía en 2019» o «tiene un stent en la
 * descendente anterior desde 2022» se reconocen, se pintan, y desaparecen al
 * cerrar la consulta salvo que el médico los teclee a mano en la prosa. En la
 * consulta siguiente nadie sabe que se dijeron.
 *
 * ── POR QUÉ IMPORTA MÁS QUE OTRAS PÉRDIDAS ──────────────────────────────────
 *
 * Un antecedente quirúrgico cambia conducta: cambia lo que se puede prescribir,
 * pedir, operar y anticoagular. Y la **lateralidad** es uno de los pares
 * prohibidos de este repositorio (derecha ↔ izquierda), justo el dato que se
 * pierde primero cuando algo se reescribe de memoria.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo WS-10 (procedimientos) con la pregunta de siempre: ¿quién lee
 * esto? La respuesta fue: el panel, y nadie más.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Familia «escrito y sin conectar»: el extractor produce, la pantalla pinta, y
 * ningún camino lo lleva al documento donde el dato tendría que quedar.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **No se documenta solo.** Se compara lo oído con lo que la nota dice y, cuando
 * falta, se señala antes de firmar. Un módulo que escribiera un antecedente
 * quirúrgico sin que nadie lo revisara estaría redactando historia clínica, y de
 * esa nota cuelga una firma con cédula profesional.
 *
 * Sale por el mismo camino que las otras cinco cosas que se señalan antes de
 * firmar, así que desde REG-366 **queda sellado en la nota** y desde REG-367
 * **vuelve a salir en la consulta siguiente**. No se añade un recuadro nuevo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No crea el campo `procedimientos` en `NotaMedica`.** Un campo nuevo de
 *   contenido clínico tiene que ir DENTRO del sello, y el sello v3 es una lista
 *   explícita: añadir uno exige un **sello v4** —canónico, vector golden y
 *   partición de cobertura— para que las notas firmadas con v3 sigan
 *   verificando. Está declarado como unidad aparte. Meterlo sin eso dejaría
 *   contenido clínico firmado **fuera del sello**, que es lo que E0-12 cerró.
 * · **No avisa de un procedimiento cuyo nombre no tenga palabras largas**
 *   («TAC», «PET»). Señalar de menos, y declararlo (regla 5).
 * · **No decide si el procedimiento es cierto** ni corrige su lateralidad.
 * · **No bloquea la firma.** Puede ser una palabra mal oída, y apagar el botón
 *   por un posible falso positivo enseña a esquivar la compuerta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  procedimientosQueNoQuedaronEscritos, avisoDeProcedimientoSinEscribir,
  MINIMO_PALABRA_UTIL, POR_QUE_NO_SE_ESCRIBE_SOLO, POR_QUE_NO_HAY_CAMPO_EN_LA_NOTA,
} from '@/lib/expediente/el-procedimiento-que-no-quedo-escrito'
import { construirAvisos, NIVEL } from '@/lib/expediente/avisos-consulta'
import { alFirmar } from '@/lib/expediente/cuando-avisar'

const OIDOS = [
  { texto: 'Colecistectomía', fecha: '2019', lateralidad: 'no_aplica' },
  { texto: 'Artroplastia de rodilla', fecha: '2022', lateralidad: 'derecha' },
]

describe('lo que se oyó y la nota no recoge', () => {
  it('con la nota en blanco, los dos se señalan', () => {
    const fuera = procedimientosQueNoQuedaronEscritos(OIDOS, '')
    expect(fuera.map(p => p.texto)).toEqual(['Colecistectomía', 'Artroplastia de rodilla'])
  })

  it('AL REVÉS — si la nota lo recoge, no se señala', () => {
    const nota = 'Antecedentes: colecistectomia en 2019. Artroplastia de rodilla derecha en 2022.'
    expect(procedimientosQueNoQuedaronEscritos(OIDOS, nota)).toEqual([])
  })

  it('conserva la LATERALIDAD, que es un par prohibido de este repositorio', () => {
    const fuera = procedimientosQueNoQuedaronEscritos(OIDOS, 'colecistectomia 2019')
    expect(fuera).toHaveLength(1)
    expect(fuera[0].lateralidad).toBe('derecha')
    expect(avisoDeProcedimientoSinEscribir(fuera[0])).toContain('derecha')
  })

  it('`no_aplica` NO se enseña: es el valor por defecto, no una lateralidad', () => {
    /* Misma regla que REG-365 con `presuntivo`: un valor de fábrica no es un
       dato que alguien haya determinado. */
    const fuera = procedimientosQueNoQuedaronEscritos([OIDOS[0]], '')
    expect(fuera[0].lateralidad).toBeUndefined()
    expect(avisoDeProcedimientoSinEscribir(fuera[0])).not.toContain('no_aplica')
  })

  it('acentos y caja no separan lo mismo', () => {
    expect(procedimientosQueNoQuedaronEscritos(
      [{ texto: 'Colecistectomía' }], 'se documenta COLECISTECTOMIA previa',
    )).toEqual([])
  })

  it('no casa por subcadena: «rodilla» no está en «rodillazo»', () => {
    expect(procedimientosQueNoQuedaronEscritos(
      [{ texto: 'Artroplastia de rodilla' }], 'refiere un rodillazo el mes pasado',
    )).toHaveLength(1)
  })

  it('el mismo procedimiento dicho dos veces se señala una', () => {
    const fuera = procedimientosQueNoQuedaronEscritos(
      [{ texto: 'Colecistectomía' }, { texto: 'colecistectomia' }], '',
    )
    expect(fuera).toHaveLength(1)
  })

  it('lo que no se puede comprobar NO se grita — señalar de menos, declarado', () => {
    /* «TAC» no tiene ninguna palabra de seis letras: no hay con qué buscarlo en
       la nota, así que se deja pasar en vez de avisar sobre algo que quizá sí
       está escrito. */
    expect(MINIMO_PALABRA_UTIL).toBeGreaterThan(4)
    expect(procedimientosQueNoQuedaronEscritos([{ texto: 'TAC' }], '')).toEqual([])
  })

  it('sin entradas no inventa nada', () => {
    expect(procedimientosQueNoQuedaronEscritos(undefined, 'lo que sea')).toEqual([])
    expect(procedimientosQueNoQuedaronEscritos([{ texto: '  ' }], '')).toEqual([])
  })
})

describe('sale por el camino que ya existe, no por un recuadro nuevo', () => {
  it('`construirAvisos` lo emite con su origen declarado', () => {
    const avisos = construirAvisos({
      procedimientosSinEscribir: [{ texto: 'Colecistectomía', mensaje: 'Se mencionó «Colecistectomía» y la nota no lo recoge.' }],
    })
    expect(avisos).toHaveLength(1)
    expect(avisos[0].origen).toBe('procedimiento_sin_escribir')
    expect(avisos[0].id).toBe('procedimiento:Colecistectomía')
  })

  it('NO bloquea la firma: puede ser una palabra mal oída', () => {
    expect(NIVEL.procedimiento_sin_escribir).toBe('revisa')
  })

  it('es de los que se ven AL FIRMAR, no mientras receta', () => {
    const avisos = construirAvisos({
      procedimientosSinEscribir: [{ texto: 'Colecistectomía', mensaje: 'x' }],
    })
    expect(alFirmar(avisos)).toHaveLength(1)
  })

  it('la clave del aviso es la MISMA con la que se marca revisado', () => {
    /* Si no coinciden, «Ya lo revisé» no lo silencia y el aviso vuelve en cada
       render. La consulta construye esa clave con el mismo recorte. */
    const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    expect(src).toContain('`procedimiento:${p.texto.slice(0, 40)}`')
  })
})

describe('lo que este módulo NO hace, dicho en el módulo', () => {
  it('no documenta por su cuenta, y explica por qué', () => {
    expect(POR_QUE_NO_SE_ESCRIBE_SOLO).toMatch(/redactando historia clínica/)
  })

  it('no crea un campo en la nota, y explica que eso exige un sello v4', () => {
    expect(POR_QUE_NO_HAY_CAMPO_EN_LA_NOTA).toMatch(/sello v4/)
    expect(POR_QUE_NO_HAY_CAMPO_EN_LA_NOTA).toMatch(/fuera del sello/i)
  })

  it('y en efecto NO se añadió un campo a la nota sin sellarlo', () => {
    /* Un `procedimientos` en `NotaMedica` que no esté en el canónico del sello
       es contenido clínico firmado y alterable sin dejar rastro. */
    const tipos = readFileSync('src/types/expediente.ts', 'utf8')
    const integrity = readFileSync('src/lib/expediente/integrity.ts', 'utf8')
    const enElTipo = /^\s*procedimientos\??:/m.test(tipos)
    const enElSello = /procedimientos:/.test(integrity)
    expect(enElTipo, 'si se añade el campo, tiene que entrar al sello v4').toBe(enElSello)
  })
})

describe('el dato tiene que LLEGAR a la consulta', () => {
  const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('la consulta lee `entidades.procedures` y compara contra el texto de la nota', () => {
    expect(src).toContain("from '@/lib/expediente/el-procedimiento-que-no-quedo-escrito'")
    expect(src).toMatch(/procedimientosQueNoQuedaronEscritos\(oidos, textoDeLaNota\(/)
  })

  it('entra a los avisos DE FIRMAR y a los de la barra', () => {
    const veces = src.split('procedimientosSinEscribir: procedimientosPerdidos').length - 1
    expect(veces, 'tiene que ir a los dos constructores de avisos').toBe(2)
  })
})
