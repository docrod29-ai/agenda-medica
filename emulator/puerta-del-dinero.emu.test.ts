/**
 * LA PUERTA DEL DINERO — contra las reglas REALES.
 *
 * ── LA PROPIEDAD QUE SE DEFIENDE ─────────────────────────────────────────────
 *
 * «El frontend NO determina si un pago existe. Backend + webhook verificado =
 * verdad.» Esa frase se cumple hoy, y no por el código: se cumple porque
 * `firestore.rules` CONGELA los campos de facturación contra cualquier escritura
 * del cliente. Es la capa fuerte — una abstracción en TypeScript no protege
 * nada si la base acepta la escritura.
 *
 * ── POR QUÉ HACÍA FALTA ESTA PRUEBA ──────────────────────────────────────────
 *
 * Porque esa defensa es UNA LÍNEA por campo dentro de una condición larga, y
 * quitarla no rompe nada visible: la aplicación sigue funcionando igual, los
 * tests siguen verdes, y el agujero es que cualquier admin de cualquier
 * consultorio puede ponerse `paseLibre: true` desde la consola del navegador y
 * usar el producto gratis para siempre. Nadie se entera hasta que se mira la
 * facturación contra el uso.
 *
 * Ya pasó una vez con `trialEndsAtMs`: se congelaron plan y status pero no el
 * reloj de la prueba, así que un admin extendía su periodo gratuito desde el
 * cliente. Lo cazó una auditoría externa, no una prueba.
 *
 * Aquí cada campo tiene su caso, y cada caso dice qué se abriría si cayera.
 */
import { afterAll, beforeAll, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import type { Rol } from '@/lib/authz/matriz-acceso'
import { TENANT_A } from './casos-tenant'
import { abrirEntorno, contextoDe, sembrar, type Db } from './entorno'

let env: RulesTestEnvironment
const contextos = new Map<string, RulesTestContext>()

function db(tenant: string, rol: Rol): Db {
  const clave = `${tenant}:${rol}`
  let ctx = contextos.get(clave)
  if (!ctx) { ctx = contextoDe(env, tenant, rol); contextos.set(clave, ctx) }
  return ctx.firestore()
}

beforeAll(async () => {
  env = await abrirEntorno()
  await sembrar(env)
})
afterAll(async () => { await env?.cleanup() })

/**
 * Cada campo, con LO QUE SE ABRIRÍA si dejara de estar congelado.
 *
 * El texto no es decoración: es lo que va a leer quien vea fallar esta prueba
 * dentro de dos años, y decide si lo repara o lo tacha por molesto.
 */
const CAMPOS_DEL_DINERO: { campo: string; valor: unknown; siCae: string }[] = [
  /**
   * `status` va con 'trial' y no con 'active', y la razón importa: la clínica
   * SEMBRADA ya está en 'active', así que escribir 'active' no es un cambio y la
   * regla lo deja pasar — correctamente, porque no cambia nada.
   *
   * La primera versión de esta prueba escribía 'active' y salía en rojo, que es
   * como se descubrió. Lo que hay que defender no es una dirección concreta sino
   * la propiedad entera: **el cliente no puede CAMBIAR el estado de la
   * suscripción**, ni hacia arriba ni hacia abajo. Cualquier valor distinto del
   * actual sirve para probarla, y así no hace falta mutar el estado compartido
   * del emulador —que otras especificaciones también leen—.
   */
  { campo: 'status', valor: 'trial', siCae: 'el cliente cambia a voluntad el estado de la suscripción, incluida su propia activación' },
  { campo: 'plan', valor: 'premium', siCae: 'cualquiera se asigna el plan más caro sin pagarlo' },
  { campo: 'paseLibre', valor: true, siCae: 'barra libre permanente: el paywall deja de existir para quien lo ponga' },
  { campo: 'trialEndsAtMs', valor: 4102444800000, siCae: 'la prueba gratuita se extiende hasta el año 2100 desde el navegador' },
  { campo: 'trialEndsAt', valor: '2100-01-01', siCae: 'lo mismo, por el campo legible' },
  { campo: 'modulos', valor: ['hospital', 'uci'], siCae: 'se desbloquean módulos que no se pagaron' },
  { campo: 'paqueteId', valor: 'hospital-uci', siCae: 'igual, por la vía del paquete' },
  { campo: 'stripeCustomerId', valor: 'cus_falso', siCae: 'se puede apuntar la facturación a otro cliente de Stripe' },
  { campo: 'stripeSubscriptionId', valor: 'sub_falso', siCae: 'se puede suplantar una suscripción ajena' },
  { campo: 'ownerId', valor: 'uid-de-otro', siCae: 'se regala o se roba la propiedad del consultorio' },
]

describe('los campos de facturación están congelados contra el cliente', () => {
  /**
   * Se prueba con ADMIN a propósito, que es el rol más alto que existe del lado
   * del cliente. Si el admin no puede, nadie puede — y si el admin pudiera, la
   * prueba con un rol menor daría un verde tranquilizador y falso.
   */
  for (const { campo, valor, siCae } of CAMPOS_DEL_DINERO) {
    it(`el admin NO puede escribir '${campo}' — si cae: ${siCae}`, async () => {
      await assertFails(
        db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}`).update({ [campo]: valor }),
      )
    })
  }

  it('…y aun así el admin sigue pudiendo editar lo suyo', async () => {
    /**
     * El contrapeso. Sin él, la forma más fácil de pasar todo lo de arriba sería
     * prohibir el `update` entero — y entonces el médico no podría ni cambiarle
     * el nombre a su consultorio. Una regla que bloquea todo no es segura: es
     * inservible, y alguien la va a aflojar de golpe.
     */
    await assertSucceeds(
      db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}`).update({ nombre: 'Clínica Alfa (sintética)' }),
    )
  })

  it('un intento MEZCLADO tampoco pasa: el campo legítimo no cuela el prohibido', async () => {
    // Es el intento real: nadie manda `{paseLibre:true}` a secas — lo esconde
    // dentro de un guardado normal de la configuración.
    await assertFails(
      db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}`).update({ nombre: 'Clínica Alfa', paseLibre: true }),
    )
  })

  it('el MÉDICO no puede tocar ni siquiera los metadatos', async () => {
    await assertFails(
      db(TENANT_A, 'medico').doc(`clinics/${TENANT_A}`).update({ nombre: 'renombrada por el médico' }),
    )
  })

  it('nadie borra el consultorio desde el cliente', async () => {
    // Borrarlo sería perder el expediente entero de una clínica de un clic.
    await assertFails(db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}`).delete())
  })
})

describe('crearse una clínica no es una puerta trasera', () => {
  it('no se puede nacer ACTIVO ni con pase libre', async () => {
    /**
     * El alta legítima va por el servidor (Admin SDK, que ignora estas reglas).
     * Lo que llega aquí es el SDK del navegador, y sin este candado bastaba con
     * crearse una clínica propia ya activada para saltarse el pago entero.
     */
    const nueva = `clinica-sintetica-${TENANT_A}`
    await assertFails(
      db(TENANT_A, 'admin').doc(`clinics/${nueva}`).set({
        ownerId: 'uid-admin-clinica-alfa', status: 'active', paseLibre: true,
        trialEndsAtMs: Date.now() + 86400000,
      }),
    )
  })

  it('tampoco con una prueba eterna', async () => {
    // Nacer en 'trial' es legítimo; nacer con el reloj en el año 2100 no.
    const nueva = `clinica-sintetica-eterna-${TENANT_A}`
    await assertFails(
      db(TENANT_A, 'admin').doc(`clinics/${nueva}`).set({
        ownerId: 'uid-admin-clinica-alfa', status: 'trial', paseLibre: false,
        trialEndsAtMs: 4102444800000,
      }),
    )
  })

  it('ni asignándose un plan de entrada', async () => {
    const nueva = `clinica-sintetica-plan-${TENANT_A}`
    await assertFails(
      db(TENANT_A, 'admin').doc(`clinics/${nueva}`).set({
        ownerId: 'uid-admin-clinica-alfa', status: 'trial', paseLibre: false,
        trialEndsAtMs: Date.now() + 86400000, plan: 'premium',
      }),
    )
  })
})

/**
 * EL MÉDICO DE UN COBRO NO SE PUEDE CAMBIAR — porque eso mueve comisiones.
 *
 * La regla de `cobros` congela monto, método, concepto, fecha y los vínculos con
 * la cita y el paciente… pero NO congelaba `medicoId`. Y la rama que permite
 * «vincular factura» sólo exige que `facturaUuid` sea un string, valiendo la
 * cadena vacía.
 *
 * O sea: cualquier miembro podía mandar un update con `facturaUuid: ''` y el
 * `medicoId` cambiado, y el cobro pasaba de un médico a otro. La base
 * comisionable se acumula exactamente por ese campo, así que es un traslado de
 * dinero entre personas — y esa rama no deja ningún rastro de autoría.
 */
describe('El médico de un cobro está congelado', () => {
  const cobroId = 'cobro-comisiones'

  beforeAll(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`clinics/${TENANT_A}/cobros/${cobroId}`).set({
        monto: 800, metodo: 'efectivo', concepto: 'consulta',
        fecha: '2026-08-01T10:00:00.000Z', dia: '2026-08-01', mes: '2026-08',
        citaId: 'cita-1', patientId: 'pac-1',
        medicoId: 'medico-uno', medicoNombre: 'Dr. Uno',
        folio: 'CB-0001', referenciaExterna: 'cs_test_1',
        creadoPor: 'uid-admin-clinica-alfa', cancelado: false, tipo: 'PAYMENT',
      })
    })
  })

  it('NO se puede reatribuir el cobro a otro médico por la puerta de «vincular factura»', async () => {
    await assertFails(
      db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}/cobros/${cobroId}`).update({
        facturaUuid: '', medicoId: 'medico-dos', medicoNombre: 'Dr. Dos',
      }),
    )
  })

  it('NO se puede borrar el hilo con Stripe (referenciaExterna ni folio)', async () => {
    await assertFails(
      db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}/cobros/${cobroId}`).update({
        facturaUuid: 'uuid-1', referenciaExterna: '',
      }),
    )
    await assertFails(
      db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}/cobros/${cobroId}`).update({
        facturaUuid: 'uuid-1', folio: 'CB-9999',
      }),
    )
  })

  it('pero SÍ se puede vincular la factura, que es para lo que existe esa rama', async () => {
    await assertSucceeds(
      db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}/cobros/${cobroId}`).update({
        facturaUuid: 'uuid-real-del-sat',
      }),
    )
  })
})

/**
 * UN EXPEDIENTE NO SE BORRA DESDE EL NAVEGADOR.
 *
 * Las reglas permitían al admin borrar el documento del paciente, y la
 * salvaguarda que impide hacerlo cuando hay NOTAS FIRMADAS vivía en
 * `deletePatientExpediente` — una función sin un solo llamador. La protección
 * NOM-004 estaba en código muerto y la puerta abierta en el único borde real.
 *
 * Además, borrando sólo el paciente las notas firmadas quedaban huérfanas:
 * siguen protegidas, pero ya no cuelgan de nadie.
 *
 * El borrado legítimo pasa por `/api/arco/cancelar`, con el SDK admin: cuenta
 * las notas firmadas, decide entre supresión y bloqueo, y deja asiento.
 */
describe('El expediente del paciente no se borra desde el cliente', () => {
  const pacienteId = 'pac-no-borrable'

  beforeAll(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`clinics/${TENANT_A}/patients/${pacienteId}`).set({
        nombre: 'Paciente Sintético', telefono: '6140000000',
      })
    })
  })

  it('ni siquiera el admin puede borrarlo', async () => {
    await assertFails(db(TENANT_A, 'admin').doc(`clinics/${TENANT_A}/patients/${pacienteId}`).delete())
  })

  it('la asistente tampoco, claro', async () => {
    await assertFails(db(TENANT_A, 'secretaria').doc(`clinics/${TENANT_A}/patients/${pacienteId}`).delete())
  })

  it('pero EDITAR sus datos de contacto sigue siendo trabajo del mostrador', async () => {
    await assertSucceeds(
      db(TENANT_A, 'secretaria').doc(`clinics/${TENANT_A}/patients/${pacienteId}`).update({ telefono: '6141111111' }),
    )
  })
})
