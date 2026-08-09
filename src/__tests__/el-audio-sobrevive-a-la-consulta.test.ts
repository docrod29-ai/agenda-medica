/**
 * EL AUDIO SOBREVIVE A LA CONSULTA — REG-249.
 *
 * ── EL ESLABÓN QUE FALTABA ──────────────────────────────────────────────────
 *
 * El médico pidió lo que Abridge llama *Linked Evidence*: pulsar cualquier frase
 * de la nota y **escuchar el audio exacto que la originó**.
 *
 * Casi todo estaba. Los tiempos sobreviven —cada palabra lleva su `inicioMs`—,
 * el trazado frase→dictado existe (`trazabilidad.ts`), y la regla de lectura de
 * `consultas-audio/` se reparó al cerrar el corte de las grabaciones largas.
 *
 * Faltaba una sola cosa, y era la que lo bloqueaba todo: **el audio se subía a
 * Storage, se sacaba su URL para dársela al motor de diarización, y se tiraba**.
 * Nunca volvía al llamador ni se guardaba con la nota. No había nada que
 * reproducir.
 *
 * ── Y SÓLO PASABA EN LAS LARGAS ─────────────────────────────────────────────
 *
 * Peor: el camino corto —el de la mayoría de las consultas— manda el audio como
 * multipart y **nunca lo subía**. Sin tocarlo, «escuchar de dónde salió esto»
 * habría sido una función que aparece pasados unos minutos y antes no, sin que
 * el médico pueda predecir cuándo.
 *
 * ── LA RUTA, NUNCA LA URL ───────────────────────────────────────────────────
 *
 * `getDownloadURL` devuelve una URL con un **token de acceso dentro**. Guardarla
 * en Firestore sería dejar una llave escrita en el expediente — y una llave que
 * sigue sirviendo aunque después cambien las reglas o se revoque el acceso.
 *
 * Se guarda la ruta; la URL se vuelve a pedir al reproducir, que es cuando las
 * reglas se evalúan otra vez con quien esté mirando en ese momento.
 *
 * ── LA DECISIÓN QUE NO ES MÍA ───────────────────────────────────────────────
 *
 * Conservar el audio lo autorizó el médico dueño explícitamente («conserva el
 * audio»). **Cuánto tiempo** se conserva sigue siendo decisión suya y está en
 * `OWNER_DECISIONS_REQUIRED.md`: por eso no hay ningún periodo de caducidad
 * escrito a mano en el código.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const hook = readFileSync(join(process.cwd(), 'src/hooks/useGrabacionAudio.ts'), 'utf8')

describe('la ruta del audio vuelve al llamador', () => {
  it('el contrato del resultado la lleva', () => {
    expect(hook).toMatch(/audioPath\?: string/)
  })

  it('el camino LARGO devuelve la ruta que ya tenía en la mano', () => {
    /** Subía a Storage y tiraba la ruta. Ahora la devuelve. */
    expect(hook).toMatch(/utterances: \(d\.utterances \?\? \[\]\) as Utterance\[\], audioPath: path/)
  })

  it('el camino CORTO ahora también guarda el audio', () => {
    /**
     * Es el de la mayoría de las consultas. Sin esto, «escuchar de dónde salió
     * esto» sería una función que aparece pasados unos minutos y antes no.
     */
    expect(hook).toContain('guardarAudioDeLaConsulta(blob, ext, recoveryKey)')
  })

  it('si la subida falla, la transcripción NO se pierde', () => {
    /**
     * Se sube DESPUÉS de tener el texto y en su propio `try`. Un fallo de
     * Storage no puede costarle al médico el dictado de la consulta.
     */
    const bloque = hook.slice(hook.indexOf('EL AUDIO CORTO TAMBIÉN SE GUARDA'))
    expect(bloque).toMatch(/let audioPath: string \| undefined\s*\n\s*try \{/)
    expect(bloque).toMatch(/\} catch \{/)
  })
})

describe('se guarda la RUTA, nunca la URL', () => {
  it('el ayudante devuelve la ruta, no llama a getDownloadURL', () => {
    const fn = hook.slice(
      hook.indexOf('async function guardarAudioDeLaConsulta'),
      hook.indexOf('async function intentarDiarizarLargo'),
    )
    expect(fn).toContain('return path')
    expect(fn).not.toContain('getDownloadURL')
  })

  it('y queda escrito por qué', () => {
    /**
     * Una URL de Storage lleva un token dentro. Si no queda escrito, el próximo
     * que toque esto guardará la URL «porque es más cómodo».
     */
    expect(hook).toMatch(/token de acceso dentro/)
    expect(hook).toMatch(/llave escrita en el expediente/)
  })
})

describe('lo que NO se guarda, y es deliberado', () => {
  it('las PARTES de un lote no dejan audio suelto', () => {
    /**
     * `transcribirParte` procesa un trozo, no una consulta. Guardar cada trozo
     * dejaría N audios que no corresponden a ninguna nota y que nadie borraría.
     */
    expect(hook).toMatch(/Sin `recoveryKey` a propósito: esto es UNA PARTE de un lote/)
    expect(hook).toMatch(/Sin clave no se guarda/)
  })

  it('sin audio guardado la ruta es null, no una cadena inventada', () => {
    /** `null` significa «no hay nada que reproducir», y eso es información. */
    expect(hook).toMatch(/useState<string \| null>\(null\)/)
  })

  it('reiniciar la grabación la limpia', () => {
    expect(hook).toMatch(/setAudioPath\(null\)/)
  })
})

describe('el hook la expone', () => {
  it('está en la interfaz pública', () => {
    expect(hook).toMatch(/audioPath: string \| null/)
  })

  it('y en lo que devuelve', () => {
    expect(hook).toMatch(/sinDiarizacion, audioPath,/)
  })
})
