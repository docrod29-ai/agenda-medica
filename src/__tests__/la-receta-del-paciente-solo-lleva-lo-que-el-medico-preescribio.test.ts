/**
 * GOLDEN — H-01: el portal del paciente enseñaba como «RECETA» medicamentos que
 * el médico nunca prescribió.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La acción `documentos` de `/api/portal` armaba las «recetas» del paciente así:
 *
 *     .filter(n => Array.isArray(n.medicamentos) && n.medicamentos.length > 0)
 *     .map(n => ({ …, medicamentos: n.medicamentos ?? [] }))
 *
 * `n.medicamentos` es la lista de la NOTA, y en ella conviven —mezclados, sin
 * distinguir— cinco cosas que no son la misma:
 *
 *   · lo que el paciente REFIRIÓ que toma       `procedenciaClinica:'ya_lo_toma'`
 *   · lo que la IA extrajo y nadie confirmó     `estado:'borrador'`
 *   · lo que el médico SUSPENDIÓ o canceló      `suspendida` / `cancelada`
 *   · lo que venció sin que nadie lo revisara   `probablemente_terminada`
 *   · lo que el médico indicó DE VERDAD         `se_prescribe_hoy` + `activa`
 *
 * La pantalla del paciente bajaba esa lista cruda a `descargarRecetaWord` con
 * `tipo:'receta'`, que imprime «RECETA MÉDICA» y numera los renglones. Resultado:
 * la historia farmacológica del paciente salía impresa como prescripción, en un
 * documento que se lleva a la farmacia, sin que ningún médico lo hubiera
 * indicado — y encima sin prescriptor, porque el segundo argumento era `null`.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría H-01 de autoridad de prescripción. La pista fue un `grep` de la
 * frontera: `loQueSeReceta` tenía **un solo llamador en todo el repositorio** —la
 * pantalla del médico— mientras que «receta» se arma en dos superficies. Una
 * regla clínica con un llamador y dos superficies deja una de las dos sin regla,
 * y la que quedó fuera es precisamente aquella en la que NO hay un médico
 * mirando el resultado.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * **La frontera existía, pero como composición dentro de un componente.** La
 * pantalla del médico escribía a mano `loQueSeReceta(...).filter(estaVigente)`
 * dentro de un `useEffect`. Una regla clínica que vive dentro de una pantalla
 * protege exactamente a esa pantalla; cualquier segunda superficie nace sin ella
 * y nada lo señala. Es la familia «escrito y sin conectar», vista desde el otro
 * lado: aquí sí estaba conectado — a un solo consumidor de dos.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 *     historia ≠ medicación actual ≠ plan ≠ prescripción ≠ receta liberada
 *
 * Sólo una intención explícita, confirmada y atribuible al médico cruza
 * `medicamentosDeLaReceta`, que es ahora la ÚNICA puerta. Y cuando el
 * destinatario es el paciente, la puerta se cruza en el SERVIDOR: esconder un
 * renglón en la pantalla no cierra la ruta HTTP que lo devuelve.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 *  - **No prueba el aislamiento con las REGLAS de Firestore.** Aquí se comprueba
 *    que la RUTA construya su consulta a partir del `{clinicId, patientId}` del
 *    token firmado y de ningún dato del cuerpo. Que `firestore.rules` lo
 *    sostenga sólo lo puede decir el emulador (`emulator/*.emu.test.ts`).
 *  - **No renderiza la pantalla del paciente.** Esta suite corre en `node`, sin
 *    jsdom: el cableado de `/mi/[token]` se comprueba leyendo su fuente, que es
 *    el precedente de esta casa. Que el `.doc` descargado se vea bien es trabajo
 *    del golden de `receta-word`, no de éste.
 *  - **No cubre el paquete de visita** (`PaqueteDeVisita`), que tiene su propia
 *    compuerta `DRAFT`/`RELEASED` y su propia prueba. Aquí sólo se juzga la
 *    acción `documentos`.
 *  - **No decide qué es clínicamente correcto prescribir.** Sólo quién tuvo la
 *    autoridad para hacerlo.
 *  - **No cubre la receta impresa del MÉDICO** más allá de comprobar que cruza la
 *    misma puerta: su maquetación, su QR y su paginación tienen sus goldens.
 *
 * Datos 100 % sintéticos — `.claude/rules/data-privacy.md`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ── EL DOBLE DEL ADMIN SDK, EN ESTE ARCHIVO Y NO EN EL COMPARTIDO ────────────
 *
 * `_harness/firestore-admin-en-memoria` existe y sería el sitio natural, pero su
 * `where()` devuelve una `Consulta` sin `get()`: no sabe expresar
 * `.where(...).get()`, que es exactamente la forma que usa la acción bajo prueba.
 * Ampliarlo tocaría un archivo que otro carril tiene abierto, así que el doble
 * vive aquí, acotado a lo que esta prueba necesita.
 *
 * Lo que sí reproduce, y es lo único que hace que la prueba signifique algo: los
 * documentos se direccionan por RUTA COMPLETA. Así, que un paciente no vea la
 * receta de otro no es una promesa del doble — es consecuencia de qué ruta
 * construye la ruta HTTP con el `{clinicId, patientId}` del token firmado.
 */
type Doc = Record<string, unknown>
const base = new Map<string, Doc>()

interface Filtro { campo: string; op: string; valor: unknown }

function hijosDirectos(ruta: string): Array<[string, Doc]> {
  const prefijo = `${ruta}/`
  return [...base.entries()].filter(([k]) => k.startsWith(prefijo) && !k.slice(prefijo.length).includes('/'))
}

function consulta(ruta: string, filtros: Filtro[]) {
  return {
    where: (campo: string, op: string, valor: unknown) => consulta(ruta, [...filtros, { campo, op, valor }]),
    get: async () => {
      const docs = hijosDirectos(ruta)
        .filter(([, d]) => filtros.every(f => {
          if (f.op === '==') return d[f.campo] === f.valor
          throw new Error(`operador no soportado por el doble: ${f.op}`)
        }))
        .map(([k, d]) => ({ id: k.slice(k.lastIndexOf('/') + 1), data: () => d }))
      return { docs, size: docs.length }
    },
  }
}

/**
 * Interruptor para el caso «Firestore no contesta». Sin esto no se puede
 * distinguir el expediente QUE NO ESTÁ del expediente QUE NO SE PUDO LEER, y
 * son dos cosas distintas con dos respuestas distintas (ver el bloque
 * «UN ERROR DE LECTURA NO ES UNA AUSENCIA»).
 */
let fallaLaLecturaDelExpediente = false

function refDoc(ruta: string) {
  return {
    id: ruta.slice(ruta.lastIndexOf('/') + 1),
    collection: (n: string) => refColeccion(`${ruta}/${n}`),
    get: async () => {
      if (fallaLaLecturaDelExpediente && /\/patients\/[^/]+$/.test(ruta)) {
        throw new Error('Firestore sintético: la lectura del expediente falló')
      }
      const d = base.get(ruta)
      return { exists: d !== undefined, id: ruta.slice(ruta.lastIndexOf('/') + 1), data: () => d }
    },
    update: async (datos: Doc) => { base.set(ruta, { ...(base.get(ruta) ?? {}), ...datos }) },
  }
}

function refColeccion(ruta: string) {
  return { ...consulta(ruta, []), doc: (id: string) => refDoc(`${ruta}/${id}`) }
}

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: { collection: (n: string) => refColeccion(n) },
}))

/**
 * El límite de tasa tiene su propio golden (`portal-limite-de-tasa.test.ts`) y
 * aquí sólo estorbaría: varias lecturas seguidas del mismo paciente son
 * justamente lo que esta prueba necesita hacer.
 */
vi.mock('@/lib/rate-limit', () => ({
  limitar: async () => ({ permitido: true, restantes: 99 }),
  limitarOResponder: async () => null,
  // `limitarEstricto` desde PATIENT-PORTAL-001. Aquí siempre deja pasar: este
  // golden prueba QUÉ medicamentos bajan al paciente, no el freno. Lo que el
  // freno hace cuando no puede contar se prueba en
  // `portal-revocacion-falla-cerrado.test.ts`, que es su sitio.
  limitarEstricto: async () => null,
}))

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'
import { medicamentosDeLaReceta } from '@/lib/expediente/que-va-en-la-receta'
import type { Medicamento } from '@/types/expediente'

const CLINICA_A = 'clinica-sintetica-a'
const CLINICA_B = 'clinica-sintetica-b'
const PACIENTE_1 = 'pac-sintetico-001'
const PACIENTE_2 = 'pac-sintetico-002'

function req(body: unknown, ip = '203.0.113.9') {
  // `headers` desde PATIENT-PORTAL-001: la ruta cobra un límite por IP antes de
  // mirar el token. Sin cabeceras el doble de `NextRequest` revienta en la
  // primera línea y el golden dejaría de probar lo suyo por un detalle de
  // andamiaje. La IP es de TEST-NET-3 (RFC 5737), no enrutable.
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': ip }),
  } as unknown as Parameters<typeof POST>[0]
}

const med = (nombre: string, over: Partial<Medicamento> = {}): Medicamento => ({
  nombre,
  dosis: '500 mg',
  via: 'oral',
  frecuencia: 'cada 8 horas',
  duracion: '7 días',
  ...over,
})

/** Lo que el médico indicó hoy, de verdad. */
const PRESCRITO_HOY = med('amoxicilina', { procedenciaClinica: 'se_prescribe_hoy', estado: 'activa' })
/** «Tomo metformina desde hace tres años» — dicho por el paciente en el minuto dos. */
const REFERIDO_POR_EL_PACIENTE = med('metformina', { procedenciaClinica: 'ya_lo_toma', estado: 'activa' })
/** Extraído por la IA, sin que nadie declarara intención: nace borrador. */
const SUGERIDO_POR_LA_IA = med('losartán', { estado: 'borrador' })
/** «Deja el ibuprofeno mientras te dure la gastritis.» */
const SUSPENDIDO = med('ibuprofeno', { procedenciaClinica: 'se_prescribe_hoy', estado: 'suspendida', motivoEstado: 'gastritis' })
/** La duración venció y NADIE lo confirmó. */
const VENCIDO_SIN_REVISAR = med('ciprofloxacino', { procedenciaClinica: 'se_prescribe_hoy', estado: 'probablemente_terminada' })
const CANCELADO = med('naproxeno', { procedenciaClinica: 'se_prescribe_hoy', estado: 'cancelada' })

const FIRMA = {
  nombreMedico: 'Dra. Sintética Ejemplo',
  cedulaProfesional: '00000000',
  especialidad: 'Medicina Interna',
  timestamp: '2026-08-20T18:00:00.000Z',
  hashFirma: 'hash-sintetico',
}

function poner(ruta: string, datos: Doc) {
  base.set(ruta, { ...(base.get(ruta) ?? {}), ...datos })
}

function sembrarPaciente(clinicId: string, patientId: string, datos: Record<string, unknown> = {}) {
  poner(`clinics/${clinicId}/patients/${patientId}`, { nombre: 'Paciente Sintético', ...datos })
}

function sembrarNota(clinicId: string, patientId: string, notaId: string, datos: Record<string, unknown>) {
  poner(`clinics/${clinicId}/patients/${patientId}/notas/${notaId}`, {
    estado: 'firmada',
    fechaConsulta: '2026-08-20T17:00:00.000Z',
    firma: FIRMA,
    diagnosticos: [{ descripcion: 'Faringitis aguda' }],
    ...datos,
  })
}

function tokenClinico(clinicId: string, patientId: string) {
  return crearTokenPaciente(clinicId, patientId, 30, 'clinico', 0)
}

async function documentos(token: string) {
  const res = await POST(req({ action: 'documentos', token }))
  return { status: res.status, cuerpo: await res.json() }
}

beforeEach(() => {
  base.clear()
  fallaLaLecturaDelExpediente = false
})

// ─────────────────────────────────────────────────────────────────────────────
// 1 · LA PUERTA, COMO FUNCIÓN PURA
// ─────────────────────────────────────────────────────────────────────────────

describe('LA AUTORIDAD DE PRESCRIPCIÓN — la puerta, sola', () => {
  const TODO = [
    PRESCRITO_HOY, REFERIDO_POR_EL_PACIENTE, SUGERIDO_POR_LA_IA,
    SUSPENDIDO, VENCIDO_SIN_REVISAR, CANCELADO,
  ]

  it('de seis renglones sólo cruza el que el médico indicó hoy', () => {
    expect(medicamentosDeLaReceta(TODO).map(m => m.nombre)).toEqual(['amoxicilina'])
  })

  it('lo que el paciente REFIRIÓ no se receta', () => {
    expect(medicamentosDeLaReceta([REFERIDO_POR_EL_PACIENTE])).toEqual([])
  })

  it('lo que sugirió la IA sin confirmar no se receta', () => {
    expect(medicamentosDeLaReceta([SUGERIDO_POR_LA_IA])).toEqual([])
  })

  it('lo suspendido no se receta', () => {
    expect(medicamentosDeLaReceta([SUSPENDIDO])).toEqual([])
  })

  it('lo cancelado no se receta', () => {
    expect(medicamentosDeLaReceta([CANCELADO])).toEqual([])
  })

  it('lo vencido sin revisar tampoco: el calendario venció, nadie lo confirmó', () => {
    /**
     * `loQueSeReceta` SOLA dejaría pasar `probablemente_terminada` — no está en
     * su lista de estados terminales, y no debe estarlo: en la NOTA ese fármaco
     * sigue siendo algo de lo que hay que hablar. Lo que no puede es reimprimirse
     * como indicación vigente. Ésta es la mitad que aporta `estaVigente`, y por
     * eso la puerta son las dos juntas y no una.
     */
    expect(medicamentosDeLaReceta([VENCIDO_SIN_REVISAR])).toEqual([])
  })

  it('un renglón manual legado, sin etiqueta ni estado, SÍ se receta', () => {
    // Lo creó una acción directa del médico. Borrarlo retroactivamente del papel
    // sería quitarle una indicación que él escribió.
    expect(medicamentosDeLaReceta([med('paracetamol')]).map(m => m.nombre)).toEqual(['paracetamol'])
  })

  it('una nota con SÓLO antecedentes no es una receta', () => {
    // «Es una receta» se contesta con la puerta, no con `medicamentos.length`.
    expect(medicamentosDeLaReceta([REFERIDO_POR_EL_PACIENTE, SUGERIDO_POR_LA_IA])).toHaveLength(0)
  })

  it('una nota con una indicación real SÍ es una receta', () => {
    expect(medicamentosDeLaReceta([REFERIDO_POR_EL_PACIENTE, PRESCRITO_HOY])).toHaveLength(1)
  })

  it('no muta ni reordena lo que recibe', () => {
    const entrada = [...TODO]
    medicamentosDeLaReceta(entrada)
    expect(entrada).toEqual(TODO)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2 · EL FLUJO REAL: LA RUTA QUE EL PACIENTE LLAMA
// ─────────────────────────────────────────────────────────────────────────────

describe('EL PORTAL DEL PACIENTE — lo que devuelve la ruta de verdad', () => {
  beforeEach(() => {
    sembrarPaciente(CLINICA_A, PACIENTE_1, { alergias: 'Penicilina' })
    sembrarNota(CLINICA_A, PACIENTE_1, 'nota-1', {
      medicamentos: [
        REFERIDO_POR_EL_PACIENTE, SUGERIDO_POR_LA_IA, SUSPENDIDO,
        VENCIDO_SIN_REVISAR, CANCELADO, PRESCRITO_HOY,
      ],
    })
  })

  it('la receta que baja al paciente lleva SÓLO lo prescrito', async () => {
    /**
     * ÉSTE ES EL CASO DEL DEFECTO, EXACTO. Antes del arreglo esta afirmación
     * devolvía los seis nombres, y los seis se imprimían bajo el título
     * «RECETA MÉDICA» en el `.doc` que el paciente descarga.
     */
    const { status, cuerpo } = await documentos(tokenClinico(CLINICA_A, PACIENTE_1))
    expect(status).toBe(200)
    expect(cuerpo.documentos).toHaveLength(1)
    expect(cuerpo.documentos[0].medicamentos.map((m: Medicamento) => m.nombre)).toEqual(['amoxicilina'])
  })

  it('ni el referido, ni el de la IA, ni el suspendido llegan a la respuesta HTTP', async () => {
    const { cuerpo } = await documentos(tokenClinico(CLINICA_A, PACIENTE_1))
    const serializado = JSON.stringify(cuerpo)
    for (const prohibido of ['metformina', 'losartán', 'ibuprofeno', 'ciprofloxacino', 'naproxeno']) {
      expect(serializado, `«${prohibido}» no puede salir del servidor`).not.toContain(prohibido)
    }
  })

  it('una nota que sólo recogió antecedentes NO aparece como receta', async () => {
    sembrarNota(CLINICA_A, PACIENTE_1, 'nota-solo-antecedentes', {
      fechaConsulta: '2026-08-21T17:00:00.000Z',
      medicamentos: [REFERIDO_POR_EL_PACIENTE, SUGERIDO_POR_LA_IA],
    })
    const { cuerpo } = await documentos(tokenClinico(CLINICA_A, PACIENTE_1))
    expect(cuerpo.documentos.map((d: { id: string }) => d.id)).toEqual(['nota-1'])
  })

  it('la receta conserva al médico prescriptor y su cédula, de la FIRMA de la nota', async () => {
    const { cuerpo } = await documentos(tokenClinico(CLINICA_A, PACIENTE_1))
    const doc = cuerpo.documentos[0]
    expect(doc.medico).toBe(FIRMA.nombreMedico)
    expect(doc.cedulaProfesional).toBe(FIRMA.cedulaProfesional)
    expect(doc.especialidad).toBe(FIRMA.especialidad)
  })

  it('si las alergias existen en el expediente, la receta NO dice «sin registro»', async () => {
    const { cuerpo } = await documentos(tokenClinico(CLINICA_A, PACIENTE_1))
    expect(cuerpo.alergiasLeidas).toBe(true)
    expect(cuerpo.alergias).toContain('Penicilina')
  })

  it('una nota SIN firmar no es una receta, tenga lo que tenga', async () => {
    sembrarNota(CLINICA_A, PACIENTE_1, 'nota-borrador', {
      estado: 'borrador',
      fechaConsulta: '2026-08-22T17:00:00.000Z',
      medicamentos: [PRESCRITO_HOY],
    })
    const { cuerpo } = await documentos(tokenClinico(CLINICA_A, PACIENTE_1))
    expect(cuerpo.documentos.map((d: { id: string }) => d.id)).toEqual(['nota-1'])
  })

  it('un enlace SIN alcance clínico no ve ninguna receta', async () => {
    const agenda = crearTokenPaciente(CLINICA_A, PACIENTE_1, 30, 'agenda', 0)
    const res = await POST(req({ action: 'documentos', token: agenda }))
    expect(res.status).toBe(403)
    expect(JSON.stringify(await res.json())).not.toContain('amoxicilina')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3 · PRUEBAS NEGATIVAS DE AISLAMIENTO
// ─────────────────────────────────────────────────────────────────────────────

describe('DOS PACIENTES Y DOS CONSULTORIOS NO SE MEZCLAN', () => {
  beforeEach(() => {
    sembrarPaciente(CLINICA_A, PACIENTE_1)
    sembrarPaciente(CLINICA_A, PACIENTE_2)
    sembrarPaciente(CLINICA_B, PACIENTE_1)
    sembrarNota(CLINICA_A, PACIENTE_1, 'n-a1', { medicamentos: [med('amoxicilina', { procedenciaClinica: 'se_prescribe_hoy', estado: 'activa' })] })
    sembrarNota(CLINICA_A, PACIENTE_2, 'n-a2', { medicamentos: [med('azitromicina', { procedenciaClinica: 'se_prescribe_hoy', estado: 'activa' })] })
    sembrarNota(CLINICA_B, PACIENTE_1, 'n-b1', { medicamentos: [med('cefalexina', { procedenciaClinica: 'se_prescribe_hoy', estado: 'activa' })] })
  })

  it('el paciente 1 no ve el medicamento del paciente 2 del mismo consultorio', async () => {
    const { cuerpo } = await documentos(tokenClinico(CLINICA_A, PACIENTE_1))
    const s = JSON.stringify(cuerpo)
    expect(s).toContain('amoxicilina')
    expect(s).not.toContain('azitromicina')
  })

  it('el mismo patientId en OTRO consultorio no cruza la receta', async () => {
    /**
     * El id de paciente no es único entre consultorios: la ruta se construye con
     * `clinics/{clinicId}/patients/{patientId}`, y el `clinicId` sale del token
     * FIRMADO, nunca del cuerpo de la petición.
     */
    const { cuerpo } = await documentos(tokenClinico(CLINICA_B, PACIENTE_1))
    const s = JSON.stringify(cuerpo)
    expect(s).toContain('cefalexina')
    expect(s).not.toContain('amoxicilina')
  })

  it('el cuerpo de la petición NO puede redirigir la lectura a otro paciente', async () => {
    // Un `clinicId`/`patientId` inyectados en el cuerpo se ignoran: sólo manda el token.
    const res = await POST(req({
      action: 'documentos',
      token: tokenClinico(CLINICA_A, PACIENTE_1),
      clinicId: CLINICA_A,
      patientId: PACIENTE_2,
    }))
    const s = JSON.stringify(await res.json())
    expect(s).toContain('amoxicilina')
    expect(s).not.toContain('azitromicina')
  })

  it('un token con la firma alterada no abre nada', async () => {
    const bueno = tokenClinico(CLINICA_A, PACIENTE_1)
    const [payload] = bueno.split('.')
    const res = await POST(req({ action: 'documentos', token: `${payload}.firma-falsificada` }))
    expect(res.status).toBe(401)
  })
})

describe('REINTENTAR NO DUPLICA NI INVENTA', () => {
  beforeEach(() => {
    sembrarPaciente(CLINICA_A, PACIENTE_1, { alergias: 'Penicilina' })
    sembrarNota(CLINICA_A, PACIENTE_1, 'n-1', { medicamentos: [PRESCRITO_HOY, REFERIDO_POR_EL_PACIENTE] })
  })

  it('tres lecturas seguidas devuelven exactamente lo mismo', async () => {
    const token = tokenClinico(CLINICA_A, PACIENTE_1)
    const a = await documentos(token)
    const b = await documentos(token)
    const c = await documentos(token)
    expect(b.cuerpo).toEqual(a.cuerpo)
    expect(c.cuerpo).toEqual(a.cuerpo)
    expect(a.cuerpo.documentos).toHaveLength(1)
    expect(a.cuerpo.documentos[0].medicamentos).toHaveLength(1)
  })

  it('reintentar no añade medicamentos a la nota ni crea documentos nuevos', async () => {
    const token = tokenClinico(CLINICA_A, PACIENTE_1)
    await documentos(token)
    await documentos(token)
    const nota = base.get(`clinics/${CLINICA_A}/patients/${PACIENTE_1}/notas/n-1`)
    expect((nota?.medicamentos as Medicamento[]).length).toBe(2)
    expect(hijosDirectos(`clinics/${CLINICA_A}/patients/${PACIENTE_1}/notas`)).toHaveLength(1)
  })
})

describe('UN ERROR DE LECTURA NO ES UNA AUSENCIA', () => {
  /**
   * ── POR QUÉ ESTE BLOQUE CAMBIÓ DE FORMA (H-01 ∪ PATIENT-PORTAL-001) ────────
   *
   * H-01 pedía: un fallo al leer el expediente NO puede imprimirse como «Sin
   * registro de alergias». La respuesta de entonces era seguir sirviendo el
   * documento con `alergiasLeidas:false`, que apaga el recuadro.
   *
   * PATIENT-PORTAL-001 endureció la misma puerta por el otro lado: la vigencia
   * del enlace se lee de ese MISMO documento, y no poder comprobarla no es
   * autorización. Así que ahora la ruta ni siquiera llega a redactar el
   * recuadro:
   *
   *   · expediente que NO ESTÁ            → 401 (revocado)
   *   · expediente que NO SE PUDO LEER    → 503 (indeterminado, reintentable)
   *
   * El invariante de H-01 no se perdió: se dice más fuerte. Antes se prohibía
   * AFIRMAR una ausencia que nadie comprobó; ahora se prohíbe además servir el
   * documento mientras no se sepa. Lo que sigue prohibido es exactamente lo
   * mismo, y estas pruebas siguen fallando si alguien devuelve el fail-open:
   * un 200 con `alergiasLeidas:false` vuelve a poner ambos casos en rojo.
   */

  it('expediente que no está: no se sirve el documento, y no se afirma nada de alergias', async () => {
    // El paciente NO está sembrado. Un expediente ausente es una baja ARCO o un
    // token que nombra un consultorio que no es el suyo: en los dos casos la
    // puerta responde, y responde sin decir de quién se trata.
    sembrarNota(CLINICA_A, PACIENTE_2, 'n-x', { medicamentos: [PRESCRITO_HOY] })
    const { status, cuerpo } = await documentos(tokenClinico(CLINICA_A, PACIENTE_2))
    expect(status).toBe(401)
    expect(cuerpo.documentos).toBeUndefined()
    expect(cuerpo.alergias).toBeUndefined()
    expect(cuerpo.alergiasLeidas).toBeUndefined()
  })

  it('expediente que no se pudo leer: 503 reintentable, y tampoco se afirma nada de alergias', async () => {
    // Aquí el paciente SÍ existe y SÍ tiene alergias registradas: lo único que
    // falla es la lectura. Que el expediente exista es lo que hace que este
    // caso pruebe el fail-closed y no, por accidente, el caso de arriba.
    sembrarPaciente(CLINICA_A, PACIENTE_2, { alergias: ['penicilina'] })
    sembrarNota(CLINICA_A, PACIENTE_2, 'n-x', { medicamentos: [PRESCRITO_HOY] })
    fallaLaLecturaDelExpediente = true
    const { status, cuerpo } = await documentos(tokenClinico(CLINICA_A, PACIENTE_2))
    expect(status).toBe(503)
    expect(cuerpo.documentos).toBeUndefined()
    expect(cuerpo.alergias).toBeUndefined()
    expect(cuerpo.alergiasLeidas).toBeUndefined()
    // Y no se filtra la alergia que sí estaba sembrada.
    expect(JSON.stringify(cuerpo)).not.toContain('penicilina')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4 · REACHABILITY — «el dato tiene que LLEGAR»
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una puerta que nadie cruza es REG-170 otra vez. Aquí se congela que las DOS
 * superficies que arman una receta la crucen, y que la del paciente además la
 * cruce en el servidor. `vitest.config` corre en `node` y no renderiza `.tsx`:
 * se lee el fuente, que es el precedente de esta casa.
 */
describe('LAS DOS SUPERFICIES CRUZAN LA MISMA PUERTA', () => {
  const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  const ruta = leer('src/app/api/portal/route.ts')
  const pantallaMedico = leer('src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx')
  const pantallaPaciente = leer('src/app/mi/[token]/page.tsx')

  it('la RUTA del portal importa la puerta', () => {
    expect(ruta).toMatch(/import\s*\{[^}]*medicamentosDeLaReceta[^}]*\}\s*from\s*'@\/lib\/expediente\/que-va-en-la-receta'/)
  })

  it('y la aplica sobre los medicamentos de cada nota', () => {
    expect(ruta).toContain('medicamentosDeLaReceta(n.medicamentos ?? [])')
  })

  it('y ya NO devuelve la lista cruda de la nota', () => {
    // La línea exacta del defecto. Si vuelve, esta prueba se pone roja.
    expect(ruta).not.toMatch(/medicamentos:\s*n\.medicamentos\s*\?\?\s*\[\]/)
  })

  it('la pantalla del médico cruza la MISMA puerta, no una copia', () => {
    expect(pantallaMedico).toContain('medicamentosDeLaReceta(n.medicamentos ?? [])')
    expect(pantallaMedico).not.toContain('loQueSeReceta(')
  })

  it('la pantalla del paciente pasa el prescriptor al documento, no `null`', () => {
    expect(pantallaPaciente).toContain('nombreMedico: doc.medico')
    expect(pantallaPaciente).toContain('cedulaProfesional: doc.cedulaProfesional')
  })

  it('y sólo enseña alergias cuando el expediente se pudo leer', () => {
    expect(pantallaPaciente).toContain('alergias: alergiasLeidas ? alergias : undefined')
    expect(pantallaPaciente).toContain('mostrarAlergias: alergiasLeidas')
  })

  it('y un fallo de lectura ya NO se pinta como «no tienes recetas»', () => {
    expect(pantallaPaciente).toContain('setDocsError(true)')
    expect(pantallaPaciente).not.toMatch(/\.catch\(\(\)\s*=>\s*setDocs\(\[\]\)\)/)
  })
})
