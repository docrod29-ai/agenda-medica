/**
 * LA GRABACIÓN LARGA NO SE MUERE A LOS 7 MINUTOS Y MEDIO — REG-225.
 *
 * ── LO QUE EL MÉDICO REPORTÓ ────────────────────────────────────────────────
 *
 * «estoy grabando y pasa un tiempo y me paras en seco y me dices que recupere
 * el audio». Preguntado, contestó dos cosas que juntas señalan la causa:
 * **antes de 10 minutos**, e **igual en iPhone que en computadora**.
 *
 * Que pase igual en los dos aparatos descarta el navegador. Es aritmética.
 *
 * ── LA ARITMÉTICA ───────────────────────────────────────────────────────────
 *
 *     64 000 bits/s ÷ 8            = 8 000 bytes por segundo
 *     3 600 000 bytes ÷ 8 000 B/s  = 450 s = **7 min 30 s**
 *
 * A los 7 min 30 s el audio deja de caber en el cuerpo de la petición, y
 * `detener()` cambia al camino «grande»: subir a Storage y diarizar por URL.
 *
 * ── Y ESE CAMINO ESTABA MUERTO ──────────────────────────────────────────────
 *
 * Para mandar la URL hay que pedirla con `getDownloadURL()`, que es un GET de
 * metadatos gobernado por la regla `read` de Storage. Y la regla decía:
 *
 *     match /consultas-audio/{uid}/{allPaths=**} { allow read: if false; }
 *
 * Lanzaba `storage/unauthorized` en el primer segundo. **Toda consulta de más
 * de 7 min 30 s perdía la separación de voces**, caía al troceado, y de ahí
 * salía el aviso de recuperar el audio.
 *
 * El propio archivo lo documenta cinco líneas más abajo, para el otro bucket:
 * *«LECTURA por el dueño: es OBLIGATORIA para que getDownloadURL() funcione en
 * el navegador»*. Se reparó ahí en v245 y aquí se olvidó — porque el comentario
 * de arriba sólo pensó en AssemblyAI, que descarga por URL con token y no por
 * reglas, y no en que el cliente tiene que LEER la URL antes de mandársela.
 *
 * ── LOS TRES DAÑOS COLATERALES ──────────────────────────────────────────────
 *
 * **1. El motivo mentía.** El `catch` devolvía «tiempo_agotado» pasara lo que
 * pasara. El médico leía «se agotó el tiempo» y buscaba el problema en su
 * internet, cuando fue un permiso denegado.
 *
 * **2. El texto en vivo se tiraba justo cuando era lo único que quedaba.**
 * `texto.trim()` era verdadero aunque fallaran TODOS los lotes, porque los
 * marcadores `[⚠ FALTA UN TRAMO…]` son texto. El respaldo con la transcripción
 * en vivo —que el médico estaba viendo en pantalla— era inalcanzable.
 *
 * **3. La recuperación usaba SIEMPRE el camino roto**, sin mirar el tamaño. El
 * botón que se ofrece como red de seguridad estaba garantizado a degradar.
 *
 * ── LO QUE ESTA PRUEBA NO PUEDE HACER ───────────────────────────────────────
 *
 * No prueba la regla de Storage en vivo: las reglas se despliegan aparte y
 * `vercel --prod` no las publica. Comprueba que el archivo la declara. Que esté
 * DESPLEGADA hay que verificarlo grabando más de ocho minutos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')
const reglas = leer('storage.rules')

describe('la regla de Storage deja leer la URL del propio audio', () => {
  it('el dueño puede LEER su audio de consulta', () => {
    const bloque = /match \/consultas-audio\/\{uid\}\/\{allPaths=\*\*\}[\s\S]*?\n    \}/.exec(reglas)?.[0] ?? ''
    expect(bloque, 'no se encontró el bloque de consultas-audio').toBeTruthy()
    expect(bloque).not.toMatch(/allow read: if false/)
    expect(bloque).toMatch(/allow read: if request\.auth != null && request\.auth\.uid == uid/)
  })

  it('y sigue sin poder leerlo NADIE MÁS', () => {
    // Abrir la lectura al dueño no puede convertirse en abrirla a cualquiera.
    const bloque = /match \/consultas-audio\/\{uid\}\/\{allPaths=\*\*\}[\s\S]*?\n    \}/.exec(reglas)?.[0] ?? ''
    expect(bloque).not.toMatch(/allow read: if request\.auth != null;/)
    expect(bloque).not.toMatch(/allow read: if true/)
    // Y el resto del bucket sigue cerrado.
    expect(reglas).toMatch(/match \/\{allPaths=\*\*\} \{\s*allow read, write: if false;/)
  })
})

describe('el umbral vive en un solo sitio', () => {
  it('está declarado con nombre, no suelto dentro de una función', () => {
    expect(hook).toMatch(/const LIMITE_CUERPO_BYTES = 3_600_000/)
  })

  it('los DOS caminos lo usan: detener y recuperar', () => {
    /**
     * `recuperarAudio` llamaba siempre al camino largo, mirara o no el tamaño.
     * Para un audio de dos minutos eso es subirlo a Storage sin ninguna
     * necesidad — el camino más frágil para el caso que menos lo pide.
     */
    expect(hook.split('LIMITE_CUERPO_BYTES').length - 1).toBeGreaterThanOrEqual(3)
    expect(hook).toMatch(/const GRANDE = blob\.size > LIMITE_CUERPO_BYTES/)
    expect(hook).toMatch(/const diar = blob\.size > LIMITE_CUERPO_BYTES/)
  })

  it('la cuenta sigue dando 7 min 30 s (si alguien cambia el bitrate, que se entere)', () => {
    const bitrate = Number(/const BITRATE_OPUS = ([\d_]+)/.exec(hook)?.[1].replace(/_/g, ''))
    const limite = Number(/const LIMITE_CUERPO_BYTES = ([\d_]+)/.exec(hook)?.[1].replace(/_/g, ''))
    expect(bitrate).toBe(64_000)
    const bytesPorSegundo = bitrate / 8
    expect(Math.round(limite / bytesPorSegundo)).toBe(450)
  })
})

describe('el motivo del fallo dice la verdad', () => {
  it('un error de Storage NO se etiqueta «tiempo agotado»', () => {
    expect(hook).toMatch(/if \(codigo\.startsWith\('storage\/'\)\) return falla\('sin_permiso_de_lectura'\)/)
  })

  it('y «no se pudo subir» se distingue de «no se pudo leer»', () => {
    expect(hook).toMatch(/if \(!subido\) return falla\('no_se_pudo_subir'\)/)
  })

  it('los dos motivos nuevos tienen texto en castellano para el médico', () => {
    const motivos = leer('src', 'lib', 'expediente', 'motivo-sin-diarizacion.ts')
    expect(motivos).toContain('sin_permiso_de_lectura:')
    expect(motivos).toContain('no_se_pudo_subir:')
    // Y el de permiso le dice explícitamente que NO es su internet, que es
    // adonde le mandaba el motivo anterior.
    expect(motivos).toMatch(/sin_permiso_de_lectura:[^\n]*no es tu conexión/)
  })
})

describe('un texto hecho sólo de advertencias no cuenta como texto', () => {
  it('si TODOS los lotes fallaron, no se da por bueno el resultado', () => {
    expect(hook).toMatch(/const todoFalló = porPartes\.lotesFallidos > 0/)
    expect(hook).toMatch(/if \(texto\.trim\(\) && !todoFalló\)/)
  })

  it('y entonces sí se alcanza el respaldo de la transcripción en vivo', () => {
    const guarda = hook.indexOf('if (texto.trim() && !todoFalló)')
    const respaldo = hook.indexOf('if (textosChunksRef.current.length > 0)')
    expect(guarda).toBeGreaterThan(-1)
    expect(respaldo).toBeGreaterThan(guarda)
  })

  it('el marcador que se filtra es el mismo que se escribe', () => {
    // Si alguien cambia el texto del marcador y no el filtro, el respaldo se
    // vuelve inalcanzable otra vez y en silencio.
    expect(hook).toContain('FALTA UN TRAMO DE LA GRABACIÓN')
    expect(hook).toMatch(/replace\(\/\\\[⚠\[\^\\\]\]\*\\\]\/g, ''\)/)
  })
})
