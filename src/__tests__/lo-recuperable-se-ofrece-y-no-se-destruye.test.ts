/**
 * LO RECUPERABLE SE OFRECE, Y NO SE DESTRUYE — auditoría de Consultorio, H-03…H-07.
 *
 * ── CÓMO SE DESCUBRIERON ────────────────────────────────────────────────────
 *
 * El auditor de Consultorio recorrió el camino del AUDIO —no el de la nota— de
 * punta a punta: dónde se graba, dónde se guarda, quién lo enseña, quién lo
 * borra. Los cinco hallazgos salieron de preguntar, en cada punto, «¿y si aquí
 * hay material y nadie lo sabe?».
 *
 * ── LOS CINCO, Y LA CAUSA RAÍZ DE CADA UNO ──────────────────────────────────
 *
 * · **H-03 (P0)** El cartel «¿Recuperar y transcribir?» vivía DENTRO de
 *   `!esElPrincipio && (…)`. `esElPrincipio` es «el grabador está quieto y no
 *   hay transcripción», que tras recargar la página es verdadero **aunque haya
 *   una consulta entera esperando en IndexedDB**. El único camino de vuelta al
 *   audio no se pintaba justo cuando era el único camino.
 *   Causa raíz: se condicionó el cartel a cómo se ve el editor en vez de a si
 *   existe material.
 *
 * · **H-04 (P1)** Al cerrar sesión, `/consulta` declaraba audio sin transcribir
 *   sólo en `grabando | pausado | subiendo`. Faltaban `error` —donde el propio
 *   hook le promete al médico que «el audio quedó GUARDADO en este
 *   dispositivo»— y el huérfano de una sesión anterior. `salirSeguro` purgaba
 *   `nexusmed-recovery` entera.
 *   Causa raíz: la lista de estados se escribió mirando la grabación en curso,
 *   no el material en disco. Y el sondeo de IndexedDB se tragaba su error con
 *   `catch(() => {})`, concluyendo «no hay» de un «no pude mirar».
 *
 * · **H-05 (P1)** Al llegar la transcripción con las voces separadas se hacía
 *   `setTranscripcion(...)` a secas, ANTES de consultar la salvaguarda. La
 *   salvaguarda existía —`edicionManualRef`— pero sólo decidía si se
 *   re-estructuraba la NOTA: el editor de dictado se pisaba igual. Y ese editor
 *   es donde el médico corrige una dosis mal oída.
 *   Causa raíz: la guarda se puso sobre el efecto caro (re-procesar con IA) y
 *   no sobre el dato. Además, sólo las secciones narrativas la levantaban; el
 *   propio editor de dictado no.
 *
 * · **H-06 (P1)** `getNota(...).catch(() => null)` daba el MISMO `null` para
 *   «no existe» y para «no pude leer». En la ruta que adopta el `notaId` de un
 *   respaldo, un fallo de red hacía adoptar el id de una nota que podía estar
 *   firmada — el fallo del 4-ago-2026 entrando otra vez por el `catch`.
 *   Causa raíz: colapsar dos estados semánticos en un solo valor.
 *
 * · **H-07 (P1)** La rama `modoDeHabla === 'dictado'` de `detener()` se quedaba
 *   con `.texto` y tiraba `lotesFallidos`. Una transcripción con tramos
 *   perdidos pasaba por buena y borraba los trozos de IndexedDB. El camino
 *   largo, dos pantallas más abajo, ya sabía hacerlo bien.
 *   Causa raíz: una decisión escrita dos veces, arreglada en una copia.
 *
 * ── LA REGLA QUE LOS HACE SEGUROS ───────────────────────────────────────────
 *
 * Dos, y son de la casa:
 *
 * 1. **Ausencia de dato no es dato de ausencia** (seguridad clínica §4). No
 *    verse en pantalla no es «no existe»; no haber podido leer no es «no hay».
 * 2. **Autoridad del médico > salida automática.** Una corrección hecha a mano
 *    no la reemplaza en silencio un resultado tardío de ASR.
 *
 * Y el sesgo de todas las decisiones va hacia CONSERVAR, porque los dos errores
 * no cuestan lo mismo: conservar de más deja en el disco un archivo que el
 * médico puede descartar de un clic; conservar de menos borra la única copia de
 * lo que dijo el paciente.
 *
 * ── QUÉ **NO** CUBRE ESTE ARCHIVO ───────────────────────────────────────────
 *
 * - **No ejecuta IndexedDB, ni `MediaRecorder`, ni React.** No existen en Node.
 *   Lo que se prueba de verdad —con entradas y salidas— son las funciones
 *   puras; que la pantalla las CONSUMA se comprueba sobre el texto fuente, que
 *   es la única forma honesta de sellarlo sin navegador. Sigue pendiente la
 *   comprobación en navegador (`NAV-NAVEGADOR-001`).
 * - **No prueba que el audio conservado se transcriba bien.** Prueba que
 *   sobreviva para poder intentarlo.
 * - **No cubre el texto en vivo** que entra mientras se graba: ahí el reemplazo
 *   es el comportamiento pedido, no un atropello.
 * - **No cubre `salirSeguro` en sí.** Que la purga respete la declaración ya lo
 *   sella `el-audio-grabado-no-se-borra.test.ts` (REG-297). Aquí se cubre quién
 *   la emite y cuándo.
 * - **No hay caso multi-consultorio real.** El aislamiento se apoya en que la
 *   clave de recuperación es `consulta-${patientId}` y en que `getNota` recibe
 *   `clinicId`; abajo se comprueba que el arreglo no toca ninguna de las dos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  debeOfrecerRecuperacion,
  hayAudioQueNoSePuedePurgar,
  puedeReemplazarTranscripcion,
  clasificarNotaPrevia,
  leerNotaPrevia,
  decidirAdopcionDeNotaPrevia,
  estaEnVuelo,
  type EstadoGrabador,
} from '@/lib/expediente/recuperacion-consulta'
import {
  soloSonAdvertencias, sePuedeBorrarElAudio, textoUtil,
  type ResultadoPorPartes,
} from '@/hooks/useGrabacionAudio'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const CONSULTA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const HOOK = leer('src', 'hooks', 'useGrabacionAudio.ts')

const TODOS: EstadoGrabador[] = ['inactivo', 'grabando', 'pausado', 'subiendo', 'listo', 'error']

// ══════════════════════════════════════════════════════════════════════════════
describe('H-03 · el cartel de recuperación no cuelga de «parece el principio»', () => {
// ══════════════════════════════════════════════════════════════════════════════

  it('con audio guardado y el grabador quieto, se ofrece', () => {
    expect(debeOfrecerRecuperacion({ hayAudioGuardado: true, estadoGrabador: 'inactivo' })).toBe(true)
  })

  it('sin audio guardado no se ofrece nada — no se inventa un cartel', () => {
    expect(debeOfrecerRecuperacion({ hayAudioGuardado: false, estadoGrabador: 'inactivo' })).toBe(false)
  })

  it('a mitad de otra grabación NO se ofrece: sería invitar a pisar lo que se capta', () => {
    for (const e of TODOS.filter(e => e !== 'inactivo')) {
      expect(debeOfrecerRecuperacion({ hayAudioGuardado: true, estadoGrabador: e })).toBe(false)
    }
  })

  /**
   * ── LA QUE MUERDE ───────────────────────────────────────────────────────
   *
   * El escenario exacto de H-03: el médico recarga la pantalla. El editor está
   * vacío, el grabador `inactivo`, la transcripción en blanco — o sea,
   * `esElPrincipio === true`— y en IndexedDB hay una consulta entera.
   *
   * Probada al revés: si `debeOfrecerRecuperacion` mirara algo parecido a
   * «¿está el editor vacío?» y devolviera `false` por ello, esto falla.
   */
  it('RECARGA CON EL EDITOR VACÍO Y AUDIO INTACTO: se ofrece igual', () => {
    expect(debeOfrecerRecuperacion({ hayAudioGuardado: true, estadoGrabador: 'inactivo' })).toBe(true)
  })

  it('la pantalla lo consume, y el cartel YA NO vive dentro del gate de `esElPrincipio`', () => {
    expect(CONSULTA).toContain("from '@/lib/expediente/recuperacion-consulta'")
    expect(CONSULTA).toContain('debeOfrecerRecuperacion({ hayAudioGuardado: ofreceRecovery, estadoGrabador: audio.estado })')
    /**
     * El corazón del arreglo, comprobado por posición y no de oídas: el cartel
     * («¿Recuperar y transcribir?») tiene que aparecer ANTES del `!esElPrincipio &&`
     * que abre la fila de controles. Si alguien lo vuelve a meter dentro, el
     * orden se invierte y esto falla.
     */
    const cartel = CONSULTA.indexOf('¿Recuperar y transcribir?')
    const gate = CONSULTA.indexOf('{!esElPrincipio && (')
    expect(cartel).toBeGreaterThan(0)
    expect(gate).toBeGreaterThan(0)
    expect(cartel).toBeLessThan(gate)
  })

  it('la condición vieja —`ofreceRecovery && audio.estado === ...` escrita a mano— ya no está', () => {
    expect(CONSULTA).not.toContain("{ofreceRecovery && audio.estado === 'inactivo' && (")
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('H-04 · nada recuperable se purga sin demostrar que sobra', () => {
// ══════════════════════════════════════════════════════════════════════════════

  it('los tres estados que ya se declaraban siguen declarándose', () => {
    for (const e of ['grabando', 'pausado', 'subiendo'] as EstadoGrabador[]) {
      expect(hayAudioQueNoSePuedePurgar({
        estadoGrabador: e, hayAudioGuardado: false, descartadoPorElMedico: false,
      })).toBe(true)
    }
  })

  /**
   * LA PRIMERA MITAD DE H-04. `error` es el estado en el que el hook escribe
   * «El audio quedó GUARDADO en este dispositivo — reintenta con "Recuperar
   * audio"». Prometerlo y purgarlo en el mismo minuto es peor que no prometerlo.
   */
  it('`error` SE DECLARA: es el estado en el que se le prometió al médico que el audio quedaba', () => {
    expect(hayAudioQueNoSePuedePurgar({
      estadoGrabador: 'error', hayAudioGuardado: false, descartadoPorElMedico: false,
    })).toBe(true)
    expect(estaEnVuelo('error')).toBe(true)
    // Y la promesa sigue escrita donde se dijo — si se quita, este caso pierde su razón.
    expect(HOOK).toContain('El audio quedó GUARDADO en este dispositivo')
  })

  /**
   * LA SEGUNDA MITAD, y la que enlaza con H-03: el huérfano. Grabador quieto,
   * pantalla que parece nueva, y una consulta entera en IndexedDB.
   */
  it('HUÉRFANO DE OTRA SESIÓN: grabador `inactivo` pero material en disco → se declara', () => {
    expect(hayAudioQueNoSePuedePurgar({
      estadoGrabador: 'inactivo', hayAudioGuardado: true, descartadoPorElMedico: false,
    })).toBe(true)
  })

  it('sin material y sin grabación en vuelo, la purga sigue haciendo su trabajo (PHI)', () => {
    expect(hayAudioQueNoSePuedePurgar({
      estadoGrabador: 'inactivo', hayAudioGuardado: false, descartadoPorElMedico: false,
    })).toBe(false)
    expect(hayAudioQueNoSePuedePurgar({
      estadoGrabador: 'listo', hayAudioGuardado: false, descartadoPorElMedico: false,
    })).toBe(false)
  })

  it('el descarte EXPLÍCITO del médico es la única forma de desproteger', () => {
    expect(hayAudioQueNoSePuedePurgar({
      estadoGrabador: 'inactivo', hayAudioGuardado: true, descartadoPorElMedico: true,
    })).toBe(false)
    // Ni siquiera un descarte deja pasar una grabación EN CURSO por accidente:
    // el médico descartó el huérfano, no lo que está grabando ahora.
    expect(hayAudioQueNoSePuedePurgar({
      estadoGrabador: 'grabando', hayAudioGuardado: true, descartadoPorElMedico: true,
    })).toBe(false)
  })

  it('la pantalla lo consume en el oyente de cierre de sesión, no en un helper suelto', () => {
    expect(CONSULTA).toContain('hayAudioQueNoSePuedePurgar({')
    expect(CONSULTA).toContain('estadoGrabador: audioEstadoRef.current,')
    expect(CONSULTA).toContain('hayAudioGuardado: hayAudioGuardadoRef.current,')
    expect(CONSULTA).toContain('descartadoPorElMedico: audioDescartadoRef.current,')
    // La lista de estados escrita a mano ya no existe: era la que se quedaba corta.
    expect(CONSULTA).not.toContain("enVuelo === 'grabando' || enVuelo === 'pausado' || enVuelo === 'subiendo'")
  })

  it('el sondeo de IndexedDB ya no concluye «no hay» de un «no pude mirar»', () => {
    /**
     * Probada al revés: con el `catch(() => {})` de antes, `hayAudioGuardadoRef`
     * se quedaba en `false` tras un fallo de lectura y la purga se llevaba el
     * audio. Ahora el fallo deja la protección PUESTA.
     */
    expect(CONSULTA).toContain('.catch(() => { hayAudioGuardadoRef.current = true })')
    expect(CONSULTA).toContain('audio.hayRecovery(`consulta-${patientId}`)')
  })

  it('empezar a grabar protege desde el primer instante, sin esperar a otro sondeo', () => {
    expect(CONSULTA).toMatch(/if \(audio\.estado === 'grabando'\) \{\s*\n\s*hayAudioGuardadoRef\.current = true/)
  })

  it('«Descartar» apaga la protección en LOS DOS carteles, no en uno', () => {
    const veces = CONSULTA.split('audioDescartadoRef.current = true').length - 1
    expect(veces).toBe(2)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('H-05 · autoridad del médico > salida automática', () => {
// ══════════════════════════════════════════════════════════════════════════════

  it('sin edición manual, el texto tardío entra: no hay autoría que respetar', () => {
    expect(puedeReemplazarTranscripcion({
      edicionManual: false, textoActual: 'lo del streaming', textoEntrante: 'lo diarizado',
    })).toBe(true)
  })

  it('con el editor vacío entra igual: no hay nada que pisar', () => {
    expect(puedeReemplazarTranscripcion({
      edicionManual: true, textoActual: '   ', textoEntrante: 'lo diarizado',
    })).toBe(true)
  })

  it('si el texto entrante es el MISMO, no es un reemplazo — no se molesta al médico', () => {
    expect(puedeReemplazarTranscripcion({
      edicionManual: true, textoActual: 'amoxicilina 500 mg', textoEntrante: '  amoxicilina 500 mg  ',
    })).toBe(true)
  })

  /**
   * ── LA QUE MUERDE ───────────────────────────────────────────────────────
   *
   * El caso clínico de H-05, con datos sintéticos: el reconocedor oyó «500 mg»
   * donde el médico dijo «50 mg», el médico lo corrigió a mano sobre la nota
   * preliminar, y la diarización llega tarde trayendo otra vez el error.
   *
   * Probada al revés: devolviendo `true` a secas, esto falla.
   */
  it('UNA CORRECCIÓN A MANO NO LA PISA UN RESULTADO TARDÍO DE ASR', () => {
    expect(puedeReemplazarTranscripcion({
      edicionManual: true,
      textoActual: 'metoprolol 50 mg cada 12 horas',
      textoEntrante: 'metoprolol 500 mg cada 12 horas',
    })).toBe(false)
  })

  it('la pantalla pregunta ANTES de escribir, no después', () => {
    /** El `setTranscripcion` tiene que estar detrás de la decisión, no delante. */
    expect(CONSULTA).toContain('const puedePisar = puedeReemplazarTranscripcion({')
    expect(CONSULTA).toContain('if (puedePisar) voz.setTranscripcion(entrante)')
    // Y la escritura incondicional que había ya no existe.
    expect(CONSULTA).not.toContain('voz.setTranscripcion(conBase(audio.transcripcion))')
  })

  it('el texto bueno NO se tira: se guarda para ofrecerlo', () => {
    expect(CONSULTA).toContain('else textoDiarizadoPendienteRef.current = entrante')
    expect(CONSULTA).toContain('if (pendiente) { voz.setTranscripcion(pendiente); autoProcRef.current = true }')
    // Y se le ofrece: la decisión de enseñar el cartel entra por el mismo camino.
    expect(CONSULTA).toContain('if (!puedePisar || (preliminarRef.current && edicionManualRef.current))')
  })

  it('empezar OTRA grabación rearma la bandera: ahí protege `baseTranscripcionRef`, no la guarda', () => {
    /**
     * Al arrancar una segunda tanda, `baseTranscripcionRef` congela lo que el
     * médico tenía y `conBase` lo antepone a todo lo que llegue después. Su
     * texto viaja DENTRO de lo entrante, así que preguntarle sería enseñarle un
     * cartel donde no hay nada que decidir. La guarda vuelve en cuanto teclee.
     */
    expect(puedeReemplazarTranscripcion({
      edicionManual: false,
      textoActual: 'metoprolol 50 mg',
      textoEntrante: 'metoprolol 50 mg\nsegunda tanda',
    })).toBe(true)
    const flanco = /if \(grabando && !grabandoPrevioRef\.current\) \{[\s\S]*?\n    \}/.exec(CONSULTA)?.[0] ?? ''
    expect(flanco).toContain('baseTranscripcionRef.current = voz.transcripcion.trim()')
    expect(flanco).toContain('edicionManualRef.current = false')
    expect(flanco).toContain("textoDiarizadoPendienteRef.current = ''")
  })

  it('el EDITOR DE DICTADO también levanta la bandera de edición manual', () => {
    /**
     * Era la mitad silenciosa de H-05: `edicionManualRef` sólo lo levantaban
     * las secciones narrativas, y el campo que la re-proyección pisaba es
     * justo el otro. Sin esto la guarda de arriba no se activa nunca en el
     * caso real.
     */
    const bloque = /<textarea\s+value=\{voz\.transcripcion[\s\S]*?\/>/.exec(CONSULTA)?.[0] ?? ''
    expect(bloque).toContain('edicionManualRef.current = true')
    expect(bloque).toContain('voz.setTranscripcion(e.target.value)')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('H-06 · error de red ≠ ausencia de dato', () => {
// ══════════════════════════════════════════════════════════════════════════════

  it('los cuatro estados salen distintos del clasificador', () => {
    expect(clasificarNotaPrevia(null)).toEqual({ estado: 'inexistente' })
    expect(clasificarNotaPrevia({ estado: 'firmada' })).toEqual({ estado: 'firmada' })
    expect(clasificarNotaPrevia({ estado: 'borrador' })).toEqual({ estado: 'borrador' })
    expect(clasificarNotaPrevia({})).toEqual({ estado: 'borrador' })
  })

  it('un fallo del lector es `error`, y NO se confunde con `inexistente`', async () => {
    const l = await leerNotaPrevia(async () => { throw new Error('offline') })
    expect(l).toEqual({ estado: 'error' })
    expect(l).not.toEqual({ estado: 'inexistente' })
  })

  it('una lectura buena atraviesa el envoltorio sin cambiar de significado', async () => {
    expect(await leerNotaPrevia(async () => null)).toEqual({ estado: 'inexistente' })
    expect(await leerNotaPrevia(async () => ({ estado: 'firmada' }))).toEqual({ estado: 'firmada' })
    expect(await leerNotaPrevia(async () => ({ estado: 'borrador' }))).toEqual({ estado: 'borrador' })
  })

  it('borrador e inexistente ADOPTAN el id — que es por lo que existe esta ruta', () => {
    /**
     * No es un detalle: sin adoptar el id se creaba una gemela en el
     * expediente y, al firmar una, la otra quedaba huérfana. El arreglo de
     * H-06 no puede llevarse eso por delante.
     */
    expect(decidirAdopcionDeNotaPrevia({ estado: 'borrador' })).toEqual({ adoptar: true, aviso: null })
    expect(decidirAdopcionDeNotaPrevia({ estado: 'inexistente' })).toEqual({ adoptar: true, aviso: null })
  })

  it('firmada no se adopta, y se dice por qué (NOM-024: es inmutable)', () => {
    const d = decidirAdopcionDeNotaPrevia({ estado: 'firmada' })
    expect(d.adoptar).toBe(false)
    expect(d.aviso).toContain('firmada')
  })

  /**
   * ── LA QUE MUERDE ───────────────────────────────────────────────────────
   *
   * Con `catch(() => null)`, un fallo de red producía `{estado:'inexistente'}`
   * y por tanto `adoptar: true`. Probada al revés: si `error` cayera en la
   * misma rama que `inexistente`, esto falla en las dos aserciones.
   */
  it('ERROR NO ADOPTA, y su aviso es DISTINTO del de firmada', () => {
    const err = decidirAdopcionDeNotaPrevia({ estado: 'error' })
    const firm = decidirAdopcionDeNotaPrevia({ estado: 'firmada' })
    expect(err.adoptar).toBe(false)
    expect(err.aviso).toBeTruthy()
    expect(err.aviso).not.toBe(firm.aviso)
    // Y no le dice al médico algo que no sabe: no afirma que esté firmada.
    expect(err.aviso).toContain('No se pudo verificar')
  })

  it('las DOS rutas de restauración consumen la misma decisión, no una copia cada una', () => {
    const veces = CONSULTA.split('decidirAdopcionDeNotaPrevia(').length - 1
    expect(veces).toBe(2)
    expect(CONSULTA.split('leerNotaPrevia(() => getNota(').length - 1).toBe(2)
    // El colapso viejo ya no existe en ninguna de las dos.
    expect(CONSULTA).not.toContain('getNota(clinicId, patientId, id).catch(() => null)')
    expect(CONSULTA).not.toContain('getNota(clinicId, patientId, idPrevio).catch(() => null)')
  })

  it('«cargando» sigue siendo un estado propio: no se adopta nada antes de que vuelva la lectura', () => {
    /**
     * No hay un valor `cargando` que probar — es el intervalo en el que la
     * promesa no ha vuelto. Lo que se comprueba es que la adopción viva DENTRO
     * del `await`: `notaIdRef.current = id` nunca antes de la decisión.
     */
    const auto = CONSULTA.indexOf('const decision = decidirAdopcionDeNotaPrevia(')
    const adopta = CONSULTA.indexOf('notaIdRef.current = id\n', auto)
    expect(auto).toBeGreaterThan(0)
    expect(adopta).toBeGreaterThan(auto)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('H-07 · un fallo parcial no finge éxito ni destruye la fuente', () => {
// ══════════════════════════════════════════════════════════════════════════════

  const r = (texto: string, lotesFallidos: number): ResultadoPorPartes => ({ texto, lotesFallidos })

  it('sin lotes caídos se puede borrar el audio: ya está todo transcrito', () => {
    expect(sePuedeBorrarElAudio(r('la consulta entera', 0))).toBe(true)
    expect(soloSonAdvertencias(r('la consulta entera', 0))).toBe(false)
  })

  /**
   * ── LA QUE MUERDE ───────────────────────────────────────────────────────
   *
   * Un lote caído en medio: hay texto de verdad, pero le falta un tramo. La
   * rama de dictado veía `texto.trim() === true` y borraba los trozos. El audio
   * era lo ÚNICO que permitía volver a por ese tramo.
   *
   * Probada al revés: devolviendo `true` a secas en `sePuedeBorrarElAudio`,
   * esto falla.
   */
  it('CON UN LOTE CAÍDO NO SE BORRA EL AUDIO, aunque haya texto aprovechable', () => {
    const parcial = r('tos de tres días [⚠ FALTA UN TRAMO DE LA GRABACIÓN] y fiebre', 1)
    expect(parcial.texto.trim()).toBeTruthy()      // por esto pasaba el filtro viejo
    expect(sePuedeBorrarElAudio(parcial)).toBe(false)
    // Y no es «todo falló»: hay texto útil, así que SÍ se aplica a la nota.
    expect(soloSonAdvertencias(parcial)).toBe(false)
    expect(textoUtil(parcial)).toContain('fiebre')
  })

  it('un texto hecho SÓLO de advertencias no es un texto', () => {
    const nada = r('[⚠ FALTA UN TRAMO DE LA GRABACIÓN] [⚠ FALTA UN TRAMO DE LA GRABACIÓN]', 2)
    expect(nada.texto.trim()).toBeTruthy()
    expect(textoUtil(nada)).toBe('')
    expect(soloSonAdvertencias(nada)).toBe(true)
    expect(sePuedeBorrarElAudio(nada)).toBe(false)
  })

  it('marcadores sin lotes caídos no bloquean nada — el conteo manda, no el símbolo', () => {
    expect(soloSonAdvertencias(r('[⚠ algo]', 0))).toBe(false)
  })

  it('la rama de DICTADO consume las dos preguntas — era la que tiraba `lotesFallidos`', () => {
    const rama = /if \(modoDeHablaRef\.current === 'dictado'\) \{[\s\S]*?\n    \}/.exec(HOOK)?.[0] ?? ''
    expect(rama).toBeTruthy()
    expect(rama).toContain('soloSonAdvertencias(porPartes)')
    expect(rama).toContain('sePuedeBorrarElAudio(porPartes)')
    // El descarte del conteo, que era la causa raíz, ya no está.
    expect(rama).not.toContain('duracionRef.current })).texto')
  })

  it('el camino largo consume LAS MISMAS, no una copia a mano', () => {
    expect(HOOK).toContain('const todoFalló = soloSonAdvertencias(porPartes)')
    expect(HOOK).toContain('if (recoveryKeyRef.current && sePuedeBorrarElAudio(porPartes)) await borrarChunks(')
    // La cuenta escrita a mano existía DOS veces; ahora cero.
    expect(HOOK).not.toContain('porPartes.lotesFallidos === 0')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('pruebas negativas — el arreglo no rompe lo que ya estaba bien', () => {
// ══════════════════════════════════════════════════════════════════════════════

  it('el union de estados no se ha desincronizado del hook', () => {
    /**
     * `recuperacion-consulta.ts` copia el union a propósito (para no depender
     * de un hook de React y poder probarse sin navegador). El precio de la
     * copia es este guardián: si alguien añade un estado al hook y no aquí,
     * `estaEnVuelo` decidiría sobre una lista incompleta.
     */
    const enHook = /type Estado = ([^\n]+)/.exec(HOOK)?.[1] ?? ''
    for (const e of TODOS) expect(enHook).toContain(`'${e}'`)
    const cuantos = (enHook.match(/'/g) ?? []).length / 2
    expect(cuantos).toBe(TODOS.length)
  })

  it('NO MEZCLA PACIENTES: la clave de recuperación sigue llevando el paciente dentro', () => {
    for (const m of ['hayRecovery', 'descartarRecovery', 'recuperarAudio', 'descargarAudioGuardado']) {
      const usos = CONSULTA.split(`audio.${m}(`).length - 1
      expect(usos).toBeGreaterThan(0)
    }
    // Ninguna llamada de recuperación sin el patientId en la clave.
    expect(CONSULTA).not.toMatch(/audio\.(hayRecovery|descartarRecovery|recuperarAudio|descargarAudioGuardado)\((?!`consulta-\$\{patientId\}`)/)
  })

  it('NO MEZCLA CONSULTORIOS: TODA lectura de nota sigue pasando por `clinicId`', () => {
    /**
     * Tres llamadas: la carga de la nota abierta, y las dos rutas de
     * restauración que toca H-06. Lo que se sella no es el número sino que
     * ninguna pueda leer sin el consultorio delante — el aislamiento entre
     * consultorios vive en esa primera posición.
     */
    expect(CONSULTA.split('getNota(clinicId, patientId,').length - 1).toBe(3)
    // `getNota(...)` con puntos suspensivos es la cita del defecto en el
    // comentario de H-06, no una llamada. Cualquier OTRA forma sería una
    // lectura sin consultorio.
    expect(CONSULTA).not.toMatch(/getNota\((?!clinicId,|\.\.\.\))/)
  })

  it('NO DUPLICA DATOS: el módulo nuevo no escribe en ningún sitio, sólo decide', () => {
    const MOD = leer('src', 'lib', 'expediente', 'recuperacion-consulta.ts')
    for (const prohibido of ['fetch(', 'indexedDB', 'localStorage', 'firebase', 'useState', 'useRef']) {
      expect(MOD).not.toContain(prohibido)
    }
  })

  it('NO DESTRUYE AUDIO: los cinco borrados siguen siendo cinco, y cada uno con su motivo', () => {
    /**
     * El hook borra en cinco sitios, y ninguno es nuevo:
     *
     *   1. rama de dictado — AHORA con guarda de `lotesFallidos` (H-07);
     *   2. diarización buena — transcrito entero, con voces separadas;
     *   3. transcripción completa — ya con guarda desde antes;
     *   4. `descartarRecovery` — lo pide el médico a propósito;
     *   5. `recuperarAudio` — sólo tras transcribir de verdad («si SÍ se transcribió»).
     *
     * Si aparece un sexto, hay que mirarlo: cada borrado es la última copia de
     * lo que dijo un paciente.
     */
    expect(HOOK.split('await borrarChunks(').length - 1).toBe(5)
    // Y los dos que dependen del conteo de lotes lo consultan, no lo suponen.
    expect(HOOK.split('sePuedeBorrarElAudio(porPartes)').length - 1).toBe(2)
  })

  it('SIGUE HABIENDO PURGA: el arreglo no convierte el cierre de sesión en «nunca se borra»', () => {
    const SALIR = leer('src', 'lib', 'salir-seguro.ts')
    expect(SALIR).toContain('if (!r.audioSinTranscribir) limpiarAudioLocal()')
    expect(SALIR).toContain('limpiarBorradoresLocales()')
  })

  it('SIN PHI: ni el módulo ni sus casos traen un paciente real', () => {
    const MOD = leer('src', 'lib', 'expediente', 'recuperacion-consulta.ts')
    expect(MOD).not.toMatch(/\b\d{10}\b/)         // teléfonos
    expect(MOD).not.toMatch(/[A-Z]{4}\d{6}[A-Z]{6}\d{2}/)  // CURP
  })
})
