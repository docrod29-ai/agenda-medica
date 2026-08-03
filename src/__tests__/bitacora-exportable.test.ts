/**
 * GOLDEN — la bitácora de accesos se puede entregar, no sólo mirar.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * El panel de Cumplimiento pinta la bitácora y cita **NOM-024 Art. 6.5** en el
 * título de la sección. Pero **no se podía sacar de ahí**: ni un `Blob`, ni un
 * `download`. Y lo que se ve son los **200 asientos más recientes** —500 si se
 * filtra por paciente—.
 *
 * Ante una auditoría, una queja ante el INAI o un litigio, lo que se pide es el
 * rastro **del periodo**, no lo que quepa en una pantalla. **Un registro que
 * sólo se puede mirar no es un registro entregable.**
 *
 * ── Y EL DETALLE QUE ARRUINA UN CSV EN SILENCIO ──────────────────────────────
 *
 * Un campo con una coma, unas comillas o un salto de línea **desplaza todas las
 * columnas siguientes** — y el archivo se abre igual, sin error, con los datos
 * corridos. `meta` es texto libre puesto por veinte sitios distintos, así que
 * pasa.
 *
 * Un CSV mal escapado es peor que no exportar: se entrega, se abre, y quien lo
 * lee cree que está leyendo el rastro.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  campo, fila, cabecera, csvDeBitacora, COLUMNAS, POR_QUE_NO_BASTA_ENTRECOMILLAR,
} from '@/lib/expediente/bitacora-csv'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'cumplimiento', 'bitacora', 'route.ts')
const panel = leer('src', 'app', '(dashboard)', 'cumplimiento', 'page.tsx')

describe('el escapado, que es donde un CSV muere en silencio', () => {
  it('una coma no desplaza las columnas', () => {
    expect(campo('uno, dos')).toBe('"uno, dos"')
  })

  it('las comillas se duplican, como manda RFC 4180', () => {
    expect(campo('dijo "hola"')).toBe('"dijo ""hola"""')
  })

  it('un salto de línea no parte la fila', () => {
    expect(campo('linea1\nlinea2')).toBe('"linea1\nlinea2"')
  })

  it('`meta` viaja como JSON, no aplanado a [object Object]', () => {
    const f = fila({ meta: { accion: 'x', n: 2 } })
    expect(f).toContain('""accion"":""x""')
    expect(f).not.toContain('[object Object]')
  })
})

describe('la inyección de fórmulas, que es PEOR y que entrecomillar no arregla', () => {
  /**
   * Excel y Sheets **ejecutan** una celda que empieza por `= + - @`. Ese texto
   * puede venir del nombre de un paciente o de una nota, y quien ejecuta la
   * fórmula al abrir el archivo es **el propio médico**, o el auditor.
   *
   * La primera versión de este módulo (v949, mía) entrecomillaba todo y se creía
   * a salvo. El repositorio ya tenía la defensa correcta desde antes
   * —`lib/csv-seguro.ts`, apóstrofo delante según OWASP— y no la estaba usando.
   *
   * Escribir la mitad de una defensa es peor que no escribirla: se da por
   * resuelto lo que sigue abierto.
   */
  it('una celda que empieza por `=` se neutraliza', () => {
    expect(campo('=1+1').startsWith("'")).toBe(true)
    expect(campo('=HYPERLINK("http://x","clic")')).toContain("'=")
  })

  it('y también `+`, `-` y `@`', () => {
    for (const c of ['+1', '-1', '@SUM(A1)']) {
      expect(campo(c).startsWith("'"), c).toBe(true)
    }
  })

  it('llega hasta `meta`, que es por donde entraría', () => {
    // `meta` es texto libre puesto por veinte sitios distintos.
    expect(fila({ meta: '=cmd|calc' })).toContain("'=cmd|calc")
  })

  it('lo inofensivo NO se toca', () => {
    // Ensuciar cada celda haría el archivo ilegible sin ganar nada.
    expect(campo('simple')).toBe('simple')
    expect(campo(42)).toBe('42')
    expect(campo(null)).toBe('')
    expect(campo(undefined)).toBe('')
  })

  it('está escrito por qué entrecomillar no bastaba', () => {
    expect(POR_QUE_NO_BASTA_ENTRECOMILLAR).toMatch(/Excel ejecuta igual/i)
    expect(POR_QUE_NO_BASTA_ENTRECOMILLAR).toMatch(/mitad de una defensa/i)
  })
})

describe('el CSV que lee un auditor', () => {
  it('las columnas van en el orden en que se leen: cuándo, qué, quién', () => {
    expect(COLUMNAS.slice(0, 5)).toEqual(
      ['fecha_hora', 'evento', 'evento_legible', 'medico_email', 'medico_uid'])
  })

  it('la etiqueta legible va AL LADO del código, no en su lugar', () => {
    /**
     * El auditor lee la etiqueta; quien revise el sistema necesita el código
     * exacto. Sustituir uno por otro obliga a elegir a quién dejar fuera.
     */
    const partes = fila({ evento: 'export_datos' }).split(',')
    expect(partes[1]).toBe('export_datos')
    expect(partes[2]).not.toBe('')
    expect(partes[2]).not.toBe('export_datos')
  })

  it('un evento desconocido no revienta ni queda en blanco', () => {
    // La bitácora es vieja: puede traer eventos de versiones anteriores.
    const partes = fila({ evento: 'evento_de_otra_epoca' }).split(',')
    expect(partes[1]).toBe('evento_de_otra_epoca')
    expect(partes[2]).toBe('evento_de_otra_epoca')
  })

  it('el archivo trae cabecera y una línea por asiento', () => {
    const csv = csvDeBitacora([{ evento: 'a' }, { evento: 'b' }])
    expect(csv.split('\n')[0]).toBe(cabecera())
    expect(csv.trim().split('\n').length).toBe(3)
  })
})

describe('la ruta: periodo declarado y del servidor', () => {
  it('exige un periodo, y explica por qué', () => {
    /**
     * Una bitácora sin periodo declarado no se puede presentar como prueba de
     * nada: no se sabe de cuándo a cuándo dice lo que dice.
     */
    expect(ruta).toContain('Hacen falta `desde` y `hasta`')
    expect(ruta).toContain('no se puede presentar como prueba de nada')
  })

  it('rechaza un periodo al revés', () => {
    expect(ruta).toContain('if (desde > hasta)')
  })

  it('el día final entra ENTERO', () => {
    /**
     * `<= '2026-08-03'` dejaría fuera todo lo de ese día salvo la medianoche
     * exacta: el error silencioso de siempre en los rangos sobre marcas ISO.
     */
    expect(ruta).toContain('`${hasta}￿`')
  })

  it('va bajo `administrar`: dice quién vio el expediente de quién', () => {
    expect(ruta).toContain("verificarCapacidad(req, clinicId, 'administrar')")
  })

  it('devuelve un flujo, no el periodo entero en memoria', () => {
    expect(ruta).toContain('new ReadableStream')
    expect(ruta).toContain('text/csv')
  })

  it('el filtro por paciente va en memoria, y a propósito', () => {
    // Combinarlo con el rango exigiría un índice compuesto creado a mano, y
    // mientras no exista la consulta falla ENTERA y no se entrega nada.
    expect(ruta).toContain('índice compuesto')
  })
})

describe('el archivo declara su alcance', () => {
  it('la última fila dice el periodo y cuántos asientos trae', () => {
    // Sin ella, un CSV cortado se ve igual que uno completo. Y «esto es todo lo
    // que hubo» es justo la afirmación que no se puede hacer a la ligera.
    expect(ruta).toContain('"_RESUMEN"')
    expect(ruta).toContain('Periodo ${desde} a ${hasta}')
  })

  it('y GRITA si se alcanzó el tope', () => {
    expect(ruta).toContain('SE ALCANZÓ EL TOPE DE ${TOPE}')
    expect(ruta).toContain('HAY MÁS QUE NO VIENEN EN ESTE ARCHIVO')
  })

  it('una lectura interrumpida se declara DENTRO del archivo', () => {
    // Quien lo abra tiene que enterarse aunque no vea la consola.
    expect(ruta).toContain('ERROR_DE_LECTURA')
    expect(ruta).toContain('NO es el rastro completo del periodo')
  })

  it('y queda asiento de que alguien se llevó la bitácora', () => {
    expect(ruta).toContain("accion: 'bitacora_csv'")
  })
})

describe('el panel lo ofrece', () => {
  it('hay botón de descarga junto a los filtros', () => {
    expect(panel).toContain('Descargar periodo (CSV)')
    expect(panel).toContain('/api/cumplimiento/bitacora?')
  })

  it('respeta el filtro de paciente que esté puesto', () => {
    // «¿Quién entró al expediente de este paciente?» es LA pregunta de la
    // trazabilidad: la descarga tiene que poder contestarla.
    expect(panel).toContain("if (pacienteFiltro) q.set('patientId', pacienteFiltro)")
  })

  it('y dice que la última fila trae el alcance', () => {
    expect(panel).toContain('La última fila dice el periodo')
  })
})
