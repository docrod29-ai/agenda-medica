/**
 * GOLDEN — LA VENTANA ENTRE «EL CÓDIGO YA ESTÁ» Y «EL ÍNDICE YA ESTÁ».
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Firestore **no degrada** una consulta que necesita un índice compuesto: la
 * RECHAZA entera con `FAILED_PRECONDITION`. Y declarar el índice, desplegarlo y
 * verlo `Enabled` son tres actos: `firebase deploy` contesta al ENVIAR, y la
 * construcción sobre una colección con datos tarda de minutos a horas — o falla
 * después, con el `success` ya impreso.
 *
 * Mientras tanto, el código nuevo YA está servido: Vercel publica solo con cada
 * merge a `main`. En esa ventana, una consulta indexada rompe la pantalla. Es
 * literalmente como se abrió el worklist por primera vez en producción: con un
 * error, no con una lista vacía.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Revisando el PR #425 antes de dejarlo fusionable. Ese PR convierte cuatro
 * consultas en indexadas y su documento de operación dice, con razón, que los
 * índices se despliegan ANTES que el código. Eso es una **instrucción**, y una
 * instrucción depende de que alguien la recuerde el día correcto — el mismo tipo
 * de defensa que falló en REG-504 (dos sitios que había que acordarse de mover a
 * la vez).
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `conRespaldoSinIndice` corre la consulta buena y, **sólo** si el error dice que
 * falta el índice, cae al camino de antes y devuelve `degradada: true`. El orden
 * de despliegue sigue siendo el correcto; lo que cambia es que romperlo ya no
 * rompe la pantalla.
 *
 * ── QUÉ *NO* CUBRE ───────────────────────────────────────────────────────────
 *
 * · **No sustituye al despliegue.** Un producto que lee siempre por el camino
 *   peor no está bien, está sobreviviendo. Por eso `degradada` sube hasta la
 *   pantalla en vez de quedarse aquí.
 * · **No reconoce un mensaje que el proveedor cambie.** Si mañana Firestore
 *   escribe otra frase y no manda `code`, esto deja de reconocerlo y el error
 *   SUBE — que es el lado seguro del que equivocarse, pero es un lado.
 * · **No cubre `onSnapshot`.** Un listener entrega el error por su callback, no
 *   lanzando; quien use listeners tiene que manejarlo por su cuenta.
 */
import { describe, it, expect } from 'vitest'
import { esIndiceQueFalta, conRespaldoSinIndice } from '@/lib/firestore/indice-que-todavia-no-esta'

/** Lo que manda el SDK de CLIENTE cuando falta el índice. */
const comoElCliente = () => Object.assign(
  new Error('The query requires an index. You can create it here: https://console.firebase.google.com/…'),
  { code: 'failed-precondition' },
)

/** Lo que manda el SDK ADMIN: el código gRPC 9. */
const comoElAdmin = () => Object.assign(
  new Error('9 FAILED_PRECONDITION: The query requires an index.'),
  { code: 9 },
)

describe('reconocer «falta el índice» y NADA MÁS', () => {
  it('EL CASO: lo reconoce por los dos SDK', () => {
    expect(esIndiceQueFalta(comoElCliente())).toBe(true)
    expect(esIndiceQueFalta(comoElAdmin())).toBe(true)
  })

  it('el 9 del admin NO basta por sí solo', () => {
    /**
     * `FAILED_PRECONDITION` también sale de una transacción que perdió su
     * precondición. Tratar eso como «falta el índice» convertiría una escritura
     * perdida en una lista corta — que es peor, porque no se ve.
     */
    const otraCosa = Object.assign(new Error('9 FAILED_PRECONDITION: the document was modified'), { code: 9 })
    expect(esIndiceQueFalta(otraCosa)).toBe(false)
  })

  it('al revés: lo que NO es esto, no lo es', () => {
    for (const e of [
      Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }),
      Object.assign(new Error('The service is currently unavailable.'), { code: 'unavailable' }),
      Object.assign(new Error('Deadline exceeded'), { code: 'deadline-exceeded' }),
      new Error('cualquier otra cosa'),
      null, undefined, 'texto suelto', 42,
    ]) {
      expect(esIndiceQueFalta(e), `se tragó ${String(e)}`).toBe(false)
    }
  })
})

describe('el respaldo', () => {
  it('EL CASO: si la consulta buena sale, no se toca el respaldo', async () => {
    let respaldoCorrio = false
    const r = await conRespaldoSinIndice('x(a, b)',
      async () => 'buena',
      async () => { respaldoCorrio = true; return 'peor' })
    expect(r).toEqual({ valor: 'buena', degradada: false })
    expect(respaldoCorrio, 'el respaldo corrió sin hacer falta: eso es pagar dos lecturas').toBe(false)
  })

  it('EL CASO: si falta el índice, cae al respaldo Y LO DICE', async () => {
    const r = await conRespaldoSinIndice('x(a, b)',
      async () => { throw comoElCliente() },
      async () => 'peor')
    expect(r).toEqual({ valor: 'peor', degradada: true })
  })

  it('al revés: un permiso denegado SUBE, no se convierte en lista corta', async () => {
    /**
     * Ésta es la mitad que hace que el respaldo sea seguro. Si absorbiera
     * cualquier error, una regla de Firestore mal desplegada —o una fuga de
     * aislamiento— se vería como «hay menos cosas», y nadie iría a mirar.
     */
    let respaldoCorrio = false
    await expect(conRespaldoSinIndice('x(a, b)',
      async () => { throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }) },
      async () => { respaldoCorrio = true; return 'peor' }),
    ).rejects.toThrow(/permissions/)
    expect(respaldoCorrio).toBe(false)
  })

  it('y si el respaldo TAMBIÉN falla, el error sube: no se inventa una lista vacía', async () => {
    /* Ausencia de dato no es dato de ausencia. Devolver `[]` aquí diría «no hay
       pendientes» de un consultorio del que no se pudo leer nada. */
    await expect(conRespaldoSinIndice('x(a, b)',
      async () => { throw comoElCliente() },
      async () => { throw new Error('la red tampoco') }),
    ).rejects.toThrow(/la red tampoco/)
  })
})
