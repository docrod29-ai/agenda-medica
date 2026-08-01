/**
 * GOLDEN FLOW — el camino que se vende, recorrido entero contra las REGLAS REALES.
 *
 * ── QUÉ HUECO CIERRA (P0-5 de la auditoría) ──────────────────────────────────
 *
 * `PACIENTE → CITA → CONSULTA → NOTA → FIRMA → COBRO` es lo que el Master
 * Execution System V5 llama el flujo dorado: si eso no funciona, no hay producto
 * que vender. Y **nadie lo comprobaba de punta a punta**. Había pruebas unitarias
 * de cada pieza y dos specs de Playwright del camino público, pero ninguna que
 * recorriera la secuencia completa.
 *
 * ── POR QUÉ CONTRA EL EMULADOR Y NO CON UN NAVEGADOR ─────────────────────────
 *
 * El E2E de navegador necesita una cuenta de médico real con contraseña, y eso es
 * una decisión del dueño (credenciales en el CI), no algo que se pueda inventar
 * aquí. Lo que SÍ se puede probar hoy, sin pedirle nada a nadie, es la capa donde
 * de verdad se decide todo: **las reglas de seguridad de Firestore**, con el
 * mismo cliente autenticado que usa el navegador del médico.
 *
 * Lo que esto cubre: permisos, secreto médico, paywall, inmutabilidad de la nota
 * firmada, integridad del cobro. Lo que NO cubre, dicho sin adornos: la interfaz,
 * las rutas de IA y el checkout de Stripe. Esos siguen esperando la cuenta de
 * prueba y están anotados en la bitácora.
 *
 * ── EL CANDADO DE SIEMPRE ────────────────────────────────────────────────────
 *
 * `projectId` empieza por `demo-`, así que el SDK se NIEGA a hablar con un
 * proyecto real. Ninguna corrida puede tocar datos de un paciente.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { abrirEntorno, contextoDe, sembrar } from './entorno'
import { TENANT_A, uidDe } from './casos-tenant'

/**
 * El inquilino se IMPORTA, no se escribe.
 *
 * La primera versión de este archivo puso `'tenant-a'` a mano y las once pruebas
 * fallaron en bloque con «Null value error»: el documento `clinics/tenant-a` no
 * existía, así que `clinicaPuedeEscribir` dereferenciaba null y TODO salía
 * denegado — por la razón equivocada. Un literal inventado no da un fallo
 * legible, da un falso rojo que parece un problema de reglas.
 */
const CLINICA = TENANT_A
const PACIENTE = 'pac-golden'
const CITA = 'cita-golden'
const NOTA = 'nota-golden'
const COBRO = 'cobro-golden'

let env: RulesTestEnvironment

/** El médico: el actor del flujo. Su uid es el que las reglas comparan. */
const uidMedico = uidDe(CLINICA, 'medico')
/** La asistente: existe para probar que el secreto médico la deja fuera. */
const dbAsistente = () => contextoDe(env, CLINICA, 'secretaria').firestore()
const dbMedico = () => contextoDe(env, CLINICA, 'medico').firestore()

/** Pone el consultorio en un estado concreto, saltándose las reglas (es setup). */
async function estadoDelConsultorio(datos: Record<string, unknown>): Promise<void> {
  await env.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(`clinics/${CLINICA}`).set(datos, { merge: true })
  })
}

beforeAll(async () => { env = await abrirEntorno() })
afterAll(async () => { await env?.cleanup() })

beforeEach(async () => {
  await env.clearFirestore()
  await sembrar(env)
  // La semilla deja el consultorio 'active'; se explicita para que cada bloque
  // arranque de un estado conocido y no del que dejó el anterior.
  await estadoDelConsultorio({ status: 'active', paseLibre: false })
})

describe('GOLDEN FLOW · con el consultorio al día', () => {
  it('1) el médico da de alta un paciente', async () => {
    await assertSucceeds(
      dbMedico().doc(`clinics/${CLINICA}/patients/${PACIENTE}`)
        .set({ nombre: 'Paciente Sintético', edad: 42, sexo: 'M' }),
    )
  })

  it('2) le agenda una cita', async () => {
    await assertSucceeds(
      dbMedico().doc(`clinics/${CLINICA}/appointments/${CITA}`)
        .set({ patientId: PACIENTE, fechaHora: '2026-08-03T10:00:00.000Z', duracion: 30, estado: 'confirmada', cobroExento: false }),
    )
  })

  it('3) abre la nota de la consulta — y NACE en borrador', async () => {
    /**
     * REG-017: la firma es una ACCIÓN, no el estado inicial. Sin esta regla una
     * nota podía nacer ya `firmada` e inmutable, sin historia previa — una firma
     * sin trazabilidad, que es justo lo que la NOM-024 existe para impedir.
     */
    await assertSucceeds(
      dbMedico().doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${NOTA}`)
        .set({ estado: 'borrador', tipoNota: 'primera_vez', medicoId: uidMedico }),
    )
    await assertFails(
      dbMedico().doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/nota-que-nace-firmada`)
        .set({ estado: 'firmada', tipoNota: 'primera_vez', medicoId: uidMedico }),
    )
  })

  it('4) la firma, y a partir de ahí la nota es INMUTABLE', async () => {
    const ref = dbMedico().doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${NOTA}`)
    await ref.set({ estado: 'borrador', tipoNota: 'primera_vez', medicoId: uidMedico })
    await assertSucceeds(ref.update({ estado: 'firmada', hashIntegridad: 'abc123' }))
    // NOM-024: una nota firmada no se edita ni se borra. Se corrige con adenda.
    await assertFails(ref.update({ estado: 'borrador' }))
    await assertFails(ref.delete())
  })

  it('4b) y una nota firmada SÍ admite adenda — que tampoco se puede editar', async () => {
    const adenda = dbMedico().doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${NOTA}/adendas/ad-1`)
    await assertSucceeds(adenda.set({ texto: 'Aclaración', medicoId: uidMedico }))
    await assertFails(adenda.update({ texto: 'Cambiada' }))
    await assertFails(adenda.delete())
  })

  it('5) registra el cobro — a su propio nombre y sin importes negativos', async () => {
    /**
     * REG-015: el autor y el importe se validan en la regla, no sólo en el
     * cliente. Antes bastaba con ser miembro, así que un cobro podía quedar
     * atribuido a otra persona, y un monto negativo simulando devolución
     * descuadraba el corte en silencio.
     */
    const cobros = dbMedico()
    await assertSucceeds(
      cobros.doc(`clinics/${CLINICA}/cobros/${COBRO}`)
        .set({ monto: 800, metodo: 'efectivo', concepto: 'Consulta', fecha: '2026-08-03', citaId: CITA, patientId: PACIENTE, creadoPor: uidMedico, cancelado: false }),
    )
    // A nombre de otro: no.
    await assertFails(
      cobros.doc(`clinics/${CLINICA}/cobros/cobro-ajeno`)
        .set({ monto: 800, creadoPor: 'otro-uid', metodo: 'efectivo', concepto: 'x', fecha: '2026-08-03', citaId: CITA, patientId: PACIENTE, cancelado: false }),
    )
    // Devolución disfrazada de monto negativo: tampoco.
    await assertFails(
      cobros.doc(`clinics/${CLINICA}/cobros/cobro-negativo`)
        .set({ monto: -800, creadoPor: uidMedico, metodo: 'efectivo', concepto: 'x', fecha: '2026-08-03', citaId: CITA, patientId: PACIENTE, cancelado: false }),
    )
  })
})

describe('GOLDEN FLOW · el secreto médico', () => {
  it('la asistente agenda y cobra, pero NUNCA lee una nota', async () => {
    /**
     * NOM-004 + LFPDPPP: la nota clínica es dato sensible. La asistente necesita
     * la agenda y la caja para hacer su trabajo; el expediente no.
     */
    await assertSucceeds(dbAsistente().doc(`clinics/${CLINICA}/appointments/${CITA}`)
      .set({ patientId: PACIENTE, fechaHora: '2026-08-03T11:00:00.000Z', duracion: 30, estado: 'confirmada', cobroExento: false }))
    await assertFails(dbAsistente().doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${NOTA}`).get())
    await assertFails(dbAsistente().doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/nueva`)
      .set({ estado: 'borrador', medicoId: uidMedico }))
  })
})

describe('GOLDEN FLOW · cuando se acaba la prueba (GA-009)', () => {
  /** Prueba vencida hace tres días: fuera del día de gracia sin discusión. */
  const VENCIDA = { status: 'trial', trialEndsAtMs: Date.now() - 3 * 86_400_000, paseLibre: false }

  it('se detiene lo NUEVO: paciente, cita y nota', async () => {
    await estadoDelConsultorio(VENCIDA)
    const db = dbMedico()
    await assertFails(db.doc(`clinics/${CLINICA}/patients/pac-nuevo`).set({ nombre: 'X' }))
    await assertFails(db.doc(`clinics/${CLINICA}/appointments/cita-nueva`)
      .set({ patientId: PACIENTE, fechaHora: '2026-08-04T10:00:00.000Z', duracion: 30, estado: 'confirmada', cobroExento: false }))
    await assertFails(db.doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/nota-nueva`)
      .set({ estado: 'borrador', medicoId: uidMedico }))
  })

  it('PERO LA LECTURA NUNCA SE CORTA — el expediente es del paciente', async () => {
    /**
     * La decisión del dueño y la ley coinciden aquí: cortarle el acceso a su
     * propio expediente a un médico que no pagó sería ilegal (NOM-004) además de
     * hostil. Se detiene lo que cuesta dinero servir, no lo que ya existe.
     */
    await env.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc(`clinics/${CLINICA}/patients/${PACIENTE}`).set({ nombre: 'Paciente Sintético' })
      await ctx.firestore().doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${NOTA}`)
        .set({ estado: 'firmada', medicoId: uidMedico })
    })
    await estadoDelConsultorio(VENCIDA)
    const db = dbMedico()
    await assertSucceeds(db.doc(`clinics/${CLINICA}/patients/${PACIENTE}`).get())
    await assertSucceeds(db.doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${NOTA}`).get())
    await assertSucceeds(db.collection(`clinics/${CLINICA}/appointments`).get())
  })

  it('y una consulta YA ABIERTA se puede cerrar — el corte no deja notas a medias', async () => {
    /**
     * El detalle más humano de todo el reglamento, y está ahí a propósito:
     * «Firmar/editar un borrador YA abierto no [está sujeto al paywall], para no
     * dejar una consulta a medias sin poder cerrarla por un corte de pago a
     * mitad del día».
     *
     * El médico que empezó a escribir a las 11:00 con la prueba viva puede
     * terminar y firmar a las 11:20 aunque haya vencido en medio. Si esta prueba
     * cae, alguien convirtió un paywall en un secuestro de la consulta.
     */
    await env.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${NOTA}`)
        .set({ estado: 'borrador', medicoId: uidMedico })
    })
    await estadoDelConsultorio(VENCIDA)
    await assertSucceeds(
      dbMedico().doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${NOTA}`)
        .update({ estado: 'firmada', hashIntegridad: 'abc123' }),
    )
  })

  it('un consultorio CANCELADO también deja de escribir, sin importar la prueba', async () => {
    await estadoDelConsultorio({ status: 'cancelled', paseLibre: false })
    await assertFails(dbMedico().doc(`clinics/${CLINICA}/patients/pac-x`).set({ nombre: 'X' }))
  })

  it('el pase libre del dueño escribe siempre', async () => {
    await estadoDelConsultorio({ ...VENCIDA, paseLibre: true })
    await assertSucceeds(dbMedico().doc(`clinics/${CLINICA}/patients/pac-cortesia`).set({ nombre: 'X' }))
  })

  it('CONTROL POSITIVO: con el consultorio al día, todo lo anterior SÍ pasa', async () => {
    /**
     * Sin este control, las pruebas de arriba podrían estar en verde porque la
     * regla revienta y deniega TODO por la razón equivocada — un falso verde que
     * se ve idéntico a una defensa que funciona.
     */
    await estadoDelConsultorio({ status: 'active', paseLibre: false })
    await assertSucceeds(dbMedico().doc(`clinics/${CLINICA}/patients/pac-control`).set({ nombre: 'X' }))
  })
})
