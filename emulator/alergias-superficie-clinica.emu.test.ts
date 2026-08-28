/**
 * LAS ALERGIAS, CONTRA EL MOTOR REAL DE REGLAS — política P1-6 / unidad E0-06.
 *
 * NO CORRE EN EL GATE COMPARTIDO. Necesita el emulador de Firestore (y por tanto un
 * JRE): `npm run test:emulador`.
 *
 * ── QUÉ HUECO CIERRA ────────────────────────────────────────────────────────
 *
 * `src/__tests__/alergias-superficie-clinica.test.ts` prueba la POLÍTICA (el
 * traslado, la equivalencia, el fail-closed) y mira `firestore.rules` como TEXTO:
 * comprueba que ahí pone `isMedico`. Eso no demuestra que Firestore deniegue —un
 * `match` mal anidado deja la cadena intacta y el agujero abierto—. Aquí responde
 * el motor de reglas, con una alergia sintética escrita en la ruta de verdad.
 *
 * ── LAS TRES AFIRMACIONES DE LA POLÍTICA ────────────────────────────────────
 *
 *  A) El médico autorizado de la clínica LEE la alergia.        (permitido)
 *  B) Recepción de la MISMA clínica NO la lee.                  (denegado)
 *  C) Un usuario de OTRA clínica no la lee ni siendo médico.    (denegado)
 *
 * A es el control positivo, y no es decorativo: sin él, B y C pasarían en verde
 * con unas reglas que niegan absolutamente todo —un typo, la clínica sin sembrar—
 * y la suite diría «la separación funciona» sin haber probado nada.
 *
 * ── EL CONTRASTE QUE LO EXPLICA TODO ────────────────────────────────────────
 *
 * La última prueba lee el DOCUMENTO ADMINISTRATIVO con el mismo rol de recepción y
 * comprueba que SÍ lo lee. Ése es el motivo entero de la unidad: mientras la
 * alergia sea un campo de ese documento, recepción la lee, porque Firestore no
 * autoriza por campo. Verlo en la misma corrida es la demostración de por qué el
 * arreglo tenía que ser de modelo de datos y no de reglas.
 *
 * DATOS SINTÉTICOS SIEMPRE (regla 2 de la carta operativa). El alérgeno de esta
 * suite es inventado y los dos inquilinos también.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { ROLES_NO_CLINICOS, type Rol } from '@/lib/authz/matriz-acceso'
import { TENANT_A, TENANT_B, uidDe } from './casos-tenant'
import { abrirEntorno, contextoDe, sembrar } from './entorno'

/** Paciente sintético del inquilino A. */
const PACIENTE = 'paciente-sintetico-e0-06'

/**
 * La alergia sintética. Lleva alérgeno, reacción y gravedad a propósito: son los
 * tres campos que la política nombra como no legibles por recepción.
 */
const ALERGIA_SINTETICA = {
  alergias: 'Alérgico a sintecilina',
  alergiasEstructuradas: [
    { alergeno: 'sintecilina', tipo: 'medicamento', severidad: 'grave', reaccion: 'exantema sintético' },
  ],
  notasClinicas: 'Antecedente sintético.',
  actualizadoEn: '2026-08-28T00:00:00.000Z',
  actualizadoPor: 'semilla-sintetica',
  migradoEn: '2026-08-28T00:00:00.000Z',
}

const rutaResumen = (t: string) => `clinics/${t}/patients/${PACIENTE}/clinico/resumen`
const rutaAdministrativa = (t: string) => `clinics/${t}/patients/${PACIENTE}`

let env: RulesTestEnvironment

const leer = (tenant: string, rol: Rol, ruta: string) =>
  contextoDe(env, tenant, rol).firestore().doc(ruta).get()

beforeAll(async () => {
  env = await abrirEntorno()
  await env.clearFirestore()
  await sembrar(env)   // membresías de los 8 roles en los 2 inquilinos + doc de clínica

  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    for (const tenant of [TENANT_A, TENANT_B]) {
      // El documento ADMINISTRATIVO: sólo identificación y contacto. Sin alergias:
      // así es como debe quedar cuando el último paso de la migración se autorice.
      await db.doc(rutaAdministrativa(tenant)).set({
        nombre: 'Paciente Sintético', telefono: '5550000000',
        noShowCount: 0, cancelacionCount: 0, creadoPor: uidDe(tenant, 'admin'),
      })
      await db.doc(rutaResumen(tenant)).set(ALERGIA_SINTETICA)
    }
  })
}, 120_000)

afterAll(async () => {
  if (env) await env.cleanup()
})

describe('A · el médico autorizado LEE la alergia (control positivo)', () => {
  it.each(['medico', 'admin'] as const)('%s de la clínica lee el resumen clínico', async rol => {
    const snap = await assertSucceeds(leer(TENANT_A, rol, rutaResumen(TENANT_A)))
    // No basta con que la lectura se permita: tiene que traer la alergia. Una
    // lectura permitida sobre un documento vacío haría verdes B y C sin significar nada.
    expect(snap.data()?.alergiasEstructuradas?.[0]?.alergeno).toBe('sintecilina')
    expect(snap.data()?.alergiasEstructuradas?.[0]?.reaccion).toBe('exantema sintético')
    expect(snap.data()?.alergiasEstructuradas?.[0]?.severidad).toBe('grave')
  })
})

describe('B · recepción NO lee la alergia', () => {
  /**
   * Se prueban los tres roles no clínicos. `secretaria` es el que EXISTE en
   * producción hoy (`clinic_members.role` no admite `recepcion`); `recepcion` y
   * `facturacion` sólo viven en `src/lib/permissions.ts`. Probar los tres es
   * estrictamente más fuerte: una prueba que sólo mirara `recepcion` pasaría en
   * verde sin haber evaluado nunca el rol que el consultorio usa de verdad.
   */
  it.each([...ROLES_NO_CLINICOS])('%s de la misma clínica es DENEGADO', async rol => {
    await assertFails(leer(TENANT_A, rol, rutaResumen(TENANT_A)))
  })

  it('y tampoco puede escribirla (no se captura a ciegas lo que no se puede leer)', async () => {
    for (const rol of ROLES_NO_CLINICOS) {
      await assertFails(
        contextoDe(env, TENANT_A, rol).firestore()
          .doc(rutaResumen(TENANT_A)).set({ alergias: 'inyectada por recepción' }, { merge: true }),
      )
    }
  })
})

describe('C · otra clínica no lee nada, ni siendo médico', () => {
  it.each(['medico', 'admin', 'enfermeria', 'secretaria'] as const)(
    '%s del inquilino B es DENEGADO sobre el paciente del inquilino A', async rol => {
      await assertFails(leer(TENANT_B, rol, rutaResumen(TENANT_A)))
    })

  it('un usuario sin sesión tampoco', async () => {
    await assertFails(env.unauthenticatedContext().firestore().doc(rutaResumen(TENANT_A)).get())
  })
})

describe('D · el contraste: por qué el arreglo tenía que ser de modelo de datos', () => {
  it('recepción SÍ lee el documento administrativo — y debe seguir leyéndolo', async () => {
    // «Lee cita» es parte de la aceptación: sin nombre y teléfono no se agenda.
    const snap = await assertSucceeds(leer(TENANT_A, 'secretaria', rutaAdministrativa(TENANT_A)))
    expect(snap.data()?.nombre).toBe('Paciente Sintético')
  })

  it('y ese documento NO lleva ni una alergia', async () => {
    /**
     * La afirmación entera de la unidad en una línea. Firestore no autoriza por
     * campo: lo que esté en este documento, recepción lo lee. Así que la única
     * forma de que no lea la alergia es que la alergia no esté aquí.
     */
    const snap = await assertSucceeds(leer(TENANT_A, 'secretaria', rutaAdministrativa(TENANT_A)))
    const datos = snap.data() ?? {}
    for (const campo of ['alergias', 'alergiasEstructuradas', 'notas', 'txValoracion'])
      expect(datos, `el documento administrativo no puede llevar ${campo}`).not.toHaveProperty(campo)
    expect(JSON.stringify(datos).toLowerCase()).not.toContain('sintecilina')
  })
})
