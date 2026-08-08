/**
 * LOS MOTORES LLEGAN AL MÉDICO — REG-255.
 *
 * ── POR QUÉ HACÍA FALTA UN INSTRUMENTO ──────────────────────────────────────
 *
 * La familia de defectos más grande de este repositorio, con diferencia, es
 * **«escrito, probado y sin conectar»**: 21 de 102 REG. El módulo existe, tiene
 * pruebas, está bien, y **no corre** donde el médico pasa.
 *
 * Los veintiuno se encontraron **de uno en uno, por casualidad**: leyendo otra
 * cosa, o porque un equipo rojo tropezó con ello.
 *
 *   · `diasDeDuracion()` sabía que «14 editas» no era una duración (REG-238)
 *   · `rastrearNota()` tenía corpus oro y la pantalla usaba media función (239)
 *   · `tareaDeResultado()` no la llamaba nadie: el bucle de laboratorio **nunca
 *     empezaba** (REG-252)
 *
 * Encontrarlos por suerte no escala. Esto los cuenta.
 *
 * ── CÓMO ME EQUIVOQUÉ AL PRIMER INTENTO ─────────────────────────────────────
 *
 * La primera versión del medidor preguntaba «¿lo usa algún archivo que no sea el
 * suyo?». Dio **152 huérfanas de 771** — y la primera que fui a reparar, por
 * parecer la más peligrosa, era **falsa**:
 *
 *     crossResistenciaFQ   (EUCAST T13, cross-resistencia de fluoroquinolonas)
 *
 * La llama `analizarSeguridad`, en el mismo archivo, y ésa sí la llama el motor.
 * Era un ayudante interno, no un motor desconectado.
 *
 * **Un medidor que grita 152 cuando hay 50 enseña a ignorarlo** — que es el
 * mismo fallo que se repara en los avisos clínicos. Y casi me hace «reparar»
 * algo que funcionaba, en el módulo de antibiogramas, que es el que más le
 * importa al médico dueño.
 *
 * ── LO QUE ESTE GUARDIÁN HACE, Y LO QUE NO ──────────────────────────────────
 *
 * **No exige cero.** Un símbolo sin llamadores puede ser API legítima. Lo que
 * hace es congelar la cuenta: **sólo puede bajar**. Un motor clínico nuevo que
 * nazca sin conectar pone esto en rojo el mismo día, en vez de esperar a que
 * alguien tropiece con él dentro de seis meses.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const RAIZ = process.cwd()

function medir(): { total: number; huerfanas: string[]; inalcanzables: string[] } {
  const out = execSync('node scripts/calidad/motores-conectados.mjs --json', {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  })
  return JSON.parse(out)
}

/**
 * Lo medido el 8-ago-2026. **Sólo puede bajar.**
 *
 * No es una meta de cero: es el tope de hoy. Cada iteración del loop puede
 * quitar una o dos, y ninguna puede añadir.
 */
const TOPE = { huerfanasMax: 44, totalMin: 771 }
/* 50 → 48 → 44 el 8-ago-2026:
     · REG-256, la bandeja de alertas del episodio (2)
     · REG-257, CAM-ICU y tres motores POCUS del panel de UCI (4)
   Cada iteración del loop cierra una o dos y baja este número. */

describe('el trinquete de conexión', () => {
  const m = medir()

  it('no aparecen motores clínicos nuevos sin conectar', () => {
    expect(
      m.huerfanas.length,
      `Subió de ${TOPE.huerfanasMax} a ${m.huerfanas.length}. Las nuevas son motores ` +
      `escritos que NO corren en el camino del médico:\n  ` +
      m.huerfanas.slice(0, 10).join('\n  '),
    ).toBeLessThanOrEqual(TOPE.huerfanasMax)
  })

  it('el barrido no encoge sin avisar', () => {
    /**
     * Si el total baja, el tope se vuelve más fácil sin que nada mejore — la
     * forma más limpia de pasar un trinquete sin tocar el producto.
     */
    expect(m.total, 'el barrido cubre menos que antes').toBeGreaterThanOrEqual(TOPE.totalMin)
  })
}, 300_000)

describe('el instrumento no repite el error que ya cometió', () => {
  const s = readFileSync(join(RAIZ, 'scripts/calidad/motores-conectados.mjs'), 'utf8')

  it('cuenta el uso DENTRO del propio archivo', () => {
    /**
     * Éste es el arreglo del falso positivo: `crossResistenciaFQ` la llama su
     * vecina de archivo, y la primera versión no lo veía.
     */
    expect(s).toMatch(/const enElSuyo = \(texto\.match\(re\) \?\? \[\]\)\.length > 1/)
  })

  it('y queda escrito el caso que lo destapó', () => {
    /**
     * Sin el nombre concreto, el próximo que lea esto no sabrá por qué el
     * medidor es más complicado de lo que parece necesario.
     */
    expect(s).toMatch(/crossResistenciaFQ/)
    expect(s).toMatch(/Un medidor que grita 152 cuando hay muchas menos/)
  })

  it('sigue la cadena de importaciones desde las pantallas', () => {
    /** Un módulo que ninguna pantalla alcanza no corre, por muy usado que esté. */
    expect(s).toMatch(/const alcanzables = new Set\(\)/)
    expect(s.replace(/\n/g, ' ')).toMatch(/src\/app\/.*src\/components\/.*src\/hooks\//)
  })

  it('sólo mira dominios clínicos, para que la señal no se ahogue', () => {
    /** En un `utils` genérico un símbolo sin llamadores es normal. */
    expect(s).toMatch(/const DOMINIOS = \[/)
    expect(s).toMatch(/'src\/lib\/seguridad'/)
    expect(s).not.toMatch(/'src\/lib\/utils'/)
  })
})

describe('lo que el instrumento encontró y hay que ir cerrando', () => {
  it('la lista vive en un sitio que se puede leer', () => {
    expect(existsSync(join(RAIZ, 'docs/quality/MOTORES-SIN-CONECTAR.md'))).toBe(true)
  })

  it('el documento distingue código muerto de probado-y-sin-conectar', () => {
    /**
     * No es lo mismo. `verificarIntegridad` no tiene ni prueba; `sePuedeFirmar`
     * sí la tiene y aun así no corre — ése es el defecto caro, porque el verde
     * de su prueba hace creer que está en marcha.
     */
    const doc = readFileSync(join(RAIZ, 'docs/quality/MOTORES-SIN-CONECTAR.md'), 'utf8')
    expect(doc).toMatch(/probad[ao]s? y sin conectar/i)
    expect(doc).toMatch(/sePuedeFirmar/)
    expect(doc).toMatch(/verificarIntegridad/)
  })
})
