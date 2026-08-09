/**
 * EL AUDIO GRABADO NO SE BORRA — V9 · REG-270, REG-271, REG-272, REG-273.
 *
 * ── LOS CUATRO DEFECTOS, Y LO QUE TENÍAN EN COMÚN ───────────────────────────
 *
 * La auditoría `PATIENT-UX-TRUTH-001` encontró cuatro caminos por los que una
 * consulta **ya grabada** se perdía para siempre. No eran cuatro descuidos
 * sueltos: eran el mismo sesgo repetido.
 *
 * **Todo el esfuerzo de persistencia se puso donde YA había red.** El texto de
 * la nota tiene borrador en memoria, respaldo en `localStorage`, autoguardado a
 * Firestore cada 30 s y volcado al desmontar — cuatro copias. El audio, que no
 * tiene ninguna otra copia en ningún sitio, se quedó fuera de todas esas
 * defensas. Y cuando hubo que elegir entre proteger el texto y proteger el
 * audio —en la purga del cierre de sesión— se protegió el texto.
 *
 *   · **REG-270** Volver a grabar borraba el audio de la grabación anterior.
 *   · **REG-271** El trozo final se tiraba al salir de la pantalla grabando.
 *   · **REG-272** El cierre por inactividad no oía dictar.
 *   · **REG-273** Y al cerrar, se llevaba el audio sin transcribir.
 *
 * ── QUÉ **NO** CUBRE ESTE ARCHIVO ───────────────────────────────────────────
 *
 * Mucho, y conviene decirlo antes que nada.
 *
 * - **No ejecuta `MediaRecorder` ni IndexedDB.** No existen en Node, y montar
 *   el hook entero pediría un navegador. Lo que se comprueba aquí es que las
 *   **decisiones** quedaron escritas donde tienen que estar: el rango del
 *   borrado, el origen del índice, el latido, la condición de la purga.
 * - Por eso son, en parte, pruebas sobre el código fuente. Es deliberado y es
 *   la única forma honesta de sellarlo sin navegador: lo dice
 *   `NAV-NAVEGADOR-001` del backlog, y la comprobación en navegador **sigue
 *   pendiente**.
 * - **No prueba que la recuperación transcriba bien** un huérfano conservado.
 *   Prueba que sobreviva para poder intentarlo.
 * - **No cierra la navegación dentro de la aplicación.** `beforeunload` cubre
 *   recargar y cerrar la pestaña —incluida la recarga que hace el service
 *   worker al desplegar—, pero no un `router.push`. Sigue abierto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const HOOK = leer('src', 'hooks', 'useGrabacionAudio.ts')
const SALIR = leer('src', 'lib', 'salir-seguro.ts')
const AUTOLOGOUT = leer('src', 'components', 'AutoLogout.tsx')
const CONSULTA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

describe('REG-270 · el borrado de éxito no arrasa el audio de otra sesión', () => {
  it('`borrarChunks` acepta desde qué índice borrar', () => {
    expect(HOOK).toMatch(/async function borrarChunks\(recoveryKey: string, desde = 0\)/)
  })

  it('el rango de borrado empieza en `desde`, no en 0', () => {
    /**
     * Ésta es la que muerde. El `IDBKeyRange` iba de 0 a MAX_SAFE_INTEGER, así
     * que borraba TODO lo de la clave — incluidos los trozos de una grabación
     * anterior que nunca se transcribió. Probada al revés: devolviendo el 0
     * literal, falla.
     */
    const cuerpo = /async function borrarChunks[\s\S]*?\n}/.exec(HOOK)?.[0] ?? ''
    expect(cuerpo).toContain('IDBKeyRange.bound([recoveryKey, desde]')
    expect(cuerpo).not.toContain('IDBKeyRange.bound([recoveryKey, 0]')
  })

  it('los TRES caminos de éxito de `detener` borran sólo desde `recoveryBase`', () => {
    /**
     * Tres, no uno: dictado, diarización y transcripción por partes. Arreglar
     * uno y dejar dos es cómo nació este defecto — `recoveryBaseRef` ya
     * protegía al huérfano al ESCRIBIR y nadie actualizó el borrado.
     */
    const conBase = HOOK.match(/await borrarChunks\(recoveryKeyRef\.current, recoveryBaseRef\.current\)/g) ?? []
    expect(conBase.length).toBe(3)
    // Y ninguno se quedó atrás con la forma antigua.
    expect(HOOK).not.toMatch(/await borrarChunks\(recoveryKeyRef\.current\)/)
  })

  it('descartar a mano y recuperar SÍ borran todo', () => {
    /**
     * El complemento necesario: cuando el médico descarta el audio, o cuando la
     * recuperación ya lo transcribió entero, no queda nada que conservar.
     * Conservarlo «por si acaso» dejaría PHI en el disco sin motivo — y el
     * cartel reaparecería para siempre.
     */
    expect(HOOK).toMatch(/descartarRecovery[\s\S]{0,200}await borrarChunks\(recoveryKey\)/)
    expect(HOOK).toMatch(/await borrarChunks\(recoveryKey\)\s+\/\/ solo se borra si SÍ se transcribió/)
  })
})

describe('REG-271 · el trozo final se persiste al salir grabando', () => {
  it('el índice de disco sale de un contador, no de la longitud de un array', () => {
    /**
     * La causa raíz. `recoveryBase + todosChunks.length - 1` ataba el índice a
     * un array que se vacía; el `ondataavailable` final llegaba después del
     * vaciado y calculaba `recoveryBase - 1`, pisando un trozo bueno.
     */
    expect(HOOK).toContain('guardarChunk(recoveryKeyRef.current, persistIdxRef.current++, e.data)')
    expect(HOOK).not.toContain('recoveryBaseRef.current + todosChunksRef.current.length - 1')
  })

  it('el contador arranca donde acaba lo que ya había', () => {
    expect(HOOK).toContain('persistIdxRef.current = recoveryBaseRef.current')
  })

  it('ya no se desengancha el handler antes de parar', () => {
    /**
     * Desengancharlo era la defensa CORRECTA mientras el índice fuera frágil:
     * mejor perder 2 s que corromper el respaldo. Con el contador monótono la
     * colisión no puede ocurrir, y esos 2 s son justo los últimos que dijo el
     * médico antes de cambiar de pantalla.
     *
     * Probada al revés: reponiendo `rec.ondataavailable = null`, falla.
     */
    const cuerpo = /const liberarRecursos = useCallback[\s\S]*?\n  }, \[\]\)/.exec(HOOK)?.[0] ?? ''
    expect(cuerpo).not.toContain('rec.ondataavailable = null')
    expect(cuerpo).toContain('rec.stop()')
  })
})

describe('REG-272 · dictar cuenta como actividad, y avisa antes de recargar', () => {
  it('el hook emite un latido mientras graba', () => {
    expect(HOOK).toContain("export const EVENTO_ACTIVIDAD_DICTADO = 'nx:actividad-dictado'")
    expect(HOOK).toMatch(/setInterval\(latido, LATIDO_DICTADO_MS\)/)
  })

  it('el latido va MUY por debajo del umbral de inactividad', () => {
    /**
     * 30 minutos es el umbral. Un latido que se acercara a esa cifra dependería
     * de que ningún reloj derive ni ninguna pestaña se ralentice en segundo
     * plano. Se comprueba la relación, no el número: si alguien baja el umbral
     * a 2 minutos, esta prueba tiene que seguir teniendo sentido.
     */
    const latidoMs = Number(/const LATIDO_DICTADO_MS = ([\d_]+)/.exec(HOOK)?.[1]?.replace(/_/g, ''))
    const inactividadMin = Number(/const INACTIVIDAD_MIN = (\d+)/.exec(AUTOLOGOUT)?.[1])
    expect(latidoMs).toBeGreaterThan(0)
    expect(inactividadMin).toBeGreaterThan(0)
    expect(latidoMs).toBeLessThan((inactividadMin * 60_000) / 4)
  })

  it('AutoLogout escucha el latido y reinicia el contador', () => {
    /**
     * Comprobar que el manejador EXISTE no basta, y esta prueba lo aprendió por
     * las malas: en la comprobación al revés se borró el `addEventListener` y
     * los 20 casos siguieron en verde, porque el `const onDictado` seguía
     * escrito y el nombre del evento seguía importado. Un manejador declarado y
     * no registrado es exactamente el defecto que este archivo persigue —
     * «escrito y sin conectar»— y el guardián no lo veía.
     *
     * Ahora se exige el REGISTRO, y también que se quite al desmontar: un
     * oyente que sobrevive al componente es una fuga que reinicia el contador
     * de una sesión que ya no existe.
     */
    expect(AUTOLOGOUT).toContain('window.addEventListener(EVENTO_ACTIVIDAD_DICTADO, onDictado)')
    expect(AUTOLOGOUT).toContain('window.removeEventListener(EVENTO_ACTIVIDAD_DICTADO, onDictado)')
    expect(AUTOLOGOUT).toMatch(/const onDictado = \(\) => \{ if \(!avisandoRef\.current\) reiniciar\(\) \}/)
  })

  it('el latido NO pasa por el estrangulador de 5 s de los otros eventos', () => {
    /**
     * `onActividad` ignora todo lo que llegue antes de 5 s del anterior, para no
     * reiniciar en cada píxel del ratón. El latido llega una vez por minuto: si
     * lo tratara igual, un latido podría caer dentro de la ventana de otro
     * evento y perderse. Por eso tiene su propio oyente.
     */
    expect(AUTOLOGOUT).not.toMatch(/EVENTO_ACTIVIDAD_DICTADO[\s\S]{0,80}onActividad/)
  })

  it('avisa antes de recargar o cerrar la pestaña mientras graba', () => {
    /**
     * No había NI UN `beforeunload` en todo el repositorio. Para el texto es
     * defendible —el volcado al desmontar lo salva—; para una grabación no hay
     * volcado posible.
     */
    expect(HOOK).toContain("window.addEventListener('beforeunload', alSalir)")
    expect(HOOK).toContain("window.removeEventListener('beforeunload', alSalir)")
  })

  it('el aviso sólo existe mientras se graba', () => {
    /** Un `beforeunload` permanente pregunta «¿seguro?» al salir de una
     *  pantalla vacía, y eso enseña a decir que sí sin leer. */
    const efecto = /if \(estado !== 'grabando'\) return[\s\S]*?\n  \}, \[estado\]\)/.exec(HOOK)?.[0] ?? ''
    expect(efecto).toContain('beforeunload')
  })
})

describe('REG-273 · al cerrar sesión, el audio sin transcribir se conserva', () => {
  it('la purga del audio es CONDICIONAL', () => {
    /**
     * Ésta es la que muerde. `limpiarAudioLocal()` se llamaba en las dos ramas,
     * sin condición, y hace `deleteDatabase('nexusmed-recovery')`. Probada al
     * revés: quitando la condición, falla.
     */
    expect(SALIR).toContain('const purgarAudio = () => { if (!r.audioSinTranscribir) limpiarAudioLocal() }')
    // Y no queda ninguna llamada suelta que se salte la condición.
    const sueltas = (SALIR.match(/^\s+limpiarAudioLocal\(\)$/gm) ?? [])
    expect(sueltas).toEqual([])
  })

  it('las DOS ramas de salida pasan por la condición', () => {
    /** La rama de «todo guardado» y la de «no se pudo confirmar». Arreglar una
     *  sola dejaría el defecto vivo en el camino más probable. */
    expect((SALIR.match(/purgarAudio\(\)/g) ?? []).length).toBe(2)
  })

  it('el acuse permite declarar audio en vuelo', () => {
    expect(SALIR).toContain('marcarAudioSinTranscribir?: () => void')
    expect(SALIR).toContain('audioSinTranscribir: boolean')
  })

  it('sin nadie escuchando, la respuesta sigue siendo completa', () => {
    /**
     * `guardarTodoYEsperar` tiene tres salidas. Si una olvidara el campo nuevo,
     * `r.audioSinTranscribir` sería `undefined`, la condición pasaría, y el
     * audio se borraría exactamente igual que antes — con el arreglo puesto y
     * sin efecto. Es la forma más silenciosa de que esto vuelva.
     */
    const fn = /export async function guardarTodoYEsperar[\s\S]*?\n\}/.exec(SALIR)?.[0] ?? ''
    const retornos = fn.match(/return \{[\s\S]*?\}/g) ?? []
    expect(retornos.length).toBe(3)
    for (const r of retornos) expect(r).toContain('audioSinTranscribir')
  })

  it('la consulta declara el audio ANTES del `return` por nota vacía', () => {
    /**
     * El orden es el arreglo. Debajo hay un `return` temprano cuando la nota no
     * tiene contenido, y una grabación recién empezada es exactamente eso: sin
     * resumen, sin diagnósticos, sin transcripción. Declarar después sería
     * declarar en todos los casos menos en el que más audio hay por delante.
     */
    const oyente = /const alGuardarTodo = \(ev: Event\) => \{[\s\S]*?\n    \}/.exec(CONSULTA)?.[0] ?? ''
    expect(oyente).toContain('marcarAudioSinTranscribir')
    expect(oyente.indexOf('marcarAudioSinTranscribir')).toBeLessThan(oyente.indexOf('if (e.firmada) return'))
  })

  it('la consulta lee el estado por REF, no por captura', () => {
    /**
     * El oyente se registra con `[guardarBorrador]` en las dependencias: leer
     * `audio.estado` directamente capturaría el valor que hubiera al
     * registrarse —«inactivo», casi siempre— y la declaración no se haría
     * nunca. El arreglo habría quedado escrito y sin efecto.
     */
    expect(CONSULTA).toContain('audioEstadoRef.current = audio.estado')
    const oyente = /const alGuardarTodo = \(ev: Event\) => \{[\s\S]*?\n    \}/.exec(CONSULTA)?.[0] ?? ''
    expect(oyente).toContain('const enVuelo = audioEstadoRef.current')
  })

  it('cubre los tres estados con audio en vuelo, no sólo «grabando»', () => {
    /** `pausado` tiene audio guardado y sin transcribir; `subiendo` está a
     *  mitad de la petición y puede fallar. Los dos perderían igual. */
    const oyente = /const alGuardarTodo = \(ev: Event\) => \{[\s\S]*?\n    \}/.exec(CONSULTA)?.[0] ?? ''
    for (const e of ['grabando', 'pausado', 'subiendo']) expect(oyente).toContain(`'${e}'`)
  })
})
