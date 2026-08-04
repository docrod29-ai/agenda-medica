/**
 * GOLDEN — el procesamiento del navegador viene APAGADO, y la app deja de
 * afirmar lo que nunca comprobó.
 *
 * ── EL HALLAZGO ──────────────────────────────────────────────────────────────
 *
 * Los tres procesadores del navegador venían `?? true` en el hook. La consulta
 * los apagaba a mano; **UCI y el banco de voz no pasaban nada**, así que
 * grababan con supresión de ruido y cancelación de eco ENCENDIDAS.
 *
 * Nadie lo decidió: fue un valor por omisión heredado. Y lo peor no es UCI — es
 * que **el banco de voz, que es con lo que se mide la calidad, medía en
 * condiciones distintas a las de la consulta real**. Una medición que no
 * describe el camino que usa el médico no sirve para decidir nada.
 *
 * ── POR QUÉ APAGARLOS (y no es una opinión) ──────────────────────────────────
 *
 * Los cuatro proveedores de reconocimiento lo desaconsejan por escrito:
 * · Google Cloud STT, *Best practices*: «All noise reduction processing should
 *   be disabled» — https://docs.cloud.google.com/speech-to-text/docs/best-practices
 * · Deepgram: «we recommend skipping noise suppression entirely… the suppression
 *   algorithm strips acoustic details that the ASR model relies on»
 *   — https://developers.deepgram.com/guides/deep-dives/audio-preprocessing-barge-in
 * · AssemblyAI: «we recommend applying noise reduction for playback purposes
 *   only, not before transcription»
 *   — https://www.assemblyai.com/docs/faq/what-are-the-recommended-options-for-audio-noise-reduction
 *
 * Y hay medición en habla MÉDICA (arXiv 2512.17562): el «limpiado» degrada el
 * reconocimiento en todas las condiciones de ruido probadas.
 *
 * El mecanismo físico: la supresión decide banda por banda qué energía es voz y
 * atenúa el resto. Las fricativas (/s/, /f/) son ruido de banda ancha y poca
 * energía — indistinguibles del ruido para ese estimador. Se pierde exactamente
 * lo que separa «seis» de «diez» y «mg» de «mL».
 *
 * ── LO QUE **NO** SE TOCA ────────────────────────────────────────────────────
 *
 * La consulta sigue con `autoGainControl: true` explícito. Ahí compensa un
 * problema físico real —el paciente está a dos metros del micrófono y el médico
 * a medio— y quitarlo sin arreglar antes la colocación sería el clásico cambio
 * «correcto según la documentación» que empeora el resultado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')

describe('EL PROCESAMIENTO VIENE APAGADO POR OMISIÓN', () => {
  it('los tres procesadores nacen en false', () => {
    /**
     * Si alguien los vuelve a poner en `?? true`, UCI y el banco de voz vuelven
     * a grabar con el procesamiento que los cuatro proveedores desaconsejan — y
     * volverían a hacerlo **sin que nadie lo decida**, que es como pasó.
     */
    expect(hook).toMatch(/echoCancellation: opts\?\.echoCancellation \?\? false/)
    expect(hook).toMatch(/noiseSuppression: opts\?\.noiseSuppression \?\? false/)
    expect(hook).toMatch(/autoGainControl: opts\?\.autoGainControl \?\? false/)
  })

  it('la razón está escrita, con el mecanismo físico', () => {
    // Un valor por omisión sin razón escrita es el que alguien revierte dentro
    // de seis meses «porque suena mejor».
    expect(hook).toMatch(/fricativas/)
    expect(hook).toMatch(/«seis» de «diez»/)
  })

  it('y se nombra el daño concreto: la medición no describía el camino real', () => {
    expect(hook).toMatch(/medía en\s*\n?\s*\* condiciones distintas/)
  })
})

describe('LA CONSULTA NO CAMBIA — sigue decidiendo por sí misma', () => {
  const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

  it('apaga supresión y eco explícitamente', () => {
    expect(page).toMatch(/noiseSuppression: false/)
    expect(page).toMatch(/echoCancellation: false/)
  })

  it('y CONSERVA la ganancia automática, que ahí sí compensa la distancia', () => {
    /**
     * El paciente está a ~2 m y el médico a ~0.5 m: son unos 12 dB de
     * diferencia. Quitar la ganancia sin arreglar antes el micrófono dejaría al
     * paciente por debajo del suelo útil. Es la decisión que NO se toma desde
     * la documentación.
     */
    expect(page).toMatch(/autoGainControl: true/)
  })
})

describe('UCI Y EL BANCO DE VOZ heredan lo correcto', () => {
  it('UCI no pasa constraints — y ahora eso significa SIN procesar', () => {
    // Se comprueba que sigue sin pasarlas: si alguien las añadiera a mano con
    // `true`, esta prueba no lo vería, pero el guardián de arriba sí fijaría el
    // valor por omisión. Aquí se fija que UCI no las declara.
    const uci = leer('src', 'app', '(dashboard)', 'uci', 'page.tsx')
    expect(uci).not.toMatch(/noiseSuppression:\s*true/)
    expect(uci).not.toMatch(/echoCancellation:\s*true/)
  })
})

describe('SE LEE LO QUE EL NAVEGADOR CONCEDIÓ, y se deja de afirmar', () => {
  it('se consultan los ajustes reales de la pista', () => {
    /**
     * `sampleRate` en `getUserMedia` es una constraint de disponibilidad
     * limitada: si el navegador no la soporta **se ignora en silencio**. La app
     * llevaba enseñando «16kHz» en pantalla como un hecho, sin comprobarlo
     * nunca — y de esa cifra depende si el bitrate actual sobra o falta.
     */
    expect(hook).toContain('getSettings?.()')
    expect(hook).toContain('setCaptura(')
  })

  it('leer los ajustes NUNCA puede impedir grabar', () => {
    // Perder una etiqueta informativa es un problema; no poder grabar la
    // consulta es otro tamaño de problema.
    expect(hook).toMatch(/catch \{ \/\* leer los ajustes NUNCA puede impedir grabar \*\/ \}/)
  })

  it('el dato viaja a la pantalla', () => {
    expect(hook).toMatch(/captura: AjustesCaptura \| null/)
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('audio.captura?.sampleRate')
  })

  it('y la pantalla ya no afirma «16kHz» ni un tope de 25 MB que no es el que actúa', () => {
    /**
     * El tope que de verdad cambia el comportamiento son 3.6 MB: a partir de ahí
     * el audio se trocea o sube a Storage. Un médico que vigilara «25 MB» no
     * veía venir el cambio de camino.
     */
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).not.toContain('16kHz/64kbps')
    expect(page).not.toContain('/ 25 MB')
    expect(page).not.toContain('voz 16kHz')
  })

  it('si el navegador SÍ aplicó supresión de ruido, se dice', () => {
    // Hay una capa de supresión en el sistema operativo y en el hardware que el
    // navegador no siempre deja apagar. Si quedó encendida, que se vea.
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('con supresión de ruido')
  })
})

/**
 * ── EL MEDIDOR MENTÍA EN LAS TRES DIRECCIONES (v982) ─────────────────────────
 *
 * Tres defectos verificados en el mismo bucle:
 *
 * 1. El aviso «Sin señal por +15s» **no se apagaba nunca**. El bucle se crea una
 *    vez y sigue corriendo; leía `silencioProlongado` desde el closure del
 *    render en que nació, así que la rama que apaga el aviso evaluaba para
 *    siempre el `false` capturado. Una vez encendido, se quedaba encendido el
 *    resto de la grabación aunque el médico estuviera hablando.
 * 2. **Tras una pausa, la detección de silencio quedaba muerta**: `reanudar`
 *    montaba una COPIA del bucle que no traía esa lógica. Dos copias de lo mismo
 *    divergen siempre — y ésta ya había divergido.
 * 3. En segundo plano `requestAnimationFrame` se congela; al volver, la
 *    diferencia contra la última señal superaba de golpe los 15 s y disparaba un
 *    «sin señal» **falso** sobre una grabación que iba perfecta.
 *
 * Un aviso que miente es peor que ninguno: enseña al médico a ignorarlos, y
 * entonces el día que dice la verdad tampoco lo va a leer.
 */
describe('EL MEDIDOR DE AUDIO: un solo bucle, y que no mienta', () => {
  it('el estado del aviso vive en una referencia, no en el closure', () => {
    expect(hook).toContain('const silencioRef = useRef(false)')
    expect(hook).toMatch(/if \(silencioRef\.current\) \{ silencioRef\.current = false; setSilencioProlongado\(false\) \}/)
  })

  it('hay UN bucle, compartido por iniciar y reanudar', () => {
    // Dos copias de la misma lógica divergen siempre. Ya había pasado.
    expect(hook).toContain('const arrancarMedidor = useCallback(')
    expect((hook.match(/arrancarMedidor\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('una pestaña dormida NO se lee como micrófono callado', () => {
    /**
     * Un salto anómalo entre fotogramas es la firma de que el navegador congeló
     * el bucle. Lo correcto es reanclar el reloj, no acusar al micrófono.
     */
    expect(hook).toContain('SALTO_SOSPECHOSO_MS')
    expect(hook).toMatch(/ultimaSenalRef\.current = ahora\n\s*ultimoFrame = ahora/)
  })

  it('se detecta el RECORTE, que el nivel no puede ver', () => {
    // Una señal saturada tiene RMS normal: por eso hay que mirar el pico.
    expect(hook).toContain('UMBRAL_RECORTE')
    expect(hook).toMatch(/setRecorte\(pico >= UMBRAL_RECORTE\)/)
  })

  it('y el recorte llega a la pantalla con qué hacer', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('El micrófono está saturando')
    expect(page).toMatch(/Bájale el volumen de entrada/)
  })

  it('el aviso se limpia al empezar una grabación nueva', () => {
    // Arrastrar el aviso de la grabación anterior es la misma mentira, en diferido.
    expect(hook).toMatch(/silencioRef\.current = false; setSilencioProlongado\(false\); setRecorte\(false\)/)
  })
})
