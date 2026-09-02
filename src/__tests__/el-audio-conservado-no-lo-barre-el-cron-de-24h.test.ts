/**
 * EL AUDIO QUE SE CONSERVA NO VIVE DONDE EL QUE SE TIRA — REG-510.
 *
 * QUÉ FALLABA. `guardarAudioDeLaConsulta` (REG-249) escribía el audio que el
 * dueño decidió CONSERVAR en `consultas-audio/{uid}/…` — el mismo prefijo del
 * audio de TRABAJO, que el cron `limpiar-audio` borra a las 24 h.
 *
 * El audio conservado se borraba al día siguiente. El clic-a-audio de REG-250
 * moría solo, en silencio, y **ninguna prueba se ponía roja**: cada pieza, por
 * separado, era correcta. El cron hacía exactamente lo que prometía; el hook
 * también. Juntos borraban lo que el médico pidió guardar.
 *
 * CÓMO SE DESCUBRIÓ. Yendo a construir el barrido de retención NOM-004, al
 * preguntarse quién más toca ese prefijo. La cadena entera salió de tirar de un
 * hilo: el reloj de la norma → de qué paciente es cada audio → REG-509, la ruta
 * no llegaba a la nota → y aquí, que el archivo tampoco duraba.
 *
 * CAUSA RAÍZ, y está escrita en el propio código que falló. El comentario de
 * REG-249 decía, como si fuera una virtud: «la carpeta que ya existía; **no se
 * abre ningún sitio nuevo**». Reutilizar el prefijo parecía prudencia y era el
 * defecto: dos vidas opuestas —24 horas y cinco años— compartiendo carpeta.
 *
 * LA REGLA QUE LO HACE SEGURO. Un prefijo aparte, no una excepción dentro del
 * barrido. La alternativa —preguntar objeto por objeto si alguna nota lo
 * referencia— es una lectura cruzada por archivo que falla hacia el lado caro:
 * si la consulta falla, o se borra PHI que debía quedarse, o se conserva PHI que
 * debía irse. Con dos prefijos el barrido **no puede alcanzarlo ni
 * equivocándose**, porque no lo mira.
 *
 * QUÉ NO CUBRE.
 * - **El audio ya guardado bajo el prefijo viejo se perdió o se perderá.** No
 *   hay migración y no se inventa: lo que el cron ya barrió no vuelve, y lo que
 *   quede lo barrerá. Sólo el audio nuevo se conserva de verdad.
 * - **No prueba contra un bucket real.** Prueba la decisión y el cableado; que
 *   las reglas de Storage rijan en producción exige desplegarlas, que es del
 *   dueño (`npx firebase deploy --only storage`).
 * - **El respaldo sigue sin llevarse el audio**, ahora declarado en
 *   `adjuntos.ts`: tras una restauración la nota traerá su `audioPath` y el
 *   objeto no estará. Meter binarios en el respaldo es otra decisión.
 * - **No implementa la caducidad NOM-004.** La desbloquea: ya hay un sitio con
 *   una sola vida que barrer. El barrido es su propia unidad.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PREFIJO_AUDIO, PREFIJO_AUDIO_CONSERVADO, esAudioDeConsulta, veredicto,
} from '@/lib/expediente/audio-caduco'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const AHORA = Date.parse('2026-09-02T12:00:00.000Z')
const HACE_UN_MES = AHORA - 30 * 24 * 3_600_000

describe('el barrido de 24 h no puede alcanzar el audio conservado', () => {
  it('son prefijos DISTINTOS — si alguien los iguala, todo lo demás da igual', () => {
    expect(PREFIJO_AUDIO_CONSERVADO).not.toBe(PREFIJO_AUDIO)
  })

  it('un objeto conservado de hace un mes NO se considera audio de trabajo', () => {
    // AL REVÉS: con el prefijo viejo esto daba `true` y el objeto se borraba.
    expect(esAudioDeConsulta(`${PREFIJO_AUDIO_CONSERVADO}uid-1/consulta-9-1756000000000.webm`)).toBe(false)
  })

  it('y el veredicto del cron lo deja en paz, aunque sea viejísimo', () => {
    const v = veredicto(
      { nombre: `${PREFIJO_AUDIO_CONSERVADO}uid-1/consulta-9-1756000000000.webm`, creadoEn: new Date(HACE_UN_MES).toISOString() },
      AHORA,
    )
    expect(v.borrar).toBe(false)
    expect(v.porQue).toMatch(/no está bajo consultas-audio\//)
  })

  it('pero el audio de TRABAJO viejo se sigue borrando: el cron no se debilitó', () => {
    // Sin este caso, «arreglar» el defecto podría ser apagar el barrido entero
    // y dejar PHI en el bucket para siempre, que es lo que REG-2xx reparó.
    const v = veredicto(
      { nombre: `${PREFIJO_AUDIO}uid-1/tmp-1756000000000.webm`, creadoEn: new Date(HACE_UN_MES).toISOString() },
      AHORA,
    )
    expect(v.borrar).toBe(true)
  })

  it('la protección viene de la barra final, no de la suerte', () => {
    // `consultas-audio-nota/` no empieza por `consultas-audio/` porque el
    // prefijo la lleva. Es el mismo cuidado que el módulo ya declaraba para
    // `consultas-audio-viejo/`.
    expect(PREFIJO_AUDIO.endsWith('/')).toBe(true)
    expect(PREFIJO_AUDIO_CONSERVADO.startsWith(PREFIJO_AUDIO)).toBe(false)
  })
})

describe('el hook escribe donde debe', () => {
  const hook = () => leer('src/hooks/useGrabacionAudio.ts')

  it('el audio conservado usa el prefijo conservado, y por constante', () => {
    expect(hook()).toMatch(/const path = `\$\{PREFIJO_AUDIO_CONSERVADO\}\$\{uid\}\//)
  })

  it('el audio de TRABAJO sigue en el prefijo de trabajo', () => {
    // No se movieron los dos: mover el efímero dejaría PHI fuera del barrido.
    expect(hook()).toMatch(/const path = `consultas-audio\/\$\{uid\}\//)
  })
})

describe('lo que rodea al sitio nuevo existe, o el sitio no sirve', () => {
  it('las reglas de Storage cubren el prefijo conservado', () => {
    expect(leer('storage.rules')).toContain('match /consultas-audio-nota/{uid}/{allPaths=**}')
  })

  it('y dan LECTURA al dueño — sin ella el reproductor no puede pedir la URL', () => {
    const r = leer('storage.rules')
    const bloque = r.slice(r.indexOf('consultas-audio-nota'), r.indexOf('match /consultas-audio/'))
    expect(bloque).toMatch(/allow read: if request\.auth != null && request\.auth\.uid == uid/)
  })

  it('el manifiesto de adjuntos lo declara, y NO como efímero', () => {
    const m = leer('src/lib/durability/adjuntos.ts')
    expect(m).toContain("'consultas-audio-nota/'")
    const linea = m.split('\n').find(l => l.includes("'consultas-audio-nota/'")) ?? ''
    expect(linea).toMatch(/NO es efímero/)
  })

  it('y declara el hueco del respaldo en vez de callarlo', () => {
    // Tras restaurar, la nota traerá audioPath y el objeto no estará.
    expect(leer('src/lib/durability/adjuntos.ts')).toMatch(/quedará mudo tras una restauración/)
  })
})
