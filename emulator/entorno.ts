/**
 * ENTORNO DEL EMULADOR + SIEMBRA SINTÉTICA (unidad Nexus OS E0-08).
 *
 * Este archivo es lo único de la unidad que habla con Firebase, y solo con el
 * EMULADOR: `PROJECT_ID` empieza por `demo-`, que hace que el SDK y las
 * herramientas se NIEGUEN a contactar un proyecto real y no pidan credenciales.
 * Es el candado para que una corrida de pruebas no pueda tocar datos del médico.
 *
 * Nada de esto corre en el gate compartido: requiere un emulador levantado (y por
 * tanto un JRE). Ver `docs/testing/emulador-multitenant.md`.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { ROLES, type Rol } from '@/lib/authz/matriz-acceso'
import {
  TENANTS,
  instanciar,
  recursosDeTenant,
  uidDe,
  type Tenant,
} from './casos-tenant'

/** El prefijo `demo-` es OBLIGATORIO: sin él el SDK podría hablar con un proyecto real. */
export const PROJECT_ID = 'demo-nexusmed-test'

/** Handle de Firestore tal como lo entrega la librería (SDK compat). */
export type Db = ReturnType<RulesTestContext['firestore']>

/**
 * Host y puerto del emulador. Bajo `firebase emulators:exec` la variable
 * FIRESTORE_EMULATOR_HOST ya viene puesta; el respaldo `127.0.0.1:8080` coincide
 * con el bloque `emulators` de `firebase.json` para que arrancar el emulador a
 * mano también funcione.
 */
function hostYPuerto(): { host: string; port: number } {
  const crudo = process.env.FIRESTORE_EMULATOR_HOST
  if (!crudo) return { host: '127.0.0.1', port: 8080 }
  const i = crudo.lastIndexOf(':')
  return { host: crudo.slice(0, i) || '127.0.0.1', port: Number(crudo.slice(i + 1)) }
}

/** Abre el entorno con las reglas REALES del repo (no una copia de pruebas). */
export async function abrirEntorno(): Promise<RulesTestEnvironment> {
  const { host, port } = hostYPuerto()
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8'),
      host,
      port,
    },
  })
}

/** Contexto autenticado como el usuario `rol` de la clínica `tenant`. */
export function contextoDe(env: RulesTestEnvironment, tenant: string, rol: Rol): RulesTestContext {
  return env.authenticatedContext(uidDe(tenant, rol))
}

/** Los 16 uids sintéticos (2 tenants × 8 roles). */
export function todosLosUids(): readonly string[] {
  return TENANTS.flatMap(t => ROLES.map(r => uidDe(t, r)))
}

/**
 * Campos que las REGLAS dereferencian al evaluar (`resource.data.<campo>`). Sin
 * ellos la evaluación revienta y la operación sale denegada por la razón
 * equivocada — un falso verde en la Afirmación A. Cada entrada dice qué regla lo
 * exige; si no está justificada, no va.
 */
const CAMPOS_EXIGIDOS_POR_LAS_REGLAS: Record<string, Record<string, unknown>> = {
  // reviews read: `resource.data.estado == 'publicada'` (firestore.rules).
  'clinics/{clinicId}/reviews/{reviewId}': { estado: 'publicada' },
  // notas update/delete: `resource.data.estado != 'firmada'`.
  'clinics/{clinicId}/patients/{docId}/notas/{notaId}': { estado: 'borrador' },
  // appointments update: compara `resource.data.cobroExento`.
  'clinics/{clinicId}/appointments/{docId}': { cobroExento: false },
  // cobros update: congela monto/metodo/concepto/fecha/citaId/patientId/creadoPor.
  'clinics/{clinicId}/cobros/{cobroId}': {
    monto: 0,
    metodo: 'efectivo',
    concepto: 'semilla sintética',
    fecha: '2026-01-01',
    citaId: 'x-docId',
    patientId: 'x-docId',
    creadoPor: 'servidor-semilla',
    cancelado: false,
  },
}

/**
 * Ids sintéticos de los documentos de RAÍZ que llevan el `clinicId` en el
 * CONTENIDO y no en la ruta. Sin `clinicId` posicional no puede haber un mismo id
 * para los dos inquilinos, así que el id incluye el tenant.
 */
export function tokenResenaDe(tenant: Tenant): string {
  return `clinic_review_requests/token-${tenant}`
}
export function codigoInvitacionDe(tenant: Tenant): string {
  return `clinic_invitations/code-${tenant}`
}

/** Un documento sembrado: ruta concreta + payload sintético. */
export interface DocSemilla {
  readonly ruta: string
  readonly datos: Record<string, unknown>
}

/**
 * Documentos que se siembran para un tenant. PURO (se puede inspeccionar sin
 * emulador), así que el spec puede afirmar sobre él sin levantar nada.
 */
export function documentosSemilla(tenant: Tenant): readonly DocSemilla[] {
  const docs: DocSemilla[] = []

  // 1) Membresías: son la BASE de todas las guardas (`memberClinicId()` hace get()
  //    de clinic_members/{uid}). Se siembran los 8 roles de la matriz aunque
  //    `clinic_members.role` en producción solo admita 6: probar 8 es estrictamente
  //    más fuerte que probar 6, y `recepcion`/`facturacion` existen en
  //    src/lib/permissions.ts.
  for (const rol of ROLES) {
    docs.push({
      ruta: `clinic_members/${uidDe(tenant, rol)}`,
      datos: { clinicId: tenant, role: rol },
    })
  }

  // 2) El doc de la clínica. OBLIGATORIO, no cosmético: `clinicaPuedeEscribir()`
  //    hace get() de clinics/{clinicId}. Si no existe, la evaluación revienta y
  //    TODO write sale denegado por la razón equivocada — la Afirmación A pasaría
  //    en verde sin haber probado nada. De ahí el control positivo (Afirmación B).
  docs.push({
    ruta: `clinics/${tenant}`,
    datos: { ownerId: uidDe(tenant, 'admin'), status: 'active', paseLibre: false, nombre: tenant },
  })

  // 3) Un documento en CADA ruta destino, para que `read` tenga `resource` y las
  //    reglas que dereferencian `resource.data` no fallen por ausencia.
  for (const recurso of recursosDeTenant()) {
    const extras = CAMPOS_EXIGIDOS_POR_LAS_REGLAS[recurso.ruta] ?? {}
    // Las rutas con `{uid}` se siembran para los 16 uids: el spec instancia con el
    // uid del ACTOR (el caso más permisivo), así que hacen falta todos.
    const uids = recurso.ruta.includes('{uid}') ? todosLosUids() : [uidDe(tenant, 'admin')]
    for (const uid of uids) {
      const ruta = instanciar(recurso.ruta, tenant, uid)
      if (ruta === `clinics/${tenant}`) continue // ya sembrado arriba con sus campos
      docs.push({ ruta, datos: { clinicId: tenant, semilla: true, ...extras } })
    }
  }

  // 4) Una reseña NO publicada: el control negativo de la única lectura pública
  //    con condición de contenido (`estado == 'publicada'`).
  docs.push({
    ruta: `clinics/${tenant}/reviews/no-publicada`,
    datos: { clinicId: tenant, semilla: true, estado: 'pendiente' },
  })

  return docs
}

/**
 * Documentos de RAÍZ cuyo aislamiento NO es posicional sino por contenido
 * (`resource.data.clinicId`). Se siembran aparte porque su id no puede repetirse
 * entre inquilinos: la ruta no lleva el clinicId.
 */
export function documentosSemillaRaiz(tenant: Tenant): readonly DocSemilla[] {
  return [
    {
      // update: lee `resource.data.used`; delete: `isMember(resource.data.clinicId)`.
      ruta: tokenResenaDe(tenant),
      datos: { clinicId: tenant, used: false, pacienteNombre: 'Paciente Sintético', medicoNombre: 'Dr. Sintético' },
    },
    {
      // update: lee `used`; delete: compara `resource.data.clinicId`.
      ruta: codigoInvitacionDe(tenant),
      datos: { clinicId: tenant, used: false, role: 'secretaria', clinicName: tenant },
    },
    // `googleTokens` y `platform_*` son `if false` para el cliente. Se siembran para
    // que un `assertFails` signifique «regla denegó», nunca «documento ausente».
    { ruta: `googleTokens/${uidDe(tenant, 'admin')}`, datos: { clinicId: tenant, semilla: true } },
    { ruta: `platform_payments/pago-${tenant}`, datos: { clinicId: tenant, semilla: true } },
    { ruta: `platform_admin_log/log-${tenant}`, datos: { clinicId: tenant, semilla: true } },
    { ruta: `platform_packages/pkg-${tenant}`, datos: { clinicId: tenant, semilla: true } },
    { ruta: `platform_meta/meta-${tenant}`, datos: { clinicId: tenant, semilla: true } },
  ]
}

/**
 * Siembra los dos inquilinos. Corre con las reglas DESACTIVADAS: sembrar es setup,
 * no parte de lo que se prueba.
 */
export async function sembrar(env: RulesTestEnvironment): Promise<void> {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    for (const tenant of TENANTS) {
      for (const doc of [...documentosSemilla(tenant), ...documentosSemillaRaiz(tenant)]) {
        await db.doc(doc.ruta).set(doc.datos)
      }
    }
  })
}
