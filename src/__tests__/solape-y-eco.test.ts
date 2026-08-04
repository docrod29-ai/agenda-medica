/**
 * GOLDEN — el audio deja de repetirse y de partirse.
 *
 * ── DOS DEFECTOS OPUESTOS EN EL MISMO TROCEADO ───────────────────────────────
 *
 * 1. **Se repetía.** Los fragmentos posteriores al primero no traen cabecera de
 *    contenedor, así que hay que anteponerles el primero para que se puedan
 *    abrir. Pero ese primer fragmento **no es sólo cabecera**: son 2 segundos de
 *    audio real. En una consulta de 20 minutos troceada en cuatro, lo primero
 *    que dijo el paciente aparecía **cuatro veces**, intercalado donde no
 *    ocurrió — y si ahí va una cifra o un fármaco, el modelo lee la misma
 *    indicación repetida en momentos distintos.
 *
 * 2. **Se partía.** El corte cada 20 segundos era limpio, sin un segundo de
 *    solape. Una palabra a caballo de la frontera se parte y cada mitad se
 *    decodifica sin la otra. Y eso no queda «mal escrito»: queda **cambiado** —
 *    «ciento… veinte» partido por la mitad produce **otro número**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  quitarEcoDeCabecera, quitarSolapeConAnterior, MAX_PALABRAS_ECO,
  POR_QUE_SE_SOLAPA, POR_QUE_NO_SE_BORRA_SIN_COINCIDENCIA, POR_QUE_EL_ECO_SE_QUITA,
} from '@/lib/asr/eco-de-cabecera'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')

describe('1 · EL ECO DE LA CABECERA', () => {
  it('se quita del lote lo que repite el arranque del primero', () => {
    const primero = 'buenos días doctor me duele el estómago'
    const lote = 'buenos días doctor y desde ayer tengo fiebre'
    expect(quitarEcoDeCabecera(lote, primero)).toBe('y desde ayer tengo fiebre')
  })

  it('la comparación ignora acentos y puntuación', () => {
    // El motor no transcribe dos veces exactamente igual el mismo audio.
    expect(quitarEcoDeCabecera('Buenos dias, doctor. Y sigo igual', 'buenos días doctor me duele'))
      .toBe('Y sigo igual')
  })

  it('UNA sola palabra en común no es un eco', () => {
    /**
     * Casi cualquier par de frases empieza por «el», «y» o «bueno». Recortar por
     * una coincidencia de una palabra borraría contenido real con regularidad.
     */
    expect(quitarEcoDeCabecera('el paciente refiere fiebre', 'el estómago me duele'))
      .toBe('el paciente refiere fiebre')
  })

  it('sin coincidencia, no se toca nada', () => {
    expect(quitarEcoDeCabecera('meropenem dos gramos', 'buenos días doctor'))
      .toBe('meropenem dos gramos')
  })
})

describe('2 · LA COSTURA DEL SOLAPE', () => {
  it('quita del nuevo lo que repite el FINAL del anterior', () => {
    const anterior = 'le voy a dar meropenem dos gramos'
    const nuevo = 'meropenem dos gramos cada ocho horas'
    expect(quitarSolapeConAnterior(nuevo, anterior)).toBe('cada ocho horas')
  })

  it('toma la coincidencia MÁS LARGA, no la primera', () => {
    // Si cortara por la más corta dejaría duplicado el resto del solape.
    const anterior = 'refiere dolor abdominal desde hace tres días'
    const nuevo = 'desde hace tres días y náusea'
    expect(quitarSolapeConAnterior(nuevo, anterior)).toBe('y náusea')
  })

  it('sin coincidencia NO se borra nada', () => {
    /**
     * Preferimos una palabra repetida —que el médico ve— a una palabra borrada,
     * que no ve.
     */
    expect(quitarSolapeConAnterior('meropenem dos gramos', 'buenos días doctor'))
      .toBe('meropenem dos gramos')
    expect(POR_QUE_NO_SE_BORRA_SIN_COINCIDENCIA).toMatch(/que no ve/)
  })

  it('una palabra suelta en común tampoco basta', () => {
    expect(quitarSolapeConAnterior('de la mañana', 'me duele de'))
      .toBe('de la mañana')
  })

  it('con texto vacío devuelve lo que llegó', () => {
    expect(quitarSolapeConAnterior('', 'algo')).toBe('')
    expect(quitarSolapeConAnterior('algo', '')).toBe('algo')
  })

  it('la ventana está acotada', () => {
    expect(MAX_PALABRAS_ECO).toBeGreaterThan(2)
    expect(MAX_PALABRAS_ECO).toBeLessThan(30)
  })
})

describe('ESTÁ CONECTADO EN LOS DOS CAMINOS', () => {
  it('el envío en vivo conserva el último trozo para solapar', () => {
    expect(hook).toContain('const ultimo = chunksRef.current[chunksRef.current.length - 1]')
    expect(hook).toContain('chunksRef.current = ultimo ? [ultimo] : []')
  })

  it('y quita los dos ecos, en orden', () => {
    /**
     * Primero el de cabecera —va delante del todo— y lo que quede empezando el
     * texto es entonces el solape.
     */
    expect(hook).toContain('const sinCabecera = idx === 0')
    expect(hook).toContain('quitarSolapeConAnterior(sinCabecera, textosChunksRef.current[idx - 1]')
  })

  it('el troceado del audio LARGO también quita el eco', () => {
    // Es donde el defecto se veía peor: cuatro lotes, cuatro repeticiones.
    expect(hook).toContain("textos.push(b === 0 ? t : quitarEcoDeCabecera(t, textos[0] ?? ''))")
  })
})

describe('LAS RAZONES ESTÁN ESCRITAS', () => {
  it('por qué se solapa', () => {
    expect(POR_QUE_SE_SOLAPA).toMatch(/queda CAMBIADO/)
    expect(POR_QUE_SE_SOLAPA).toMatch(/produce otro número/)
  })
  it('y por qué el eco se quita', () => {
    expect(POR_QUE_EL_ECO_SE_QUITA).toMatch(/indicación repetida/)
  })
})
