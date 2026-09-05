import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { limpiarComentarios } from '@/lib/authz/analisis-estatico'
import { terapiaDuplicadaDeLaLista, QUE_NO_CUBRE } from '@/lib/seguridad/terapia-duplicada'
import { dosisPeligrosasDeLaLista } from '@/lib/seguridad/dosis-de-la-lista'
import { revisarDosis, CATALOGO } from '@/lib/seguridad/dosis'
import { cantidad } from '@/types/clinical-quantity'

/**
 * LA MISMA SUSTANCIA DOS VECES SE DICE — REG-521.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * «Paracetamol 500 mg cada 8 horas» y «Tempra 1 g cada 8 horas» en la misma
 * receta. `revisarDosis` revisa renglón a renglón: 1 500 mg/día y 3 000 mg/día,
 * los dos debajo del techo de 4 000. Sumados, 4 500. La nota del catálogo dice
 * «vigilar dosis acumulada» y nadie acumulaba. Ni la consulta ni la receta
 * decían nada; tampoco cuando el Tempra ya estaba vigente en el expediente y
 * hoy se recetaba paracetamol.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría read-only de medicación del 5-sep-2026 («paracetamol + Tempra
 * pasa», `NOT_IMPLEMENTED`). Verificado por el orquestador: ningún módulo
 * cruzaba renglones entre sí. El vocabulario sí existía: `CATALOGO` en
 * `dosis.ts` ya sabía que Tempra y Tylenol son paracetamol.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Se agrupa por sustancia con el catálogo que ya existe (`buscarFarmaco`), o
 * por nombre normalizado si no está. Dos renglones de hoy con la misma
 * sustancia → `terapia_duplicada`; si todos traen mg y tomas, la suma diaria
 * se compara con el techo **que ya estaba en el catálogo**, con los mismos
 * tres niveles que `revisarDosis`. Un renglón de hoy que repite algo vigente
 * del expediente → `terapia_duplicada` que lo dice, sin sumar. Ninguna cifra
 * nueva. Un solo módulo, y las dos pantallas pasan por él.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * El caso 1 muestra lo que veía el producto antes: `revisarDosis` sobre cada
 * renglón, vacío. Con `dosis-de-la-lista` y las dos pantallas como estaban
 * (`git stash`), los guardianes de fuente se ponen rojos.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Clases terapéuticas (ibuprofeno + naproxeno): no hay vocabulario en el
 *   catálogo y no se inventa. `NOT_IMPLEMENTED`, declarado en `QUE_NO_CUBRE`.
 * - Dosis por kilo y frecuencias ilegibles no se suman: el aviso de duplicado
 *   sale sin cifra.
 * - No renderiza ninguna pantalla: el cableado se vigila por fuente.
 */

const HOY = [
  { nombre: 'Paracetamol', dosis: '500 mg', frecuencia: 'cada 8 horas', via: 'oral' },
  { nombre: 'Tempra', dosis: '1 g', frecuencia: 'cada 8 horas', via: 'oral' },
]

describe('REG-521 · lo que veía el producto antes', () => {
  it('1 · EL CASO: renglón a renglón, paracetamol 500 + Tempra 1 g no dicen nada', () => {
    for (const r of HOY) {
      const a = revisarDosis({ farmaco: r.nombre, dosis: cantidad(r.nombre === 'Tempra' ? 1000 : 500, 'mg', 'masa'), tomasDia: 3, via: 'oral' })
      expect(a.filter(x => x.codigo !== 'sin_referencia')).toEqual([])
    }
  })
})

describe('REG-521 · terapiaDuplicadaDeLaLista', () => {
  it('2 · EL CASO: dos renglones de la misma sustancia se dicen, y la suma pasa del techo del catálogo', () => {
    const r = terapiaDuplicadaDeLaLista(HOY)
    expect(r).toHaveLength(1)
    expect(r[0].med).toBe('Paracetamol')
    const codigos = r[0].alertas.map(a => a.codigo)
    expect(codigos).toContain('terapia_duplicada')
    expect(codigos).toContain('sobre_maximo_diario')
    const suma = r[0].alertas.find(a => a.codigo === 'sobre_maximo_diario')!
    // 500 × 3 + 1000 × 3 = 4500; el techo 4000 sale del CATALOGO, no de aquí.
    const techo = CATALOGO.find(f => f.nombre === 'Paracetamol')!.maxDiaMg
    expect(suma.mensaje).toContain('1500 mg + 3000 mg = 4500 mg/día')
    expect(suma.mensaje).toContain(`(${techo} mg)`)
    expect(r[0].alertas.find(a => a.codigo === 'terapia_duplicada')!.mensaje).toContain('«Tempra 1 g cada 8 horas»')
  })

  it('3 · la misma sustancia dos veces debajo del techo se dice igual, sin la suma', () => {
    const r = terapiaDuplicadaDeLaLista([
      { nombre: 'Paracetamol', dosis: '500 mg', frecuencia: 'cada 8 horas' },
      { nombre: 'Tylenol', dosis: '500 mg', frecuencia: 'cada 12 horas' },
    ])
    expect(r.map(x => x.alertas.map(a => a.codigo))).toEqual([['terapia_duplicada']])
    expect(r[0].severidad).toBe('alta')
  })

  it('4 · con dosis por kilo o frecuencia ilegible no se suma, pero el duplicado se dice', () => {
    const r = terapiaDuplicadaDeLaLista([
      { nombre: 'Paracetamol', dosis: '15 mg/kg', frecuencia: 'cada 6 horas' },
      { nombre: 'Tempra', dosis: '1 g', frecuencia: 'cuando haga falta' },
    ])
    expect(r[0].alertas.map(a => a.codigo)).toEqual(['terapia_duplicada'])
  })

  it('5 · fuera del catálogo, el mismo nombre escrito dos veces también es duplicado (por texto)', () => {
    const r = terapiaDuplicadaDeLaLista([
      { nombre: 'Fármaco-sintético-Z', dosis: '10 mg' },
      { nombre: 'fármaco-sintético-z', dosis: '20 mg' },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].alertas.map(a => a.codigo)).toEqual(['terapia_duplicada'])
  })

  it('6 · dos sustancias distintas no son duplicado; un renglón solo tampoco; lista vacía, nada', () => {
    expect(terapiaDuplicadaDeLaLista([
      { nombre: 'Paracetamol', dosis: '500 mg', frecuencia: 'cada 8 horas' },
      { nombre: 'Ibuprofeno', dosis: '400 mg', frecuencia: 'cada 8 horas' },
    ])).toEqual([])
    expect(terapiaDuplicadaDeLaLista([{ nombre: 'Paracetamol', dosis: '1 g', frecuencia: 'cada 6 horas' }])).toEqual([])
    expect(terapiaDuplicadaDeLaLista([])).toEqual([])
    expect(terapiaDuplicadaDeLaLista([{ nombre: '  ' }, { nombre: '' }])).toEqual([])
  })

  it('7 · el techo oral específico manda cuando TODOS los renglones son orales (ketorolaco)', () => {
    const r = terapiaDuplicadaDeLaLista([
      { nombre: 'Ketorolaco', dosis: '10 mg', frecuencia: 'cada 8 horas', via: 'oral' },
      { nombre: 'Dolac', dosis: '10 mg', frecuencia: 'cada 12 horas', via: 'oral' },
    ])
    const suma = r[0].alertas.find(a => a.codigo === 'sobre_maximo_diario')!
    expect(suma.mensaje).toContain('POR VÍA ORAL')
    expect(suma.mensaje).toContain('(40 mg)')
  })

  it('8 · con perfil de dosis alta (amoxicilina) la zona amarilla es «verificar», y por encima del absoluto es crítica', () => {
    const amarilla = terapiaDuplicadaDeLaLista([
      { nombre: 'Amoxicilina', dosis: '1 g', frecuencia: 'cada 8 horas' },
      { nombre: 'Amoxil', dosis: '500 mg', frecuencia: 'cada 12 horas' },
    ])
    expect(amarilla[0].alertas.map(a => a.codigo)).toEqual(['terapia_duplicada', 'dosis_alta_verificar'])
    const roja = terapiaDuplicadaDeLaLista([
      { nombre: 'Amoxicilina', dosis: '1 g', frecuencia: 'cada 8 horas' },
      { nombre: 'Clavulin', dosis: '1 g', frecuencia: 'cada 8 horas' },
    ])
    expect(roja[0].severidad).toBe('critica')
    expect(roja[0].alertas.find(a => a.codigo === 'sobre_maximo_diario')!.mensaje).toContain('ABSOLUTO')
  })

  it('9 · EL CASO con el expediente: Tempra vigente + paracetamol hoy se dice, sin sumar', () => {
    const r = terapiaDuplicadaDeLaLista(
      [{ nombre: 'Paracetamol', dosis: '1 g', frecuencia: 'cada 8 horas' }],
      [{ nombre: 'Tempra', dosis: '500 mg', frecuencia: 'cada 8 horas' }],
    )
    expect(r).toHaveLength(1)
    expect(r[0].alertas.map(a => a.codigo)).toEqual(['terapia_duplicada'])
    expect(r[0].alertas[0].mensaje).toContain('ya figura como vigente en el expediente')
    expect(r[0].alertas[0].mensaje).toContain('«Tempra 500 mg cada 8 horas»')
  })

  it('10 · lo vigente entre sí no se cruza: sólo importa lo que se receta hoy', () => {
    expect(terapiaDuplicadaDeLaLista(
      [{ nombre: 'Losartán', dosis: '50 mg', frecuencia: 'cada 24 horas' }],
      [{ nombre: 'Paracetamol', dosis: '500 mg' }, { nombre: 'Tempra', dosis: '500 mg' }],
    )).toEqual([])
  })

  it('11 · lo que no cubre está declarado, no aproximado: dos AINE distintos no son «la misma sustancia»', () => {
    expect(terapiaDuplicadaDeLaLista([
      { nombre: 'Ibuprofeno', dosis: '400 mg', frecuencia: 'cada 8 horas' },
      { nombre: 'Naproxeno', dosis: '250 mg', frecuencia: 'cada 12 horas' },
    ])).toEqual([])
    expect(QUE_NO_CUBRE).toContain('NOT_IMPLEMENTED')
  })
})

describe('REG-521 · la revisión de la lista lo incluye (la consulta pasa por ahí)', () => {
  it('12 · dosisPeligrosasDeLaLista devuelve el duplicado junto con lo de siempre', () => {
    const r = dosisPeligrosasDeLaLista(HOY)
    expect(r.map(x => x.med)).toEqual(['Paracetamol'])
    expect(r[0].alertas.map(a => a.codigo)).toContain('sobre_maximo_diario')
  })

  it('13 · y con yaToma, cruza contra el expediente', () => {
    const r = dosisPeligrosasDeLaLista(
      [{ nombre: 'Paracetamol', dosis: '500 mg', frecuencia: 'cada 8 horas' }],
      { yaToma: [{ nombre: 'Tylenol', dosis: '500 mg' }] },
    )
    expect(r[0].alertas.map(a => a.codigo)).toEqual(['terapia_duplicada'])
  })

  it('14 · sin duplicados, la lista se comporta exactamente como antes', () => {
    expect(dosisPeligrosasDeLaLista([{ nombre: 'paracetamol', dosis: '500 mg', frecuencia: 'cada 8 horas' }])).toEqual([])
  })
})

describe('REG-521 · las dos pantallas pasan por él (comentarios fuera)', () => {
  const receta = limpiarComentarios(readFileSync(join(process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8'))
  const consulta = limpiarComentarios(readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8'))
  const lista = limpiarComentarios(readFileSync(join(process.cwd(), 'src/lib/seguridad/dosis-de-la-lista.ts'), 'utf8'))

  it('15 · la receta cruza la lista de hoy contra lo vigente que REG-520 ya carga', () => {
    expect(receta).toContain('terapiaDuplicadaDeLaLista(medicamentos, vigentes.map(v => v.medicamento))')
  })

  it('16 · la consulta le pasa lo vigente del cuadro a la revisión de la lista', () => {
    expect(consulta).toContain('yaToma: medsDelCuadro.filter(m => !m.deHoy)')
  })

  it('17 · y la revisión de la lista lo llama, con lo que ya toma', () => {
    expect(lista).toContain('terapiaDuplicadaDeLaLista(medicamentos, ctx.yaToma ?? [])')
  })
})
