/**
 * GOLDEN — LA CABECERA DECÍA QUE SE BORRABA AL CERRAR SESIÓN, Y NO SE BORRABA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `no-se-abrieron.ts` guarda los pendientes clínicos que no se pudieron crear
 * (REG-411), para que un fallo de red no los pierda. Su cabecera aseguraba:
 *
 *     «se borra al cerrar sesión como el resto de PHI local»
 *
 * **No se borraba.** `limpiarBorradoresLocales` purga las claves que empiezan
 * por los prefijos declarados:
 *
 *     PREFIJOS_PHI = ['nx.consulta.bkp.', 'nx.uci.']
 *
 * y el cajón se llama `nexusmed.pendientes-no-abiertos`. No casa con ninguno.
 *
 * ── LO QUE ESO SIGNIFICA ────────────────────────────────────────────────────
 *
 * Cada entrada es un `TareaClinica`: lleva `patientId`, **`patientNombre`**, el
 * título («Revisar resultado de…») y el detalle. Hasta cincuenta, en el
 * `localStorage` de un equipo de consultorio —que se comparte— y sobreviviendo
 * al cierre de sesión indefinidamente.
 *
 * La regla de datos de esta casa dice que al cerrar sesión se limpia el disco
 * precisamente porque el equipo es compartido. Aquí no se limpiaba, y el
 * comentario aseguraba que sí: un comentario que describe una limpieza que no
 * ocurre es peor que no tenerlo, porque da por revisado lo que no lo está.
 *
 * Es la segunda vez en esta tanda que una garantía vive en la prosa y no en el
 * código (REG-572 fue la otra, con el tope del documento del episodio).
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo `WS-11.sobrevive-a-la-navegacion`. Su censo decía «el cierre de
 * sesión lo limpia (lleva PHI)» y se fue a comprobar contra los prefijos antes
 * de construir nada. No lo limpiaba.
 *
 * ── POR QUÉ SE DRENA Y NO SE BORRA ──────────────────────────────────────────
 *
 * Añadir la clave a la lista de purga habría cerrado la fuga **y perdido los
 * pendientes en silencio**, que es exactamente lo que REG-411 existe para
 * impedir. Se hace lo que este mismo cierre de sesión ya hace con la cola de
 * auditoría: **se manda mientras el token todavía sirve**.
 *
 * Lo que entra desaparece del disco porque ya vive en el servidor. Lo que no
 * entra se queda, igual que el borrador, porque borrarlo «por seguridad»
 * convertiría un problema de red en un pendiente clínico perdido.
 *
 * Y no contradice a REG-390 —«una operación no puede aparecer como completada si
 * sólo quedó encolada»—: aquí nada se marca completado. O la tarea queda escrita
 * en Firestore, o sigue en el cajón.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · SIGUE sin cruzar de dispositivo. Un pendiente perdido en el consultorio no
 *   aparece en el teléfono, y eso no se arregla aquí: exige escribir en Firestore
 *   justo cuando se acaba de demostrar que no se puede escribir.
 * · PUEDE quedar PHI local — la que no se pudo salvar. La diferencia es que ahora
 *   está dicho, y sólo queda lo que el servidor rechazó, no lo que nadie recogió.
 * · NO avisa al médico de lo que quedó sin drenar. El cierre de sesión ya no es
 *   sitio para un cartel; `/pendientes` sigue siendo quien lo ofrece.
 * · NO se probó en navegador: se comprueba el drenaje y el orden respecto al
 *   `signOut`, no el ciclo real de una pestaña cerrándose.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { PREFIJOS_PHI, esClaveBorrador } from '@/lib/mobile/local-drafts'
import { LLAVE, leerPerdidos } from '@/lib/tareas-clinicas/no-se-abrieron'

vi.mock('@/lib/tareas-clinicas/firestore', () => ({
  crearTareas: vi.fn(),
}))

const { drenarPendientesPerdidos } = await import('@/lib/tareas-clinicas/abrir')
const { crearTareas } = await import('@/lib/tareas-clinicas/firestore')

const SALIR = readFileSync('src/lib/salir-seguro.ts', 'utf8')
const CAJON = readFileSync('src/lib/tareas-clinicas/no-se-abrieron.ts', 'utf8')

const tarea = (patientNombre: string, titulo: string) => ({
  clinicId: 'c1', patientId: 'p1', patientNombre, tipo: 'estudio_pendiente',
  titulo, prioridad: 'alta', estado: 'solicitada', creadaEn: '2026-08-30T00:00:00.000Z',
  origen: 'nota',
})
const cajonCon = (...tareas: unknown[]) => JSON.stringify(
  tareas.map(t => ({ clinicId: 'c1', deDonde: 'nota', cuando: '2026-08-30T00:00:00.000Z', tarea: t })),
)

describe('el defecto: la purga no alcanzaba a esta clave', () => {
  it('la clave del cajón NO casa con los prefijos de PHI', () => {
    /* Ésta es la línea del defecto. Si algún día se añade el prefijo, este caso
       cae y obliga a decidir: purgar pierde pendientes, drenar no. */
    expect(esClaveBorrador(LLAVE)).toBe(false)
    for (const p of PREFIJOS_PHI) expect(LLAVE.startsWith(p)).toBe(false)
  })

  it('y la cabecera ya no asegura una limpieza que no ocurre', () => {
    expect(CAJON).not.toContain('se borra al cerrar sesión** como el resto de PHI')
    expect(CAJON).toContain('No se borraba')
    expect(CAJON).toContain('drenarPendientesPerdidos')
  })
})

describe('el drenaje', () => {
  it('lo que entra desaparece del disco', async () => {
    vi.mocked(crearTareas).mockResolvedValue({ creadas: 2, noEntraron: [] })
    let disco = cajonCon(tarea('Paciente Sintético', 'Revisar biometría'), tarea('Otro', 'Revisar TSH'))
    const r = await drenarPendientesPerdidos({ leer: () => disco, escribir: v => { disco = v } })
    expect(r).toEqual({ habia: 2, entraron: 2, siguenPerdidos: 0 })
    expect(leerPerdidos(() => disco)).toHaveLength(0)
  })

  it('lo que NO entra se queda, igual que el borrador', async () => {
    /* Borrarlo «por seguridad» convierte un problema de red en un pendiente
       clínico perdido. Es la doctrina de `salir-seguro`, aplicada aquí. */
    const queda = tarea('Paciente Sintético', 'Revisar biometría')
    vi.mocked(crearTareas).mockResolvedValue({ creadas: 0, noEntraron: [queda] as never })
    let disco = cajonCon(queda)
    const r = await drenarPendientesPerdidos({ leer: () => disco, escribir: v => { disco = v } })
    expect(r).toEqual({ habia: 1, entraron: 0, siguenPerdidos: 1 })
    expect(leerPerdidos(() => disco)).toHaveLength(1)
  })

  it('si ni siquiera se puede intentar, no se pierde nada', async () => {
    vi.mocked(crearTareas).mockRejectedValue(new Error('sin red'))
    let disco = cajonCon(tarea('Paciente Sintético', 'Revisar biometría'))
    const r = await drenarPendientesPerdidos({ leer: () => disco, escribir: v => { disco = v } })
    expect(r.siguenPerdidos).toBe(1)
    expect(leerPerdidos(() => disco)).toHaveLength(1)
  })

  it('no mezcla consultorios en una sola escritura', async () => {
    /**
     * `crearTareas` escribe bajo UN `clinicId`. Mandar juntos los de dos
     * consultorios escribiría los de uno en el otro — una fuga entre inquilinos
     * por la puerta de atrás.
     */
    vi.mocked(crearTareas).mockClear()
    vi.mocked(crearTareas).mockResolvedValue({ creadas: 1, noEntraron: [] })
    const dos = JSON.stringify([
      { clinicId: 'c1', deDonde: 'nota', cuando: 'x', tarea: tarea('A', 'uno') },
      { clinicId: 'c2', deDonde: 'nota', cuando: 'x', tarea: tarea('B', 'dos') },
    ])
    let disco = dos
    await drenarPendientesPerdidos({ leer: () => disco, escribir: v => { disco = v } })
    const clinicas = vi.mocked(crearTareas).mock.calls.map(c => c[0])
    expect([...clinicas].sort()).toEqual(['c1', 'c2'])
  })

  it('con el cajón vacío no llama a nadie', async () => {
    vi.mocked(crearTareas).mockClear()
    const r = await drenarPendientesPerdidos({ leer: () => '[]', escribir: () => {} })
    expect(r).toEqual({ habia: 0, entraron: 0, siguenPerdidos: 0 })
    expect(crearTareas).not.toHaveBeenCalled()
  })
})

describe('corre donde tiene que correr', () => {
  it('el cierre de sesión lo drena', () => {
    expect(SALIR).toContain('drenarPendientesPerdidos()')
  })

  it('ANTES del `signOut`, o no tendría con qué autenticar', () => {
    /* Es el mismo motivo por el que `drenarCola` va donde va. Después del
       `signOut` el cajón no se vaciaría nunca. */
    expect(SALIR.indexOf('drenarPendientesPerdidos')).toBeLessThan(SALIR.indexOf('auth.signOut()'))
  })

  it('y no puede trabar el cierre de sesión', () => {
    /* La sesión se cierra igual: eso sí es seguridad. */
    const bloque = SALIR.slice(SALIR.indexOf('drenarPendientesPerdidos') - 200, SALIR.indexOf('drenarPendientesPerdidos') + 200)
    expect(bloque).toContain('catch')
  })
})
