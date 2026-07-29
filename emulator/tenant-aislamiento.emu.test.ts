/**
 * AISLAMIENTO MULTI-TENANT CONTRA EL MOTOR REAL DE REGLAS (unidad Nexus OS E0-08).
 *
 * NO CORRE EN EL GATE COMPARTIDO. Necesita el emulador de Firestore (y por tanto un
 * JRE) levantado: `npm run test:emulador`. Ver `docs/testing/emulador-multitenant.md`.
 *
 * QUÉ HUECO CIERRA. `src/__tests__/firestore-rules-guard.test.ts` y
 * `src/__tests__/matriz-acceso.test.ts` son ANÁLISIS DE TEXTO: comprueban que la
 * cadena `memberClinicId() == clinicId` está escrita en el archivo. Un cambio que
 * deje esa cadena intacta pero rompa el aislamiento —un `match` nuevo mal anidado,
 * un `||` mal puesto— pasa hoy en verde. Aquí es el MOTOR de Firestore el que
 * responde permitido/denegado. Eso es la diferencia entre «demostrado» y «asumido».
 *
 * DOS AFIRMACIONES:
 *  A) Aislamiento — todo acceso cross-tenant a un recurso no público se DENIEGA.
 *     Es la aceptación de la unidad.
 *  B) Control positivo — sin esto, A pasaría verde con unas reglas que niegan
 *     absolutamente todo (un typo, un `match` mal cerrado, la clínica sin sembrar).
 *     B es lo que hace que el verde de A signifique algo.
 *
 * LO QUE ESTA SUITE NO CUBRE, dicho para que nadie lea de más: la política POR
 * CAMPO (inmutabilidad de nota firmada, congelado de facturación) es E0-09;
 * `storage.rules` necesita su propio emulador; las rutas de API usan Admin SDK, que
 * IGNORA estas reglas por diseño (eso lo cubre `api-authz-guard.test.ts`).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import type { Rol } from '@/lib/authz/matriz-acceso'
import {
  TENANT_A,
  TENANT_B,
  casosDeAislamiento,
  recursosDeTenant,
  uidDe,
  type CasoTenant,
} from './casos-tenant'
import {
  abrirEntorno,
  codigoInvitacionDe,
  contextoDe,
  sembrar,
  tokenResenaDe,
  type Db,
} from './entorno'

let env: RulesTestEnvironment

/** Un contexto por (tenant, rol): crearlos por caso multiplicaría el coste. */
const contextos = new Map<string, RulesTestContext>()
function ctx(tenant: string, rol: Rol): RulesTestContext {
  const clave = `${tenant}|${rol}`
  let c = contextos.get(clave)
  if (!c) {
    c = contextoDe(env, tenant, rol)
    contextos.set(clave, c)
  }
  return c
}
function db(tenant: string, rol: Rol): Db {
  return ctx(tenant, rol).firestore()
}

beforeAll(async () => {
  env = await abrirEntorno()
  await env.clearFirestore()
  await sembrar(env)
}, 120_000)

afterAll(async () => {
  if (env) await env.cleanup()
})

/** Ejecuta el intento que describe el caso. */
function intentar(caso: CasoTenant): Promise<unknown> {
  const cliente = db(caso.tenantDelUsuario, caso.rol)
  const ref = cliente.doc(caso.ruta)
  if (caso.operacion === 'read') return ref.get()
  // Un `set` sobre un doc sembrado es un UPDATE a ojos de las reglas. El payload es
  // irrelevante para la Afirmación A: un deny es un deny sea el payload válido o no.
  return ref.set({
    clinicId: caso.tenantDelRecurso,
    tocadoPor: uidDe(caso.tenantDelUsuario, caso.rol),
    semilla: true,
  })
}

const CASOS = casosDeAislamiento()

describe('A) Aislamiento cross-tenant (rutas con clinicId posicional)', () => {
  it('el generador produjo casos y TODOS esperan denegación', () => {
    expect(CASOS.length).toBeGreaterThan(500)
    expect(CASOS.every(c => c.esperado === 'denegado')).toBe(true)
  })

  // Un `it` por colección (no por caso): 36 pruebas legibles en vez de 1 152 líneas
  // de reporte, sin perder ni una aserción.
  for (const recurso of recursosDeTenant()) {
    const casos = CASOS.filter(c => c.plantilla === recurso.ruta)
    if (casos.length === 0) continue
    it(`${recurso.ruta} — ${casos.length} intentos cross-tenant, todos denegados`, async () => {
      for (const caso of casos) {
        try {
          await assertFails(intentar(caso))
        } catch (e) {
          // `assertFails` rechaza si la operación FUE PERMITIDA (la fuga) o si falló
          // por otro error. Se distingue en el mensaje para no acusar de fuga a un
          // problema de infraestructura.
          throw new Error(
            `NO SE DENEGÓ como debía: ${caso.operacion.toUpperCase()} en ${caso.ruta}\n` +
              `  plantilla: ${caso.plantilla}\n` +
              `  guarda declarada: ${caso.guarda}\n` +
              `  usuario: ${uidDe(caso.tenantDelUsuario, caso.rol)} (rol ${caso.rol}, clínica ${caso.tenantDelUsuario})\n` +
              `  recurso de la clínica: ${caso.tenantDelRecurso}\n` +
              `  detalle: ${e instanceof Error ? e.message : String(e)}`,
          )
        }
      }
    }, 60_000)
  }
})

describe('A2) Aislamiento de las colecciones de RAÍZ (clinicId por contenido)', () => {
  // Estas rutas no llevan clinicId en la ruta: su aislamiento depende de
  // `resource.data.clinicId`, así que no se pueden generar con el producto
  // cartesiano. Van a mano y son las que más importan.

  it('un miembro de A no puede LEER la membresía de un usuario de B', async () => {
    const ajena = `clinic_members/${uidDe(TENANT_B, 'medico')}`
    await assertFails(db(TENANT_A, 'admin').doc(ajena).get())
    await assertFails(db(TENANT_A, 'medico').doc(ajena).get())
    await assertFails(db(TENANT_A, 'secretaria').doc(ajena).get())
  })

  it('NADIE puede LISTAR el directorio clinic_members (enumeración)', async () => {
    // `list` cerrado: con él abierto se enumeran correos y roles de todas las
    // clínicas. El listado legítimo va por /api/clinic/miembros (Admin SDK).
    await assertFails(db(TENANT_A, 'admin').collection('clinic_members').get())
    await assertFails(env.unauthenticatedContext().firestore().collection('clinic_members').get())
  })

  it('un admin de A no puede reapuntar su membresía a B (escalada cross-tenant)', async () => {
    const propia = `clinic_members/${uidDe(TENANT_A, 'admin')}`
    await assertFails(db(TENANT_A, 'admin').doc(propia).update({ clinicId: TENANT_B }))
  })

  it('un miembro de A no puede BORRAR la solicitud de reseña de B', async () => {
    await assertFails(db(TENANT_A, 'admin').doc(tokenResenaDe(TENANT_B)).delete())
  })

  it('un médico de A no puede CREAR una invitación para B (spam cross-tenant)', async () => {
    await assertFails(
      db(TENANT_A, 'medico').doc('clinic_invitations/inventado-por-alfa').set({
        clinicId: TENANT_B,
        role: 'secretaria',
        used: false,
      }),
    )
  })

  it('un miembro de A no puede BORRAR la invitación de B', async () => {
    await assertFails(db(TENANT_A, 'admin').doc(codigoInvitacionDe(TENANT_B)).delete())
  })

  it('NADIE puede enumerar clinic_invitations ni clinic_review_requests', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(anon.collection('clinic_invitations').get())
    await assertFails(anon.collection('clinic_review_requests').get())
  })

  it('los tokens de Google y las colecciones platform_* están cerradas al cliente', async () => {
    const cliente = db(TENANT_A, 'admin')
    await assertFails(cliente.doc(`googleTokens/${uidDe(TENANT_A, 'admin')}`).get())
    await assertFails(cliente.doc(`platform_payments/pago-${TENANT_A}`).get())
    await assertFails(cliente.doc(`platform_admin_log/log-${TENANT_A}`).get())
    await assertFails(cliente.doc(`platform_packages/pkg-${TENANT_A}`).get())
    await assertFails(cliente.doc(`platform_meta/meta-${TENANT_A}`).get())
  })

  it('el default-deny cierra una colección que no existe en las reglas', async () => {
    await assertFails(db(TENANT_A, 'admin').doc('coleccion_inventada/doc').get())
    await assertFails(db(TENANT_A, 'admin').doc('coleccion_inventada/doc').set({ x: 1 }))
  })
})

describe('B) Control positivo — el verde de A no es un «todo denegado»', () => {
  // Lista CURADA, no generada, y con payloads válidos escritos a mano: varias reglas
  // tienen condiciones POR CAMPO (nota firmada inmutable, congelado de facturación,
  // audit_log create:false) y un `set` genérico produciría rojos por payload
  // inválido, no por autorización. Verificar esas condiciones es E0-09.
  // Una entrada por guarda.

  it('isMember — appointments: la secretaria de A crea cita en A; un anónimo no', async () => {
    const cita = { clinicId: TENANT_A, cobroExento: false, fecha: '2026-01-02', pacienteId: 'x-docId' }
    await assertSucceeds(
      db(TENANT_A, 'secretaria').doc(`clinics/${TENANT_A}/appointments/cita-positiva`).set(cita),
    )
    await assertFails(
      env.unauthenticatedContext().firestore()
        .doc(`clinics/${TENANT_A}/appointments/cita-anonima`).set(cita),
    )
  })

  it('isMedico — notas: el médico de A crea borrador; la secretaria no lo lee', async () => {
    const ruta = `clinics/${TENANT_A}/patients/x-docId/notas/nota-positiva`
    await assertSucceeds(
      db(TENANT_A, 'medico').doc(ruta).set({ estado: 'borrador', contenido: 'texto sintético' }),
    )
    await assertSucceeds(db(TENANT_A, 'medico').doc(ruta).get())
    // SECRETO MÉDICO: la asistente agenda pero NO lee expedientes (NOM-004).
    await assertFails(db(TENANT_A, 'secretaria').doc(ruta).get())
  })

  it('isClinicoHospital — signos: enfermería de A registra; la secretaria no', async () => {
    const ruta = `clinics/${TENANT_A}/internamientos/x-intId/signos/signo-positivo`
    await assertSucceeds(
      db(TENANT_A, 'enfermeria').doc(ruta).set({ clinicId: TENANT_A, fc: 80, fr: 16 }),
    )
    await assertFails(
      db(TENANT_A, 'secretaria').doc(`${ruta}-2`).set({ clinicId: TENANT_A, fc: 80 }),
    )
  })

  it('isLabStaff — laboratorio: el laboratorio de A carga resultado; enfermería no', async () => {
    const ruta = `clinics/${TENANT_A}/laboratorio/x-ordenId`
    await assertSucceeds(
      db(TENANT_A, 'laboratorio').doc(ruta).set({ clinicId: TENANT_A, semilla: true, resultado: 'sintético' }),
    )
    // Enfermería LEE (isClinicoHospital) pero no EMITE resultados (isLabStaff).
    await assertSucceeds(db(TENANT_A, 'enfermeria').doc(ruta).get())
    await assertFails(
      db(TENANT_A, 'enfermeria').doc(ruta).set({ clinicId: TENANT_A, semilla: true, resultado: 'alterado' }),
    )
  })

  it('isAdmin — clinics: el admin de A renombra su clínica; el médico no', async () => {
    // `update`, NO `set`: la regla congela plan/status/ownerId/Stripe/paseLibre y un
    // `set` completo los borraría — sería un rojo por payload, no por autorización.
    await assertSucceeds(
      db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}`).update({ nombre: 'Clínica Alfa (sintética)' }),
    )
    await assertFails(
      db(TENANT_A, 'medico').doc(`clinics/${TENANT_A}`).update({ nombre: 'renombrada por el médico' }),
    )
  })

  it('servidor — secretos: ni el admin de la propia clínica los lee', async () => {
    await assertFails(db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}/secretos/x-docId`).get())
    await assertFails(db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}/secretos/x-docId`).set({ k: 'v' }))
  })

  it('publico — reviews: un anónimo lee la PUBLICADA, no la pendiente', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(anon.doc(`clinics/${TENANT_A}/reviews/x-reviewId`).get())
    await assertFails(anon.doc(`clinics/${TENANT_A}/reviews/no-publicada`).get())
  })

  it('E0-06 — patients/clinico: el médico de A lo lee, la secretaria no', async () => {
    const ruta = `clinics/${TENANT_A}/patients/x-docId/clinico/x-clinicoId`
    await assertSucceeds(db(TENANT_A, 'medico').doc(ruta).get())
    await assertFails(db(TENANT_A, 'secretaria').doc(ruta).get())
  })
})
