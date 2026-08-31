/**
 * WS-03 — PARA ENSEÑAR 20 PACIENTES NO SE DESCARGAN 50 000.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * El invariante central de WS-03 estaba escrito en el tablero y **nunca medido**.
 * REG-341/350/351/352 acotaron las lecturas más caras y sus pruebas comprueban
 * que el código *diga* `limit()`; ninguna comprobó qué **trae de vuelta** una
 * consulta cuando el consultorio es grande de verdad.
 *
 * Y esa diferencia ya costó una vez en este repositorio: REG-160 validaba un
 * campo y escribía en otro, con todas las pruebas en verde. «El dato tiene que
 * LLEGAR» tiene su gemelo aquí — **el dato tiene que NO llegar**: lo que se mide
 * es el volumen que cruza el cable, no la forma del código que lo pide.
 *
 * ── CÓMO SE MIDE ────────────────────────────────────────────────────────────
 *
 * Se envuelve `getDocs` del SDK modular y se **cuentan los documentos que cada
 * consulta devuelve**. Después se corren las funciones REALES del producto
 * —`listarPacientesPagina`, `buscarPacientes`, `listarNotasPagina`— contra el
 * emulador con las **reglas reales cargadas** y un contexto autenticado.
 *
 * No es una reimplementación: el `db` del producto se sustituye por el del
 * emulador y lo que corre es `src/lib/firestore.ts` tal cual.
 *
 * ── LA FORMA DE LA PRUEBA: DOS TAMAÑOS, NO UNO ──────────────────────────────
 *
 * Un solo tamaño no demuestra nada. «20 lecturas con 1 000 pacientes» es
 * compatible con una implementación que lea N/50. Se siembra **dos veces**, con
 * un salto grande entre las dos, y se exige que el conteo **no crezca**.
 *
 * `WS03_PACIENTES` permite subir el tamaño para el acta de escala; por omisión
 * usa un par pequeño para que el job del CI siga durando lo que duraba.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide autorización**: siembra con las reglas desactivadas y lee con un
 *   contexto de médico. Quien mide el aislamiento es `tenant-aislamiento` y, en
 *   ejecución, el arnés de carga (REG-378).
 * · **No mide latencia**: cuenta documentos. La latencia de un emulador local no
 *   se parece a la de producción y prometerla sería inventar una cifra.
 * · **No cubre todas las lecturas del producto**: cubre las tres del camino que
 *   el médico recorre a diario. El inventario completo sigue abierto en WS-03.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { abrirEntorno, contextoDe } from './entorno'
import { TENANT_A, uidDe } from './casos-tenant'

/** Documentos devueltos por consulta, acumulados por el envoltorio de `getDocs`. */
const leidos = vi.hoisted(() => ({ total: 0, consultas: 0 }))

vi.mock('firebase/firestore', async (original) => {
  const real = await original<typeof import('firebase/firestore')>()
  return {
    ...real,
    getDocs: async (q: Parameters<typeof real.getDocs>[0]) => {
      const snap = await real.getDocs(q)
      leidos.total += snap.size
      leidos.consultas += 1
      return snap
    },
  }
})

/** El `db` del producto pasa a ser el del emulador, con las reglas reales. */
const inyectado = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/firebase', () => ({
  get db() { return inyectado.db },
  auth: null,
  storage: null,
}))

const CLINICA = TENANT_A
const MEDICO = uidDe(TENANT_A, 'medico')

/**
 * Los dos tamaños. El salto tiene que ser grande: si fueran 100 y 120, una
 * implementación que lee N/5 pasaría.
 */
const PEQUENO = Number(process.env.WS03_PEQUENO ?? 200)
const GRANDE = Number(process.env.WS03_PACIENTES ?? 2000)

let env: RulesTestEnvironment

/**
 * Notas por paciente en la siembra.
 *
 * Un consultorio de 50 000 CASCARONES no ejercita nada: la historia es lo que
 * hace grande a una práctica, y es donde una lectura sin cota se vuelve cara.
 * Con tres notas por paciente, 50 000 pacientes son 200 000 documentos.
 */
const NOTAS_POR_PACIENTE = Number(process.env.WS03_NOTAS ?? 3)

/** Siembra `n` pacientes con nombres ordenables y su historia. */
async function sembrarPacientes(n: number): Promise<void> {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    const { doc, setDoc, writeBatch } = await import('firebase/firestore')
    await setDoc(doc(db, 'clinics', CLINICA), { nombre: 'Sintética', syntheticNonPhi: true })
    await setDoc(doc(db, 'clinic_members', MEDICO), { clinicId: CLINICA, role: 'medico', syntheticNonPhi: true })

    /* Lotes de 400: el mismo tope que usa el importador del producto. */
    for (let i = 0; i < n; i += 400) {
      const lote = writeBatch(db)
      for (let k = i; k < Math.min(i + 400, n); k += 1) {
        lote.set(doc(db, `clinics/${CLINICA}/patients/p${String(k).padStart(7, '0')}`), {
          nombre: `Paciente ${String(k).padStart(7, '0')}`,
          creadoPor: MEDICO,
          syntheticNonPhi: true,
        })
      }
      await lote.commit()
    }

    /* La historia: cada paciente con sus notas firmadas, en lotes propios. */
    for (let i = 0; i < n; i += 130) {
      const lote = writeBatch(db)
      for (let k = i; k < Math.min(i + 130, n); k += 1) {
        for (let j = 0; j < NOTAS_POR_PACIENTE; j += 1) {
          lote.set(doc(db, `clinics/${CLINICA}/patients/p${String(k).padStart(7, '0')}/notas/h${j}`), {
            estado: 'firmada',
            fechaConsulta: `202${j}-0${(k % 9) + 1}-1${k % 9}`,
            metadata: { medicoId: MEDICO },
            syntheticNonPhi: true,
          })
        }
      }
      await lote.commit()
    }
  })
}

/** Siembra `n` notas firmadas para un paciente, para medir el historial. */
async function sembrarNotas(patientId: string, n: number): Promise<void> {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    const { doc, writeBatch } = await import('firebase/firestore')
    for (let i = 0; i < n; i += 400) {
      const lote = writeBatch(db)
      for (let k = i; k < Math.min(i + 400, n); k += 1) {
        lote.set(doc(db, `clinics/${CLINICA}/patients/${patientId}/notas/n${String(k).padStart(5, '0')}`), {
          estado: 'firmada',
          fechaConsulta: `2020-01-${String((k % 28) + 1).padStart(2, '0')}`,
          metadata: { medicoId: MEDICO },
          syntheticNonPhi: true,
        })
      }
      await lote.commit()
    }
  })
}

function medir<T>(): { fin: () => { docs: number; consultas: number } } {
  const base = { ...leidos }
  return { fin: () => ({ docs: leidos.total - base.total, consultas: leidos.consultas - base.consultas }) }
}

beforeAll(async () => {
  env = await abrirEntorno()
  inyectado.db = contextoDe(env, CLINICA, 'medico').firestore()
}, 120_000)

afterAll(async () => { await env?.cleanup() })

describe('las lecturas del consultorio no crecen con el consultorio', () => {
  const medidas: Record<string, { docs: number; consultas: number }> = {}

  it(`mide con ${PEQUENO} y con ${GRANDE} pacientes, y compara`, async () => {
    const { listarPacientesPagina, buscarPacientes } = await import('@/lib/firestore')
    const { listarNotasPagina } = await import('@/lib/expediente/firestore')

    for (const [etiqueta, n] of [['pequeno', PEQUENO], ['grande', GRANDE]] as const) {
      await sembrarPacientes(n)
      await sembrarNotas('p0000000', 300)

      let m = medir()
      const pagina = await listarPacientesPagina(CLINICA, { limite: 20 })
      medidas[`${etiqueta}.pagina`] = m.fin()
      expect(pagina.pacientes.length, 'la página debe traer los 20 que se pidieron').toBe(20)

      m = medir()
      await buscarPacientes(CLINICA, 'Paciente 000')
      medidas[`${etiqueta}.busqueda`] = m.fin()

      m = medir()
      const notas = await listarNotasPagina(CLINICA, 'p0000000', { limite: 10 })
      medidas[`${etiqueta}.notas`] = m.fin()
      expect(notas.notas.length).toBeGreaterThan(0)
    }

    /**
     * El invariante, dicho en números. Se permite un margen del 20 %: una
     * consulta de prefijo puede traer una ventana ligeramente distinta según
     * cuántos nombres caigan dentro del rango. Lo que NO se permite es que el
     * conteo escale con N — y entre los dos tamaños hay un factor de 10.
     */
    for (const op of ['pagina', 'busqueda', 'notas']) {
      const p = medidas[`pequeno.${op}`].docs
      const g = medidas[`grande.${op}`].docs
      expect(
        g,
        `«${op}» leyó ${p} documentos con ${PEQUENO} pacientes y ${g} con ${GRANDE}: escala con el consultorio`,
      ).toBeLessThanOrEqual(Math.max(Math.ceil(p * 1.2), p + 5))
    }
  }, 600_000)

  it('para enseñar 20 pacientes no se descargan más de 21 documentos', () => {
    /* El +1 es el centinela del cursor: así se sabe si hay página siguiente sin
       pedir una segunda consulta. Es la única lectura de más que se acepta. */
    expect(medidas['grande.pagina'].docs).toBeLessThanOrEqual(21)
    expect(medidas['grande.pagina'].consultas).toBe(1)
  })

  it('el historial de un paciente con 300 notas se lee de a página', () => {
    expect(medidas['grande.notas'].docs).toBeLessThanOrEqual(11)
  })

  it('la búsqueda depende de la ventana, no del tamaño del consultorio', () => {
    /* `buscarPacientes` lanza una consulta de prefijo por estrategia aplicable,
       cada una con su ventana. El techo es ventana × estrategias. */
    expect(medidas['grande.busqueda'].docs).toBeLessThanOrEqual(200)
  })

  it('el medidor mide de verdad (si no, todo saldría en cero)', () => {
    /* Un contador que se queda en cero pasaría todos los casos de arriba. */
    expect(medidas['grande.pagina'].docs).toBeGreaterThan(0)
    expect(medidas['grande.notas'].docs).toBeGreaterThan(0)
    expect(leidos.consultas).toBeGreaterThan(5)
  })

  it('deja el acta en la salida, para el censo del programa', () => {
    const acta = {
      syntheticNonPhi: true,
      entorno: 'firestore-emulator con firestore.rules reales',
      pacientes: { pequeno: PEQUENO, grande: GRANDE },
      notasPorPaciente: NOTAS_POR_PACIENTE,
      documentosSembrados: GRANDE * (1 + NOTAS_POR_PACIENTE) + 300,
      documentosLeidos: medidas,
      loQueNoMide: 'Autorización (la mide tenant-aislamiento) y latencia (un emulador local no se parece a producción).',
    }
    fs.mkdirSync('docs/audit/ws-03-consultorio-grande', { recursive: true })
    fs.writeFileSync(
      `docs/audit/ws-03-consultorio-grande/lecturas-${GRANDE}.json`,
      `${JSON.stringify(acta, null, 2)}\n`,
    )
    expect(fs.existsSync(`docs/audit/ws-03-consultorio-grande/lecturas-${GRANDE}.json`)).toBe(true)
  })
})
