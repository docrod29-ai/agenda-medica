/**
 * GUARDIÁN — el pipeline de dictado se carga al DICTAR, no al abrir /consulta.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * /consulta pagaba en su JS inicial el pipeline de voz completo — léxico,
 * normalización de cifras, corrector vigilado, guardián de sustituciones,
 * siglas — sin que el médico hubiera dictado una palabra. El arnés de
 * V15-PERF-001 lo midió: 691 KB transferidos contra ~490 de sus hermanas, y
 * las long tasks móviles más altas de la cadena clínica (591–964 ms en CINCO
 * muestras, contra 379–448 del expediente). Parte de ese excedente era un
 * chunk de ~140 KB con `useGrabacionAudio` + todo `lib/asr`.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * La 4ª rebanada de PERF-001 pedía juzgar la varianza de las long tasks con
 * dos muestras más (951 y 964 ms — sostenidas) y atribuir el excedente. La
 * atribución por chunks (`atribuir-js-consulta-v15.mjs`) señaló el chunk del
 * dictado; el grep confirmó DOS imports estáticos de `@/lib/asr/pipeline`:
 * `useGrabacionAudio` y `useGrabacionVoz`.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Ninguna llamada a `procesarTranscript` ocurre al montar: todas viven DESPUÉS
 * de que una transcripción volvió de la red (o de que el reconocedor emitió un
 * final). El import estático era comodidad, no necesidad: obligaba a parsear y
 * ejecutar las nueve etapas en el arranque de la pantalla.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. El import es dinámico y CACHEADO a nivel de módulo (una sola carga).
 * 2. `useGrabacionAudio.iniciar()` lo PRECALIENTA (`void cargarPipeline()`):
 *    para cuando llega el primer texto, el módulo ya está en memoria.
 * 3. `useGrabacionVoz.iniciar()` lo ESPERA antes de `rec.start()`: su
 *    `onresult` es síncrono y no puede esperar a nadie — ningún final se
 *    acumula sin pasar por el corrector. Si el módulo no llega (sin red), la
 *    grabación NO arranca: arrancar sin corrector escribiría texto que el
 *    pipeline nunca vigiló, y el reconocedor de Chrome tampoco vive sin red.
 * 4. Las nueve etapas corren IGUAL en cada texto (REG-170: diferir el CUÁNDO
 *    se carga, jamás el SI se corre). Los guardianes hermanos
 *    (gate-ambiguedad-conectado, cambios-de-cifras-visibles, origen-del-dictado)
 *    siguen vigilando que el resultado del pipeline LLEGUE a los estados.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No mide bytes ni garantiza que el bundler parta el chunk (eso lo mide el
 * arnés `medir-perf-v15.mjs` en navegador real, y quedó en el baseline vivo).
 * No cubre el resto del excedente de /consulta (el monolito de page.tsx).
 * No prueba la carrera «import falla a media consulta»: el precalentado en
 * `iniciar()` la hace teórica (la carga ocurre al empezar, no al terminar).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const AUDIO = leer('src', 'hooks', 'useGrabacionAudio.ts')
const VOZ = leer('src', 'hooks', 'useGrabacionVoz.ts')

describe('el pipeline de dictado es carga diferida', () => {
  it('ningún hook de grabación importa el pipeline estáticamente', () => {
    // Un `import { … } from '@/lib/asr/pipeline'` en la cabecera lo devolvería
    // al JS inicial de /consulta. El tipo (`typeof import(...)`) no cuenta:
    // se borra al compilar.
    const estatico = /^import\s+\{[^}]*\}\s+from\s+'@\/lib\/asr\/pipeline'/m
    expect(AUDIO).not.toMatch(estatico)
    expect(VOZ).not.toMatch(estatico)
  })

  it('los dos lo cargan dinámicamente, cacheado a nivel de módulo', () => {
    for (const src of [AUDIO, VOZ]) {
      expect(src).toContain("import('@/lib/asr/pipeline')")
      // La caché: una promesa module-level, no un import() suelto por llamada.
      expect(src).toContain('pipelinePromise ??=')
    }
  })

  it('useGrabacionAudio lo precalienta al INICIAR la grabación', () => {
    // Sin el precalentado, el primer chunk transcrito pagaría la carga en el
    // momento en que el médico espera ver su texto.
    expect(AUDIO).toContain('void cargarPipeline()')
    // Y el precalentado vive DENTRO de iniciar(), después del check de soporte.
    const iniciar = AUDIO.indexOf('const iniciar = useCallback')
    const precalienta = AUDIO.indexOf('void cargarPipeline()')
    const pausar = AUDIO.indexOf('const pausar = useCallback')
    expect(iniciar).toBeGreaterThan(-1)
    expect(precalienta).toBeGreaterThan(iniciar)
    expect(precalienta).toBeLessThan(pausar)
  })

  it('useGrabacionVoz lo ESPERA antes de arrancar el reconocedor', () => {
    // onresult es síncrono: si el módulo no está cargado cuando llega el primer
    // final, ese texto se acumularía sin corrector. La espera va ANTES de
    // construir el reconocedor.
    const espera = VOZ.indexOf('await cargarPipeline()')
    const arranque = VOZ.indexOf('const rec = new SR()')
    expect(espera).toBeGreaterThan(-1)
    expect(arranque).toBeGreaterThan(-1)
    expect(espera).toBeLessThan(arranque)
    // Y si la carga falla, NO se arranca sin corrector.
    expect(VOZ).toMatch(/try \{ \(\{ procesarTranscript \} = await cargarPipeline\(\)\) \} catch \{ return \}/)
  })

  it('el pipeline sigue corriendo sobre lo transcrito (no se difirió el SI)', () => {
    // La pareja de corregirUtterances en los dos caminos con diarización…
    expect(AUDIO.split('await corregirUtterances(diar.utterances)').length - 1).toBe(2)
    // …y el corrector sobre cada final del reconocedor en vivo.
    expect(VOZ).toContain('procesarTranscript(txt)')
  })
})
