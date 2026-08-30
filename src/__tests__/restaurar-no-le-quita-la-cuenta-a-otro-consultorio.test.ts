/**
 * GOLDEN — restaurar un respaldo podía quitarle la cuenta a otro consultorio.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-343 metió en el respaldo las tres colecciones que pertenecen al
 * consultorio **por un campo** y no por la ruta (`clinic_members`,
 * `clinic_invitations`, `clinic_review_requests`), y REG-348 enseñó al
 * importador a devolverlas. Como su identificador es **global**
 * —`clinic_members/{uid}` es literalmente la misma ruta para todos los
 * consultorios del mundo— REG-348 puso la defensa correcta: mirar de quién es
 * el documento ANTES de escribirlo, y no pisarlo si es de otro.
 *
 * Pero la miraba **fuera de transacción**: `adminDb.getAll(...)` primero, y el
 * `merge` después, dentro de un `WriteBatch` que se commitea más tarde —hasta
 * 400 documentos después, y en una función que puede correr 300 s—. Entre la
 * lectura y la escritura no había nada.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Revisión independiente del propio REG-348 (hallazgo de Codex), reproducida
 * aquí antes de tocar una línea: la comprobación existía, pero comprobaba un
 * pasado.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * **Comprobar y escribir eran dos operaciones, no una.** Un `getAll` no fija
 * nada: es una foto. Un `WriteBatch` es atómico entre sus escrituras, pero **no
 * mira** si el mundo cambió desde que alguien lo llenó. Así que la secuencia
 *
 *     restauración lee `clinic_members/U` → LIBRE
 *     el consultorio VECINO da de alta a U  (registro, invitación aceptada…)
 *     restauración commitea el merge         → U pasa a ser del que restaura
 *
 * le quita a una persona el acceso a su consultorio **sin que nadie haya hecho
 * nada mal**, y sin dejar rastro: el informe dice «escrito», porque para él
 * estaba libre. Es exactamente el daño que la comprobación existía para evitar,
 * cometido por la propia comprobación.
 *
 * No hace falta un atacante. Basta con que una restauración larga coincida con
 * un alta normal en otro consultorio.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * **Donde el identificador es compartido, mirar y escribir es UN solo acto.**
 * Las de nivel raíz se restauran dentro de una **transacción**: la lectura fija
 * la versión de cada documento y, si alguna cambió antes del commit, Firestore
 * reejecuta — y la segunda vuelta sí ve al vecino y se aparta. El árbol del
 * consultorio (`clinics/{id}/…`) sigue por lote: ahí la ruta ya separa los
 * consultorios y no hay identificador que disputar.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **Las reglas de Firestore no se evalúan aquí.** Este camino usa el SDK
 *   admin, que se las salta por diseño; lo que las reglas dicen se prueba
 *   contra el emulador.
 * · **No prueba el límite de 500 escrituras por transacción de Firestore.** La
 *   tienda en memoria no lo impone; lo que ata el tamaño del grupo es
 *   `LOTE_RAIZ`, y eso se comprueba leyendo la constante, no ejecutándola.
 * · **No prueba la latencia ni el presupuesto de la función.** Una transacción
 *   reejecutada cuesta más que un lote; que eso quepa en 300 s no se mide aquí.
 * · **Sólo cubre la colisión por consultorio distinto.** Que el documento
 *   existente sea del MISMO consultorio (su propio respaldo volviendo) se
 *   prueba en `el-respaldo-sabe-volver-entero.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { TiendaEnMemoria, adminDbSobre } from './_harness/firestore-admin-en-memoria'

const DESTINO = 'consultorio-sintetico-destino'
const ORIGEN = 'consultorio-sintetico-origen'
const VECINA = 'consultorio-sintetico-vecino'
const UID = 'uid-sintetico-de-prueba'

const tienda = vi.hoisted(() => ({ actual: null as unknown }))

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  get adminDb() { return (tienda.actual as { db: unknown }).db },
}))

vi.mock('@/lib/authz/verificar', () => ({
  verificarCapacidad: async () => ({
    ok: true, uid: 'medico-sintetico', email: 'sintetico@ejemplo.test',
    clinicId: DESTINO, role: 'owner',
  }),
}))

let t: TiendaEnMemoria

/** El NDJSON tal cual sale del exportador, con su cabecera y su pie. */
function respaldo(lineas: Record<string, unknown>[]): string {
  return [
    JSON.stringify({ _tipo: 'cabecera', clinicId: ORIGEN, generado: '2026-08-29T00:00:00.000Z' }),
    ...lineas.map(l => JSON.stringify(l)),
    JSON.stringify({ _tipo: 'pie', completo: true }),
  ].join('\n')
}

/** Una membresía del consultorio de ORIGEN, como la escribe el respaldo. */
const MEMBRESIA = {
  _ruta: `clinic_members/${UID}`,
  _coleccion: 'clinic_members',
  clinicId: ORIGEN,
  role: 'asistente',
  email: 'asistente.sintetica@ejemplo.test',
}

async function restaurar(cuerpo: string, extra = ''): Promise<Record<string, unknown>> {
  const { POST } = await import('@/app/api/clinic/importar/route')
  const req = new NextRequest(
    `https://ejemplo.test/api/clinic/importar?clinicId=${DESTINO}${extra}`,
    { method: 'POST', body: cuerpo, headers: { 'content-type': 'application/x-ndjson' } },
  )
  const res = await POST(req)
  return await res.json() as Record<string, unknown>
}

/**
 * Monta la tienda. `alLeer` se dispara justo después de que la restauración
 * lea el bloque de nivel raíz — el hueco exacto donde vive el defecto.
 */
function montar(alLeer?: (rutas: string[]) => void) {
  let disparado = false
  t = new TiendaEnMemoria({
    trasLeerEnBloque: (rutas) => {
      if (!alLeer || disparado) return
      // Una sola vez: si no, la reejecución volvería a meter al competidor y la
      // transacción no convergería nunca — y eso sería un defecto de la prueba.
      disparado = true
      alLeer(rutas)
    },
  })
  tienda.actual = { db: adminDbSobre(t) }
}

beforeEach(() => {
  vi.resetModules()
  montar()
})

describe('EL DEFECTO: la comprobación miraba un pasado', () => {
  it('si el vecino da de alta a esa persona MIENTRAS se restaura, no se la quitamos', async () => {
    montar(() => {
      // El alta normal del consultorio vecino, en el hueco entre la lectura y
      // la escritura. Nadie ha hecho nada mal.
      t.poner(`clinic_members/${UID}`, { clinicId: VECINA, role: 'medico' })
    })

    const informe = await restaurar(respaldo([MEMBRESIA]))

    expect(informe.ok).toBe(true)
    const quedo = t.obtener(`clinic_members/${UID}`)
    expect(
      quedo?.clinicId,
      'la membresía tiene que seguir siendo del consultorio vecino: restaurar no le quita nada a nadie',
    ).toBe(VECINA)
    expect(quedo?.role).toBe('medico')
  })

  it('y la carrera OCURRIÓ de verdad: la transacción se reejecutó', async () => {
    montar(() => { t.poner(`clinic_members/${UID}`, { clinicId: VECINA, role: 'medico' }) })
    await restaurar(respaldo([MEMBRESIA]))
    expect(
      t.vecesReejecutada,
      'si nunca se reejecutó, esta prueba pasa por no haber carrera y no prueba nada',
    ).toBeGreaterThan(0)
  })

  it('la pérdida se CUENTA y se dice, no se traga', async () => {
    montar(() => { t.poner(`clinic_members/${UID}`, { clinicId: VECINA, role: 'medico' }) })
    const informe = await restaurar(respaldo([MEMBRESIA]))
    expect(informe.raizDeOtroConsultorio).toBe(1)
    expect(informe.escritos).toBe(0)
    expect(String(informe.aviso)).toContain('NO podrá entrar')
  })
})

describe('SIN CARRERA, LA RESTAURACIÓN SIGUE HACIENDO SU TRABAJO', () => {
  it('una membresía libre vuelve, y apuntando al consultorio destino', async () => {
    const informe = await restaurar(respaldo([MEMBRESIA]))
    expect(informe.escritos).toBe(1)
    expect(informe.raizReapuntada).toBe(1)
    expect(informe.raizDeOtroConsultorio).toBe(0)
    const quedo = t.obtener(`clinic_members/${UID}`)
    expect(quedo?.clinicId, 'el destino lo decide quien restaura, no el archivo').toBe(DESTINO)
    expect(quedo?.role).toBe('asistente')
    // Los metadatos del transporte no son campos del documento.
    expect(quedo?._ruta).toBeUndefined()
    expect(quedo?._coleccion).toBeUndefined()
  })

  it('su propio respaldo volviendo encima de sí mismo sí se escribe', async () => {
    t.poner(`clinic_members/${UID}`, { clinicId: DESTINO, role: 'medico' })
    const informe = await restaurar(respaldo([MEMBRESIA]))
    expect(informe.escritos).toBe(1)
    expect(informe.raizDeOtroConsultorio).toBe(0)
    expect(t.obtener(`clinic_members/${UID}`)?.role).toBe('asistente')
  })

  it('el árbol del consultorio sigue restaurándose junto a lo de nivel raíz', async () => {
    const informe = await restaurar(respaldo([
      MEMBRESIA,
      { _ruta: `clinics/${ORIGEN}/patients/P1`, _coleccion: 'patients', nombre: 'Paciente Sintético' },
    ]))
    expect(informe.escritos).toBe(2)
    // Re-enraizado de RUTA para el árbol: el origen no sobrevive al viaje.
    expect(t.obtener(`clinics/${DESTINO}/patients/P1`)?.nombre).toBe('Paciente Sintético')
    expect(t.obtener(`clinics/${ORIGEN}/patients/P1`)).toBeUndefined()
  })
})

describe('EL MODO ENSAYO NO ESCRIBE, Y AUN ASÍ VE LA COLISIÓN', () => {
  it('dice que no podría, y no toca nada', async () => {
    t.poner(`clinic_members/${UID}`, { clinicId: VECINA, role: 'medico' })
    const informe = await restaurar(respaldo([MEMBRESIA]), '&simular=1')
    expect(informe.simulado).toBe(true)
    expect(informe.raizDeOtroConsultorio).toBe(1)
    expect(t.obtener(`clinic_members/${UID}`)?.clinicId).toBe(VECINA)
    expect(t.obtener(`clinic_members/${UID}`)?.role).toBe('medico')
  })

  it('y un ensayo sobre una ruta libre no la crea', async () => {
    const informe = await restaurar(respaldo([MEMBRESIA]), '&simular=1')
    expect(informe.escritos).toBe(1)
    expect(t.obtener(`clinic_members/${UID}`), 'un ensayo que escribe no es un ensayo').toBeUndefined()
  })
})
