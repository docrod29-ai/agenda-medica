/**
 * EL CAMINO DEL MÉDICO LLEGA ENTERO.
 *
 * ── DE DÓNDE SALE ESTA PRUEBA ────────────────────────────────────────────────
 *
 * La familia de defecto más grande del ledger —**9 de 56**— es «escrito, probado
 * y sin conectar»: el módulo existe, sus pruebas pasan, y **no corre en el
 * camino que el médico recorre**. El motor de sobredosis corriendo después de
 * firmar, «Quitar de la nota» tocando un metadato, los motores recibiendo la
 * receta de hoy en vez del paciente entero.
 *
 * Todos esos tenían prueba unitaria en verde.
 *
 * ── LO QUE ESTA PRUEBA AÑADE A LAS QUE YA HAY ────────────────────────────────
 *
 * `modulos-sin-conectar.test.ts` caza el caso extremo: el módulo que **nadie**
 * importa. Pero un módulo puede estar importado por otro que tampoco corre —una
 * isla de dos— y pasar en verde.
 *
 * Ésta parte de `src/app/` y sigue los imports hasta donde lleguen. Para cada
 * paso del camino clínico pregunta lo único que importa: **¿se llega hasta
 * aquí?**
 *
 * No prueba que el módulo funcione —para eso están sus propias pruebas— ni que
 * corra en el momento correcto: REG-190 y REG-173 eran motores alcanzables que
 * llegaban tarde. Prueba que **el cable existe**, que es la condición previa a
 * todo lo demás y la que se rompía nueve veces.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { alcanzableDesdeLaApp } from '@/lib/arquitectura/grafo-de-dependencias'

const RAIZ = process.cwd()
const DOC = join(RAIZ, 'docs/product/EL-CAMINO-DEL-MEDICO.md')

/**
 * Los pasos del camino, del paciente entrando a la nota firmada.
 *
 * Cada uno nombra los módulos que lo sirven. La lista no es exhaustiva —el
 * camino toca decenas de módulos— sino **la columna vertebral**: lo que si se
 * desconecta deja al médico sin la parte del producto por la que paga.
 */
const EL_CAMINO: ReadonlyArray<{ paso: string; hace: string; modulos: readonly string[] }> = [
  {
    paso: '1 · Escuchar',
    hace: 'El médico habla y el paciente contesta; el audio se transcribe y se separa por hablante.',
    modulos: [
      'src/lib/expediente/confianza-audio.ts',
      'src/lib/expediente/motivo-sin-diarizacion.ts',
      'src/lib/asr/especialidad-del-medico.ts',
    ],
  },
  {
    paso: '2 · Entender lo dicho',
    hace: 'Distinguir lo que se niega de lo que se afirma, y lo que pasó de lo que pasa hoy.',
    modulos: [
      'src/lib/expediente/negaciones.ts',
      'src/lib/expediente/temporalidad.ts',
      'src/lib/expediente/hueco-textual.ts',
    ],
  },
  {
    paso: '3 · Extraer sin inventar',
    hace: 'Convertir la conversación en datos, dejando vacío lo que nadie dijo.',
    modulos: [
      'src/lib/expediente/medical-ner.ts',
      'src/lib/expediente/procedencia.ts',
      'src/lib/expediente/via-asumida.ts',
    ],
  },
  {
    paso: '4 · Ver al paciente entero',
    hace: 'Los motores reciben el cuadro completo, no sólo lo de hoy (REG-188).',
    modulos: ['src/lib/expediente/cuadro-completo.ts', 'src/lib/expediente/problemas-activos.ts'],
  },
  {
    paso: '5 · Avisar antes de firmar',
    hace: 'Una sola barra, tres niveles, y lo que no se pliega no se pliega.',
    modulos: [
      'src/lib/expediente/avisos-consulta.ts',
      'src/lib/seguridad/dosis-de-la-lista.ts',
      'src/components/AntesDeFirmar.tsx',
    ],
  },
  {
    paso: '6 · Poder corregir',
    hace: 'Quitar de la nota tiene que quitar de la nota (REG-198).',
    modulos: ['src/lib/expediente/quitar-de-la-nota.ts', 'src/components/RevisionPanel.tsx'],
  },
  {
    paso: '7 · Firmar, o saber por qué no',
    hace: 'El botón apagado dice su motivo; la firma sella lo firmado.',
    modulos: [
      'src/lib/expediente/por-que-no-se-firma.ts',
      'src/lib/expediente/nom004.ts',
      'src/lib/expediente/integrity.ts',
    ],
  },
]


/**
 * ── EL TRINQUETE: 29 módulos fuera del camino, y no pueden ser 30 ────────────
 *
 * Medido el 6-ago-2026 sobre 500 módulos de `lib/` y `components/`: **471 se
 * alcanzan desde `src/app/`, 29 no.**
 *
 * De esos 29, **26 ya estaban declarados** en `modulos-sin-conectar.test.ts` con
 * su motivo (herramientas de CI, motores esperando dónde enseñarse). Que dos
 * instrumentos independientes converjan en el mismo conjunto es la mejor señal
 * que puede dar una medición.
 *
 * **Los otros tres son lo que este instrumento ve y el otro no**: están
 * importados —así que no son huérfanos— pero **por un módulo que tampoco corre**.
 * Islas de dos. Ninguno es alarmante; los tres son lo que quedaba por ver.
 *
 * El número puede BAJAR. No puede subir sin que alguien lo escriba aquí.
 */
const FUERA_DEL_CAMINO_HOY = 29

const ISLAS_DE_DOS: Readonly<Record<string, string>> = {
  'src/lib/clinica/simulacro.ts': 'simulacro de restauración; lo usa material que tampoco corre en producción',
  'src/lib/compliance/country-profiles.ts': 'lo importa compliance/policy.ts, que ya está declarado huérfano',
  'src/lib/uci/benchmark-metricas.ts': 'lo importa uci/benchmark.ts, que ya está declarado huérfano',
}

describe('el camino del médico llega entero', () => {
  const alcanzables = alcanzableDesdeLaApp()

  it('el lector funciona (si no, todo lo de abajo pasaría por vacío)', () => {
    // Sin esto, un fallo del recorrido daría «nada alcanzable» y las pruebas
    // siguientes fallarían por el motivo equivocado — o peor, un recorrido que
    // devuelve TODO las haría pasar sin probar nada.
    expect(alcanzables.size).toBeGreaterThan(300)
    expect(alcanzables.has('src/lib/expediente/firestore.ts')).toBe(true)
  })

  it('el documento del camino existe', () => {
    expect(existsSync(DOC)).toBe(true)
  })

  it('son siete pasos y ninguno está vacío', () => {
    expect(EL_CAMINO).toHaveLength(7)
    for (const p of EL_CAMINO) {
      expect(p.modulos.length, `${p.paso} sin módulos`).toBeGreaterThan(0)
      expect(p.hace.length, `${p.paso} sin descripción`).toBeGreaterThan(30)
    }
  })

  it.each(EL_CAMINO)('$paso — sus módulos existen', ({ modulos }) => {
    const faltan = modulos.filter(m => !existsSync(join(RAIZ, m)))
    expect(faltan, `renombrados o borrados: ${faltan.join(', ')}`).toEqual([])
  })

  it.each(EL_CAMINO)('$paso — se llega desde la app', ({ paso, modulos }) => {
    /**
     * Si esto se pone rojo, el módulo dejó de estar en el camino. No es un aviso
     * de estilo: es la firma exacta de los nueve defectos más caros del ledger.
     */
    const desconectados = modulos.filter(m => !alcanzables.has(m))
    expect(
      desconectados,
      `${paso}: fuera del camino → ${desconectados.join(', ')}`,
    ).toEqual([])
  })

  it('el documento nombra los siete pasos', () => {
    const t = readFileSync(DOC, 'utf8')
    for (const p of EL_CAMINO) {
      expect(t, `el documento no nombra «${p.paso}»`).toContain(p.paso)
    }
  })

  it('los módulos fuera del camino no aumentan', () => {
    const libs: string[] = []
    const anda = (d: string) => {
      for (const e of readdirSync(join(RAIZ, d))) {
        if (e === '__tests__') continue
        const rel = `${d}/${e}`
        if (statSync(join(RAIZ, rel)).isDirectory()) anda(rel)
        else if (/\.tsx?$/.test(e)) libs.push(rel)
      }
    }
    anda('src/lib')
    anda('src/components')
    const fuera = libs.filter(f => !alcanzables.has(f))

    /**
     * Si esto sube, alguien escribió un módulo que no llega al médico. Puede ser
     * legítimo —una herramienta de CI— pero entonces se declara, no se ignora.
     */
    expect(
      fuera.length,
      `subió a ${fuera.length}. Los nuevos:\n  ${fuera.filter(f => !ISLAS_DE_DOS[f]).slice(0, 12).join('\n  ')}`,
    ).toBeLessThanOrEqual(FUERA_DEL_CAMINO_HOY)
  })

  it('las tres islas de dos siguen siendo las declaradas', () => {
    for (const f of Object.keys(ISLAS_DE_DOS)) {
      expect(existsSync(join(RAIZ, f)), `${f} ya no existe: quítalo de la lista`).toBe(true)
    }
  })

  it('el documento dice qué NO prueba esto', () => {
    // Sin esta advertencia, «el camino llega entero» se lee como «el camino
    // funciona», y son cosas distintas: REG-190 era un motor alcanzable que
    // corría después de firmar.
    const t = readFileSync(DOC, 'utf8')
    expect(t).toContain('que el cable existe')
    expect(t).toContain('llegaban tarde')
  })
})
