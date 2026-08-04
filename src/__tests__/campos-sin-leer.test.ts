/**
 * GUARDIÁN — un CAMPO que nadie lee es un módulo huérfano en miniatura.
 *
 * ── DE DÓNDE SALE, CON LOS CASOS QUE LO PIDIERON ─────────────────────────────
 *
 * `modulos-sin-conectar.test.ts` vigila archivos que nadie importa, y funciona.
 * Pero en una sola sesión aparecieron **seis** fallos de la misma familia que
 * ese guardián no puede ver, porque el módulo sí estaba importado: lo que no se
 * leía era **un campo del contrato**.
 *
 *   · `ResultadoPipeline.cambiosNormalizacion` y `.cambiosSiglas` (v1000) — se
 *     calculaban en cada dictado y no salían del pipeline: el médico veía las
 *     correcciones de fármacos y **no las de dosis**.
 *   · `ContextoDictado.especialidades` (v999) — declarado, viajando por cuatro
 *     capas, y ninguna pantalla lo llenaba.
 *   · Los `utterances` de la semilla de UCI (v997) — llegaban a la consulta y se
 *     tiraban; con ellos se apagaban la separación de voces, las palabras a
 *     verificar y la procedencia V3.
 *   · `rolesHablante` (v998) — se usaba al firmar y se tiraba al archivar.
 *   · `ResultadoPipeline.crudo` (v996) — se producía y se descartaba en la misma
 *     línea en que se aplicaba.
 *
 * Ninguno rompía nada. Los tests pasaban, el build pasaba, y el trabajo no le
 * llegaba al médico.
 *
 * ── POR QUÉ ES UN TRINQUETE ──────────────────────────────────────────────────
 *
 * Igual que los demás de este repositorio: los que hoy no se leen se **congelan
 * con su razón**. Uno nuevo pone el CI en rojo; quitar uno obliga a bajar la
 * lista. La deuda queda declarada, no escondida.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  camposDe, camposSinConectar, POR_QUE_SOLO_CONTRATOS, POR_QUE_EL_VEREDICTO_ES_PRUDENTE,
  type Contrato,
} from '@/lib/guardia/campos-conectados'

const RAIZ = process.cwd()

/**
 * Los contratos vigilados: los que cruzan una frontera.
 *
 * Se añaden a mano y a conciencia. Vigilar todas las interfaces daría cientos de
 * falsos positivos, y un guardián ruidoso se apaga.
 */
const CONTRATOS: Contrato[] = [
  {
    archivo: 'src/lib/asr/pipeline.ts', interfaz: 'ResultadoPipeline', direccion: 'salida',
    porQue: 'Es la salida del pipeline de voz. Un campo que no sale de aquí es trabajo que el médico no ve — pasó con las cifras y las siglas.',
  },
  {
    archivo: 'src/lib/asr/lexicon.ts', interfaz: 'ContextoDictado', direccion: 'entrada',
    porQue: 'Es lo que decide qué vocabulario OYE el motor. Un campo que nadie llena es sesgo que no se aplica.',
  },
  {
    archivo: 'src/lib/asr/lexicon.ts', interfaz: 'Lexicon', direccion: 'salida',
    porQue: 'Lo que se le manda al reconocedor, con lo que se descartó. Un descarte que nadie mira se lee como «cupó todo».',
  },
  {
    archivo: 'src/lib/expediente/procedencia.ts', interfaz: 'CampoProcedencia', direccion: 'salida',
    porQue: 'El sello de dónde salió cada dato. Un campo que no se lee es una garantía que no se enseña.',
  },
  {
    archivo: 'src/lib/finanzas/mrr.ts', interfaz: 'DesgloseMRR', direccion: 'salida',
    porQue: 'El ingreso recurrente y su desglose. Una cifra que no llega al tablero es una decisión de precio tomada a ciegas.',
  },
  {
    archivo: 'src/lib/ia/segmentar-revision.ts', interfaz: 'Segmentacion', direccion: 'salida',
    porQue: 'Cuánto de la consulta se revisó de verdad. Lo que no se lee aquí se presenta como una revisión completa.',
  },
  /**
   * Los que se pudieron añadir al afinar la regla (v1018). Con la versión
   * anterior daban falso positivo y habrían apagado el guardián.
   */
  {
    archivo: 'src/lib/expediente/negaciones.ts', interfaz: 'Contradiccion', direccion: 'salida',
    porQue: 'Lo que el paciente negó frente a lo que la nota afirma. Un campo que no se lee aquí es media contradicción, que no se puede resolver sin volver al audio.',
  },
  {
    archivo: 'src/lib/asr/intencion-de-orden.ts', interfaz: 'MencionFarmaco', direccion: 'salida',
    porQue: 'El encuadre con el que se dijo un fármaco. De aquí sale si va a la receta o sólo al plan.',
  },
  {
    archivo: 'src/lib/ia/revalidar-citas.ts', interfaz: 'ResultadoRevalidacion', direccion: 'salida',
    porQue: 'Qué pasó con las citas al fusionar. Lo que no se lee no se puede decir, y una corrección silenciosa se ve igual que un acierto.',
  },
  {
    archivo: 'src/lib/expediente/confianza-audio.ts', interfaz: 'PalabraOida', direccion: 'salida',
    porQue: 'La confianza por palabra: lo único que distingue «lo oyó bien» de «lo adivinó».',
  },
  {
    archivo: 'src/lib/finanzas/mrr.ts', interfaz: 'EntradaMRR', direccion: 'entrada',
    porQue: 'Lo que decide el ingreso recurrente. Un campo que nadie llena hace que el MRR se calcule sobre un supuesto.',
  },
]

/**
 * Campos que hoy no se leen, con la razón por la que se quedan.
 *
 * Para quitar uno: conéctalo. Para añadir uno: que sea a conciencia.
 */
const ACEPTADOS: Record<string, string> = {
  /**
   * LO ENCONTRÓ ESTE GUARDIÁN EN SU PRIMERA PASADA, y se queda con razón escrita.
   *
   * `trazas` guarda el texto COMPLETO después de cada etapa: cuatro copias del
   * dictado entero. Su valor —saber qué cambió en cada etapa— ya se entrega en
   * una forma mucho más ligera: `cambiosLexicos` y la lista de cifras, unidades
   * y siglas que la v1000 sacó a pantalla con su botón de deshacer.
   *
   * Conectarlo de verdad significaría persistir cuatro transcripciones por nota,
   * y este repositorio ya sabe cómo acaba eso: el documento se acerca al tope de
   * 1 MB de Firestore y deja de guardarse **todo lo demás**. Es el defecto que
   * cerró la v996, y no se va a reintroducir por completar una lista.
   *
   * Se queda disponible para depurar en el momento, que es para lo que sirve.
   */
  'ResultadoPipeline.trazas': 'Cuatro copias del dictado completo. Su valor ya se entrega en las listas de cambios, que pesan una fracción; persistirlo repetiría el defecto de documento inflado que cerró la v996.',
  /**
   * Mío, de la v1015, y lo cazó este guardián en la primera pasada tras
   * afinarlo. `frase` es la EVIDENCIA del veredicto —en qué frase se dijo el
   * fármaco— y hoy sólo la consume el golden, que es donde se comprueba que el
   * encuadre se juzgó sobre la frase correcta.
   *
   * Se queda porque quitarla dejaría el veredicto sin nada que lo respalde, y
   * eso es justo lo que este repositorio no acepta en ningún otro sitio.
   */
  'MencionFarmaco.frase': 'Es la evidencia del veredicto y la consume el golden. Quitarla dejaría un booleano sin nada que lo respalde.',
}

const fuentes: Record<string, string> = {}
function recorrer(dir: string) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e === '__tests__') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) recorrer(p)
    else if (/\.(ts|tsx)$/.test(e)) fuentes[relative(RAIZ, p)] = readFileSync(p, 'utf8')
  }
}
recorrer(join(RAIZ, 'src'))

describe('EL LECTOR DE CAMPOS', () => {
  it('saca los campos de una interfaz, opcionales incluidos', () => {
    const src = `export interface X {\n  a: string\n  b?: number\n  c: { d: string }\n}`
    expect(camposDe(src, 'X')).toEqual(['a', 'b', 'c'])
  })

  it('no confunde un campo con algo escrito en un comentario', () => {
    /**
     * Este repositorio documenta con ejemplos dentro de los comentarios: sin
     * esto, el guardián perseguiría campos que no existen y se apagaría solo.
     */
    const src = `export interface X {\n  /** ejemplo: otro: 1 */\n  // suelto: 2\n  a: string\n}`
    expect(camposDe(src, 'X')).toEqual(['a'])
  })

  it('no se mete en los objetos anidados', () => {
    const src = `export interface X {\n  a: {\n    interno: string\n  }\n  b: number\n}`
    expect(camposDe(src, 'X')).toEqual(['a', 'b'])
  })

  it('una interfaz que no existe devuelve vacío, no revienta', () => {
    expect(camposDe('nada aquí', 'NoExiste')).toEqual([])
  })
})

describe('EL TRINQUETE: TODO CAMPO DE UN CONTRATO SE LEE EN ALGÚN SITIO', () => {
  for (const c of CONTRATOS) {
    it(`${c.interfaz} — ${c.archivo}`, () => {
      // Si el archivo se movió, el guardián deja de vigilar en silencio.
      expect(fuentes[c.archivo], `${c.archivo} no existe: el guardián se quedó ciego`).toBeTruthy()
      const campos = camposDe(fuentes[c.archivo], c.interfaz)
      expect(campos.length, `${c.interfaz} no declara campos: ¿se renombró?`).toBeGreaterThan(0)

      const sueltos = camposSinConectar(c, fuentes, ACEPTADOS)
      expect(
        sueltos.map(x => `${x.contrato}.${x.campo} (nadie lo ${x.falta === 'lectura' ? 'lee' : 'llena'})`),
        `Campos sin conectar.\n${c.porQue}\n`
        + 'Conéctalos, o decláralos en ACEPTADOS con la razón por la que el '
        + 'trabajo no le llega a nadie.',
      ).toEqual([])
    })
  }
})

describe('LO QUE EL GUARDIÁN DECLARA DE SÍ MISMO', () => {
  it('dice por qué no vigila todo', () => {
    expect(POR_QUE_SOLO_CONTRATOS).toMatch(/un guardián ruidoso se apaga/)
  })

  it('y que su veredicto es prudente, no una acusación', () => {
    expect(POR_QUE_EL_VEREDICTO_ES_PRUDENTE).toMatch(/no se ve leído/)
  })

  it('la lista de aceptados está declarada, aunque esté vacía', () => {
    // Una lista implícita es una lista que nadie revisa.
    expect(typeof ACEPTADOS).toBe('object')
  })
})
