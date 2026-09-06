/**
 * EL PAQUETE DE LA VISITA SE LIBERA Y LLEGA — V9 · POSTVISIT-001 · REG-335.
 *
 * ── EL INVARIANTE QUE ESTE ARCHIVO EXISTE PARA SOSTENER ─────────────────────
 *
 *     FIRMAR UNA NOTA ≠ LIBERARLE INFORMACIÓN AL PACIENTE.
 *
 * Un contenido de cara al paciente necesita **autoridad clínica explícita**. La
 * firma es autoridad sobre el expediente; liberar es autoridad sobre lo que el
 * paciente leerá como definitivo. Son dos actos, y este archivo comprueba que
 * el segundo no se puede obtener haciendo el primero.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Recorriendo el camino entero —consulta → nota firmada → receta/órdenes →
 * paquete → liberación → portal → entrega— en vez de leer módulos sueltos. El
 * camino se cortaba en tres sitios, y los tres tenían las pruebas en verde:
 *
 *  1. **`POSTVISIT-GATE-001`.** `HojaParaElPaciente` se componía del estado VIVO
 *     de la consulta —medicamentos y estudios a medio dictar— y su única guarda
 *     era `{!esNotaHospital}`. Justo encima, `ComoCerrarLaConsulta` sí exigía
 *     `firmada`. La cabecera del módulo AFIRMABA que salía de lo ya firmado: era
 *     intención de diseño, no precondición.
 *  2. **`POSTVISIT-ENTREGA-001`.** Esa hoja tenía dos botones —copiar e
 *     imprimir— y no estaba en `/mi/[token]`, ni en `/api/portal`, ni en ninguna
 *     plantilla. La pieza mejor pensada del lado del paciente no le llegaba
 *     nunca. Y el único emisor de enlace con alcance clínico era el de la
 *     teleconsulta: la puerta existía y no había llave.
 *  3. **`componerPaquete` sin llamador.** Se escribió en
 *     `PATIENT-COMPANION-001` y se borró el mismo día porque el guardián de
 *     conexión la cazó. La ruta `paquetes` de `/api/portal` servía una colección
 *     que nadie escribía jamás.
 *
 * Causa raíz común: **el modelo y la compuerta existían; el ACTO no.** Nada
 * podía pasar de `DRAFT` a `RELEASED` porque no había ninguna superficie con
 * autoridad para hacerlo. Familia «escrito, probado y sin conectar».
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Un paquete sólo se compone **en el servidor**, **de una nota firmada**, con
 * las primitivas canónicas (`medicamentosDeLaReceta`, `alergiasParaImpreso`,
 * `comoTomarlo`) y **sin un solo modelo de lenguaje**. Sólo pasa a `RELEASED`
 * por `liberar()`, que exige quién y cuándo. Sólo sale del servidor lo que
 * `visibleParaElPaciente` aprueba. Y sólo se compone un camino hacia él —enlace
 * o mensaje— si esa misma compuerta vuelve a decir que sí.
 *
 * ── QUÉ **NO** CUBRE ESTE ARCHIVO ───────────────────────────────────────────
 *
 *  - **No renderiza ninguna pantalla.** La suite corre en `node`, sin jsdom: el
 *    cableado de `/mi/[token]`, de `EntregarAlPaciente` y de la consulta se
 *    comprueba leyendo su fuente, que es el precedente de esta casa. Que se vea
 *    bien es trabajo de las capturas de V15, no de éste.
 *  - **No corre contra Firestore de verdad.** El doble del Admin SDK direcciona
 *    por RUTA COMPLETA y soporta `runTransaction`, así que el aislamiento entre
 *    pacientes y entre consultorios NO es una promesa del doble: es consecuencia
 *    de qué ruta construye el código con el `{clinicId, patientId}` verificado.
 *    Las reglas reales las prueba la suite del emulador.
 *  - **No prueba las reglas de Firestore.** `paquetes_visita` es `write: if false`
 *    desde `PATIENT-COMPANION-001` y su guardián vive en la matriz de acceso.
 *  - **No juzga si el contenido es clínicamente correcto.** Sólo quién tuvo la
 *    autoridad para liberarlo y de qué material salió.
 *  - **No manda un solo WhatsApp.** Compone el mensaje y comprueba cuándo se
 *    niega a componerlo. El envío es el cliente del médico.
 *  - **No cubre la cartera de documentos** (`DOCUMENTS-001`) ni las preguntas
 *    del paciente (`PATIENT-AI-001`): sus campos siguen vacíos y declarados.
 *  - **No cubre el límite de tasa** (tiene su golden) ni la revocación por
 *    versión (idem) más allá de comprobar que el paquete pasa por la misma
 *    puerta que el resto del portal.
 *
 * Datos 100 % sintéticos — `.claude/rules/data-privacy.md`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* ────────────────────────────────────────────────────────────────────────────
   EL DOBLE DEL ADMIN SDK — con transacciones, que es lo que aquí importa
   ────────────────────────────────────────────────────────────────────────────
   Los documentos se direccionan por RUTA COMPLETA. Y `runTransaction` corre el
   cuerpo con un candado de proceso, así que dos liberaciones simultáneas se
   serializan igual que en Firestore: sin eso, la prueba del doble clic pasaría
   por accidente aunque el código tuviera la carrera. */
type Doc = Record<string, unknown>
const base = new Map<string, Doc>()
let fallaLaLecturaDelPaciente = false
let fallaLaLecturaDeNotas = false
/** Cuántas veces se ESCRIBIÓ de verdad un paquete. La idempotencia se cuenta aquí. */
let escrituras = 0
/** Entradas de bitácora, para poder mirar QUÉ se registró y qué no viajó en ellas. */
const bitacora: Doc[] = []

interface Filtro { campo: string; op: string; valor: unknown }

function hijosDirectos(ruta: string): Array<[string, Doc]> {
  const prefijo = `${ruta}/`
  return [...base.entries()].filter(([k]) => k.startsWith(prefijo) && !k.slice(prefijo.length).includes('/'))
}

function consulta(ruta: string, filtros: Filtro[]) {
  return {
    where: (campo: string, op: string, valor: unknown) => consulta(ruta, [...filtros, { campo, op, valor }]),
    get: async () => {
      if (fallaLaLecturaDeNotas && ruta.endsWith('/notas')) throw new Error('Firestore sintético: notas ilegibles')
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

function refDoc(ruta: string) {
  return {
    path: ruta,
    id: ruta.slice(ruta.lastIndexOf('/') + 1),
    collection: (n: string) => refColeccion(`${ruta}/${n}`),
    get: async () => {
      if (fallaLaLecturaDelPaciente && /\/patients\/[^/]+$/.test(ruta)) {
        throw new Error('Firestore sintético: el expediente no se pudo leer')
      }
      const d = base.get(ruta)
      return { exists: d !== undefined, id: ruta.slice(ruta.lastIndexOf('/') + 1), data: () => d }
    },
    set: async (datos: Doc) => { base.set(ruta, datos) },
    update: async (datos: Doc) => { base.set(ruta, { ...(base.get(ruta) ?? {}), ...datos }) },
  }
}

function refColeccion(ruta: string) {
  return {
    ...consulta(ruta, []),
    doc: (id?: string) => refDoc(`${ruta}/${id ?? `auto_${base.size}_${Math.random().toString(36).slice(2)}`}`),
    add: async (datos: Doc) => {
      const ruta2 = `${ruta}/auto_${base.size}_${Math.random().toString(36).slice(2)}`
      base.set(ruta2, datos)
      if (ruta.endsWith('/audit_log')) bitacora.push(datos)
      return refDoc(ruta2)
    },
  }
}

/** Candado de proceso: serializa las transacciones como haría el servidor real. */
let cola: Promise<unknown> = Promise.resolve()

async function correrTransaccion<T>(cuerpo: (tx: unknown) => Promise<T>): Promise<T> {
  const anterior = cola
  let resolver: () => void = () => {}
  cola = new Promise<void>(r => { resolver = r })
  await anterior.catch(() => {})
  try {
    const tx = {
      get: async (ref: { path?: string; get: () => Promise<unknown> }) => ref.get(),
      set: (ref: { path: string }, datos: Doc) => {
        if (ref.path.includes('/paquetes_visita/')) escrituras++
        base.set(ref.path, datos)
      },
    }
    return await cuerpo(tx)
  } finally { resolver() }
}

vi.mock('@/lib/firebase-admin', () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIME' } } },
  adminDb: {
    collection: (n: string) => refColeccion(n),
    runTransaction: <T>(cuerpo: (tx: unknown) => Promise<T>) => correrTransaccion(cuerpo),
  },
}))

/* ── La identidad de quien llama: se decide por prueba ─────────────────────── */
let quienLlama: { ok: boolean; uid?: string; email?: string; role?: string; clinicIdReal?: string } =
  { ok: true, uid: 'uid_dr_david', email: 'dr@ejemplo.mx', role: 'medico', clinicIdReal: 'clinica-sintetica-a' }

vi.mock('@/lib/authz/verificar', async () => {
  const { NextResponse } = await import('next/server')
  return {
    verificarCapacidad: async (_req: unknown, clinicId: string) => {
      if (!quienLlama.ok) {
        return { ok: false, response: NextResponse.json({ ok: false, error: 'Sin permiso' }, { status: 403 }) }
      }
      /* LA MEMBRESÍA MANDA, NO EL CUERPO. Un médico de la clínica A que escriba
         el id de la B recibe 403, igual que en `verificarMiembro`. */
      if (quienLlama.clinicIdReal && clinicId !== quienLlama.clinicIdReal) {
        return { ok: false, response: NextResponse.json({ ok: false, error: 'No tienes acceso a esta clínica.' }, { status: 403 }) }
      }
      return { ok: true, uid: quienLlama.uid, email: quienLlama.email, role: quienLlama.role, clinicId }
    },
  }
})

vi.mock('@/lib/rate-limit', () => ({
  limitar: async () => ({ permitido: true, restantes: 99 }),
  limitarOResponder: async () => null,
  limitarEstricto: async () => null,
}))

import { POST as PAQUETE } from '@/app/api/expediente/paquete-de-visita/route'
import { POST as PORTAL } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'
import {
  componerPaquete, liberar, visibleParaElPaciente, cambiosDeMedicacion,
  mismoContenido, retirar, siguienteVersion,
  type PaqueteDeVisita, type NotaParaElPaquete,
} from '@/lib/paciente/paquete-de-visita'
import { mensajeDeEntrega } from '@/lib/paciente/entrega-del-paquete'
import type { Medicamento } from '@/types/expediente'

const CLINICA_A = 'clinica-sintetica-a'
const CLINICA_B = 'clinica-sintetica-b'
const PACIENTE_1 = 'pac-sintetico-001'
const PACIENTE_2 = 'pac-sintetico-002'
const NOTA_1 = 'nota-sintetica-001'

function req(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'vitest' }),
  } as unknown as Parameters<typeof PAQUETE>[0]
}

const med = (nombre: string, over: Partial<Medicamento> = {}): Medicamento => ({
  nombre, dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días', ...over,
})

const PRESCRITO_HOY = med('amoxicilina', { procedenciaClinica: 'se_prescribe_hoy', estado: 'activa' })
const REFERIDO_POR_EL_PACIENTE = med('metformina', { procedenciaClinica: 'ya_lo_toma', estado: 'activa' })
const SUGERIDO_POR_LA_IA = med('losartán', { estado: 'borrador' })
const SUSPENDIDO = med('ibuprofeno', { procedenciaClinica: 'se_prescribe_hoy', estado: 'suspendida', motivoEstado: 'gastritis' })

const FIRMA = {
  nombreMedico: 'Dra. Sintética Ejemplo',
  cedulaProfesional: '00000000',
  especialidad: 'Medicina Interna',
  timestamp: '2026-08-20T18:00:00.000Z',
  hashFirma: 'hash-sintetico',
}

function poner(ruta: string, datos: Doc) { base.set(ruta, { ...(base.get(ruta) ?? {}), ...datos }) }

function sembrarPaciente(clinicId: string, patientId: string, datos: Doc = {}) {
  poner(`clinics/${clinicId}/patients/${patientId}`, {
    nombre: 'Paciente Sintético', alergiasEstructuradas: [{ alergeno: 'penicilina', tipo: 'medicamento', severidad: 'grave' }], ...datos,
  })
}

function sembrarNota(clinicId: string, patientId: string, notaId: string, datos: Doc = {}) {
  poner(`clinics/${clinicId}/patients/${patientId}/notas/${notaId}`, {
    estado: 'firmada',
    fechaConsulta: '2026-08-20T17:00:00.000Z',
    firma: FIRMA,
    diagnosticos: [{ descripcion: 'Faringitis aguda' }],
    medicamentos: [PRESCRITO_HOY, REFERIDO_POR_EL_PACIENTE, SUGERIDO_POR_LA_IA, SUSPENDIDO],
    estudiosOrden: ['Biometría hemática'],
    ...datos,
  })
}

function sembrarConfig(clinicId: string) {
  poner(`clinics/${clinicId}/config/main`, { nombreClinica: 'Consultorio Sintético', whatsappConsultorio: '5215555550000' })
}

const notaDePrueba = (over: Partial<NotaParaElPaquete> = {}): NotaParaElPaquete => ({
  id: NOTA_1,
  estado: 'firmada',
  fechaConsulta: '2026-08-20T17:00:00.000Z',
  firma: FIRMA,
  diagnosticos: [{ descripcion: 'Faringitis aguda' }],
  medicamentos: [PRESCRITO_HOY, REFERIDO_POR_EL_PACIENTE, SUGERIDO_POR_LA_IA, SUSPENDIDO],
  estudiosOrden: ['Biometría hemática'],
  ...over,
})

async function liberarComoMedico(extra: Doc = {}) {
  return PAQUETE(req({ action: 'liberar', clinicId: CLINICA_A, patientId: PACIENTE_1, notaId: NOTA_1, ...extra }))
}

async function paquetesDelPortal(clinicId: string, patientId: string, alcance: 'agenda' | 'clinico' = 'clinico', version = 0) {
  const token = crearTokenPaciente(clinicId, patientId, 7, alcance, version)
  const res = await PORTAL(req({ action: 'paquetes', token }) as never)
  return { status: res.status, cuerpo: await res.json() }
}

beforeEach(() => {
  base.clear()
  bitacora.length = 0
  escrituras = 0
  fallaLaLecturaDelPaciente = false
  fallaLaLecturaDeNotas = false
  quienLlama = { ok: true, uid: 'uid_dr_david', email: 'dr@ejemplo.mx', role: 'medico', clinicIdReal: CLINICA_A }
  sembrarConfig(CLINICA_A)
  sembrarPaciente(CLINICA_A, PACIENTE_1)
  sembrarNota(CLINICA_A, PACIENTE_1, NOTA_1)
})

// ─────────────────────────────────────────────────────────────────────────────
// 1 · FIRMAR NO LIBERA (§5 de la prueba pedida)
// ─────────────────────────────────────────────────────────────────────────────

describe('firmar la nota NO libera nada al paciente', () => {
  it('con la nota firmada, el paquete compuesto sigue naciendo DRAFT', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(c.paquete.estado).toBe('DRAFT')
    expect(visibleParaElPaciente(c.paquete)).toBe(false)
  })

  it('firmar no escribe ningún paquete: hasta que alguien libera, el portal no ve nada', async () => {
    /**
     * ÉSTA es la prueba del invariante entero. La nota está firmada en la base
     * desde `beforeEach` y nadie ha llamado a `liberar`.
     */
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1)
    expect(r.status).toBe(200)
    expect(r.cuerpo.paquetes).toEqual([])
  })

  it('un borrador NO se puede componer, y se dice por qué', async () => {
    /**
     * `POSTVISIT-GATE-001`. Probada al revés: si la ruta compusiera del estado
     * vivo —que es lo que hacía la hoja del paciente— esto devolvería 200.
     */
    poner(`clinics/${CLINICA_A}/patients/${PACIENTE_1}/notas/${NOTA_1}`, { estado: 'borrador', firma: null })
    const res = await liberarComoMedico()
    expect(res.status).toBe(409)
    const cuerpo = await res.json()
    expect(cuerpo.motivo).toBe('nota-sin-firmar')
    expect(escrituras).toBe(0)
  })

  it('una nota sin firma con cédula tampoco: no hay a quién atribuir el papel', () => {
    const sinCedula = componerPaquete({
      nota: notaDePrueba({ firma: { nombreMedico: 'Dra. Sintética Ejemplo', cedulaProfesional: '' } }),
      medicacionPrevia: [], alergias: '',
    })
    expect(sinCedula).toEqual({ ok: false, motivo: 'nota-sin-firma' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2 · DRAFT INVISIBLE / RELEASED VISIBLE
// ─────────────────────────────────────────────────────────────────────────────

describe('DRAFT invisible, RELEASED visible — y el servidor es quien filtra', () => {
  it('un DRAFT sembrado a mano en la base NO sale por el portal', async () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    poner(`clinics/${CLINICA_A}/patients/${PACIENTE_1}/paquetes_visita/${NOTA_1}`, c.paquete as unknown as Doc)
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1)
    expect(r.cuerpo.paquetes).toEqual([])
  })

  it('un `RELEASED` con el estado puesto A MANO, sin aprobador, tampoco sale', async () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    poner(`clinics/${CLINICA_A}/patients/${PACIENTE_1}/paquetes_visita/${NOTA_1}`,
      { ...c.paquete, estado: 'RELEASED', approvedBy: null, approvedAt: null } as unknown as Doc)
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1)
    expect(r.cuerpo.paquetes).toEqual([])
  })

  it('liberado por la ruta, SÍ sale — y trae quién y cuándo', async () => {
    const res = await liberarComoMedico()
    expect(res.status).toBe(200)
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1)
    expect(r.cuerpo.paquetes).toHaveLength(1)
    const p = r.cuerpo.paquetes[0] as PaqueteDeVisita
    expect(p.estado).toBe('RELEASED')
    expect(p.approvedBy).toBe('uid_dr_david')
    expect(p.approvedAt).toBeGreaterThan(0)
  })

  it('un enlace de AGENDA no abre el paquete, aunque esté liberado', async () => {
    await liberarComoMedico()
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1, 'agenda')
    expect(r.status).toBe(403)
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/amoxicilina/i)
  })

  it('un token REVOCADO no abre el paquete', async () => {
    /**
     * La revocación por contador de versión: el consultorio sube
     * `portalTokenVersion` y todos los enlaces emitidos antes mueren de golpe.
     * El paquete pasa por la MISMA puerta que el resto del portal — no tiene
     * una suya, que es como se abren los agujeros.
     */
    await liberarComoMedico()
    poner(`clinics/${CLINICA_A}/patients/${PACIENTE_1}`, { portalTokenVersion: 3 })
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1, 'clinico', 0)
    expect(r.status).toBe(401)
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/amoxicilina/i)
  })

  it('estado indeterminado del enlace: falla CERRADO', async () => {
    /**
     * Si no se puede comprobar la vigencia, no se sirve secreto médico. Es
     * REG-332 dicho sobre esta superficie: «no pude comprobarlo» no es «adelante».
     */
    await liberarComoMedico()
    fallaLaLecturaDelPaciente = true
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1)
    expect(r.status).not.toBe(200)
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/amoxicilina/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3 · AISLAMIENTO — paciente y consultorio
// ─────────────────────────────────────────────────────────────────────────────

describe('el paciente A no ve al B, y el consultorio A no ve al B', () => {
  it('el paciente 2 no ve el paquete del paciente 1', async () => {
    await liberarComoMedico()
    sembrarPaciente(CLINICA_A, PACIENTE_2)
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_2)
    expect(r.cuerpo.paquetes).toEqual([])
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/amoxicilina/i)
  })

  it('un token de la clínica B no alcanza el paquete de la clínica A', async () => {
    await liberarComoMedico()
    sembrarPaciente(CLINICA_B, PACIENTE_1)
    const r = await paquetesDelPortal(CLINICA_B, PACIENTE_1)
    expect(r.cuerpo.paquetes).toEqual([])
  })

  it('un médico de la clínica A no puede liberar en la clínica B ni sabiendo su id', async () => {
    sembrarPaciente(CLINICA_B, PACIENTE_1)
    sembrarNota(CLINICA_B, PACIENTE_1, NOTA_1)
    const res = await PAQUETE(req({ action: 'liberar', clinicId: CLINICA_B, patientId: PACIENTE_1, notaId: NOTA_1 }))
    expect(res.status).toBe(403)
    expect(base.get(`clinics/${CLINICA_B}/patients/${PACIENTE_1}/paquetes_visita/${NOTA_1}`)).toBeUndefined()
  })

  it('quien no tiene la capacidad de firmar no libera', async () => {
    quienLlama = { ok: false }
    const res = await liberarComoMedico()
    expect(res.status).toBe(403)
    expect(escrituras).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4 · DE QUÉ MATERIAL SALE — y de cuál NO
// ─────────────────────────────────────────────────────────────────────────────

describe('el paquete sólo se deriva de material con autoridad clínica', () => {
  it('lo que el médico NO prescribió no aparece', async () => {
    await liberarComoMedico()
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1)
    const p = r.cuerpo.paquetes[0] as PaqueteDeVisita
    const nombres = p.medicationInstructions.map(m => m.nombre)
    expect(nombres).toEqual(['amoxicilina'])
    /* Lo que el paciente REFIRIÓ y lo que la IA sugirió sin confirmar se quedan
       en la nota, que es donde tienen que estar, y fuera del papel. */
    expect(nombres).not.toContain('metformina')
    expect(nombres).not.toContain('losartán')
  })

  it('un medicamento SUSPENDIDO no aparece como receta activa', async () => {
    await liberarComoMedico()
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1)
    const p = r.cuerpo.paquetes[0] as PaqueteDeVisita
    expect(JSON.stringify(p.medicationInstructions)).not.toMatch(/ibuprofeno/i)
  })

  it('lo vencido sin revisar tampoco cruza', () => {
    const c = componerPaquete({
      nota: notaDePrueba({ medicamentos: [med('ciprofloxacino', { procedenciaClinica: 'se_prescribe_hoy', estado: 'probablemente_terminada' })] }),
      medicacionPrevia: [], alergias: '',
    })
    if (!c.ok) throw new Error('no compuso')
    expect(c.paquete.medicationInstructions).toEqual([])
  })

  it('la instrucción se COMPONE, no se redacta: sale de `comoTomarlo`', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    /* Vía en llano y «cada 8 horas» expandido sólo porque 24÷8 es exacto. */
    expect(c.paquete.medicationInstructions[0].instruccion)
      .toBe('amoxicilina · 500 mg · por la boca · cada 8 horas (3 veces al día) · durante 7 días')
  })

  it('las alergias CANÓNICAS llegan, por la primitiva del impreso del médico', async () => {
    await liberarComoMedico()
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1)
    const p = r.cuerpo.paquetes[0] as PaqueteDeVisita
    /* Están sólo en `alergiasEstructuradas`: un paciente así salía como «sin
       registro» antes de que `alergiasParaImpreso` fuera la única puerta. */
    expect(String(p.alergias)).toMatch(/penicilina/i)
  })

  it('el prescriptor y la cédula llegan DE LA FIRMA, no de la configuración viva', async () => {
    /* La configuración del consultorio dice otra cosa a propósito: si el papel
       la usara, actualizar el perfil cambiaría el autor de un acto ya entregado. */
    poner(`clinics/${CLINICA_A}/config/main`, { nombreMedico: 'Dr. Otro Distinto', cedulaProfesional: '99999999' })
    await liberarComoMedico()
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1)
    const p = r.cuerpo.paquetes[0] as PaqueteDeVisita
    expect(p.prescriptor).toEqual({
      nombre: 'Dra. Sintética Ejemplo', cedulaProfesional: '00000000', especialidad: 'Medicina Interna',
    })
  })

  it('lo que no se puede componer se queda VACÍO: no hay signos de alarma inventados', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    expect(c.paquete.warningSigns).toEqual([])
    expect(c.paquete.educationalMaterial).toEqual([])
  })

  it('ningún modelo de lenguaje toca este camino', () => {
    const RUTA = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'expediente', 'paquete-de-visita', 'route.ts'), 'utf8')
    const MOTOR = readFileSync(join(process.cwd(), 'src', 'lib', 'paciente', 'paquete-de-visita.ts'), 'utf8')
    for (const fuente of [RUTA, MOTOR]) {
      expect(fuente).not.toMatch(/anthropic|openai|@\/lib\/ia|llamarModelo/i)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5 · UN FALLO DE RED NO ES UNA AUSENCIA
// ─────────────────────────────────────────────────────────────────────────────

describe('no se pudo leer ≠ no hay nada', () => {
  it('sin lista previa, `medicationChanges` es `null` y NO una lista de nuevos', () => {
    expect(cambiosDeMedicacion(['amoxicilina'], null)).toBeNull()
  })

  it('con lista previa vacía sí se afirma: todo es nuevo', () => {
    expect(cambiosDeMedicacion(['amoxicilina'], [])).toEqual([{ nombre: 'amoxicilina', tipo: 'nuevo' }])
  })

  it('lo que estaba antes y hoy no, se dice suspendido', () => {
    expect(cambiosDeMedicacion([], ['losartán'])).toEqual([{ nombre: 'losartán', tipo: 'suspendido' }])
  })

  it('si la lectura de las notas anteriores FALLA, el paquete no afirma ningún cambio', async () => {
    fallaLaLecturaDeNotas = true
    const res = await liberarComoMedico()
    expect(res.status).toBe(200)
    const p = (await res.json()).paquete as PaqueteDeVisita
    expect(p.medicationChanges).toBeNull()
  })

  it('si el expediente no se pudo leer, `alergias` es `null` — nunca `""`', async () => {
    fallaLaLecturaDelPaciente = true
    const res = await liberarComoMedico()
    const p = (await res.json()).paquete as PaqueteDeVisita
    /* `''` significaría «se leyó y no hay nada». Aquí no se leyó. */
    expect(p.alergias).toBeNull()
  })

  it('la pantalla del paciente distingue las dos cosas', () => {
    const PANTALLA = readFileSync(join(process.cwd(), 'src', 'app', 'mi', '[token]', 'page.tsx'), 'utf8')
    /*
     * Un fallo al pedir los paquetes NO acaba en `setPaquetes([])`. Desde
     * PC-006 la apertura del portal es UNA petición y el servidor distingue las
     * dos cosas en el propio dato: `null` = no se pudo leer, `[]` = se leyó y no
     * hay ninguno. La pantalla traduce esa distinción en vez de perderla.
     */
    expect(PANTALLA).toContain('setPaquetesError(d.paquetes === null)')
    expect(PANTALLA).toMatch(/paquetesError && \(/)
    /* Y con `alergias === null` no se escribe nada sobre alergias. */
    expect(PANTALLA).toContain('pk.alergias !== null')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6 · IDEMPOTENCIA Y VERSIONES
// ─────────────────────────────────────────────────────────────────────────────

describe('el doble clic, el reintento y la pestaña vieja', () => {
  it('dos liberaciones SIMULTÁNEAS no crean dos paquetes ni dos versiones', async () => {
    const [a, b] = await Promise.all([liberarComoMedico(), liberarComoMedico()])
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    const cuerpos = [await a.json(), await b.json()]
    /* Un solo documento, porque el id ES el `notaId`. */
    const docs = [...base.keys()].filter(k => k.includes('/paquetes_visita/'))
    expect(docs).toHaveLength(1)
    /* Y una sola versión: la segunda vio el mismo contenido ya liberado. */
    expect(cuerpos.map(c => c.paquete.version).sort()).toEqual([1, 1])
    expect(cuerpos.some(c => c.yaEstaba === true)).toBe(true)
    /* Y una sola escritura de verdad: la idempotencia no es «escribir lo mismo». */
    expect(escrituras).toBe(1)
  })

  it('un reintento posterior tampoco duplica ni reescribe la aprobación', async () => {
    const primera = (await (await liberarComoMedico()).json()).paquete as PaqueteDeVisita
    const segunda = (await (await liberarComoMedico()).json()).paquete as PaqueteDeVisita
    expect(segunda.version).toBe(1)
    expect(segunda.approvedAt).toBe(primera.approvedAt)
    expect(escrituras).toBe(1)
    /* Y la bitácora tampoco se duplica: un solo acto, un solo rastro. */
    expect(bitacora.filter(b => b.evento === 'paquete_liberado')).toHaveLength(1)
  })

  it('si el contenido CAMBIA, se libera una versión nueva — no se reescribe la vieja', async () => {
    await liberarComoMedico()
    poner(`clinics/${CLINICA_A}/patients/${PACIENTE_1}/notas/${NOTA_1}`, {
      medicamentos: [PRESCRITO_HOY, med('paracetamol', { procedenciaClinica: 'se_prescribe_hoy', estado: 'activa' })],
    })
    const p = (await (await liberarComoMedico({ versionEsperada: 1 })).json()).paquete as PaqueteDeVisita
    expect(p.version).toBe(2)
    expect(p.medicationInstructions.map(m => m.nombre)).toContain('paracetamol')
  })

  it('un paquete VIEJO no pisa la versión nueva: 409 y no se escribe', async () => {
    await liberarComoMedico()
    poner(`clinics/${CLINICA_A}/patients/${PACIENTE_1}/notas/${NOTA_1}`, { estudiosOrden: ['Radiografía de tórax'] })
    await liberarComoMedico({ versionEsperada: 1 })     // otra pestaña avanza a la 2
    const escriturasAntes = escrituras
    const res = await liberarComoMedico({ versionEsperada: 1 })   // la pestaña vieja llega tarde
    expect(res.status).toBe(409)
    expect((await res.json()).motivo).toBe('version-superada')
    expect(escrituras).toBe(escriturasAntes)
  })

  it('`mismoContenido` ignora la aprobación y mira el contenido', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    const a = liberar(c.paquete, 'dr_a', 1_754_000_000_000)
    const b = liberar(c.paquete, 'dr_b', 1_755_000_000_000)
    expect(mismoContenido(a, b)).toBe(true)
    expect(mismoContenido(a, { ...a, orders: ['otra cosa'] })).toBe(false)
  })

  it('`siguienteVersion` SUBE el contador; no lo repite', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    const v1 = liberar(c.paquete, 'dr_a', 1)
    expect(siguienteVersion(v1, c.paquete).version).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7 · REVERSIBILIDAD EXPLÍCITA
// ─────────────────────────────────────────────────────────────────────────────

describe('sólo se deshace con una versión nueva y un estado explícito', () => {
  it('retirar vuelve a DRAFT, sube la versión y lo saca del portal', async () => {
    await liberarComoMedico()
    const res = await PAQUETE(req({ action: 'retirar', clinicId: CLINICA_A, patientId: PACIENTE_1, notaId: NOTA_1 }))
    expect(res.status).toBe(200)
    const p = (await res.json()).paquete as PaqueteDeVisita
    expect(p.estado).toBe('DRAFT')
    expect(p.version).toBe(2)
    expect(p.approvedBy).toBeNull()
    const r = await paquetesDelPortal(CLINICA_A, PACIENTE_1)
    expect(r.cuerpo.paquetes).toEqual([])
  })

  it('retirar NO borra el documento: lo entregado sigue constando', async () => {
    await liberarComoMedico()
    await PAQUETE(req({ action: 'retirar', clinicId: CLINICA_A, patientId: PACIENTE_1, notaId: NOTA_1 }))
    expect(base.get(`clinics/${CLINICA_A}/patients/${PACIENTE_1}/paquetes_visita/${NOTA_1}`)).toBeTruthy()
    expect(bitacora.filter(b => b.evento === 'paquete_retirado')).toHaveLength(1)
  })

  it('`retirar` como función pura no pierde el contenido', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    const v = retirar(liberar(c.paquete, 'dr_a', 1))
    expect(v.medicationInstructions).toEqual(c.paquete.medicationInstructions)
    expect(visibleParaElPaciente(v)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8 · LA ENTREGA — WhatsApp sólo enlaza a lo liberado
// ─────────────────────────────────────────────────────────────────────────────

describe('sólo se compone un camino hacia un paquete LIBERADO', () => {
  const enlace = 'https://ejemplo.mx/mi/token-sintetico'

  it('con un DRAFT no hay mensaje: se niega y dice por qué', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    expect(mensajeDeEntrega({ paquete: c.paquete, enlace })).toEqual({ ok: false, motivo: 'no-liberado' })
  })

  it('con un RELEASED sin aprobador tampoco', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    const aMano = { ...c.paquete, estado: 'RELEASED' as const, approvedBy: null, approvedAt: null }
    expect(mensajeDeEntrega({ paquete: aMano, enlace }).ok).toBe(false)
  })

  it('con un RELEASED de verdad, sí — y el mensaje lleva el enlace', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    const m = mensajeDeEntrega({ paquete: liberar(c.paquete, 'dr_a', 1_754_000_000_000), enlace, consultorio: 'Consultorio Sintético' })
    expect(m.ok).toBe(true)
    if (!m.ok) return
    expect(m.mensaje).toContain(enlace)
  })

  it('el mensaje NO lleva secreto médico: se reenvía y acaba donde nadie controla', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: 'penicilina' })
    if (!c.ok) throw new Error('no compuso')
    const m = mensajeDeEntrega({ paquete: liberar(c.paquete, 'dr_a', 1), enlace })
    expect(m.ok).toBe(true)
    if (!m.ok) return
    for (const secreto of ['amoxicilina', 'Faringitis', 'penicilina', 'Biometría']) {
      expect(m.mensaje, `«${secreto}» no puede viajar por WhatsApp`).not.toMatch(new RegExp(secreto, 'i'))
    }
  })

  it('sin enlace no se compone un mensaje que diga «ya puedes verlo» sin decir dónde', () => {
    const c = componerPaquete({ nota: notaDePrueba(), medicacionPrevia: [], alergias: '' })
    if (!c.ok) throw new Error('no compuso')
    expect(mensajeDeEntrega({ paquete: liberar(c.paquete, 'dr_a', 1), enlace: '  ' }))
      .toEqual({ ok: false, motivo: 'sin-enlace' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9 · BITÁCORA Y PHI
// ─────────────────────────────────────────────────────────────────────────────

describe('auditable, y sin PHI donde no debe estar', () => {
  it('liberar deja quién, con la identidad del SERVIDOR y la hora del servidor', async () => {
    await liberarComoMedico()
    const e = bitacora.find(b => b.evento === 'paquete_liberado')
    expect(e).toBeTruthy()
    expect(e?.medicoUid).toBe('uid_dr_david')
    expect(e?.timestamp).toBe('SERVER_TIME')
    expect(e?.notaId).toBe(NOTA_1)
  })

  it('la bitácora lleva CONTEOS, no nombres de fármaco ni diagnósticos', async () => {
    await liberarComoMedico()
    const e = bitacora.find(b => b.evento === 'paquete_liberado')
    const texto = JSON.stringify(e)
    expect(texto).not.toMatch(/amoxicilina/i)
    expect(texto).not.toMatch(/faringitis/i)
    expect((e?.meta as Record<string, unknown>)?.medicamentos).toBe(1)
  })

  it('ni la ruta ni el motor registran PHI en los logs', () => {
    const RUTA = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'expediente', 'paquete-de-visita', 'route.ts'), 'utf8')
    /* `safeLog` y nunca `console.*` con datos del paciente. */
    expect(RUTA).not.toMatch(/console\.(log|error|warn)\(/)
    /* Ni el `patientId` ni el `notaId` viajan a los logs: el identificador de un
       expediente es dato del paciente y esto acaba en los logs de Vercel. */
    for (const m of RUTA.matchAll(/safeLog\.[a-z]+\(([^\n]*)/g)) {
      expect(m[1], `un log de esta ruta nombra al paciente: ${m[1]}`).not.toMatch(/patientId|notaId|paciente\./)
    }
  })

  it('los dos eventos están declarados en el tipo de la bitácora', async () => {
    const { EVENTO_LABEL } = await import('@/lib/expediente/audit-eventos')
    expect(EVENTO_LABEL.paquete_liberado).toBeTruthy()
    expect(EVENTO_LABEL.paquete_retirado).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10 · EL CAMINO EXISTE DE VERDAD (alcanzabilidad, no intención)
// ─────────────────────────────────────────────────────────────────────────────

describe('el camino está recorrido: UI médico → API → base → portal → entrega', () => {
  const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

  it('la pantalla de consulta MONTA el gesto de liberar', () => {
    const CONSULTA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(CONSULTA).toContain("import { EntregarAlPaciente }")
    expect(CONSULTA).toContain('<EntregarAlPaciente')
    /* Y con la compuerta de firma puesta: es `POSTVISIT-GATE-001`. */
    expect(CONSULTA).toMatch(/<EntregarAlPaciente[\s\S]{0,400}firmada=\{firmada\}/)
  })

  it('esa pantalla llama a la ruta que libera, y no escribe el paquete por su cuenta', () => {
    const COMP = leer('src', 'components', 'EntregarAlPaciente.tsx')
    expect(COMP).toContain("'/api/expediente/paquete-de-visita'")
    expect(COMP).toContain("action: 'liberar'")
    /* El navegador NO manda contenido clínico: sólo identificadores y la fecha. */
    expect(COMP).not.toMatch(/medicationInstructions:\s/)
    expect(COMP).not.toMatch(/encounterSummary:\s/)
  })

  it('la ruta compone del expediente con las primitivas canónicas', () => {
    const RUTA = leer('src', 'app', 'api', 'expediente', 'paquete-de-visita', 'route.ts')
    expect(RUTA).toContain('alergiasParaImpreso')
    expect(RUTA).toContain('medicamentosDeLaReceta')
    expect(RUTA).toContain('componerPaquete')
    expect(RUTA).toContain("verificarCapacidad(req, clinicId, 'firmar')")
  })

  it('el portal del paciente PIDE los paquetes y los pinta', () => {
    const PANTALLA = leer('src', 'app', 'mi', '[token]', 'page.tsx')
    /*
     * PC-006: la apertura del portal pedía CUATRO acciones y tres contaban
     * contra la ventana clínica; a la quinta recarga el paciente veía «no
     * pudimos cargar». Ahora la apertura es una sola petición (`inicio`) que
     * trae también los paquetes. La acción `paquetes` sigue existiendo para
     * refrescar sólo eso; lo que este caso vigila es que la pantalla los PIDA
     * al servidor y los pinte.
     */
    expect(PANTALLA).toContain("action: 'inicio'")
    expect(PANTALLA).toContain('d.paquetes')
    expect(PANTALLA).toContain('setPaquetes(')
    expect(PANTALLA).toContain('medicationInstructions.map')
  })

  it('la entrega pasa por la compuerta, no por el estado de la pantalla', () => {
    const ENTREGA = leer('src', 'lib', 'paciente', 'entrega-del-paquete.ts')
    expect(ENTREGA).toContain('visibleParaElPaciente')
    const COMP = leer('src', 'components', 'EntregarAlPaciente.tsx')
    expect(COMP).toContain('mensajeDeEntrega')
    /* Y el enlace que pide es el CLÍNICO: el de agenda no abre esto (E0-06). */
    expect(COMP).toContain("alcance: 'clinico'")
  })
})
