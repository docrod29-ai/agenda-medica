/**
 * UN MONÓLOGO NO ES UN DIÁLOGO — REG-227 · I-4 del loop.
 *
 * ── LO QUE EL MÉDICO CONTESTÓ ───────────────────────────────────────────────
 *
 * Preguntado quién habla en la grabación, marcó tres y **no** marcó una cuarta:
 *
 *   ✓ Consulta: el paciente y yo conversando
 *   ✓ UCI: yo dictando por aparatos
 *   ✓ Hospital: yo dictando la evolución
 *   ✗ Consulta: yo dictando solo
 *
 * En dos de los tres módulos habla **una sola persona**. Y el sistema pedía
 * separación de voces en los tres por igual.
 *
 * ── EL DAÑO, QUE NO ES SÓLO COSTO ───────────────────────────────────────────
 *
 * El texto que ve la IA se arma como un diálogo con etiquetas. Si el reconocedor
 * parte a UNA sola persona en dos hablantes —cosa que hace cuando cambia el tono
 * o hay una pausa larga—, el pase de visita sale así:
 *
 *     Médico adscrito: el paciente lleva tres días con fiebre
 *     Paciente: y la creatinina en uno punto ocho
 *
 * Y de ahí en adelante **el motor de negaciones y el de procedencia razonan
 * sobre una atribución falsa**: la diferencia entre «el paciente lo afirmó» y
 * «el médico lo dictó» es justo la que sostiene esas dos defensas.
 *
 * ── LAS DOS PIEZAS, EN ESTE ORDEN ───────────────────────────────────────────
 *
 * **1. La red** (`esMonologo`): si al final hubo un solo hablante, no se arma
 * diálogo. Funciona pase lo que pase.
 *
 * **2. El ahorro** (`esDictado`): si el tipo de nota es de dictado, ni se pide
 * la separación.
 *
 * La red va primero, y por eso el ahorro puede permitirse ser conservador:
 * equivocarse clasificando sólo cuesta una diarización inútil. Sin la red, un
 * tipo mal clasificado se traga la conversación real.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  esMonologo, hablantesDistintos, esDictado, TIPOS_DE_DICTADO,
} from '@/lib/asr/un-solo-hablante'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('cuántas personas se oyeron', () => {
  it('dos hablantes son dos', () => {
    expect(hablantesDistintos([{ speaker: 'A' }, { speaker: 'B' }, { speaker: 'A' }])).toEqual(['A', 'B'])
  })

  it('el mismo hablante repetido sigue siendo uno', () => {
    expect(esMonologo([{ speaker: 'A' }, { speaker: 'A' }, { speaker: 'A' }])).toBe(true)
  })

  it('dos hablantes NO son un monólogo', () => {
    expect(esMonologo([{ speaker: 'A' }, { speaker: 'B' }])).toBe(false)
  })

  it('sin turnos también es monólogo', () => {
    /**
     * Si no hay diarización no hay diálogo que armar. Tratar la ausencia como
     * si fuera una conversación es exactamente el error que esto evita.
     */
    expect(esMonologo([])).toBe(true)
    expect(esMonologo(undefined)).toBe(true)
  })

  it('un hablante vacío no cuenta como persona', () => {
    expect(esMonologo([{ speaker: 'A' }, { speaker: '' }, { speaker: '  ' }])).toBe(true)
  })
})

describe('qué tipos de nota se dictan solos', () => {
  it('la evolución de UCI y la de hospital, que fue lo que él nombró', () => {
    expect(esDictado('evolucion_uci')).toBe(true)
    expect(esDictado('evolucion')).toBe(true)
  })

  it('la consulta NO: ahí conversa con el paciente', () => {
    expect(esDictado('primera_vez')).toBe(false)
    expect(esDictado('seguimiento')).toBe(false)
    expect(esDictado('historia_clinica')).toBe(false)
  })

  it('el INGRESO tampoco, aunque sea de hospital', () => {
    /**
     * Un ingreso se hace interrogando al paciente: ahí sí hay dos voces. Es de
     * hospital, pero no es un dictado. La lista es corta a propósito.
     */
    expect(esDictado('ingreso')).toBe(false)
  })

  it('ante lo desconocido, se diariza', () => {
    // Perder la separación en una conversación real cuesta información que no
    // se recupera; diarizar un monólogo sólo cuesta unos segundos.
    expect(esDictado('un_tipo_que_no_existe')).toBe(false)
    expect(esDictado(undefined)).toBe(false)
    expect(esDictado(null)).toBe(false)
  })

  it('la lista sale de lo que él contestó, y de nada más', () => {
    expect([...TIPOS_DE_DICTADO].sort()).toEqual(['evolucion', 'evolucion_uci'])
  })
})

describe('está conectado de verdad', () => {
  it('la consulta no arma diálogo con un solo hablante', () => {
    const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    expect(page).toContain("import { esMonologo, esDictado } from '@/lib/asr/un-solo-hablante'")
    expect(page).toMatch(/audio\.utterances\.length > 0 && !multiTramo && !esMonologo\(audio\.utterances\)/)
  })

  it('la consulta elige el modo por el TIPO de nota, no por una opción en pantalla', () => {
    const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    expect(page).toMatch(/modoDeHabla: \(esDictado\(tipo\) \? 'dictado' : 'conversacion'\)/)
  })

  it('la UCI dicta siempre, y tampoco arma discusión con un solo hablante', () => {
    const uci = leer('src/app/(dashboard)/uci/page.tsx')
    expect(uci).toMatch(/modoDeHabla: 'dictado' as const/)
    expect(uci).toMatch(/utterances && utterances\.length && !esMonologo\(utterances\)/)
  })

  it('el grabador se salta la diarización cuando es dictado', () => {
    const hook = leer('src/hooks/useGrabacionAudio.ts')
    expect(hook).toMatch(/modoDeHabla\?: 'conversacion' \| 'dictado'/)
    expect(hook).toMatch(/modoDeHablaRef\.current = opts\?\.modoDeHabla \?\? 'conversacion'/)
    expect(hook).toMatch(/if \(modoDeHablaRef\.current === 'dictado'\)/)
  })

  it('y por omisión CONVERSA: el ahorro nunca se activa por descuido', () => {
    const hook = leer('src/hooks/useGrabacionAudio.ts')
    expect(hook).toMatch(/useRef<'conversacion' \| 'dictado'>\('conversacion'\)/)
    expect(hook).toMatch(/opts\?\.modoDeHabla \?\? 'conversacion'/)
  })

  it('saltarse la diarización NO se anuncia como un fallo', () => {
    /**
     * `sinDiarizacion` se queda en null a propósito: no es que fallara, es que
     * no hacía falta. Poner un motivo enseñaría al médico un aviso de algo que
     * salió bien — y los avisos que sobran se aprenden a ignorar.
     */
    const hook = leer('src/hooks/useGrabacionAudio.ts')
    // El tope de 900 caracteres se quedó corto cuando H-07 (REG-330) metió en
    // esta rama la guarda de `lotesFallidos` y su explicación. Se sube el tope;
    // lo que se comprueba —que aquí NO se anuncie un fallo— no cambia.
    const bloque = /if \(modoDeHablaRef\.current === 'dictado'\)[\s\S]{0,2600}?\n    \}/.exec(hook)?.[0] ?? ''
    expect(bloque, 'no se encontró el bloque de dictado').toBeTruthy()
    expect(bloque).not.toMatch(/setSinDiarizacion\(/)
  })
})
