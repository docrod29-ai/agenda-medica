/**
 * GOLDEN — EL DOCUMENTO DECÍA QUE ESTABA TOPADO Y NO LO ESTABA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `registro-durable.ts` lleva escrito en su cabecera, desde E0-09:
 *
 *     «Los arrays del doc de internamiento (`balanceHidrico`, `escalas`, `sbar`
 *      y `indicaciones[].administraciones[]`) son solo CACHÉ DE DISPLAY: están
 *      topados por el límite de 1 MB por documento Firestore.»
 *
 * Tres lo estaban de verdad: `balanceHidrico` y `escalas` a 100, `sbar` a 50.
 * **`administraciones` no.** Se anexaba sin tope, dosis tras dosis.
 *
 * ── POR QUÉ NO ES UNA DEGRADACIÓN, ES UN PARO ───────────────────────────────
 *
 * Firestore rechaza escribir un documento que pase de 1 MB, y **todas** las
 * mutaciones del episodio son un solo `tx.update` sobre ese documento. Al
 * rebasarlo no falla lo último que se añadió: falla todo — no se puede registrar
 * una administración, ni suspender una orden, ni **egresar al paciente**.
 *
 * Una UCI de veinte días con ocho fármacos cada seis horas son ~2 500 objetos de
 * administración en un documento. No es un caso raro: es una estancia larga.
 *
 * El «límite de 1 MB» que la cabecera citaba como techo no era un techo: era el
 * punto donde el episodio deja de funcionar.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo `WS-03.documentos-que-crecen`, cuyo `queFalta` nombraba
 * exactamente esto («seis arrays en un documento, administraciones sin tope») y
 * lo daba por fuera de carril por ser Hospital. Es trabajo interno accionable y
 * la consecuencia es de las peores del árbol, así que se hizo.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Un tope declarado en prosa y no en código. Familia «el sistema se contradice a
 * sí mismo»: leer la cabecera daba por revisado lo que no lo estaba, que es lo
 * que mantuvo el defecto invisible durante todo E0-09.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Topar un array sólo es seguro si el hecho vive en otro sitio**, y aquí no
 * todos viven en otro sitio. Por eso el módulo no reparte topes: reparte los
 * arrays en los que se pueden topar y los que no, con la razón de cada uno.
 *
 *   · `administraciones` se topa: `administrar` está en
 *     `ACCIONES_CON_EVENTO_DURABLE` y cada dosis queda entera en `registros`.
 *   · `movimientos` NO: `registro-durable.ts` declara que `trasladar` no emite
 *     evento **porque** queda ahí. Es la única copia; toparlo borraría traslados.
 *   · `indicaciones` e `interconsultas` NO: son la orden y la interconsulta
 *     mismas. Recortarlas haría desaparecer órdenes vivas del MAR.
 *
 * Los que no se pueden topar quedan como riesgo **nombrado**, que es lo que se
 * puede vigilar.
 *
 * Y se recorta por el PRINCIPIO. Al revés perdería la última dosis dada, que es
 * el ancla del atraso del MAR: convertiría a un paciente al día en uno «nunca
 * administrado».
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO acota `movimientos`, `indicaciones` ni `interconsultas`, por lo de
 *   arriba. Siguen creciendo sin techo, ahora dicho en voz alta. Acotarlas de
 *   verdad exige sacarlas a subcolección, que es otra unidad y toca las reglas.
 * · NO mide bytes. Cuenta elementos, que es lo que se puede contar sin serializar
 *   el documento en cada escritura. Un `sbar` con un texto enorme puede pesar más
 *   que cien administraciones, y por eso su tope es menor — pero es una
 *   aproximación, y se dice.
 * · NO prueba contra Firestore. Prueba la partición, los topes y por qué extremo
 *   se recorta; que el documento quede por debajo de 1 MB en producción es la
 *   otra frontera.
 * · El tope 100 NO es una cifra clínica: dice cuánto cabe en un documento. Está
 *   muy por encima de lo que lee cualquiera (la pantalla enseña `slice(-6)`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ARRAYS_DEL_EPISODIO, TOPES, cabe,
} from '@/lib/hospital/lo-que-cabe-en-un-episodio'
import {
  ACCIONES_CON_EVENTO_DURABLE, ACCIONES_SIN_EVENTO_DURABLE,
} from '@/lib/hospital/registro-durable'
import { lineaMar } from '@/lib/uci/mar'

const RUTA = readFileSync('src/app/api/hospital/mutar/route.ts', 'utf8')
const TIPOS = readFileSync('src/types/hospital.ts', 'utf8')

describe('el array que crecía sin tope', () => {
  it('`administraciones` tiene tope, que era el defecto entero', () => {
    expect(TOPES['indicaciones[].administraciones']).toBe(100)
  })

  it('la ruta lo aplica: no queda ningún `.slice(-N)` suelto', () => {
    /* Al revés: un tope escrito en la ruta y no en el módulo volvería a ser un
       número que nadie puede auditar de un vistazo. */
    expect(RUTA).toContain("cabe('indicaciones[].administraciones'")
    expect(RUTA).not.toMatch(/\.slice\(-(100|50)\)/)
  })

  it('recorta por el PRINCIPIO: lo que se va es lo más viejo', () => {
    const largo = Array.from({ length: 120 }, (_, i) => i)
    const quedan = cabe('indicaciones[].administraciones', largo)
    expect(quedan).toHaveLength(100)
    expect(quedan[quedan.length - 1]).toBe(119)   // la última dosis SIEMPRE queda
    expect(quedan[0]).toBe(20)
  })

  it('y por eso el atraso del MAR no cambia al recortar', () => {
    /**
     * La comprobación que importa: el motor ancla en la ÚLTIMA dosis dada. Se
     * corre con la lista entera y con la recortada y tiene que decir lo mismo.
     * Recortar por el otro lado convertiría a un paciente al día en uno «nunca
     * administrado».
     */
    const base = Date.parse('2026-08-30T12:00:00.000Z')
    const administraciones = Array.from({ length: 120 }, (_, i) => ({
      fecha: new Date(base - (119 - i) * 6 * 3_600_000).toISOString(),
      estado: 'administrado' as const,
    }))
    const ind = { id: 'i1', descripcion: 'Ceftriaxona', frecuencia: 'cada 6 horas', activa: true, fecha: new Date(base - 130 * 6 * 3_600_000).toISOString() }
    const ahoraIso = new Date(base).toISOString()
    const conTodo = lineaMar({ ...ind, administraciones } as never, ahoraIso, 30)
    const recortada = lineaMar({ ...ind, administraciones: cabe('indicaciones[].administraciones', administraciones) } as never, ahoraIso, 30)
    expect(recortada.estado).toBe(conTodo.estado)
    expect(recortada.ultima?.fecha).toBe(conTodo.ultima?.fecha)
    expect(recortada.horasDesde).toBe(conTodo.horasDesde)
  })
})

describe('lo que NO se topa, y por qué', () => {
  const sinTope = ARRAYS_DEL_EPISODIO.filter(a => a.tope === null)

  it('`movimientos` no se topa porque es su única copia', () => {
    /* Y no es una opinión: `registro-durable.ts` declara que `trasladar` no
       emite evento PRECISAMENTE porque queda ahí. Si alguien lo topara, esa
       declaración se volvería falsa y se borrarían traslados. */
    expect(TOPES.movimientos).toBeUndefined()
    expect(ACCIONES_SIN_EVENTO_DURABLE.trasladar).toContain('movimientos[]')
  })

  it('las órdenes y las interconsultas tampoco: son la cosa, no su registro', () => {
    expect(TOPES.indicaciones).toBeUndefined()
    expect(TOPES.interconsultas).toBeUndefined()
  })

  it('cada uno sin tope dice POR QUÉ, y no de pasada', () => {
    for (const a of sinTope) {
      expect(a.copiaCompleta).toBeNull()
      expect(a.porQue.length).toBeGreaterThan(80)
    }
  })

  it('`cabe` los deja intactos en vez de recortarlos «por si acaso»', () => {
    const largo = Array.from({ length: 500 }, (_, i) => i)
    expect(cabe('movimientos', largo)).toHaveLength(500)
    expect(cabe('indicaciones', largo)).toHaveLength(500)
  })
})

describe('la partición no deja huecos', () => {
  it('todo array del tipo `Internamiento` está declarado', () => {
    /**
     * Al revés, como `ACCIONES_CON_EVENTO_DURABLE`: un array nuevo que nadie
     * clasifique rompe esto a propósito, para que nadie añada algo que crece a
     * un documento sin decidir si se topa.
     */
    const cuerpo = TIPOS.slice(TIPOS.indexOf('export interface Internamiento'))
      .slice(0, TIPOS.slice(TIPOS.indexOf('export interface Internamiento')).indexOf('\n}'))
    const enElTipo = [...cuerpo.matchAll(/^\s{2}(\w+)\??:\s*[^\n]*\[\]/gm)].map(m => m[1])
    expect(enElTipo.length).toBeGreaterThan(0)
    const declarados = new Set(ARRAYS_DEL_EPISODIO.map(a => a.campo.split('[]')[0]))
    for (const campo of enElTipo) expect([campo, declarados.has(campo)]).toEqual([campo, true])
  })

  it('todo el que SE topa tiene copia completa declarada', () => {
    /* La regla entera: topar sólo es seguro si el hecho vive en otro sitio. */
    for (const a of ARRAYS_DEL_EPISODIO) {
      if (a.tope === null) continue
      expect([a.campo, a.copiaCompleta]).not.toEqual([a.campo, null])
      expect(a.copiaCompleta).toContain('registros')
    }
  })

  it('y esa copia existe de verdad en el libro durable', () => {
    /* Sin esto, «tiene copia en registros» sería una promesa del comentario —
       que es exactamente el defecto que esta unidad repara. */
    expect(ACCIONES_CON_EVENTO_DURABLE.administrar).toBe('administracion')
    expect(ACCIONES_CON_EVENTO_DURABLE.balance).toBe('balance')
    expect(ACCIONES_CON_EVENTO_DURABLE.escala).toBe('escala')
    expect(ACCIONES_CON_EVENTO_DURABLE.sbar).toBe('sbar')
  })
})
