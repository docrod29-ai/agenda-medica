/**
 * GOLDEN · P1-14 — EL WORKLIST RECORTABA POR ANTIGÜEDAD Y LLAMABA A ESO
 * «PRIORIDAD».
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `tareasVivas()` trae como mucho `tope` tareas (200 por defecto). La pregunta
 * que decide si el worklist sirve no es cuántas: es **cuáles**. Ha tenido tres
 * respuestas, y las dos primeras fallaban:
 *
 * 1. **Sin `orderBy`** (hasta REG-421): `tope` documentos cualesquiera, en orden
 *    de identificador. REG-344 consiguió que al menos se DIJERA (`truncada`).
 * 2. **`orderBy('creadaEn')`** (REG-421): el recorte se lleva a las más NUEVAS.
 *    Deja de ser arbitrario, y **sustituye urgencia por antigüedad**. En un
 *    consultorio con más pendientes vivos que el tope, el resultado crítico de
 *    esta mañana es el primero en caerse — y se cae en silencio, porque el aviso
 *    de REG-344 dice «hay más», no «falta lo urgente».
 *
 * Ésa es exactamente la mitad de P1-14 que quedaba abierta: el tablero pedía
 * «las más urgentes» y el producto daba «las más antiguas».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Cerrando P1-14 de verdad en vez de darlo por cerrado con REG-421. El propio
 * comentario de `tareasVivas` lo decía —«P1-14 pedía las más urgentes, y esto da
 * las más antiguas»— y estaba escrito como deuda con nombre, no como defecto.
 *
 * ── LA CAUSA RAÍZ, QUE NO ES EL `orderBy` ────────────────────────────────────
 *
 * **`prioridad` guarda TEXTO, y Firestore ordena texto alfabéticamente:**
 *
 *     alta  <  critica  <  normal
 *
 * `orderBy('prioridad')` habría puesto lo ALTO por delante de lo CRÍTICO. Y no
 * se habría visto: una lista ordenada al revés de lo que dice la palabra no
 * parece rota, parece ordenada. Por eso el orden del servidor necesitaba un
 * NÚMERO, y por eso el arreglo no era añadir un `orderBy`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `pesoUrgencia`: la proyección numérica de `prioridad`, derivada por
 * `pesoDeUrgencia` en la ÚNICA puerta de escritura (`crearTareas`), que la pisa
 * si alguien intenta pasarla desde fuera. `prioridad` sigue siendo el dato; el
 * número existe sólo para que Firestore pueda elegir CUÁLES manda. Una vez aquí,
 * el orden lo pone la palabra.
 *
 * Y una red de seguridad que no es opcional: **un `orderBy` de Firestore no
 * ordena los documentos sin el campo, los EXCLUYE**. La consulta de urgencia,
 * ella sola, haría desaparecer del worklist todos los pendientes escritos antes
 * de esta migración. Por eso se leen dos y se unen.
 *
 * ── QUÉ *NO* CUBRE ───────────────────────────────────────────────────────────
 *
 * · **No decide la urgencia.** La pone quien crea la tarea. Aquí sólo se ordena.
 * · **No prueba Firestore.** Prueba contra el doble en memoria, que sí reproduce
 *   la exclusión por campo ausente —que es el comportamiento del que depende
 *   todo esto— pero no impone índices ni latencia.
 * · **No prueba que el índice esté construido.** Declararlo, desplegarlo y verlo
 *   `Enabled` son tres actos y los dos últimos son de la consola.
 * · **No prueba que la pantalla lo pinte.** Que `ordenadaPorUrgencia` exista no
 *   demuestra que se vea; eso es navegador.
 * · **Tres escalones, no cuatro.** No hay nivel «bajo» porque ningún camino del
 *   producto lo crea; el hueco de la escalera (0, 10, 20) está puesto para que
 *   quepa sin migrar nada el día que el dueño decida qué significa.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  contador: { lecturas: 0, getDocs: 0, getDoc: 0 },
  fallos: { collectionGroup: false, lectura: false, lecturaEn: '', indiceAusenteSobre: '' },
}))

vi.mock('@/lib/firebase', () => ({
  db: { doble: true },
  auth: { currentUser: { uid: 'medico-sintetico' } },
  storage: null,
}))
vi.mock('firebase/firestore', async () => {
  const { firestoreClienteSobre } = await import('./_harness/firestore-cliente-en-memoria')
  return firestoreClienteSobre(h)
})

import { tareasVivas, crearTareas } from '@/lib/tareas-clinicas/firestore'
import {
  pesoDeUrgencia, ESCALERA_DE_URGENCIA, PESO_SIN_CLASIFICAR, urgenciaDeLaTarea, ordenWorklist,
  type Prioridad, type TareaClinica,
} from '@/lib/tareas-clinicas/modelo'

const CLINICA = 'c1'
const RUTA = `clinics/${CLINICA}/tareas_clinicas`

/** Escribe una tarea DIRECTAMENTE, como si llevara años en la base. */
function sembrar(id: string, campos: Record<string, unknown>) {
  h.docs.set(`${RUTA}/${id}`, {
    clinicId: CLINICA, patientId: 'p1', tipo: 'resultado_por_revisar',
    titulo: id, estado: 'solicitada', origen: 'nota', ...campos,
  })
}

beforeEach(() => {
  h.docs.clear()
  h.contador.lecturas = 0; h.contador.getDocs = 0; h.contador.getDoc = 0
  h.fallos.collectionGroup = false; h.fallos.lectura = false; h.fallos.lecturaEn = ''
  h.fallos.indiceAusenteSobre = ''
})

describe('la escalera de urgencia es un número, y ordena como dice la palabra', () => {
  it('EL CASO: crítica antes que alta antes que normal', () => {
    expect(pesoDeUrgencia('critica')).toBeLessThan(pesoDeUrgencia('alta'))
    expect(pesoDeUrgencia('alta')).toBeLessThan(pesoDeUrgencia('normal'))
  })

  it('y por eso hacía falta un número: en TEXTO el orden sale al revés', () => {
    /**
     * La demostración del defecto, no una curiosidad. Éste es exactamente el
     * orden que habría devuelto `orderBy('prioridad')`, y por eso no se usó.
     */
    const alfabetico = (['normal', 'critica', 'alta'] as Prioridad[]).slice().sort()
    expect(alfabetico).toEqual(['alta', 'critica', 'normal'])
    expect(alfabetico[0], 'en alfabético `alta` va PRIMERO, delante de `critica`').toBe('alta')

    const porPeso = (['normal', 'critica', 'alta'] as Prioridad[])
      .slice().sort((a, b) => pesoDeUrgencia(a) - pesoDeUrgencia(b))
    expect(porPeso).toEqual(['critica', 'alta', 'normal'])
  })

  it('lo que no se puede clasificar cae al FINAL, no fuera', () => {
    /* Datos históricos: una prioridad ausente, vacía o de un vocabulario viejo.
       Se ordena la última, y sigue estando. */
    for (const raro of [undefined, null, '', 'urgentísimo', 'BAJA', 42 as unknown as string]) {
      expect(pesoDeUrgencia(raro as never)).toBe(PESO_SIN_CLASIFICAR)
    }
    expect(PESO_SIN_CLASIFICAR).toBeGreaterThan(Math.max(...Object.values(ESCALERA_DE_URGENCIA)))
  })

  it('la escalera deja hueco para un escalón nuevo sin migrar nada', () => {
    const pesos = Object.values(ESCALERA_DE_URGENCIA).sort((a, b) => a - b)
    for (let i = 1; i < pesos.length; i++) {
      expect(pesos[i] - pesos[i - 1], 'dos escalones consecutivos sin hueco entre medias').toBeGreaterThan(1)
    }
  })

  it('la palabra manda sobre el número guardado, y se dice cuando no coinciden', () => {
    const coherente = urgenciaDeLaTarea({ prioridad: 'critica', pesoUrgencia: ESCALERA_DE_URGENCIA.critica })
    expect(coherente).toEqual({ peso: ESCALERA_DE_URGENCIA.critica, pesoGuardadoMiente: false })

    const mentirosa = urgenciaDeLaTarea({ prioridad: 'critica', pesoUrgencia: ESCALERA_DE_URGENCIA.normal })
    expect(mentirosa.peso, 'gana `prioridad`, que es el dato').toBe(ESCALERA_DE_URGENCIA.critica)
    expect(mentirosa.pesoGuardadoMiente).toBe(true)

    /* Sin peso guardado no hay mentira: hay una tarea vieja. */
    expect(urgenciaDeLaTarea({ prioridad: 'alta' }).pesoGuardadoMiente).toBe(false)
  })

  it('hay UNA sola escalera: el orden del cliente usa la misma que el servidor', () => {
    /**
     * Antes había dos copias de la tabla escritas a mano —en `modelo.ts` y en
     * `cabos-del-paciente.ts`— y el orden del servidor iba a ser la tercera. Una
     * copia que se desincronice ordena distinto en dos pantallas de la misma
     * lista, y ninguna parece rota.
     */
    const t = (prioridad: Prioridad, creadaEn: string): TareaClinica => ({
      clinicId: CLINICA, patientId: 'p', tipo: 'otra', titulo: 't',
      prioridad, estado: 'solicitada', creadaEn, origen: 'nota',
    })
    const ahora = Date.parse('2026-09-01T00:00:00Z')
    const lista = [t('normal', '2026-01-01'), t('critica', '2026-08-01'), t('alta', '2026-02-01')]
    lista.sort((a, b) => ordenWorklist(a, b, ahora))
    expect(lista.map(x => x.prioridad)).toEqual(['critica', 'alta', 'normal'])
  })
})

describe('la puerta de escritura deriva el peso, y no deja que se lo pasen', () => {
  it('EL CASO: crear una tarea escribe su `pesoUrgencia`', async () => {
    await crearTareas(CLINICA, [{
      clinicId: CLINICA, patientId: 'p1', tipo: 'resultado_por_revisar', titulo: 'Potasio 6.9',
      prioridad: 'critica', estado: 'solicitada', creadaEn: '2026-09-01T08:00:00Z', origen: 'laboratorio',
    }])
    const escrita = [...h.docs.values()][0]
    expect(escrita.pesoUrgencia).toBe(ESCALERA_DE_URGENCIA.critica)
  })

  it('al revés: un peso que venga de fuera SE PISA', async () => {
    /**
     * Si el llamador pudiera fijarlo, `pesoUrgencia` sería una segunda fuente de
     * verdad y podría decir que una tarea crítica es normal — que es justo la
     * forma de fallo que este repositorio persigue.
     */
    await crearTareas(CLINICA, [{
      clinicId: CLINICA, patientId: 'p1', tipo: 'resultado_por_revisar', titulo: 'Mentirosa',
      prioridad: 'critica', estado: 'solicitada', creadaEn: '2026-09-01T08:00:00Z', origen: 'laboratorio',
      pesoUrgencia: ESCALERA_DE_URGENCIA.normal,
    }])
    const escrita = [...h.docs.values()][0]
    expect(escrita.pesoUrgencia, 'ganó el valor de fuera: hay dos fuentes de verdad')
      .toBe(ESCALERA_DE_URGENCIA.critica)
  })
})

describe('el recorte del worklist se lleva lo MENOS urgente', () => {
  /** Cinco críticas nuevas y cinco normales viejas. El tope deja pasar cinco. */
  function consultorioDesbordado() {
    for (let i = 0; i < 5; i++) {
      sembrar(`vieja-normal-${i}`, {
        prioridad: 'normal', pesoUrgencia: ESCALERA_DE_URGENCIA.normal,
        creadaEn: `2026-01-0${i + 1}T08:00:00Z`,
      })
      sembrar(`nueva-critica-${i}`, {
        prioridad: 'critica', pesoUrgencia: ESCALERA_DE_URGENCIA.critica,
        creadaEn: `2026-08-2${i}T08:00:00Z`,
      })
    }
  }

  it('EL DEFECTO, MEDIDO: por antigüedad se caen las cinco críticas', () => {
    /**
     * Esto es lo que hacía la versión anterior (REG-421), reproducido sobre los
     * mismos datos. No es una hipótesis: es el orden que devuelve
     * `orderBy('creadaEn')` con `limit(5)`.
     */
    consultorioDesbordado()
    const porAntiguedad = [...h.docs.values()]
      .sort((a, b) => String(a.creadaEn).localeCompare(String(b.creadaEn)))
      .slice(0, 5)
    expect(porAntiguedad.every(t => t.prioridad === 'normal')).toBe(true)
    expect(porAntiguedad.some(t => t.prioridad === 'critica'),
      'ni una sola crítica entraba en el recorte por antigüedad').toBe(false)
  })

  it('EL ARREGLO: por urgencia entran las cinco críticas', async () => {
    consultorioDesbordado()
    const w = await tareasVivas(CLINICA, 5)
    expect(w.tareas).toHaveLength(5)
    expect(w.tareas.every(t => t.prioridad === 'critica')).toBe(true)
    expect(w.truncada, 'hay diez vivas y sólo caben cinco').toBe(true)
    expect(w.ordenadaPorUrgencia).toBe(true)
  })

  it('crítica > alta > normal, con las tres a la vez', async () => {
    sembrar('n', { prioridad: 'normal', pesoUrgencia: ESCALERA_DE_URGENCIA.normal, creadaEn: '2026-01-01T00:00:00Z' })
    sembrar('c', { prioridad: 'critica', pesoUrgencia: ESCALERA_DE_URGENCIA.critica, creadaEn: '2026-08-01T00:00:00Z' })
    sembrar('a', { prioridad: 'alta', pesoUrgencia: ESCALERA_DE_URGENCIA.alta, creadaEn: '2026-05-01T00:00:00Z' })
    const w = await tareasVivas(CLINICA, 10)
    expect(w.tareas.map(t => t.prioridad)).toEqual(['critica', 'alta', 'normal'])
  })

  it('DESEMPATE TEMPORAL: a igual urgencia, lo más viejo arriba', async () => {
    /**
     * Sin esto, entre dos críticas el recorte volvería a ser arbitrario — y la
     * que lleva tres semanas esperando es la que más falta hace que se vea.
     */
    sembrar('critica-de-hoy', {
      prioridad: 'critica', pesoUrgencia: ESCALERA_DE_URGENCIA.critica, creadaEn: '2026-08-31T08:00:00Z',
    })
    sembrar('critica-de-hace-tres-semanas', {
      prioridad: 'critica', pesoUrgencia: ESCALERA_DE_URGENCIA.critica, creadaEn: '2026-08-10T08:00:00Z',
    })
    const w = await tareasVivas(CLINICA, 10)
    expect(w.tareas.map(t => t.titulo)).toEqual(['critica-de-hace-tres-semanas', 'critica-de-hoy'])
  })

  it('lo cerrado y lo cancelado siguen fuera; `agendada` sigue dentro (REG-404)', async () => {
    sembrar('viva', { prioridad: 'alta', pesoUrgencia: ESCALERA_DE_URGENCIA.alta, creadaEn: '2026-08-01T00:00:00Z' })
    sembrar('agendada', { estado: 'agendada', prioridad: 'alta', pesoUrgencia: ESCALERA_DE_URGENCIA.alta, creadaEn: '2026-08-02T00:00:00Z' })
    sembrar('cerrada', { estado: 'cerrada', prioridad: 'critica', pesoUrgencia: ESCALERA_DE_URGENCIA.critica, creadaEn: '2026-08-03T00:00:00Z' })
    sembrar('cancelada', { estado: 'cancelada', prioridad: 'critica', pesoUrgencia: ESCALERA_DE_URGENCIA.critica, creadaEn: '2026-08-04T00:00:00Z' })
    const w = await tareasVivas(CLINICA, 10)
    expect(w.tareas.map(t => t.titulo).sort()).toEqual(['agendada', 'viva'])
  })
})

describe('los datos históricos NO desaparecen del worklist', () => {
  it('EL PELIGRO, MEDIDO: un `orderBy` EXCLUYE al que le falta el campo', async () => {
    /**
     * Éste es el comportamiento de Firestore del que depende todo lo demás, y el
     * doble lo reproduce. Si esta prueba dejara de pasar, la red de seguridad de
     * `tareasVivas` sobraría — o, peor, alguien la quitaría creyendo que sí.
     */
    sembrar('historica', { prioridad: 'critica', creadaEn: '2026-01-01T00:00:00Z' }) // sin pesoUrgencia
    const { collection, query, where, orderBy, getDocs } =
      await import('firebase/firestore') as unknown as Record<string, (...a: never[]) => unknown>
    const snap = await (getDocs as (q: unknown) => Promise<{ docs: unknown[] }>)(
      (query as (...a: unknown[]) => unknown)(
        (collection as (...a: unknown[]) => unknown)({}, 'clinics', CLINICA, 'tareas_clinicas'),
        (where as (...a: unknown[]) => unknown)('estado', 'in', ['solicitada']),
        (orderBy as (...a: unknown[]) => unknown)('pesoUrgencia', 'asc'),
      ),
    )
    expect(snap.docs, 'la consulta de urgencia, ella sola, no la ve').toHaveLength(0)
  })

  it('EL CASO: y aun así llega al worklist, por la red de seguridad', async () => {
    sembrar('historica', { prioridad: 'critica', creadaEn: '2026-01-01T00:00:00Z' })
    sembrar('nueva', {
      prioridad: 'normal', pesoUrgencia: ESCALERA_DE_URGENCIA.normal, creadaEn: '2026-08-01T00:00:00Z',
    })
    const w = await tareasVivas(CLINICA, 10)
    expect(w.tareas.map(t => t.titulo).sort()).toEqual(['historica', 'nueva'])
  })

  it('y la histórica se ordena por su PALABRA, no por el peso que no tiene', async () => {
    /* Es crítica: va primero, aunque su número no esté escrito todavía. */
    sembrar('historica-critica', { prioridad: 'critica', creadaEn: '2026-01-01T00:00:00Z' })
    sembrar('nueva-normal', {
      prioridad: 'normal', pesoUrgencia: ESCALERA_DE_URGENCIA.normal, creadaEn: '2026-08-01T00:00:00Z',
    })
    const w = await tareasVivas(CLINICA, 10)
    expect(w.tareas.map(t => t.titulo)).toEqual(['historica-critica', 'nueva-normal'])
  })

  it('la migración pendiente se MIDE, no se recuerda', async () => {
    sembrar('historica', { prioridad: 'alta', creadaEn: '2026-01-01T00:00:00Z' })
    expect((await tareasVivas(CLINICA, 10)).migracionPendiente).toBe(true)

    h.docs.clear()
    sembrar('migrada', {
      prioridad: 'alta', pesoUrgencia: ESCALERA_DE_URGENCIA.alta, creadaEn: '2026-01-01T00:00:00Z',
    })
    expect((await tareasVivas(CLINICA, 10)).migracionPendiente).toBe(false)
  })

  it('una prioridad ILEGIBLE tampoco desaparece: cae al final', async () => {
    sembrar('rara', { prioridad: 'urgentísimo', creadaEn: '2026-01-01T00:00:00Z' })
    sembrar('normal', {
      prioridad: 'normal', pesoUrgencia: ESCALERA_DE_URGENCIA.normal, creadaEn: '2026-08-01T00:00:00Z',
    })
    const w = await tareasVivas(CLINICA, 10)
    expect(w.tareas.map(t => t.titulo)).toEqual(['normal', 'rara'])
  })
})

describe('si el índice todavía no está, la pantalla no se rompe — y lo dice', () => {
  it('EL CASO: sin el índice de urgencia, el worklist SIGUE saliendo', async () => {
    /**
     * La ventana peligrosa es real: Vercel publica con cada merge a `main` y la
     * construcción de un índice compuesto sobre una colección con datos tarda de
     * minutos a horas. En esa ventana la consulta nueva se RECHAZA — así se abrió
     * el worklist por primera vez en producción, con un error, no con una lista.
     */
    h.fallos.indiceAusenteSobre = 'pesoUrgencia'
    sembrar('a', { prioridad: 'critica', pesoUrgencia: 0, creadaEn: '2026-08-01T00:00:00Z' })
    sembrar('b', { prioridad: 'normal', pesoUrgencia: 20, creadaEn: '2026-01-01T00:00:00Z' })

    const w = await tareasVivas(CLINICA, 10)
    expect(w.tareas.map(t => t.titulo).sort(), 'no se perdió ninguna').toEqual(['a', 'b'])
  })

  it('y NO se calla que el recorte se hizo por el criterio peor', async () => {
    /**
     * Regla 3 de seguridad clínica dicha de una lectura: una lista recortada por
     * el criterio equivocado, presentada como la buena, hace que el médico deje
     * de mirar creyendo que lo que falta es lo menos urgente — y es lo más nuevo.
     */
    h.fallos.indiceAusenteSobre = 'pesoUrgencia'
    sembrar('a', { prioridad: 'critica', pesoUrgencia: 0, creadaEn: '2026-08-01T00:00:00Z' })
    expect((await tareasVivas(CLINICA, 10)).ordenadaPorUrgencia).toBe(false)
  })

  it('al revés: CON el índice, no se declara degradada', async () => {
    /* Si `ordenadaPorUrgencia` fuera siempre `false`, el caso de arriba pasaría
       por la razón equivocada y el aviso se volvería ruido permanente. */
    sembrar('a', { prioridad: 'critica', pesoUrgencia: 0, creadaEn: '2026-08-01T00:00:00Z' })
    expect((await tareasVivas(CLINICA, 10)).ordenadaPorUrgencia).toBe(true)
  })

  it('un error que NO es «falta el índice» sí sube: no se traga nada', async () => {
    /**
     * Si el respaldo absorbiera cualquier fallo, un permiso denegado —una fuga de
     * seguridad, o una regla mal desplegada— se vería como una lista corta.
     */
    h.fallos.lectura = true
    await expect(tareasVivas(CLINICA, 10)).rejects.toThrow(/UNAVAILABLE/)
  })

  it('sin consultorio no inventa una lista vacía silenciosa', async () => {
    const w = await tareasVivas('', 10)
    expect(w.tareas).toEqual([])
    expect(w.ordenadaPorUrgencia).toBe(true)
    expect(w.migracionPendiente).toBe(false)
  })
})
