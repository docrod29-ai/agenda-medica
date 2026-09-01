/**
 * GOLDEN — LA LISTA DE ESPERA SE LEÍA ENTERA, Y AL ACOTARLA CASI SE VUELVE PEOR.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `getWaitlist` leía la colección COMPLETA:
 *
 *   where('estado','==','activo') + orderBy('createdAt','asc')   ← sin techo
 *
 * Estaba en el inventario de lecturas sin cota (`scripts/escala/lecturas-sin-cota.mjs`)
 * desde que ese inventario existe. Crece con el CONSULTORIO —no con el paciente—,
 * así que es de las que sólo duelen cuando el producto empieza a funcionar: una
 * lista de espera de mil personas se baja entera cada vez que alguien abre la
 * pantalla, y otra vez en `/operaciones`.
 *
 * ── POR QUÉ NO BASTABA CON PONER `limit`, QUE ES LA MITAD QUE IMPORTA ────────
 *
 * Acotar y devolver el mismo array habría cambiado un problema de coste por uno
 * **peor**: una lista recortada que se presenta como completa. Es exactamente el
 * defecto que REG-351 encontró en nueve pantallas a la vez, y aquí significa un
 * paciente esperando un hueco que nadie ve, y un semáforo de `/operaciones` que
 * dice «al día» de una lista que no lo está.
 *
 * Por eso `getWaitlist` **deja de devolver un array pelado**: un array no puede
 * decir que viene recortado. Devuelve `{ entradas, truncada, tope }`, y la
 * pantalla lo pinta.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Bajando el techo del inventario de lecturas sin cota (WS-03), que es una lista
 * que sólo puede bajar. `getWaitlist` era la candidata más clara: crece con el
 * consultorio, tiene DOS pantallas que la llaman, y su índice
 * `waitlist(estado, createdAt)` ya estaba declarado.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Se pide `tope + 1` para SABER si se quedó corta; la de más no se devuelve,
 * sólo sirve para poder decirlo. Y el `orderBy('createdAt','asc')` no es
 * decorativo: hace que las que se caen sean siempre las MÁS NUEVAS, nunca las que
 * llevan más tiempo esperando, que son las que peor se llevan un olvido.
 *
 * ── QUÉ *NO* CUBRE ───────────────────────────────────────────────────────────
 *
 * · **No es a quién se le ofrece un hueco.** Eso lo decide `ofrecerHuecoLiberado`
 *   con su propia lectura, ordenada por PRIORIDAD y con su propio índice. Ésta es
 *   la lista que se PINTA.
 * · **200 no es una cifra clínica**: es el techo de una lectura. Lo que este
 *   golden vigila no es que 200 sea el número correcto, sino que alcanzarlo se
 *   DIGA.
 * · **No prueba que la pantalla lo pinte.** Que `truncada` exista y llegue no
 *   demuestra que se vea; eso es navegador.
 * · **No baja las otras 28 lecturas sin cota.** Siguen inventariadas, con su
 *   techo que sólo baja.
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
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => {} }))
vi.mock('firebase/firestore', async () => {
  const { firestoreClienteSobre } = await import('./_harness/firestore-cliente-en-memoria')
  return firestoreClienteSobre(h)
})

import { getWaitlist, TOPE_LISTA_DE_ESPERA } from '@/lib/firestore'

const CLINICA = 'c1'

/** `n` entradas activas, la más vieja primero. */
function sembrarActivas(n: number) {
  for (let i = 0; i < n; i++) {
    h.docs.set(`clinics/${CLINICA}/waitlist/e${String(i).padStart(4, '0')}`, {
      estado: 'activo',
      prioridad: 1,
      createdAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
      pacienteNombre: `Paciente ${i}`,
    })
  }
}

beforeEach(() => {
  h.docs.clear()
  h.contador.lecturas = 0; h.contador.getDocs = 0; h.contador.getDoc = 0
  h.fallos.lectura = false; h.fallos.lecturaEn = ''; h.fallos.indiceAusenteSobre = ''
})

describe('la lista de espera se acota, y dice cuándo se quedó corta', () => {
  it('por debajo del tope viene entera y NO se declara recortada', () => {
    sembrarActivas(5)
    return getWaitlist(CLINICA).then(r => {
      expect(r.entradas).toHaveLength(5)
      expect(r.truncada, 'decir «hay más» cuando no los hay es un aviso falso, y se aprende a ignorar').toBe(false)
      expect(r.tope).toBe(TOPE_LISTA_DE_ESPERA)
    })
  })

  it('justo EN el tope todavía no se declara recortada', async () => {
    /* El borde exacto: ni una de más. */
    sembrarActivas(TOPE_LISTA_DE_ESPERA)
    const r = await getWaitlist(CLINICA)
    expect(r.entradas).toHaveLength(TOPE_LISTA_DE_ESPERA)
    expect(r.truncada).toBe(false)
  })

  it('EL CASO: con una más que el tope, se recorta Y SE DICE', async () => {
    sembrarActivas(TOPE_LISTA_DE_ESPERA + 1)
    const r = await getWaitlist(CLINICA)
    expect(r.truncada, 'se recortó en silencio: un paciente esperando que nadie ve').toBe(true)
    /* La de más sólo sirve para SABER que hay más; no se devuelve. */
    expect(r.entradas).toHaveLength(TOPE_LISTA_DE_ESPERA)
  })

  it('EL DEFECTO ORIGINAL, medido: sin techo se bajaba la colección entera', async () => {
    /**
     * Se cuentan los documentos LEÍDOS, no los devueltos. Ésta es la diferencia
     * que ninguna prueba de forma puede ver: antes crecía con el consultorio.
     */
    sembrarActivas(TOPE_LISTA_DE_ESPERA * 3)
    h.contador.lecturas = 0
    await getWaitlist(CLINICA)
    expect(
      h.contador.lecturas,
      'la lectura sigue creciendo con el tamaño de la lista de espera',
    ).toBeLessThanOrEqual(TOPE_LISTA_DE_ESPERA + 1)
  })

  it('lo que se cae son las MÁS NUEVAS, nunca las que llevan más esperando', async () => {
    /**
     * El `orderBy('createdAt','asc')` no es decorativo. Si el recorte se llevara
     * a las viejas, el producto olvidaría justo a quien lleva más tiempo — que
     * es de quien peor sienta un olvido.
     */
    sembrarActivas(TOPE_LISTA_DE_ESPERA + 10)
    const r = await getWaitlist(CLINICA)
    const fechas = r.entradas.map(e => (e as unknown as { createdAt: string }).createdAt)
    expect([...fechas].sort()).toEqual(fechas)
  })

  it('lo que NO está activo no entra', async () => {
    sembrarActivas(3)
    h.docs.set(`clinics/${CLINICA}/waitlist/contactado`, {
      estado: 'contactado', prioridad: 1, createdAt: '2026-01-01T00:00:00.000Z',
    })
    const r = await getWaitlist(CLINICA)
    expect(r.entradas).toHaveLength(3)
  })

  it('al revés: una lectura caída NO se convierte en una lista vacía', async () => {
    /**
     * «Ausencia de dato no es dato de ausencia». Si esto devolviera `[]` cuando
     * no se pudo leer, la pantalla diría «la lista está vacía» de un consultorio
     * con gente esperando — y la pantalla ya distingue los dos casos, así que
     * tragarse el error aquí le quitaría esa capacidad.
     */
    sembrarActivas(3)
    h.fallos.lectura = true
    await expect(getWaitlist(CLINICA)).rejects.toThrow()
  })
})
