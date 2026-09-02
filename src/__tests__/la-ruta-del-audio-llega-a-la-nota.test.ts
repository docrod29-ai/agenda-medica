/**
 * LA RUTA DEL AUDIO LLEGA A LA NOTA — REG-509. El último palmo de REG-249.
 *
 * QUÉ FALLABA. El clic-a-audio (REG-250) —«pulsar una frase y oír el segundo
 * exacto del dictado»— funcionaba con la pestaña de la consulta abierta y
 * **dejaba de existir al día siguiente**, sobre la nota firmada, que es cuando
 * hace falta. El archivo seguía en Cloud Storage, huérfano: nada lo señalaba,
 * así que no se podía ni reproducir ni borrar cuando venciera.
 *
 * CÓMO SE DESCUBRIÓ. Yendo a construir el barrido de retención NOM-004 que el
 * dueño autorizó. El reloj de la norma cuenta desde el último acto médico del
 * PACIENTE, y no había forma de saber de qué paciente era cada audio: el único
 * vínculo era la carpeta `consultas-audio/{uid}/…`, y ese `uid` es el MÉDICO.
 * Tirando de ahí apareció que `audioPath` no se escribía en ninguna parte.
 *
 * CAUSA RAÍZ. REG-249 hizo lo difícil y lo hizo bien: sube el audio por los dos
 * caminos y devuelve su ruta al llamador — once casos lo comprueban. Y ahí se
 * acababa. Es «el dato tiene que LLEGAR» en su forma exacta: una prueba de
 * contrato comprueba que el código **diga** lo acordado; no comprueba que el
 * dato **quede escrito**. Nadie miró del otro lado, en el documento real.
 *
 * LA REGLA QUE LO HACE SEGURO. Tres invariantes, y los tres se prueban aquí:
 *
 *   1. LA RUTA, NUNCA LA URL. `getDownloadURL` lleva un token de acceso dentro;
 *      guardarlo sería dejar una llave escrita en el expediente, y una llave que
 *      sigue sirviendo aunque después se revoque el acceso.
 *   2. NO SE PISA AL REABRIR. En la sesión siguiente el grabador está vacío;
 *      escribir su valor tal cual BORRARÍA la ruta guardada. Es el mismo defecto
 *      que `transcripcionMotorGuardadaRef` ya resolvió, un eje más allá.
 *   3. FUERA DEL SELLO, a propósito y declarado. `canonicoV4` es lista blanca:
 *      dejarlo fuera garantiza que **ninguna nota firmada cambie de hash** —la
 *      falsa alarma que costó REG-060—. Meterlo dentro es decisión del dueño.
 *
 * QUÉ NO CUBRE.
 * - **No prueba que el audio se OIGA.** Prueba que la ruta se escribe, sobrevive
 *   y no rompe el sello. Que el reproductor la resuelva se mira en un navegador.
 * - **No cierra la retención NOM-004.** Desbloquea su construcción: ya se puede
 *   saber de qué paciente es cada audio. El barrido es otra unidad.
 * - **Residual del sello, y no es menor**: quien pueda escribir la nota puede
 *   APUNTAR el audio a otro archivo sin que el hash lo note. Queda declarado en
 *   `CAMPOS_NO_SELLADOS_V3`, no escondido.
 * - **Las notas ya firmadas antes de hoy no tienen ruta** y no la van a tener:
 *   su audio, si existe, sigue huérfano. No se inventa un vínculo retroactivo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CAMPOS_SELLADOS_V4, CAMPOS_NO_SELLADOS_V3 } from '@/lib/expediente/integrity'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const pagina = () => leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

describe('el dato llega al documento', () => {
  it('el tipo de la nota declara el campo — sin esto no hay dónde escribirlo', () => {
    expect(leer('src/types/expediente.ts')).toMatch(/audioPath\?: string/)
  })

  it('`construirNota` lo escribe: es la nota que se guarda y se firma', () => {
    // AL REVÉS: antes de REG-509 `audioPath` aparecía UNA sola vez en esta
    // pantalla, y era una prop hacia un componente. Nunca entraba en la nota.
    expect(pagina()).toMatch(/audioPath: audio\.audioPath \|\| audioPathGuardadaRef\.current \|\| undefined,/)
  })

  it('y no se queda sólo en la prop que ya existía', () => {
    const veces = (pagina().match(/audioPath/g) ?? []).length
    expect(veces, 'audioPath debe aparecer en el ref, la rehidratación, la escritura y la prop')
      .toBeGreaterThanOrEqual(4)
  })
})

describe('sobrevive a cerrar la pestaña, que es el punto', () => {
  it('hay un ref que conserva lo que la nota ya traía', () => {
    expect(pagina()).toMatch(/const audioPathGuardadaRef = useRef\(''\)/)
  })

  it('se rehidrata al cargar la nota — si no, el ref nace vacío y no sirve', () => {
    expect(pagina()).toMatch(/if \(n\.audioPath\) audioPathGuardadaRef\.current = n\.audioPath/)
  })

  it('el ref va ANTES del `||`: el valor guardado gana cuando el grabador está vacío', () => {
    // El orden es el invariante. `audio.audioPath || ref` conserva; `ref || audio.audioPath`
    // también, pero `audio.audioPath` a secas BORRA — y es lo que había que evitar.
    const m = pagina().match(/audioPath: ([^\n]+)/)
    expect(m?.[1]).toContain('audioPathGuardadaRef.current')
  })
})

describe('la ruta, nunca la URL', () => {
  it('no se guarda ninguna URL de descarga en la nota', () => {
    const linea = pagina().match(/audioPath: [^\n]+/)?.[0] ?? ''
    expect(linea).not.toMatch(/getDownloadURL|https?:\/\//)
  })

  it('el reproductor resuelve la URL en el momento, no la lee del expediente', () => {
    // Así las reglas se evalúan otra vez con quien esté mirando.
    expect(leer('src/components/EscucharElMomento.tsx')).toMatch(/resolverUrl\(p\.audioPath\)/)
  })
})

describe('el sello no se toca — ninguna nota firmada cambia de hash', () => {
  it('`audioPath` NO está entre los campos sellados de v4', () => {
    expect(CAMPOS_SELLADOS_V4).not.toContain('audioPath')
  })

  it('está declarado como NO sellado, con su razón escrita', () => {
    const d = CAMPOS_NO_SELLADOS_V3.find(c => c.campo === 'audioPath')
    expect(d, 'un campo fuera del sello sin razón escrita es un olvido disfrazado').toBeDefined()
    expect(d!.razon.length).toBeGreaterThan(120)
  })

  it('la razón dice el residual: se puede reapuntar el audio sin que el hash lo note', () => {
    const d = CAMPOS_NO_SELLADOS_V3.find(c => c.campo === 'audioPath')!
    expect(d.razon).toMatch(/APUNTAR|reapunt/i)
  })

  it('el canónico v4 no lo menciona: es lista blanca y sigue siéndolo', () => {
    const integrity = leer('src/lib/expediente/integrity.ts')
    const v4 = integrity.slice(integrity.indexOf('function canonicoV4'),
                               integrity.indexOf('export const HASH_VERSION'))
    expect(v4).not.toContain('audioPath')
  })
})
