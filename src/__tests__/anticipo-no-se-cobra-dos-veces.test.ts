/**
 * GOLDEN — el anticipo del paciente se podía registrar DOS VECES.
 *
 * ── CÓMO OCURRÍA, PASO A PASO ────────────────────────────────────────────────
 *
 * 1. El paciente paga su anticipo por el portal.
 * 2. El consultorio reagenda o borra esa cita **antes** de que llegue el webhook.
 * 3. Llega el webhook: se escribe la marca, se registra el cobro con `.add()`
 *    —un documento NUEVO— y después `citaRef.update()` lanza NOT_FOUND porque la
 *    cita ya no está.
 * 4. El catch **retira la marca** (correcto: si no, el dinero quedaría cobrado en
 *    Stripe e invisible en Finanzas) y devuelve 500.
 * 5. Stripe reintenta. La marca ya no existe, así que entra otra vez… y `.add()`
 *    escribe **otro cobro**.
 *
 * Stripe reintenta durante unos tres días. Son varios cobros en Finanzas por un
 * solo pago, y el corte de caja los suma todos. Contradice el «CERO cobro
 * duplicado» del charter.
 *
 * ── LA REPARACIÓN ────────────────────────────────────────────────────────────
 *
 * El identificador del cobro deja de ser aleatorio y pasa a ser
 * `stripe_{session.id}`: escribir dos veces es escribir **el mismo documento**.
 *
 * `create()` falla si ya existe, y ese fallo concreto —código 6, ALREADY_EXISTS—
 * no es un error: es la prueba de que el candado funcionó. Se sigue adelante a
 * saldar la cita, que es justo la parte que había fallado.
 *
 * ── LO QUE NO SE TOCÓ, Y POR QUÉ ─────────────────────────────────────────────
 *
 * La marca sigue retirándose al fallar. Es lo que impide el estado peor de
 * todos: dinero cobrado en Stripe que no aparece en Finanzas. Ahora el reintento
 * es seguro porque el cobro ya no puede duplicarse.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ruta = readFileSync(join(process.cwd(), 'src/app/api/stripe/webhook/route.ts'), 'utf8')

describe('EL COBRO DEL ANTICIPO TIENE IDENTIFICADOR DETERMINISTA', () => {
  it('se escribe en `stripe_{session.id}`, no en un documento nuevo', () => {
    expect(ruta).toContain(".doc(`stripe_${session.id}`)")
  })

  it('y ya no queda ningún `.add()` en la rama del anticipo', () => {
    /**
     * `.add()` genera un id aleatorio: dos entregas del mismo evento son dos
     * documentos, y no hay forma de notarlo después.
     */
    const rama = ruta.slice(ruta.indexOf("tipo === 'paciente_anticipo'"))
    const hastaElBreak = rama.slice(0, rama.indexOf('\n          break'))
    expect(hastaElBreak).not.toContain("collection('cobros').add(")
  })

  it('se usa `create`, que es lo que falla si ya existe', () => {
    expect(ruta).toContain('await cobroRef.create(datosCobro)')
  })
})

describe('UN REINTENTO NO ES UN ERROR', () => {
  it('«ya existe» (código 6) se distingue de un fallo real', () => {
    /**
     * Si se tratara como error, el reintento devolvería 500 para siempre y la
     * cita no se saldaría nunca — cambiando un duplicado por un bloqueo.
     */
    expect(ruta).toContain('if (codigo !== 6) throw e')
  })

  it('y queda dicho en el registro, no en silencio', () => {
    expect(ruta).toMatch(/anticipo ya registrado, no se duplica/)
  })
})

describe('LO QUE SIGUE IGUAL PORQUE ESTABA BIEN', () => {
  it('la marca se retira si el efecto falla', () => {
    /**
     * Es lo que impide el estado peor: dinero cobrado en Stripe e invisible en
     * Finanzas. El reintento ahora es seguro porque el cobro no puede
     * duplicarse.
     */
    expect(ruta).toContain('await marca.delete().catch(')
    expect(ruta).toMatch(/marca retirada para que Stripe reintente/)
  })

  it('y el abono parcial sigue sin saldar la cita', () => {
    // Un pago parcial tiene que poder cobrarse el resto.
    expect(ruta).toContain("estado: 'pendiente-pago'")
    expect(ruta).toContain('saldoPendiente: decision.saldoPendiente')
  })
})
