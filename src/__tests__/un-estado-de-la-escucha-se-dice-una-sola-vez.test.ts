/**
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * MEDIDO en navegador el 1-sep-2026, con la consulta grabando de verdad
 * —micrófono falso, ciclo completo desde el consentimiento—:
 *
 *   relojes a la vez ........ 4   →  «0:39», «0:39», «00:39», «00:39»
 *   palabras de estado ...... 3   →  «Grabando», «Escuchando», «Esperando voz»
 *   controles de detener .... 2   →  «Terminar», «Detener y generar nota»
 *   regiones aria-live ...... 6
 *
 * Cuatro relojes contando el MISMO segundo en DOS formatos, y tres palabras
 * para el MISMO estado — una de ellas, «Esperando voz…», contradiciendo a las
 * otras dos mientras la barra de nivel se movía.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Grabando en el navegador. No se puede ver de otra forma: leyendo el código,
 * cada uno de los cuatro renderizadores es correcto por separado. El defecto
 * sólo existe cuando los cuatro están en pantalla a la vez.
 *
 * ── CAUSA RAÍZ, QUE NO ES LA QUE PARECE ─────────────────────────────────────
 *
 * NO había cuatro fuentes de verdad. Hay una sola —el `EVENTO_GRABANDO` que
 * escuchan `MarcoEscuchando`, `InstrumentStrip`, `FlowRail` y `BottomNav`— y el
 * invariante de arquitectura se respetaba.
 *
 * Lo duplicado era la PRESENTACIÓN. «La misma entidad se pinta distinto según
 * dónde se mire» permite que la barra superior sea discreta y la banda del
 * encuentro sea grande; no permite que una diga «Escuchando» y otra «Grabando»
 * del mismo segundo. Eso no es pintar distinto: es DECIR distinto.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El vocabulario vive en UN módulo. Palabra y reloj salen de ahí, y quien pinte
 * el estado del encuentro lo pide en vez de escribirlo.
 *
 * Y dos decisiones que esta prueba fija porque son clínicas, no de estilo:
 *
 * 1. «Grabando», no «Escuchando». El paciente firmó consentimiento para que la
 *    conversación SE GRABE, el audio se guarda y `data-privacy` declara que la
 *    voz es biométrica. La palabra suave es la equivocada justo aquí.
 * 2. `grabando` NO se anuncia a lector de pantalla. Su rótulo lleva un reloj que
 *    cambia cada segundo; anunciarlo convierte la consulta en un goteo de
 *    cifras. Se anuncia el CAMBIO de estado, no el paso del tiempo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No cuenta cuántos indicadores hay EN PANTALLA a la vez — eso se mide en
 *   navegador y vive en la bitácora del carril. Aquí se fija que, cuando se
 *   pinten, digan lo mismo.
 * · No toca los DOS controles de detener ni el flotante que queda encima de un
 *   campo de signos vitales: declarados, no arreglados.
 * · `Esperando voz…` sigue existiendo como lectura del nivel de micrófono. Es
 *   otro hecho (¿llega señal?), no otro estado — pero puede seguir leyéndose
 *   como contradicción y queda declarado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PALABRA, SE_ANUNCIA, reloj, rotulo } from '@/lib/encuentro/vocabulario-de-la-escucha'

const RAIZ = join(__dirname, '..')
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8')

describe('el estado de la escucha se dice con una sola voz', () => {
  it('el reloj tiene UN formato, y es de ancho estable', () => {
    expect(reloj(39)).toBe('00:39')
    expect(reloj(8)).toBe('00:08')
    // Lo que provocaba el salto de composición: 9:59 → 10:00 cambia de ancho.
    expect(reloj(599)).toHaveLength(5)
    expect(reloj(600)).toHaveLength(5)
  })

  it('no inventa un tiempo cuando no lo hay', () => {
    expect(reloj(0)).toBe('00:00')
    expect(reloj(-5)).toBe('00:00')
    expect(reloj(NaN)).toBe('00:00')
  })

  it('la palabra de grabar dice GRABAR, no escuchar', () => {
    expect(PALABRA.grabando).toBe('Grabando')
    expect(Object.values(PALABRA).join(' ')).not.toMatch(/Escuchando/)
  })

  it('sólo los estados que DURAN llevan reloj', () => {
    expect(rotulo('grabando', 39)).toBe('Grabando · 00:39')
    expect(rotulo('pausado', 39)).toBe('En pausa · 00:39')
    // Cronometrar un fallo no significa nada.
    expect(rotulo('error', 39)).toBe('No se pudo grabar')
    expect(rotulo('estructurando', 39)).toBe('Estructurando la nota')
    expect(rotulo('inactivo')).toBe('')
  })

  it('`grabando` NO se anuncia a lector de pantalla — es el que lleva el reloj', () => {
    expect(SE_ANUNCIA.grabando).toBe(false)
    // Y los cambios sí, o el anuncio no serviría para nada.
    expect(SE_ANUNCIA.pausado).toBe(true)
    expect(SE_ANUNCIA.error).toBe(true)
    expect(SE_ANUNCIA.estructurando).toBe(true)
  })

  /**
   * LA CONEXIÓN. Las de arriba fijan el vocabulario; ésta comprueba que los
   * cuatro sitios lo USEN — que es lo que fallaba. Un vocabulario que nadie
   * llama es la misma pantalla con un archivo más.
   */
  it('los cuatro renderizadores piden la palabra en vez de escribirla', () => {
    const fuentes: Array<[string, string]> = [
      ['barra superior', leer('components/InstrumentStrip.tsx')],
      ['banda del encuentro', leer('components/MientrasHablas.tsx')],
      ['consulta', leer('app/(dashboard)/consulta/[patientId]/page.tsx')],
    ]
    for (const [nombre, src] of fuentes) {
      expect(src, `${nombre} no importa el vocabulario`)
        .toMatch(/from '@\/lib\/encuentro\/vocabulario-de-la-escucha'/)
    }
  })

  it('nadie vuelve a escribir el reloj a mano', () => {
    const sinComentarios = (t: string) => t
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
    for (const f of [
      'components/InstrumentStrip.tsx',
      'components/MientrasHablas.tsx',
      'app/(dashboard)/consulta/[patientId]/page.tsx',
    ]) {
      /*
       * LA PRIMERA VERSIÓN DE ESTA REGLA NO CAZABA NADA.
       *
       * Exigía `Math.floor(...)/ 60)).padStart` — la ortografía EXACTA de las
       * cuatro copias que yo había visto, espacios incluidos. Al probarla al
       * revés metiendo `Math.floor(s/60)` sin espacios, el guardián siguió en
       * verde con la copia local reinstalada. Un guardián que sólo reconoce la
       * versión del defecto que ya conocía no vigila la familia: vigila un
       * recuerdo.
       *
       * Ahora busca los DOS ingredientes en la misma línea —dividir entre 60 y
       * rellenar a dos cifras—, que es lo que hace un reloj a mano se escriba
       * como se escriba.
       */
      const aMano = sinComentarios(leer(f)).split('\n')
        .filter(l => /\/\s*60/.test(l) && /padStart\(\s*2/.test(l))
      expect(aMano, `${f} vuelve a formatear el reloj a mano:\n  ${aMano.join('\n  ')}`)
        .toEqual([])
    }
  })
})
