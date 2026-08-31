/**
 * GOLDEN — un aviso efímero sobre una pérdida permanente es no avisar.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-344 encontró que al firmar la nota los pendientes se creaban con
 * `void crearTareas(...).catch(() => {})`, y lo escribió así: *«Si la pestaña se
 * cerraba o la red se caía en esa ventana, los pendientes de esa consulta
 * desaparecían y el médico se iba convencido de que estaban.»*
 *
 * Lo arregló **en ese sitio**. Y `crearTareas` tenía CUATRO llamadores en
 * pantallas. Los otros tres —las dos reconciliaciones de medicación y la emisión
 * de la orden— siguieron con el `catch` vacío. Uno de ellos con el comentario
 * `/* igual que arriba *​/`, que es exactamente lo que no era: arriba había un
 * aviso y ahí no había nada.
 *
 * Es la misma forma que REG-410: una reparación que llega a un consumidor y no a
 * los demás. Con el agravante de que aquí el comentario **afirma** la paridad.
 *
 * ── Y DONDE SÍ HABÍA AVISO, TAMPOCO BASTABA ─────────────────────────────────
 *
 * Era un `toast`. Dura unos segundos y muere al cambiar de pantalla — y este
 * aviso sale justo después de firmar, que es cuando el médico se va al siguiente
 * paciente. El resultado final es el que REG-344 describe como el defecto, sólo
 * que con un aviso que nadie llegó a leer.
 *
 * `WS-11.sobrevive-a-la-navegacion` pide literalmente que nada pendiente
 * desaparezca al cambiar de pantalla.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Que la decisión viviera en el llamador. Con cuatro sitios decidiendo por su
 * cuenta qué hacer con el resultado, la próxima pantalla que abra pendientes
 * volverá a elegir mal — y nadie lo notará, porque no falla nada.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. `crearTareas` dice **cuáles** no entraron, no sólo cuántas: un pendiente que
 *    nadie puede nombrar es un pendiente que nadie puede reintentar.
 * 2. Un solo sitio —`abrirPendientes`— decide qué pasa cuando faltan.
 * 3. Lo que no entró se guarda donde sobreviva a la navegación y a la sesión.
 * 4. Se vuelve a ofrecer en Pendientes, **cuando el médico lo pide**.
 *
 * ── LO QUE SIGUE IGUAL, Y ES DELIBERADO ─────────────────────────────────────
 *
 * Abrir pendientes **sigue sin bloquear la firma**. Hacer que un fallo del
 * worklist reviente la firma sería cambiar un pendiente perdido por una consulta
 * perdida, que es lo que REG-344 dejó escrito.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No reintenta solo.** Volver a escribir en el expediente de un paciente por
 *   decisión de la máquina es lo que REG-390 reserva: una operación clínica no
 *   puede aparecer como completada si sólo quedó encolada.
 * · **No sobrevive a otro equipo ni a otro navegador.** Es almacenamiento local:
 *   si el médico firma en el consultorio y abre Pendientes en el teléfono, ahí no
 *   están. Guardarlo en Firestore es escribir en el expediente justo cuando se ha
 *   demostrado que no se puede escribir.
 * · **No sobrevive a borrar los datos del sitio**, ni al cierre de sesión — que
 *   limpia el almacenamiento local a propósito, porque esto lleva PHI.
 * · **No prueba el render.** Que el recuadro se VEA es del navegador.
 * · **No cubre los dos llamadores de servidor** (`hospital` y `laboratorio`), que
 *   sí leen el conteo desde REG-252 y no tienen pantalla donde ofrecer nada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  comoQuedo, guardarPerdidos, leerPerdidos, perdidosDe, olvidar, TOPE,
  POR_QUE_NO_SE_REINTENTA_SOLO, POR_QUE_NO_BASTA_EL_TOAST,
} from '@/lib/tareas-clinicas/no-se-abrieron'

const almacen = vi.hoisted(() => ({ escrituras: 0, fallaEnLaEscritura: 0 }))

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: (_c: unknown, id: string) => ({ id }),
  getDoc: async () => ({ exists: () => false }),
  setDoc: async () => {
    almacen.escrituras += 1
    if (almacen.escrituras === almacen.fallaEnLaEscritura) throw new Error('firestore dijo que no')
  },
  addDoc: async () => {
    almacen.escrituras += 1
    if (almacen.escrituras === almacen.fallaEnLaEscritura) throw new Error('firestore dijo que no')
    return { id: 'x' }
  },
  updateDoc: async () => {},
  getDocs: async () => ({ docs: [] }),
  query: () => ({}), where: () => ({}), orderBy: () => ({}), limit: () => ({}),
  serverTimestamp: () => ({}),
}))
vi.mock('@/lib/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u' } } }))

const CONSULTA = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
const ORDEN = readFileSync('src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx', 'utf8')
const PENDIENTES = readFileSync('src/app/(dashboard)/pendientes/page.tsx', 'utf8')
const ABRIR = readFileSync('src/lib/tareas-clinicas/abrir.ts', 'utf8')

const tarea = (titulo: string, patientId = 'p1') => ({
  clinicId: 'c1', patientId, titulo, tipo: 'seguimiento', prioridad: 'normal',
  estado: 'solicitada', creadaEn: '2026-08-30T00:00:00.000Z', origen: 'nota',
}) as never

describe('AL REVÉS: los cuatro llamadores tenían tratos distintos', () => {
  it('ya no queda ningún `catch` vacío tragándose los pendientes', () => {
    /**
     * El defecto, escrito como el patrón que lo producía. `/* igual que arriba *​/`
     * era el comentario de uno de ellos, y arriba había un aviso que él no tenía.
     */
    expect(CONSULTA).not.toMatch(/igual que arriba/)
    expect(ORDEN).not.toMatch(/esto no puede tumbarla \*\/\s*\)/)
  })

  it('los tres de la consulta pasan por el mismo sitio', () => {
    const usos = CONSULTA.split('abrirPendientesEn(').length - 1
    expect(usos, 'la consulta abre pendientes en tres sitios').toBe(3)
    expect(CONSULTA).not.toMatch(/void crearTareas\(/)
  })

  it('y la orden también', () => {
    expect(ORDEN).toMatch(/abrirPendientes\(clinicId, tareasDeNota\(/)
    expect(ORDEN).not.toMatch(/void crearTareas\(/)
  })

  it('la firma SIGUE sin bloquearse por esto (REG-344)', () => {
    /* Cambiar un pendiente perdido por una consulta perdida sería peor. */
    expect(CONSULTA).not.toMatch(/await crearTareas\(/)
    expect(ABRIR).toMatch(/void crearTareas\(/)
  })
})

describe('`crearTareas` dice CUÁLES no entraron, no sólo cuántas', () => {
  beforeEach(() => { almacen.escrituras = 0 })

  it('una que falla no tumba a las demás, y queda NOMBRADA', async () => {
    /**
     * AL REVÉS del estado anterior: devolvía `1` y el llamador sabía que faltaba
     * una, sin saber cuál. Un pendiente que nadie puede nombrar es un pendiente
     * que nadie puede reintentar, y la única defensa posible era un aviso — que
     * se lo lleva la primera navegación.
     *
     * Falla la SEGUNDA escritura: así se comprueba también que la tercera entra,
     * o sea que un fallo no tumba a las que vienen detrás.
     */
    const { crearTareas } = await import('@/lib/tareas-clinicas/firestore')
    almacen.fallaEnLaEscritura = 2
    const { creadas, noEntraron } = await crearTareas('c1', [tarea('A'), tarea('B'), tarea('C')])
    expect(creadas).toBe(2)
    expect(noEntraron).toHaveLength(1)
    expect(noEntraron[0].titulo, 'no dice CUÁL falló').toBe('B')
  })

  it('cuando entran todas, no nombra ninguna', () => {
    /* `noEntraron` vacío tiene que significar «entraron todas», no «no miré». */
    expect(comoQuedo(3, 3, 'nota').estado).toBe('todas')
  })

  it('sin nada que crear no inventa un resultado', async () => {
    const { crearTareas } = await import('@/lib/tareas-clinicas/firestore')
    expect(await crearTareas('c1', [])).toEqual({ creadas: 0, noEntraron: [] })
    expect(await crearTareas('', [tarea('A')])).toEqual({ creadas: 0, noEntraron: [] })
  })
})

describe('el veredicto vive en un solo sitio', () => {
  it('sin nada que abrir no hay nada que decir', () => {
    expect(comoQuedo(0, 0, 'nota')).toEqual({ estado: 'nada_que_abrir' })
  })

  it('con todas dentro tampoco', () => {
    /* Un aviso que sale cuando todo fue bien enseña a saltarse los avisos. */
    expect(comoQuedo(3, 3, 'nota').estado).toBe('todas')
  })

  it('y cuando faltan lo dice, con de dónde venían', () => {
    const q = comoQuedo(3, 1, 'reconciliacion')
    expect(q.estado).toBe('faltaron')
    expect(q).toMatchObject({ creadas: 1, perdidas: 2 })
    expect((q as { aviso: string }).aviso).toMatch(/reconciliación de medicamentos/)
    expect((q as { aviso: string }).aviso).toMatch(/se te vuelven a ofrecer/)
  })

  it('ninguna dentro es el mismo caso, no uno especial', () => {
    expect(comoQuedo(2, 0, 'orden').estado).toBe('faltaron')
  })
})

describe('lo perdido sobrevive a la navegación', () => {
  const io = () => {
    let buf: string | null = null
    return { leer: () => buf, escribir: (v: string) => { buf = v } }
  }

  it('se guarda y se vuelve a leer', () => {
    /**
     * El corazón del requisito. La pantalla se desmonta, el médico se va al
     * siguiente paciente, y esto sigue ahí — que es justo lo que un `toast` no
     * hace.
     */
    const s = io()
    expect(guardarPerdidos({ clinicId: 'c1', deDonde: 'nota', cuando: 'z', noEntraron: [tarea('A'), tarea('B')] }, s)).toBe('guardado')
    expect(leerPerdidos(s.leer).map(p => p.tarea.titulo)).toEqual(['A', 'B'])
  })

  it('sin nada perdido no escribe nada', () => {
    const s = io()
    expect(guardarPerdidos({ clinicId: 'c1', deDonde: 'nota', cuando: 'z', noEntraron: [] }, s)).toBe('nada_que_guardar')
    expect(s.leer()).toBeNull()
  })

  it('si no se puede guardar, lo DICE — no dice que se guardó', () => {
    /**
     * Modo privado, almacenamiento lleno o bloqueado. Devolver `guardado` aquí
     * sería la mentira exacta que este módulo existe para no repetir: el médico
     * se iría convencido de que están.
     */
    const roto = { leer: () => null, escribir: () => { throw new Error('sin espacio') } }
    expect(guardarPerdidos({ clinicId: 'c1', deDonde: 'nota', cuando: 'z', noEntraron: [tarea('A')] }, roto)).toBe('no_se_pudo')
  })

  it('y un almacenamiento con basura no tumba la pantalla', () => {
    /* Esto se lee al pintar el worklist: lanzar aquí deja al médico sin lista. */
    expect(leerPerdidos(() => 'esto no es json')).toEqual([])
    expect(leerPerdidos(() => null)).toEqual([])
    expect(leerPerdidos(() => '{"no":"un array"}')).toEqual([])
  })

  it('lo nuevo va delante: si hay que recortar, se pierde lo viejo', () => {
    const s = io()
    guardarPerdidos({ clinicId: 'c1', deDonde: 'nota', cuando: 'z', noEntraron: [tarea('vieja')] }, s)
    guardarPerdidos({ clinicId: 'c1', deDonde: 'nota', cuando: 'z', noEntraron: [tarea('nueva')] }, s)
    expect(leerPerdidos(s.leer)[0].tarea.titulo).toBe('nueva')
  })

  it('con un tope, para no comerse el sitio del borrador', () => {
    /**
     * Si hubiera que elegir entre guardar pendientes perdidos y guardar el
     * borrador de la nota, el borrador gana: lo que el médico escribió no se
     * puede reconstruir y un pendiente sí.
     */
    const s = io()
    guardarPerdidos({
      clinicId: 'c1', deDonde: 'nota', cuando: 'z',
      noEntraron: Array.from({ length: TOPE + 10 }, (_, i) => tarea(`t${i}`)),
    }, s)
    expect(leerPerdidos(s.leer)).toHaveLength(TOPE)
  })
})

describe('el aislamiento entre consultorios vale también en el navegador', () => {
  it('un consultorio no ve los perdidos de otro', () => {
    /* Dos cuentas en el mismo equipo comparten `localStorage`. Filtrar al leer
       es más barato que acordarse de filtrar en cada pantalla. */
    let buf: string | null = null
    const s = { leer: () => buf, escribir: (v: string) => { buf = v } }
    guardarPerdidos({ clinicId: 'c1', deDonde: 'nota', cuando: 'z', noEntraron: [tarea('mía')] }, s)
    guardarPerdidos({ clinicId: 'c2', deDonde: 'orden', cuando: 'z', noEntraron: [tarea('ajena')] }, s)
    expect(perdidosDe('c1', leerPerdidos(s.leer)).map(p => p.tarea.titulo)).toEqual(['mía'])
    expect(perdidosDe('c2', leerPerdidos(s.leer)).map(p => p.tarea.titulo)).toEqual(['ajena'])
  })

  it('y lo que ya se reabrió deja de ofrecerse', () => {
    const todos = [
      { clinicId: 'c1', deDonde: 'nota' as const, cuando: 'z', tarea: tarea('A') },
      { clinicId: 'c1', deDonde: 'nota' as const, cuando: 'z', tarea: tarea('B') },
    ]
    expect(olvidar(todos, [tarea('A')]).map(p => p.tarea.titulo)).toEqual(['B'])
  })

  it('pero lo que sigue sin entrar SE CONSERVA', () => {
    /* Un reintento fallido que borrara la copia perdería el pendiente para
       siempre, que es peor que el estado del que se venía. */
    const todos = [{ clinicId: 'c1', deDonde: 'nota' as const, cuando: 'z', tarea: tarea('A') }]
    expect(olvidar(todos, [])).toHaveLength(1)
  })
})

describe('el dato LLEGA a la pantalla donde se trabaja', () => {
  it('Pendientes los lee y los enseña', () => {
    /**
     * «El dato tiene que LLEGAR». Guardar lo perdido y que ninguna pantalla lo
     * mire sería la familia «escrito y sin conectar» sobre la reparación de un
     * defecto de esa misma familia.
     */
    expect(PENDIENTES).toMatch(/leerPerdidos\(/)
    expect(PENDIENTES).toMatch(/perdidosDe\(clinicId/)
    expect(PENDIENTES).toMatch(/No están en la lista de abajo/)
  })

  it('y ofrece volver a abrirlos, sin hacerlo solo', () => {
    expect(PENDIENTES).toMatch(/Volver a abrirlos/)
    expect(POR_QUE_NO_SE_REINTENTA_SOLO).toMatch(/REG-390/)
    expect(POR_QUE_NO_SE_REINTENTA_SOLO).toMatch(/completada si sólo quedó encolada/)
  })

  it('la razón de no conformarse con el toast está escrita', () => {
    expect(POR_QUE_NO_BASTA_EL_TOAST).toMatch(/muere al cambiar de pantalla/)
  })
})
