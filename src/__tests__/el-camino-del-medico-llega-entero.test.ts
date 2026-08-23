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

/**
 * ── EL ARNÉS DE RECUPERACIÓN (#312) ──────────────────────────────────────────
 *
 * Módulos que NO se alcanzan desde `src/app/` A PROPÓSITO: son el arnés de
 * simulacro de recuperación y los contratos que documentan lo que todavía no
 * tiene pantalla. Los corre `scripts/recovery/simulacro-recuperacion.mjs` y sus
 * pruebas; su sitio es el CI, igual que el de los demás gates.
 *
 * Se declaran POR NOMBRE en vez de subir `FUERA_DEL_CAMINO_HOY`, y no es un
 * matiz: un número más alto admite cualquier módulo nuevo sin que nadie lo
 * mire, que es justo lo que este trinquete existe para impedir. Con la lista,
 * cada uno cuesta una línea y una razón.
 *
 * Los que SÍ corren en producción no están aquí: `manifiesto`, `huellas`,
 * `aislamiento`, `verdad-firmada`, `idempotencia`, `veredicto`,
 * `reconciliacion`, `integridad-referencial` y `ensayo` los importan
 * `api/clinic/exportar` y `api/clinic/importar`.
 */
const ARNES_DE_RECUPERACION: Readonly<Record<string, string>> = {
  'src/lib/durability/fixtures.ts': 'Consultorio sintético y las dieciséis averías. Un fixture con pantalla sería un fixture que alguien edita para que pase.',
  'src/lib/durability/inventario.ts': 'Inventario de clases de dato con su régimen de restauración. Lo consume el arnés y su guardián: una pantalla no protegería de que una colección nueva se quede sin régimen; lo que protege es que el CI lo cace.',
  'src/lib/durability/crecimiento.ts': 'Proyección de almacenamiento con procedencias OBSERVADO/ESCENARIO/OBJETIVO. Trabajo de operación, no de consulta; su consumidor es el acta del simulacro.',
  'src/lib/durability/rpo-rto.ts': 'Tabla de tramos de recuperación con TARGET/OBSERVED/NOT_MEASURED. Es evidencia de operación; su sitio es el acta.',
  'src/lib/durability/adjuntos.ts': 'Cruce metadato ↔ objeto de Storage. Necesita un listado del bucket, que sólo tiene el arnés; conectarlo a una pantalla exigiría exponer el bucket al navegador.',
  'src/lib/durability/archivado.ts': 'Ciclo de vida del expediente. NO se conecta hasta que el dueño fije el plazo mínimo de conservación (hoy `NEEDS_CLINICAL_REVIEW`): una pantalla que enseñe «elegible para borrado» sin plazo decidido es peor que ninguna.',
  'src/lib/durability/rollback.ts': 'Plan de reversión de una restauración. Sin colección donde persistir los asientos —y toda colección nueva exige publicar reglas, que es del dueño— no hay a qué conectarlo todavía.',
  'src/lib/durability/autosave-contrato.ts': 'Máquina de estados del punto seguro de la consulta. La pantalla es de #306: el traspaso exacto está en `docs/recovery/HANDOFF-306-AUTOGUARDADO.md`.',
}

const ISLAS_DE_DOS: Readonly<Record<string, string>> = {
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

  it('el pipeline de voz diferido sigue EN el camino (p ??= import)', () => {
    /**
     * QUÉ FALLABA — 13-ago-2026, commit 86530a3f (V15-PERF, 4ª rebanada): los
     * dos hooks de dictado difirieron el pipeline con el memoizado canónico
     * `pipelinePromise ??= import('@/lib/asr/pipeline')`. El lector del grafo
     * sólo reconocía `await import(` y `=> import(`, así que declaró fuera del
     * camino a pipeline/normalizacion/siglas (29 → 32) — con el dictado
     * FUNCIONANDO, probado en navegador real. CI en rojo por ceguera del
     * instrumento, no por cable roto.
     *
     * LA CAUSA RAÍZ: quinta ceguera de la misma familia — el lector veía texto
     * donde tenía que ver código (ver DINAMICO_REAL en el propio grafo).
     *
     * LA REGLA QUE LO HACE SEGURO: las asignaciones lógicas (`??=`, `||=`,
     * `&&=`) cuentan como carga real; el `=` a secas no, porque `type X =
     * import('…')` es posición de tipo.
     *
     * Probada al revés: sin la tercera regex de DINAMICO_REAL este caso falla
     * (así se encontró). QUÉ NO CUBRE: que el pipeline corra a TIEMPO — eso lo
     * prueba v15-perf-el-dictado-no-carga-hasta-hablar y el arnés de navegador.
     */
    expect(alcanzables.has('src/lib/asr/pipeline.ts')).toBe(true)
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
    const fuera = libs.filter(f => !alcanzables.has(f) && !ARNES_DE_RECUPERACION[f])

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

  it('el arnés de recuperación existe, se declara y NO se alcanza desde la app', () => {
    /**
     * Las dos mitades. Si un módulo del arnés se vuelve alcanzable, esta lista
     * pasa a mentir y hay que quitarlo de ella — que es lo que pasó con
     * `clinica/simulacro.ts`, hoy alcanzable desde `api/clinic/importar`.
     */
    for (const [f, razon] of Object.entries(ARNES_DE_RECUPERACION)) {
      expect(existsSync(join(RAIZ, f)), `${f} ya no existe: quítalo de la lista`).toBe(true)
      expect(razon.length, `${f} no dice por qué`).toBeGreaterThan(40)
      expect(alcanzables.has(f), `${f} YA se alcanza desde src/app: quítalo de ARNES_DE_RECUPERACION`).toBe(false)
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
