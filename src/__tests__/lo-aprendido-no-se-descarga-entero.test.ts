/**
 * GOLDEN — el vocabulario aprendido no se descarga entero, y no miente al faltar.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `leerAprendido` hacía `getDocs` de **la colección entera**:
 *
 *     const snap = await getDocs(ruta(clinicId))
 *
 * Un documento por palabra distinta, compartido por consultorio, creciendo con
 * los años — y se leía en CADA apertura de consulta y en CADA apertura de UCI,
 * con el médico esperando la pantalla.
 *
 * Lo que se hace con ese vocabulario es meterlo en el sesgo del reconocedor,
 * cuyo tope declarado son **mil términos** (`TOPE_TERMINOS`, `sesgo-diarizado.ts`)
 * y dentro de los cuales compiten además el léxico de especialidad y —con
 * prioridad— el vocabulario del paciente que está enfrente. O sea: se bajaba
 * todo para usar, como mucho, mil.
 *
 * ── EL SEGUNDO, QUE ES PEOR ─────────────────────────────────────────────────
 *
 * En la pantalla de configuración —la única donde el médico QUITA una palabra—
 * una lectura fallida devolvía `[]`, y `[]` se pintaba con esta frase:
 *
 *     «Todavía no ha aprendido ninguna palabra.»
 *
 * Un fallo de red diciéndole al médico que su vocabulario está vacío. Es la
 * regla 4 de seguridad clínica en la pantalla donde más barato habría sido
 * respetarla: **ausencia de dato no es dato de ausencia**.
 *
 * ── EL TERCERO, DECLARADO Y ACOTADO A MEDIAS ────────────────────────────────
 *
 * `oidoComo` crecía con `arrayUnion` sin techo, en un documento que nadie
 * revisa. Firestore corta en 1 MiB y ahí `setDoc` empieza a fallar — en
 * silencio, porque el aprendizaje nunca puede romper una consulta: dejaría de
 * aprender esa palabra sin decirlo.
 *
 * El techo se aplica a lo que se APORTA por escritura, no al acumulado, y eso se
 * dice sin adornos: recortar el total exigiría leer-modificar-escribir, que es
 * justo lo que `arrayUnion` está aquí para evitar (dos consultas simultáneas se
 * pisarían). Acota el ritmo, no el total.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide la latencia ganada.** Que se lea menos está probado; cuántos ms se
 *   ahorran al abrir la consulta, no.
 * · **No acota `oidoComo` retroactivamente**: un documento que ya venga grande
 *   sigue grande. Sólo deja de crecer deprisa.
 * · **No prueba el corte en el servidor.** Que la consulta lleve `limit` y
 *   `orderBy` se comprueba; que Firestore los aplique es de Firestore, y el
 *   emulador de WS-03 es donde se mide de verdad.
 * · **No cubre `internamientos/{id}`**, que guarda seis arrays en un documento y
 *   cuyas `administraciones` tampoco tienen tope: es Hospital/UCI y queda fuera
 *   de este carril, con nombre y sin cerrar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { TOPE_TERMINOS } from '@/lib/asr/sesgo-diarizado'

const firestore = vi.hoisted(() => ({
  docs: [] as { data: () => unknown }[],
  ultimaConsulta: null as { limite?: number; orden?: string[]; filtro?: string[] } | null,
  falla: false,
}))

vi.mock('@/lib/firebase', () => ({ db: {}, auth: null, storage: null }))
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  setDoc: async () => {},
  deleteDoc: async () => {},
  increment: (n: number) => ({ _inc: n }),
  arrayUnion: (...xs: string[]) => ({ _union: xs }),
  where: (campo: string, op: string, v: unknown) => ({ _where: [campo, op, v] }),
  orderBy: (campo: string, dir: string) => ({ _order: [campo, dir] }),
  limit: (n: number) => ({ _limit: n }),
  query: (_base: unknown, ...partes: Record<string, unknown>[]) => {
    firestore.ultimaConsulta = {
      limite: partes.find(p => '_limit' in p)?._limit as number | undefined,
      orden: partes.find(p => '_order' in p)?._order as string[] | undefined,
      filtro: partes.find(p => '_where' in p)?._where as string[] | undefined,
    }
    return {}
  },
  getDocs: async () => {
    if (firestore.falla) throw new Error('sin red')
    return { docs: firestore.docs }
  },
}))

const palabras = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    data: () => ({ palabra: `p${i}`, veces: n - i, oidoComo: [] }),
  }))

beforeEach(() => {
  firestore.docs = []
  firestore.ultimaConsulta = null
  firestore.falla = false
})

describe('la lectura del dictado tiene cota, y la cota tiene motivo', () => {
  it('la consulta lleva `limit`, y ordena por frecuencia en el servidor', async () => {
    /**
     * AL REVÉS del código anterior, que era `getDocs(ruta(clinicId))` a secas:
     * sin `query`, `ultimaConsulta` se queda en null y este caso cae.
     */
    const { leerAprendido, TOPE_PARA_EL_DICTADO } = await import('@/lib/asr/aprendizaje-firestore')
    firestore.docs = palabras(5)
    await leerAprendido('c1')
    expect(firestore.ultimaConsulta, 'la lectura no pasa por una consulta acotada').not.toBeNull()
    expect(firestore.ultimaConsulta?.limite).toBe(TOPE_PARA_EL_DICTADO)
    expect(firestore.ultimaConsulta?.orden).toEqual(['veces', 'desc'])
    expect(firestore.ultimaConsulta?.filtro).toEqual(['veces', '>', 0])
  })

  it('el corte NO supera lo que cabe en el sesgo del reconocedor', () => {
    /**
     * Si el tope de la lectura fuera mayor que el del sesgo, se estaría pagando
     * tráfico por palabras que ninguna petición puede llevar. Y el del sesgo
     * todavía se reparte con el léxico de especialidad y con el vocabulario del
     * paciente, que va primero.
     */
    return import('@/lib/asr/aprendizaje-firestore').then(({ TOPE_PARA_EL_DICTADO }) => {
      expect(TOPE_PARA_EL_DICTADO).toBeLessThanOrEqual(TOPE_TERMINOS)
    })
  })

  it('devuelve lo leído ordenado, y sin las palabras con cuenta cero', async () => {
    const { leerAprendido } = await import('@/lib/asr/aprendizaje-firestore')
    firestore.docs = [
      { data: () => ({ palabra: 'ceftriaxona', veces: 2, oidoComo: [] }) },
      { data: () => ({ palabra: 'meropenem', veces: 9, oidoComo: [] }) },
      { data: () => ({ palabra: 'basura', veces: 0, oidoComo: [] }) },
    ]
    const r = await leerAprendido('c1')
    expect(r.map(p => p.palabra)).toEqual(['meropenem', 'ceftriaxona'])
  })

  it('si no se puede leer, el dictado sigue: es un extra', async () => {
    const { leerAprendido } = await import('@/lib/asr/aprendizaje-firestore')
    firestore.falla = true
    expect(await leerAprendido('c1')).toEqual([])
  })
})

describe('la pantalla que administra el vocabulario dice la verdad', () => {
  it('cuando hay más de las que caben, lo dice', async () => {
    const { leerVocabularioCompleto } = await import('@/lib/asr/aprendizaje-firestore')
    firestore.docs = palabras(4)          // se pidieron 3+1 y llegaron 4 → hay más
    const r = await leerVocabularioCompleto('c1', 3)
    expect(r.truncada).toBe(true)
    expect(r.lista).toHaveLength(3)
    expect(r.leida).toBe(true)
  })

  it('y cuando caben todas, NO lo dice — un aviso falso también es ruido', async () => {
    const { leerVocabularioCompleto } = await import('@/lib/asr/aprendizaje-firestore')
    firestore.docs = palabras(3)
    const r = await leerVocabularioCompleto('c1', 3)
    expect(r.truncada).toBe(false)
    expect(r.lista).toHaveLength(3)
  })

  it('AL REVÉS: una lectura fallida NO es «no ha aprendido nada»', async () => {
    /**
     * El defecto, escrito como caso. Antes esto devolvía `[]` y la pantalla lo
     * pintaba con «Todavía no ha aprendido ninguna palabra» — un fallo de red
     * afirmando que el vocabulario del médico está vacío, en la pantalla donde
     * decide si está bien.
     */
    const { leerVocabularioCompleto } = await import('@/lib/asr/aprendizaje-firestore')
    firestore.falla = true
    const r = await leerVocabularioCompleto('c1')
    expect(r.lista).toEqual([])
    expect(r.leida, 'no haber podido leer no puede confundirse con no haber nada').toBe(false)
  })

  it('la pantalla usa las dos frases, no una', () => {
    const CONF = readFileSync('src/app/(dashboard)/configuracion/page.tsx', 'utf8')
    expect(CONF).toContain('Todavía no ha aprendido ninguna palabra')
    expect(CONF).toContain('No se pudo leer el vocabulario aprendido')
    expect(CONF, 'la pantalla sigue leyendo sin cota').toContain('leerVocabularioCompleto(clinicId)')
  })
})

describe('lo que se escribe también está acotado — y se dice hasta dónde', () => {
  it('una observación con cincuenta formas mal oídas aporta como mucho el tope', async () => {
    const m = await import('@/lib/asr/aprendizaje-firestore')
    const fs = await import('firebase/firestore')
    const escrito: Record<string, unknown>[] = []
    vi.spyOn(fs, 'setDoc').mockImplementation((async (_d: unknown, data: Record<string, unknown>) => {
      escrito.push(data)
    }) as never)
    await m.acumular('c1', [{
      palabra: 'ceftriaxona', veces: 3,
      oidoComo: Array.from({ length: 50 }, (_, i) => `variante${i}`),
    }], '2026-08-30T00:00:00.000Z')
    const union = escrito[0]?.oidoComo as { _union: string[] }
    expect(union._union.length).toBe(m.TOPE_OIDO_COMO)
    vi.restoreAllMocks()
  })

  it('el módulo declara que acota el RITMO y no el acumulado', () => {
    /**
     * Decir «acotado» a secas sería falso: el techo va sobre lo que aporta cada
     * escritura, porque recortar el total exigiría leer-modificar-escribir y dos
     * consultas simultáneas se pisarían. Señalar de menos, y declararlo.
     */
    const src = readFileSync('src/lib/asr/aprendizaje-firestore.ts', 'utf8')
    expect(src).toMatch(/Acota el ritmo, no el acumulado/)
  })

  it('las razones están escritas donde se puedan leer', async () => {
    const m = await import('@/lib/asr/aprendizaje-firestore')
    expect(m.POR_QUE_LA_LECTURA_TIENE_COTA).toMatch(/colección entera/)
    expect(m.POR_QUE_LA_LISTA_DICE_QUE_SE_QUEDO_CORTA).toMatch(/ausencia de dato/i)
  })
})
