/**
 * GOLDEN — REUNIR LO DECLARADO COMO RIESGO SIN INVENTAR EL CATÁLOGO.
 *
 * ── QUÉ SE PEDÍA, Y QUÉ NO SE PODÍA HACER ───────────────────────────────────
 *
 * `WS-10.banderas-y-respuesta` pedía «banderas de riesgo». El censo ya decía por
 * qué llevaba sin construirse: **el catálogo de qué condición cuenta como
 * bandera es política clínica y no está decidido**, y fijarlo aquí está
 * prohibido.
 *
 * Lo que sí se podía era reunir lo que YA está declarado, con su procedencia: no
 * es un criterio nuevo, son juicios que ya hizo una persona.
 *
 * ── LA PATA QUE NO EXISTÍA ──────────────────────────────────────────────────
 *
 * El censo nombraba tres fuentes, y una no se puede llenar:
 *
 *     PatientTag          13 valores declarados en types/index.ts
 *     PATIENT_TAG_CONFIG  su etiqueta y su color, para cada uno
 *     patient.tags        CERO escritores y CERO lectores en el árbol
 *
 * Ninguna pantalla pone una etiqueta y ninguna la enseña. Recogerla habría sido
 * recoger un campo siempre vacío — y eso es PEOR que no recogerla, porque el eje
 * diría «sin banderas» y quien lo leyera entendería «sin riesgo declarado»,
 * cuando la verdad es que una de sus tres fuentes no se puede llenar.
 *
 * ── EL DEFECTO QUE APARECIÓ AL ESCRIBIRLO ───────────────────────────────────
 *
 * La primera versión sacaba la severidad sólo de `peorSeveridadRegistrada`, que
 * mira **los sellos de las notas firmadas**. Una alergia escrita en la consulta
 * de hoy todavía no tiene sello: `registros` viene vacío.
 *
 * O sea: **una anafilaxia apuntada hoy no era bandera hasta que se firmara la
 * nota** — justo cuando más falta hace. Se descubrió al comprobar que la rama
 * «la lista de alergias de hoy» del código era inalcanzable.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Este eje nunca tranquiliza.** Sin banderas no escribe «Sin banderas»:
 * escribe qué miró. Y `LO_QUE_NO_SE_VIGILA` es una exportación, no un
 * comentario, porque tiene que pintarse al lado de la lista: una lista vacía
 * junto a nada se lee como «este paciente no tiene riesgos».
 *
 * Regla 4 de seguridad clínica (ausencia de dato no es dato de ausencia) y
 * regla 5 (el vocabulario es vocabulario, no criterio; lo que falta NO se
 * vigila, y se declara).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO decide qué condición es una bandera. Sigue siendo del médico.
 * · NO conecta las etiquetas del paciente: falta la pantalla que las escriba, y
 *   eso es otra unidad. Aquí se DECLARA que no se miran.
 * · NO cubre «respuesta al tratamiento» ni «compromisos», las otras dos partes
 *   del requisito: el dato de la primera no existe (nada liga un fármaco con el
 *   desenlace del problema que trata) y la segunda choca con el esquema de la
 *   nota, congelado por el sello.
 * · NO puntúa riesgo ni ordena por gravedad clínica.
 * · NO comprueba en navegador que el bloque se vea: eso es la otra frontera.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  banderasDeclaradas, resumenDeBanderas, LO_QUE_NO_SE_VIGILA,
} from '@/lib/expediente/banderas-declaradas'
import type { EstadoDeAlergias } from '@/lib/expediente/alergias-longitudinales'
import type { ProblemaVigente } from '@/lib/expediente/problemas-activos'

const PANTALLA = readFileSync('src/app/(dashboard)/expediente/[patientId]/page.tsx', 'utf8')
const MODULO = readFileSync('src/lib/expediente/banderas-declaradas.ts', 'utf8')

const estado = (alergias: EstadoDeAlergias['alergias'], truncado = false): EstadoDeAlergias => ({
  asOf: '2026-08-30T00:00:00.000Z', version: 1, alergias,
  ausentesDeLaListaDeHoy: [], enConflicto: [], historialIncompleto: truncado,
})
const sellada = (alergeno: string, severidad: string, fecha = '2024-03-12T00:00:00.000Z') => ({
  alergeno, registros: [{ fecha, alergia: { alergeno, severidad } }],
  registro: { alergeno, severidad }, selladaEn: fecha, desde: fecha,
  notasQueLaAfirman: 1, enLaListaDeHoy: true, negadaHoy: false,
}) as unknown as EstadoDeAlergias['alergias'][number]
const soloDeHoy = (alergeno: string) => ({
  alergeno, registros: [], selladaEn: '', desde: '',
  notasQueLaAfirman: 0, enLaListaDeHoy: true, negadaHoy: false,
}) as unknown as EstadoDeAlergias['alergias'][number]
const problema = (descripcion: string, estadoDx: string, dichoEn = '2025-01-08T00:00:00.000Z') =>
  ({ diagnostico: { descripcion, tipo: 'definitivo', estado: estadoDx }, dichoEn }) as unknown as ProblemaVigente

describe('lo que entra, y de dónde dice que sale', () => {
  it('una alergia grave sellada entra, con la nota y la fecha', () => {
    const b = banderasDeclaradas(estado([sellada('Penicilina', 'anafilaxia')]), [])
    expect(b.banderas).toHaveLength(1)
    expect(b.banderas[0]).toMatchObject({
      clase: 'alergia_grave', que: 'Penicilina', detalle: 'anafilaxia',
      desde: '2024-03-12T00:00:00.000Z', deDonde: 'nota firmada del 2024-03-12',
    })
  })

  it('un problema marcado CRÓNICO entra, con la nota que lo dijo', () => {
    const b = banderasDeclaradas(estado([]), [problema('Diabetes mellitus tipo 2', 'cronico')])
    expect(b.banderas[0]).toMatchObject({
      clase: 'problema_cronico', que: 'Diabetes mellitus tipo 2',
      deDonde: 'nota firmada del 2025-01-08',
    })
  })

  it('un problema ACTIVO no crónico no entra: nadie lo declaró bandera', () => {
    /* Aquí no se infiere: que la diabetes SUELA ser crónica no autoriza a decir
       que ÉSTA lo es si el médico no lo escribió. */
    expect(banderasDeclaradas(estado([]), [problema('Diabetes mellitus tipo 2', 'activo')]).banderas)
      .toHaveLength(0)
  })

  it('una alergia leve o sin severidad no entra — y eso NO dice que sea leve', () => {
    expect(banderasDeclaradas(estado([sellada('Polen', 'leve')]), []).banderas).toHaveLength(0)
    expect(banderasDeclaradas(estado([soloDeHoy('Polvo')]), []).banderas).toHaveLength(0)
  })
})

describe('la anafilaxia de HOY, que la primera versión perdía', () => {
  it('una alergia grave escrita hoy es bandera ANTES de firmar la nota', () => {
    /**
     * El defecto que se encontró escribiendo esto: `peorSeveridadRegistrada`
     * sólo mira sellos de notas firmadas, así que lo apuntado en esta consulta
     * no contaba hasta firmar — justo cuando más falta hace.
     */
    const b = banderasDeclaradas(
      estado([soloDeHoy('Penicilina')]), [],
      [{ alergeno: 'Penicilina', severidad: 'anafilaxia' }],
    )
    expect(b.banderas).toHaveLength(1)
    expect(b.banderas[0].desde).toBeNull()
    expect(b.banderas[0].deDonde).toBe('la lista de alergias de hoy')
  })

  it('`desde: null` no se rellena con hoy: no consta cuándo', () => {
    /* Poner la fecha de hoy diría «desde agosto de 2026» de algo que quizá lleva
       veinte años escrito. Inventar una fecha es inventar un dato clínico. */
    const b = banderasDeclaradas(estado([soloDeHoy('Sulfas')]), [],
      [{ alergeno: 'Sulfas', severidad: 'grave' }])
    expect(b.banderas[0].desde).toBeNull()
  })

  it('cuando hay sello Y lista de hoy, manda el sello', () => {
    /* La asimetría de la proyección de alergias: afirmar suma, el silencio no
       resta. Aquí no se cambia. */
    const b = banderasDeclaradas(
      estado([sellada('Penicilina', 'anafilaxia')]), [],
      [{ alergeno: 'Penicilina', severidad: 'grave' }],
    )
    expect(b.banderas[0].detalle).toBe('anafilaxia')
  })
})

describe('una lista vacía NO dice «sin riesgo»', () => {
  it('el resumen dice qué se miró, no que no haya nada', () => {
    const texto = resumenDeBanderas(banderasDeclaradas(estado([]), []))
    expect(texto).toContain('Nadie ha declarado')
    /* La frase que este módulo no puede emitir jamás. */
    expect(texto).not.toMatch(/sin banderas/i)
    expect(texto).not.toMatch(/sin riesgo/i)
    expect(texto).not.toMatch(/^ninguna$/i)
  })

  it('lo que no se vigila se declara, y nombra la pata que no existe', () => {
    expect(LO_QUE_NO_SE_VIGILA.length).toBeGreaterThanOrEqual(4)
    expect(LO_QUE_NO_SE_VIGILA.join(' ')).toContain('PatientTag')
    expect(LO_QUE_NO_SE_VIGILA.join(' ')).toContain('política clínica')
  })

  it('y `patient.tags` sigue sin escritores ni lectores — por eso no se recoge', () => {
    /**
     * Al revés: si algún día alguien conecta las etiquetas, esto se pone en rojo
     * y obliga a decidir si entran al eje. Un campo que empieza a llenarse y no
     * entra sería una bandera declarada que nadie ve.
     */
    /* Por el IMPORT y no por el texto: el módulo NOMBRA `PATIENT_TAG_CONFIG` en
       su cabecera, explicando por qué no lo usa. Buscar la palabra suelta ponía
       en rojo la propia explicación. */
    expect(MODULO).not.toMatch(/^import .*PATIENT_TAG_CONFIG/m)
    expect(MODULO).not.toMatch(/^\s*import .*from '@\/types'/m)
    expect(PANTALLA).not.toMatch(/patient\.tags/)
  })

  it('el historial recortado viaja: «no encontré más» no es «no hay más»', () => {
    expect(banderasDeclaradas(estado([], true), []).historialIncompleto).toBe(true)
  })
})

describe('está conectado, y no añade un cuarto recorrido', () => {
  it('la pantalla lo arma con las proyecciones que YA calculó', () => {
    /* Un recorrido propio del expediente daría, tarde o temprano, un número
       distinto para el mismo paciente. */
    expect(PANTALLA).toContain('banderasDeclaradas(estadoAlergias, problemas,')
    expect(MODULO).not.toContain('estadoDeAlergias(')
    expect(MODULO).not.toContain('problemasActivos(')
  })

  it('la pantalla pinta también lo que el eje NO mira', () => {
    /* Sin esto el bloque tranquilizaría, que es el único modo en que puede hacer
       daño. */
    expect(PANTALLA).toContain('LO_QUE_NO_SE_VIGILA')
    expect(PANTALLA).toContain('resumenDeBanderas(banderas)')
  })
})
