/**
 * EL BARRIDO SE CIERRA: LOS CINCO QUE QUEDAN ESTÁN EXPLICADOS — REG-263.
 *
 * ── DE DÓNDE VIENE ──────────────────────────────────────────────────────────
 *
 * El instrumento de REG-255 encontró **50** funciones de motores clínicos sin
 * ningún uso. En siete versiones se cerraron once de verdad —la bandeja de
 * alertas, CAM-ICU, tres motores POCUS, el oxígeno sin declarar, la omisión de
 * alertas críticas, los ingresos hospitalarios, los dos resúmenes— y el número
 * bajó a **39**.
 *
 * De esos 39, **34 son envoltorios** de ≤3 líneas sobre algo que sí corre
 * (REG-260): no son defectos. Quedan **cinco con cuerpo real**.
 *
 * ── Y NINGUNO DE LOS CINCO ES UN DEFECTO ────────────────────────────────────
 *
 * Verificado uno a uno, leyendo el código:
 *
 * | Símbolo | Por qué no tiene llamador |
 * |---|---|
 * | `validarCorreccion` | **Bloqueado en el dueño.** Exige una política como parámetro obligatorio y `POLITICA_CORRECCION` nace en `null` a propósito |
 * | `coherenteConElTipo` | Su comentario dice «se exporta para que un caso del golden la ejecute», y el golden la ejecuta |
 * | `invariantesProtegidos` | Deriva el conjunto protegido para la compuerta clínica; su consumidor es esa compuerta |
 * | `correrBenchmark` | Arranque de un banco de pruebas que se corre a mano y se paga |
 * | `obtenerVersion` | **Redundante**: `listarVersiones` ya devuelve las versiones ENTERAS, así que restaurar no necesita una segunda lectura |
 *
 * ── POR QUÉ ESTA PRUEBA EXISTE ──────────────────────────────────────────────
 *
 * Porque dentro de tres meses alguien —yo incluido— va a mirar la lista, ver
 * cinco nombres y «arreglarlos». Conectar `obtenerVersion` añadiría una lectura
 * de Firestore para traer lo que ya está en memoria. Conectar
 * `validarCorreccion` exigiría inventarse la política.
 *
 * **Un residuo explicado no es deuda: es una decisión.** Lo que esta prueba
 * impide es que se vuelva a litigar sin leer.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const RAIZ = process.cwd()
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8')

const medir = () => JSON.parse(execSync(
  'node scripts/calidad/motores-conectados.mjs --json',
  { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
)) as { huerfanas: string[]; envoltorios: string[]; conCuerpo: string[] }

/** Los cinco, con la razón por la que NO se conectan. */
const EXPLICADOS: Record<string, RegExp> = {
  'src/lib/hospital/eventos.ts::validarCorreccion': /Bloqueado en el dueño/,
  'src/lib/hospital/estados-cama.ts::coherenteConElTipo': /golden/i,
  'src/lib/clinical/safety-gate.ts::invariantesProtegidos': /compuerta clínica/,
  'src/lib/uci/benchmark.ts::correrBenchmark': /se corre a mano/,
  'src/lib/expediente/versioning.ts::obtenerVersion': /Redundante/,
}

describe('el residuo está explicado, uno a uno', () => {
  const m = medir()

  it('no queda ningún motor con cuerpo real sin explicación', () => {
    const sinExplicar = m.conCuerpo.filter(x => !(x in EXPLICADOS))
    expect(
      sinExplicar,
      'apareció un motor con cuerpo real que nadie ha mirado:\n  ' + sinExplicar.join('\n  '),
    ).toEqual([])
  })

  it('y ninguna explicación sobra: si se conecta, se quita de aquí', () => {
    /**
     * Una lista de excusas que sobrevive a lo que explicaba es la forma más
     * silenciosa de que un guardián deje de guardar.
     */
    const sobran = Object.keys(EXPLICADOS).filter(x => !m.conCuerpo.includes(x))
    expect(sobran, 'explicaciones de motores que YA se conectaron: ' + sobran.join(', ')).toEqual([])
  })

  it('cada explicación está escrita donde se lee, no sólo aquí', () => {
    const doc = leer('docs', 'quality', 'MOTORES-SIN-CONECTAR.md')
    for (const [simbolo, razon] of Object.entries(EXPLICADOS)) {
      const nombre = simbolo.split('::')[1]
      expect(doc, `${nombre} no está en el documento`).toContain(nombre)
      expect(doc, `${nombre} está sin su razón`).toMatch(razon)
    }
  })
}, 300_000)

describe('las razones son verificables en el código, no de palabra', () => {
  it('`validarCorreccion` exige la política y la constante sigue en null', () => {
    const ev = leer('src', 'lib', 'hospital', 'eventos.ts')
    expect(ev).toMatch(/politica: PoliticaCorreccion,/)
    expect(ev).toMatch(/export const POLITICA_CORRECCION: PoliticaCorreccion \| null = null/)
  })

  it('`coherenteConElTipo` la ejecuta de verdad el golden', () => {
    const golden = leer('src', '__tests__', 'hospital-estados-cama.test.ts')
    expect(golden).toMatch(/expect\(coherenteConElTipo\(\)\)\.toBe\(true\)/)
  })

  it('`obtenerVersion` es redundante: listarVersiones ya trae la nota entera', () => {
    /**
     * `NotaVersion` es la nota completa. El historial ya la lleva en memoria,
     * así que restaurar no necesita una segunda lectura de Firestore.
     */
    const v = leer('src', 'lib', 'expediente', 'versioning.ts')
    expect(v).toMatch(/export type NotaVersion = Omit<NotaMedica, 'id'>/)
    const comp = leer('src', 'components', 'HistorialVersiones.tsx')
    expect(comp).toContain('listarVersiones')
    expect(comp).not.toContain('obtenerVersion')
  })
})

describe('el trabajo hecho no se deshace', () => {
  it('el trinquete sigue por debajo de donde empezó', () => {
    /** Empezó en 50. Once motores conectados de verdad. */
    const m = medir()
    expect(m.huerfanas.length).toBeLessThanOrEqual(39)
  })

  it('y los envoltorios siguen siendo la mayoría', () => {
    /**
     * Si esta proporción se invirtiera, querría decir que están naciendo
     * motores nuevos sin conectar — y eso sí sería deuda.
     */
    const m = medir()
    expect(m.envoltorios.length).toBeGreaterThan(m.conCuerpo.length * 3)
  })
}, 300_000)
