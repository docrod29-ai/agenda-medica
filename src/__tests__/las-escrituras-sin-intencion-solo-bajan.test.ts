/**
 * TRINQUETE — escrituras clínicas con nombre aleatorio. Sólo puede bajar.
 *
 * ── POR QUÉ UN INVENTARIO Y NO UNA REGLA DE LINT ────────────────────────────
 *
 * Porque **no toda escritura necesita clave de intención**. Duplicar una cama de
 * hospital es una molestia que se borra; duplicar una dispensación de farmacia
 * descuenta el medicamento dos veces y descuadra las existencias. Exigírsela a
 * las veinticuatro enseñaría a ponerla por costumbre, que es peor que no
 * tenerla: parece protegido y no lo está.
 *
 * ── LO QUE ESTE TRINQUETE SUSTITUYE ─────────────────────────────────────────
 *
 * El censo de WS-04 llevaba la lista a mano: «tareas clínicas, fotos clínicas,
 * farmacia, ARCO y bloques de agenda siguen sin clave de intención». Al medirlo:
 *
 * · **tareas clínicas** ya estaba protegida (`idDerivado`);
 * · **bloques de agenda** no es un riesgo clínico —un bloque duplicado se ve en
 *   la agenda y se borra—;
 * · y la lista **no nombraba cuatro** que sí lo son: los signos vitales del
 *   hospital (dos sitios), la solicitud de laboratorio y la observación de UCI.
 *   Los signos alimentan NEWS2: un duplicado altera una escala de gravedad.
 *
 * Una lista escrita a mano envejece sola. Ésta se mide.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Es ESTÁTICO. No sabe si una ruta de servidor deduplica por su cuenta.
 * · No mira colecciones fuera del manifiesto del respaldo — tokens de Google,
 *   estados de OAuth, el buzón de errores. No son datos del consultorio.
 * · Ver una clave de intención en la función NO prueba que el llamador la pase.
 *   Eso lo prueba el golden de cada unidad, no un conteo.
 */
import { describe, it, expect } from 'vitest'
import {
  inventariar, sinIntencion, recuento, coleccionesDelConsultorio,
} from '../../scripts/idempotencia/escrituras-sin-intencion.mjs'

/**
 * TECHO ACTUAL: CERO. Sólo puede subir si alguien escribe una escritura nueva.
 *
 * Las doce escrituras clínicas del árbol tienen clave de intención. Se cerraron
 * en tres tandas: farmacia (REG-515), ARCO y fotos (REG-516), y signos ×2,
 * laboratorio y observación de UCI (REG-522).
 *
 * Un cero aquí NO significa «esto no puede volver a pasar»: significa que la
 * próxima vez se ve. Una escritura clínica nueva con `addDoc` o con `doc()` sin
 * id sube el número y pone el CI en rojo el mismo día.
 */
const TECHO = 0

describe('el instrumento mide algo', () => {
  it('el universo NO está vacío (si lo estuviera, todo pasaría por bueno)', () => {
    /**
     * El caso que impide el falso verde. Si `respaldo.ts` cambiara de forma y el
     * lector devolviera un conjunto vacío, ninguna escritura entraría en el
     * inventario y este archivo diría «cero defectos» para siempre.
     */
    const universo = coleccionesDelConsultorio()
    expect(universo.size).toBeGreaterThan(30)
    for (const c of ['notas', 'adendas', 'farmacia_movimientos', 'tareas_clinicas']) {
      expect(universo.has(c), `el manifiesto del respaldo ya no nombra «${c}»`).toBe(true)
    }
  })

  it('y encuentra escrituras de las dos formas que fabrican un nombre', () => {
    /**
     * `idempotencia.ts` lo dice en su primera línea: «`addDoc()` **y `doc()` sin
     * id** generan un identificador aleatorio nuevo». La primera versión de este
     * inventario sólo miraba `addDoc`, y por eso daba por buena la escritura más
     * peligrosa de farmacia — un `tx.set(doc(COL_MOV(clinicId)), …)` dentro de
     * una transacción, que parece segura y no lo es.
     */
    const inv = inventariar()
    const formas = new Set(inv.map(x => x.forma))
    expect(formas.has('addDoc')).toBe(true)
    expect(formas.has('doc-sin-id'), 'no reconoce `doc()` sin id').toBe(true)
  })

  it('no deja ninguna colección sin clasificar', () => {
    /**
     * Lo que no se ha pensado no se da por operativo. Una colección nueva entra
     * sola —el manifiesto del respaldo es obligatorio— y entra en rojo hasta que
     * alguien escriba qué cuesta duplicarla.
     */
    const sin = inventariar().filter(x => x.peso === 'sin_clasificar')
    expect(sin.map(x => `${x.coleccion} (${x.archivo}:${x.linea})`)).toEqual([])
  })

  it('cada entrada dice QUÉ pasa si se duplica', () => {
    for (const x of inventariar()) {
      expect(x.porQue.length, `${x.coleccion} sin razón`).toBeGreaterThan(30)
    }
  })
})

describe('el techo sólo baja', () => {
  it('ninguna escritura clínica NUEVA sin clave de intención', () => {
    const faltan = sinIntencion()
    expect(
      faltan.length,
      `subió a ${faltan.length}. Las que están sin clave:\n  `
      + faltan.map(x => `${x.archivo}:${x.linea} [${x.coleccion}] ${x.porQue}`).join('\n  '),
    ).toBeLessThanOrEqual(TECHO)
  })

  it('y el techo no se subió para conseguirlo', () => {
    /* Si un cambio lo sube, se arregla el cambio — no se sube el techo. */
    expect(TECHO).toBe(0)
  })

  it('no queda ninguna, ni de Practice ni de Hospital', () => {
    const quedan = sinIntencion()
    expect(
      quedan.map(x => `${x.archivo}:${x.linea} [${x.coleccion}]`),
      'una escritura clínica nueva sin clave de intención',
    ).toEqual([])
  })

  it('y las DOCE clínicas siguen contándose: el cero no es una lista vacía', () => {
    /**
     * El caso que impide el falso cero. Si el inventario dejara de reconocer las
     * escrituras —un `addDoc` renombrado, una colección fuera del manifiesto—
     * `sinIntencion` daría cero por no mirar, que es indistinguible de cero por
     * estar bien.
     */
    expect(recuento().clinicas).toBe(12)
  })

  it('la dispensación de farmacia YA NO está entre ellas', () => {
    /**
     * AL REVÉS de como estaba: era el peor de todos y el inventario no la veía,
     * porque escribía con `doc()` sin id dentro de una transacción.
     */
    expect(sinIntencion().some(x => x.coleccion === 'farmacia_movimientos')).toBe(false)
  })

  it('el reparto entre clínicas y operativas está medido, no supuesto', () => {
    const r = recuento()
    expect(r.total).toBe(r.clinicas + r.operativas + r.sinClasificar)
    expect(r.clinicas).toBeGreaterThan(0)
    expect(r.operativas).toBeGreaterThan(0)
  })
})
