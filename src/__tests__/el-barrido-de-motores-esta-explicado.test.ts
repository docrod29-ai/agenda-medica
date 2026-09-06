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
 * | `validarCorreccion` | **Decidida y sin cablear.** La política la decidió el dueño el 4-sep-2026 (D-026); lo que falta es el caso `corregir` en `api/hospital/mutar` y la pantalla |
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
  'src/lib/hospital/eventos.ts::validarCorreccion': /Decidida y sin cablear/,
  /**
   * ── LOS DOS QUE APARECIERON AL ARREGLAR EL INSTRUMENTO (4-sep-2026) ───────
   *
   * Hasta ese día el script contaba las apariciones del símbolo sobre el texto
   * CRUDO, así que **nombrarlo en un comentario lo daba por conectado**. Estos
   * dos llevaban tapados por eso. No son motores nuevos: son motores que el
   * barrido no podía ver.
   *
   * Se miraron, y los DOS resultaron ser lo mismo: una función huérfana cuyo
   * COMENTARIO afirmaba un uso que no existe. En los dos casos el trabajo que
   * prometían ya lo hace otra ruta —`nom004.ts` alerta por alerta,
   * `RevisionPanel.tsx` campo por campo—, así que no hay hueco de seguridad.
   *
   * Se declararon primero como «huecos reales» y era falso. Corregido el mismo
   * día tras ir a mirar. Queda escrito porque el error iba en la dirección cara:
   * asustar sobre una compuerta que sí funciona.
   */
  /**
   * ── EL QUE APARECIÓ AL FUSIONAR LAS DOS RAMAS (6-sep-2026) ────────────────
   *
   * `claseSegura` viene de la rama de laboratorio y es un hueco REAL, no un
   * falso positivo del instrumento: la clase 4 de las cinco del §2 de la regla
   * de IA de cara al paciente —`ESCALATE_TO_CLINICIAN`— está escrita, probada y
   * sin un solo llamador. El webhook de WhatsApp usa las reglas nombradas del §3
   * y NO baja a este suelo, cosa que dice en su propio comentario.
   *
   * No se cableó de paso a propósito: decidir qué le pasa a una pregunta de
   * paciente que el sistema no entiende es política clínica del dueño, y la
   * regla 6 de seguridad clínica dice que ante la duda se pregunta.
   */
  'src/lib/paciente/hay-que-escalar.ts::claseSegura': /HUECO REAL Y ABIERTO/,
  'src/lib/seguridad/clasificacion.ts::masGrave': /comentario afirmaba un uso que no existe/,
  'src/lib/expediente/extraction-schema.ts::camposQueRequierenRevision': /comentario prometía un consumidor que no llegó/,
  'src/lib/hospital/estados-cama.ts::coherenteConElTipo': /golden/i,
  'src/lib/clinical/safety-gate.ts::invariantesProtegidos': /compuerta clínica/,
  'src/lib/uci/benchmark.ts::correrBenchmark': /se corre a mano/,
  'src/lib/expediente/versioning.ts::obtenerVersion': /Redundante/,
  /*
   * `leerConsulta` SE FUE DE AQUÍ el 5-sep-2026, y no porque se conectara.
   *
   * La explicación decía la verdad —evalúa contra un gold, y en una consulta
   * real no hay gold— pero estaba en la lista equivocada: el barrido lo daba
   * por «sin ningún uso» y era falso. Lo llama
   * `scripts/medir-wer-limpio.ts:131`. El universo de llamadores no incluía
   * `scripts/` (REG-512).
   *
   * Ahora sale en el cubo «sólo lo llama una herramienta», que es lo que es. Su
   * razón no se pierde: vive en `los-motores-llegan-al-medico.test.ts`, en el
   * caso que vigila que no vuelva a declararse muerto.
   */
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
  it('`validarCorreccion` exige la política, y la política YA está decidida', () => {
    /**
     * Hasta el 4-sep-2026 este caso exigía que la constante siguiera en `null`,
     * y tenía razón: inventar quién puede corregir un registro clínico habría
     * sido enterrar política NOM-004 en una constante.
     *
     * El dueño la decidió (D-026), así que lo que se vigila cambia: que el
     * motor siga EXIGIENDO la política —no vaya a aparecer un default— y que la
     * constante esté rellena. Lo que falta ahora tiene otro nombre y lo vigila
     * el caso siguiente.
     */
    const ev = leer('src', 'lib', 'hospital', 'eventos.ts')
    expect(ev).toMatch(/politica: PoliticaCorreccion,/)
    expect(ev).not.toMatch(/export const POLITICA_CORRECCION: PoliticaCorreccion \| null = null/)
    expect(ev).toMatch(/ventanaHoras: 24/)
  })

  it('y el hueco que QUEDA se llama por su nombre: no tiene llamador', () => {
    /**
     * El riesgo de rellenar la constante es que alguien lea el archivo y crea
     * que corregir ya funciona. `SIN_CABLEAR_CORRECCION` existe para que el
     * repositorio lo diga en voz alta, y este caso para que no se borre.
     */
    const ev = leer('src', 'lib', 'hospital', 'eventos.ts')
    expect(ev).toMatch(/SIN_CABLEAR_CORRECCION/)
    expect(ev, 'el hueco tiene que nombrar QUÉ falta, no sólo que falta')
      .toMatch(/api\/hospital\/mutar/)
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
    /* 39 → 46 el 4-sep-2026. No creció la deuda: se arregló el instrumento,
       que contaba sobre el texto CRUDO y daba por conectado cualquier motor
       nombrado en un comentario. Siete estaban tapados así. La razón larga, con
       cómo se descubrió, está en `los-motores-llegan-al-medico.test.ts`. */
    expect(m.huerfanas.length).toBeLessThanOrEqual(46)
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
