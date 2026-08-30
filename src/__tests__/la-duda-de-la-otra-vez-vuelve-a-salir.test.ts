/**
 * GOLDEN — LA DUDA DE UNA CONSULTA ANTERIOR NO LLEGABA A LA SIGUIENTE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-366 hizo que los avisos que el médico revisa al firmar queden sellados en
 * la nota, y que la pantalla de ESA nota los enseñe. Y declaró, sin disimularlo,
 * lo que no cerraba: **ninguna consulta posterior los lee**.
 *
 * Sellar algo que sólo se ve abriendo el documento donde se selló es media
 * reparación. Hay que ir a buscarlo, y nadie va a buscar lo que no sabe que
 * está.
 *
 * ── LA FRASE QUE ESTE MÓDULO CONTRADICE ─────────────────────────────────────
 *
 * De `certeza.ts`, escrita por el propio repositorio y verificada aquí:
 *
 *     «Lo que el paciente ofreció como duda queda en el expediente como
 *      diagnóstico. A partir de la SEGUNDA CONSULTA ya nadie sabe que era una
 *      duda: se lee igual que un dato confirmado y se arrastra a todas las
 *      notas siguientes.»
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Lo declaró REG-366 como lo que dejaba abierto, en su propio golden y en el
 * ledger. Cerrarlo en la unidad siguiente es lo que evita que un «qué no cubre»
 * se convierta en el defecto de dentro de seis meses.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El dato existía en un documento y ningún camino del producto lo leía desde el
 * sitio donde hace falta. Familia «escrito y sin conectar» — el sello estaba, el
 * lector no.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Se enseña **sólo** lo que habla de un problema que el paciente **sigue
 * teniendo hoy**, con la fecha de la nota firmada que lo dice. Sin la fecha
 * sería una afirmación del sistema; con ella es una cita del expediente que el
 * médico puede ir a leer. No cambia la lista de problemas, no recalifica ningún
 * diagnóstico y no bloquea nada.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **El emparejamiento es una heurística, y señala de MENOS.** Casa por
 *   palabras de seis letras o más del diagnóstico dentro de la frase. Un
 *   problema cuyas palabras sean todas cortas —«gota», «asma», «TEP»— **no se
 *   empareja nunca**, y eso es deliberado: emparejar de más llena la consulta de
 *   dudas que no son de ese problema, y un aviso que salta de más se aprende a
 *   cerrar. Regla 5: señalar de menos, y declararlo.
 * · **No cubre notas anteriores a REG-366**, que no llevan avisos sellados. Para
 *   ellas no hay nada que leer, y no se inventa nada.
 * · **No dice si la duda se resolvió.** Nadie registra eso todavía. Enseña que
 *   la hubo; decidir es del médico.
 * · **No trae los avisos de aquella consulta que no viajan** (dosis incompleta,
 *   requisito NOM-004): eran de aquel momento y se resolvieron allí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  dudasQueSiguenEnPie, ORIGENES_QUE_VIAJAN, MINIMO_PALABRA_UTIL, POR_QUE_VUELVE_A_SALIR,
} from '@/lib/expediente/la-duda-de-la-otra-vez'
import { conAvisosSellados } from '@/lib/expediente/lo-que-se-aviso-al-firmar'
import { construirAvisos } from '@/lib/expediente/avisos-consulta'
import { alFirmar } from '@/lib/expediente/cuando-avisar'
import { POR_QUE_IMPORTA } from '@/lib/expediente/certeza'
import type { NotaMedica } from '@/types/expediente'

function nota(id: string, fecha: string, estado: string): NotaMedica {
  return {
    id, clinicId: 'c1', pacienteId: 'p1', pacienteNombre: 'Paciente Sintético',
    tipo: 'consulta', estado, fechaConsulta: fecha,
    metadata: { id, fechaCreacion: fecha },
    secciones: [], diagnosticos: [], medicamentos: [], alergias: [],
  } as unknown as NotaMedica
}

/** La cadena real: motores → avisos → sello en la nota. */
function conDuda(n: NotaMedica, frase: string): NotaMedica {
  return conAvisosSellados(n, alFirmar(construirAvisos({
    datosInciertos: [{ frase, matiz: 'duda', marca: 'creo que' }],
  })))
}

const HACE_DOS_ANIOS = conDuda(
  nota('n1', '2024-03-11T09:00:00.000Z', 'firmada'),
  'creo que me dijeron que tenía anemia',
)

describe('la duda de la otra vez vuelve a salir', () => {
  it('el problema de hoy trae consigo la duda que lo originó', () => {
    const dudas = dudasQueSiguenEnPie([HACE_DOS_ANIOS], ['Anemia'])
    expect(dudas).toHaveLength(1)
    expect(dudas[0].problema).toBe('Anemia')
    expect(dudas[0].texto).toMatch(/creo que me dijeron/)
    /* Con la fecha de la nota: sin ella sería una afirmación del sistema. */
    expect(dudas[0].dichoEn).toBe('2024-03-11T09:00:00.000Z')
    expect(dudas[0].origen).toBe('dato_incierto')
  })

  it('AL REVÉS — sin el sello de REG-366 no hay nada que leer', () => {
    /* El estado anterior: la nota existe, el problema existe, y la duda no. */
    const sinSello = nota('n1', '2024-03-11T09:00:00.000Z', 'firmada')
    expect(dudasQueSiguenEnPie([sinSello], ['Anemia'])).toEqual([])
  })

  it('la frase de `certeza.ts` que esto contradice sigue escrita donde estaba', () => {
    /* Si alguien reescribe ese porqué, este módulo se queda sin su razón. */
    expect(POR_QUE_IMPORTA).toMatch(/a partir de la segunda consulta/i)
    expect(POR_QUE_VUELVE_A_SALIR).toMatch(/no se veía/)
  })
})

describe('sólo lo que sigue en pie, y sólo de notas firmadas', () => {
  it('un problema que ya no está en la lista no arrastra su duda', () => {
    expect(dudasQueSiguenEnPie([HACE_DOS_ANIOS], ['Faringitis'])).toEqual([])
  })

  it('una nota en BORRADOR no cuenta: todavía se está escribiendo', () => {
    const borrador = conDuda(nota('n2', '2026-08-29', 'borrador'), 'creo que tengo anemia')
    expect(dudasQueSiguenEnPie([borrador], ['Anemia'])).toEqual([])
  })

  it('la nota de HOY se excluye: sus avisos ya están en pantalla', () => {
    const hoy = conDuda(nota('n9', '2026-08-29T09:00:00.000Z', 'firmada'), 'creo que tengo anemia')
    expect(dudasQueSiguenEnPie([hoy], ['Anemia'], 'n9')).toEqual([])
    expect(dudasQueSiguenEnPie([hoy], ['Anemia'])).toHaveLength(1)
  })

  it('la misma duda sellada dos veces sale UNA, y por la nota más reciente', () => {
    const vieja = conDuda(nota('n1', '2024-03-11T09:00:00.000Z', 'firmada'), 'creo que me dijeron que tenía anemia')
    const nueva = conDuda(nota('n2', '2025-07-02T09:00:00.000Z', 'firmada'), 'creo que me dijeron que tenía anemia')
    const dudas = dudasQueSiguenEnPie([vieja, nueva], ['Anemia'])
    expect(dudas).toHaveLength(1)
    expect(dudas[0].dichoEn).toBe('2025-07-02T09:00:00.000Z')
  })

  it('sin problemas vigentes no hay nada que emparejar', () => {
    expect(dudasQueSiguenEnPie([HACE_DOS_ANIOS], [])).toEqual([])
    expect(dudasQueSiguenEnPie([], ['Anemia'])).toEqual([])
  })
})

describe('el emparejamiento señala de MENOS, y está declarado', () => {
  it('casa por palabra ENTERA, no por subcadena', () => {
    /* «anemia» no puede casar con un problema llamado «Anemias carenciales»
       al revés: lo que se busca son las palabras del DIAGNÓSTICO dentro de la
       frase, enteras. Una frase que diga «anemias» no casa con «Anemia». */
    const n = conDuda(nota('n1', '2024-01-01', 'firmada'), 'creo que tengo anemias varias')
    expect(dudasQueSiguenEnPie([n], ['Anemia'])).toEqual([])
  })

  it('un diagnóstico de palabras CORTAS no se empareja nunca — y es deliberado', () => {
    const n = conDuda(nota('n1', '2024-01-01', 'firmada'), 'creo que me dijeron que tenía gota')
    expect(MINIMO_PALABRA_UTIL).toBeGreaterThan(4)
    expect(dudasQueSiguenEnPie([n], ['Gota'])).toEqual([])
  })

  it('casa con la palabra larga aunque el diagnóstico traiga más', () => {
    const n = conDuda(nota('n1', '2024-01-01', 'firmada'), 'creo que me dijeron que tengo diabetes')
    const dudas = dudasQueSiguenEnPie([n], ['Diabetes mellitus tipo 2'])
    expect(dudas).toHaveLength(1)
    expect(dudas[0].problema).toBe('Diabetes mellitus tipo 2')
  })

  it('la palabra al final de la frase, con punto, también casa', () => {
    const n = conDuda(nota('n1', '2024-01-01', 'firmada'), 'creo que me dijeron que tenía anemia.')
    expect(dudasQueSiguenEnPie([n], ['Anemia'])).toHaveLength(1)
  })

  it('acentos, eñes y mayúsculas no separan el mismo problema', () => {
    /* El dictado escribe «migrana» y el diagnóstico «MIGRAÑA». La normalización
       descompone y quita las marcas, así que la ñ y la n acaban siendo la misma
       letra — que es lo que hace falta para que un reconocedor de voz y un
       catálogo se entiendan. */
    const n = conDuda(nota('n1', '2024-01-01', 'firmada'), 'creo que tengo migrana cronica')
    expect(dudasQueSiguenEnPie([n], ['MIGRAÑA'])).toHaveLength(1)
    expect(dudasQueSiguenEnPie([n], ['Crónica'])).toHaveLength(1)
  })

  it('la palabra entre comillas y seguida de punto casa — lo cazó esta prueba', () => {
    /*
     * El texto del aviso envuelve la frase del médico: «…que tenía anemia».
     * Confírmalo…». La primera versión de este módulo comparaba « palabra » con
     * espacios a los lados y listaba a mano los separadores que se le
     * ocurrieron, así que **no encontraba el caso principal**. Frontera de
     * palabra de verdad.
     */
    const dudas = dudasQueSiguenEnPie([HACE_DOS_ANIOS], ['Anemia'])
    expect(dudas).toHaveLength(1)
    expect(dudas[0].texto).toMatch(/anemia»/)
  })
})

describe('qué avisos viajan entre consultas', () => {
  it('sólo los que dicen de dónde salió el dato', () => {
    expect(ORIGENES_QUE_VIAJAN).toContain('dato_incierto')
    expect(ORIGENES_QUE_VIAJAN).toContain('antecedente_del_familiar')
    /* Los de aquella consulta, que se resolvieron allí, NO vuelven. */
    expect(ORIGENES_QUE_VIAJAN).not.toContain('dosis_incompleta')
    expect(ORIGENES_QUE_VIAJAN).not.toContain('requisito_nom004')
  })

  it('un aviso de un origen que no viaja se queda en su nota', () => {
    const n = conAvisosSellados(nota('n1', '2024-01-01', 'firmada'), [
      { id: 'requisito_nom004:x', origen: 'requisito_nom004', nivel: 'bloquea', texto: 'falta anemia en algo' },
    ] as never)
    expect(dudasQueSiguenEnPie([n], ['Anemia'])).toEqual([])
  })
})

describe('el dato tiene que LLEGAR a la consulta', () => {
  const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('la consulta lo calcula sobre las notas que ya cargó', () => {
    expect(src).toContain("from '@/lib/expediente/la-duda-de-la-otra-vez'")
    expect(src).toMatch(/setDudasDeAntes\(dudasQueSiguenEnPie\(/)
  })

  it('y lo pinta con la fecha de la nota que lo dice', () => {
    expect(src).toMatch(/\{dudasDeAntes\.length > 0 && \(/)
    expect(src).toContain('d.dichoEn.slice(0, 10)')
  })

  it('excluye la nota que se está escribiendo ahora', () => {
    expect(src).toMatch(/notaIdRef\.current \?\? undefined/)
  })
})
