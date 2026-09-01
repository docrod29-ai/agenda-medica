/**
 * GOLDEN — una caída de red no convierte a un médico establecido en un usuario
 * nuevo.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Cortando el acceso a datos y entrando al producto, las cuatro rutas probadas
 * —`/citas`, `/calendario`, `/finanzas`, `/dashboard`— acababan en la misma
 * pantalla: **«Configura tu consultorio · ¡Bienvenido! Solo tu nombre y el del
 * consultorio»**. El asistente de alta.
 *
 * Es decir: ante un problema de conexión, la aplicación le decía a un médico con
 * su consultorio, sus pacientes y su historia que **no tenía consultorio**, y lo
 * invitaba a crear uno.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * `ClinicContext` escuchaba `clinic_members/{uid}` y hacía:
 *
 *     if (!snap.exists()) { setNeedsSetup(true) }
 *
 * Firestore entrega **primero lo que tiene en cache y después lo que dice el
 * servidor**. Un documento ausente en un snapshot `fromCache` no significa que
 * no exista: significa que todavía no se sabe, o que el servidor no contesta.
 * Las dos situaciones acababan en el mismo estado, y el layout redirigía.
 *
 * Es la regla 4 de seguridad clínica en la puerta de entrada: **ausencia de dato
 * no es dato de ausencia**. Y la familia que este repositorio ya tiene
 * nombrada: el hueco tratado como dato.
 *
 * ── LO QUE MÁS DUELE DE ESTE ────────────────────────────────────────────────
 *
 * **La pantalla correcta ya existía**, a dos líneas del defecto: «No pudimos
 * cargar tu consultorio · Tus datos están a salvo en el servidor. Esto es un
 * problema de conexión, no de tu información», con su botón de Reintentar.
 * Estaba escrita, estaba bien escrita, y no se llegaba a ella nunca porque el
 * hueco se confundía con el dato antes.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Yendo a por la columna de estados de ERROR del encargo, que estaba
 * NOT_PROVEN. Una sonda hace fallar con 500 todo lo que pide datos —emulador
 * incluido— y mira dónde acaba el producto.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Sólo se concluye que un usuario no tiene consultorio cuando **el servidor lo
 * ha confirmado**. Mientras no lo confirme, no se sabe, y no saber se dice — no
 * se rellena con la respuesta más cómoda.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo `!existe` a secas, el caso del snapshot de cache cae. Y sobre el
 * producto vivo, con la red de datos cortada: antes salía «Configura tu
 * consultorio», ahora sale «No pudimos cargar tu consultorio». Comprobado
 * también que un usuario REALMENTE nuevo —creado en el emulador de auth, sin
 * membresía— sigue llegando a `/setup`: su snapshot vacío acaba confirmado por
 * el servidor.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Sólo la decisión, no el cableado.** Que `ClinicContext` la llame, y que el
 *   layout redirija con su resultado, no se prueba aquí: este repositorio no
 *   renderiza React en las pruebas. Lo comprueba el arnés sobre el navegador.
 * · **No cubre el segundo listener**, el de `clinics/{id}`: allí un snapshot de
 *   cache vacío deja `clinic` en nulo y se pierde el nombre y los módulos del
 *   consultorio. Es el mismo defecto en su versión menos grave y **queda sin
 *   arreglar**, dicho aquí para que no se descubra dos veces.
 * · No dice nada de cuánto se espera antes de rendirse: eso es la red de
 *   seguridad de 8 s del contexto, que es otra decisión.
 */
import { describe, it, expect } from 'vitest'
import { seSabeQueNoTieneConsultorio } from '@/lib/clinica/saber-si-hay-consultorio'

describe('un consultorio que no se pudo leer no es un consultorio que no existe', () => {
  it('el servidor confirma que no hay membresía: entonces sí, es un usuario nuevo', () => {
    expect(seSabeQueNoTieneConsultorio({ existe: false, deCache: false })).toBe(true)
  })

  it('EL CASO DEL DEFECTO: vacío pero sin confirmar — no se concluye nada', () => {
    expect(
      seSabeQueNoTieneConsultorio({ existe: false, deCache: true }),
      'un snapshot de cache vacío mandaba al médico al asistente de alta',
    ).toBe(false)
  })

  it('si la membresía existe, nunca se concluye que no la hay', () => {
    expect(seSabeQueNoTieneConsultorio({ existe: true, deCache: false })).toBe(false)
    expect(seSabeQueNoTieneConsultorio({ existe: true, deCache: true })).toBe(false)
  })

  it('las cuatro combinaciones están cubiertas, y sólo una da verdadero', () => {
    // Sin esto, una implementación que devolviera siempre `false` pasaría los
    // tres casos de arriba menos el primero — y con `true` fijo, sólo el
    // primero. Aquí se ve la tabla entera de un vistazo.
    const tabla = [false, true].flatMap(existe =>
      [false, true].map(deCache => ({ existe, deCache, r: seSabeQueNoTieneConsultorio({ existe, deCache }) })),
    )
    expect(tabla.filter(f => f.r)).toHaveLength(1)
    expect(tabla.find(f => f.r)).toEqual({ existe: false, deCache: false, r: true })
  })
})
