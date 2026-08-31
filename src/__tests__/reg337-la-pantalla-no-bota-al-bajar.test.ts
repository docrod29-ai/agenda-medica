import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { destinoDelRielHorizontal } from '@/lib/ui/traer-a-la-vista'

/**
 * REG-337 — LA PANTALLA DEL EXPEDIENTE BOTABA AL BAJAR (teléfono Y escritorio).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * En `/expediente/[patientId]`, al desplazarse hacia abajo la página saltaba
 * sola de vuelta a la zona alta, una y otra vez, mientras el dedo (o la rueda)
 * seguía bajando. No era el dispositivo: pasaba igual en iPhone y en escritorio.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * El dueño grabó la pantalla del teléfono bajando por el expediente de una
 * paciente sin notas (28-ago-2026) y dijo «mira cómo se bota la pantalla cuando
 * bajo». En el vídeo se ve el ciclo completo: el contenido baja hasta enseñar
 * «Datos del paciente» / «Herramientas clínicas», y vuelve arriba solo.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * `ClinicalSpine` seguía la lectura con:
 *
 *     el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
 *
 * y su comentario afirmaba «`nearest`, para no arrastrar la página». Es falso.
 * `nearest` elige la ALINEACIÓN; NO elige a quién se desplaza. `scrollIntoView`
 * recorre **todos** los ancestros desplazables —el documento incluido— y mueve
 * cada uno lo necesario para que el elemento quede visible.
 *
 * El `PatientAnchor` es `position: sticky; top: 0` y el riel va justo debajo en
 * flujo normal, así que a ~100px de bajada el riel ya salió del viewport. Ahí
 * se cierra el bucle:
 *
 *     bajar → IntersectionObserver marca otra sección → setActivo
 *           → efecto pide traer a la vista un botón del riel que ya no se ve
 *           → el navegador SUBE la página para enseñarlo
 *           → al subir cambia otra vez la sección visible → setActivo → …
 *
 * Y con `behavior: 'smooth'` cada salto es una animación peleándose con el dedo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Cuando lo que hay que mover es UN carril, se desplaza ese scrollport por su
 * nombre (`riel.scrollTo`), que no puede tocar a un ancestro. La aritmética de
 * «¿hace falta moverse, y hasta dónde?» vive en `lib/ui/traer-a-la-vista.ts`,
 * pura y sin DOM, para que se pueda probar de verdad.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * - Estos casos NO ven un navegador. `vitest` corre en `node`: no hay layout ni
 *   scroll real, así que prueban la aritmética y el cableado, no el efecto. El
 *   bote se reprodujo y se midió aparte, en Chromium (ver REG-337 en el ledger:
 *   6 botes antes, 0 después); esa medición **no está en CI**, así que si
 *   alguien vuelve a meter un `scrollIntoView` aquí, lo que lo caza es el
 *   guardián de abajo — no una prueba de navegador.
 * - Recorrer la pantalla REAL con datos sigue pendiente: lo medido fue un arnés
 *   que copia su estructura, no `/expediente/[patientId]`.
 * - No prueba el IntersectionObserver ni el `rootMargin`: qué sección se
 *   considera activa no cambió en este arreglo.
 * - No vigila al resto del producto. Un `scrollIntoView({ block: 'nearest' })`
 *   nuevo en otra pantalla volvería a arrastrar la página; el guardián de abajo
 *   sólo mira este componente, que es el único que hoy lo hacía dentro de un
 *   carril.
 * - Sólo eje horizontal y sólo `direction: ltr`.
 */

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const SPINE = leer('src/components/expediente/ClinicalSpine.tsx')

/**
 * Los comentarios del componente CUENTAN la causa raíz, y para contarla citan
 * la llamada que la provocaba. Un guardián que contara `scrollIntoView` sobre
 * el archivo entero se dispararía con su propia explicación —y, peor, se
 * podría «arreglar» borrando la explicación—. Así que se mide el CÓDIGO.
 */
const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const CODIGO = sinComentarios(SPINE)

/** El riel del vídeo: puerto de 360px de ancho que empieza en x=16 del viewport. */
const PUERTO = { puertoIzquierda: 16, puertoDerecha: 376 }

describe('REG-337 · la aritmética del carril: mover lo mínimo, y sólo cuando hace falta', () => {
  it('si el activo ya se ve entero, NO se desplaza nada (null, no 0)', () => {
    // El caso que más veces se da al bajar: el activo sigue a la vista. Antes
    // aquí se pedía un scroll igualmente, y cada petición arrastraba la página.
    expect(destinoDelRielHorizontal({
      scrollLeft: 0, ...PUERTO, objetivoIzquierda: 20, objetivoDerecha: 180,
    })).toBeNull()
  })

  it('un activo que se sale por la DERECHA se alinea al final del puerto', () => {
    // Objetivo 300px más allá del borde derecho → hay que avanzar 300px.
    expect(destinoDelRielHorizontal({
      scrollLeft: 0, ...PUERTO, objetivoIzquierda: 520, objetivoDerecha: 676,
    })).toBe(300)
  })

  it('un activo que se sale por la IZQUIERDA se alinea al principio, con su margen', () => {
    // Ya desplazado 300px; el objetivo empieza 44px antes del borde visible y
    // se pide 2px de aire (el mismo `scrollPaddingLeft` del riel).
    expect(destinoDelRielHorizontal({
      scrollLeft: 300, ...PUERTO, objetivoIzquierda: -28, objetivoDerecha: 120, margen: 2,
    })).toBe(254)
  })

  it('un activo más ancho que el puerto se alinea al principio (donde se empieza a leer)', () => {
    // Se sale por los dos lados: gana el principio, no el final.
    expect(destinoDelRielHorizontal({
      scrollLeft: 100, ...PUERTO, objetivoIzquierda: -50, objetivoDerecha: 900,
    })).toBe(34)
  })

  it('nunca devuelve un destino negativo', () => {
    expect(destinoDelRielHorizontal({
      scrollLeft: 4, ...PUERTO, objetivoIzquierda: -400, objetivoDerecha: -100,
    })).toBe(0)
  })

  it('no pasa del tope real de desplazamiento', () => {
    expect(destinoDelRielHorizontal({
      scrollLeft: 0, ...PUERTO, objetivoIzquierda: 900, objetivoDerecha: 1100, maximo: 240,
    })).toBe(240)
  })

  it('si el recorte contra un tope deja el destino donde ya estaba, no se mueve', () => {
    // Ya en el tope: pedir más sería un scroll de 0px — y un scroll de 0px con
    // `behavior: smooth` sigue siendo una animación encima del dedo.
    expect(destinoDelRielHorizontal({
      scrollLeft: 240, ...PUERTO, objetivoIzquierda: 900, objetivoDerecha: 1100, maximo: 240,
    })).toBeNull()
  })
})

describe('REG-337 · el riel se mueve solo a sí mismo', () => {
  /**
   * PROBADO AL REVÉS: si se devuelve a `ClinicalSpine` la línea original
   * (`el?.scrollIntoView({ behavior: comportamientoScroll(), block: 'nearest',
   * inline: 'nearest' })`) los tres casos de abajo caen — el primero porque
   * aparece un segundo `scrollIntoView`, el segundo porque reaparece
   * `'nearest'`, y el tercero porque desaparece `riel.scrollTo`.
   */

  it('el efecto que sigue la lectura NO usa scrollIntoView', () => {
    // `scrollIntoView` desplaza TODOS los ancestros. El único que queda en el
    // archivo es el viaje deliberado del click (`irA`), que sí debe mover la
    // página porque el médico lo pidió.
    const llamadas = CODIGO.match(/scrollIntoView\(/g) ?? []
    expect(llamadas).toHaveLength(1)
    // Y esa única llamada vive en `irA`, después de la declaración del click.
    expect(CODIGO.indexOf('const irA =')).toBeGreaterThan(-1)
    expect(CODIGO.indexOf('scrollIntoView(')).toBeGreaterThan(CODIGO.indexOf('const irA ='))
  })

  it('ya no queda ningún `nearest` en el componente', () => {
    expect(CODIGO).not.toMatch(/'nearest'/)
  })

  it('el activo se trae a la vista desplazando el scrollport por su nombre', () => {
    expect(CODIGO).toMatch(/riel\.scrollTo\(\{ left: destino, behavior: comportamientoScroll\(\) \}\)/)
    expect(CODIGO).toMatch(/destinoDelRielHorizontal/)
    expect(CODIGO).toMatch(/from '@\/lib\/ui\/traer-a-la-vista'/)
  })

  it('y no se pide desplazamiento cuando la aritmética dice que no hace falta', () => {
    // El `null` tiene que CORTAR el efecto, no colarse como `scrollTo({left: null})`.
    expect(CODIGO).toMatch(/if \(destino === null\) return/)
  })

  it('el viaje del click conserva su alineación original (`start`)', () => {
    // Freeze funcional: este arreglo no toca lo que pasa al PULSAR el riel.
    expect(CODIGO).toMatch(/scrollIntoView\(\{ behavior: comportamientoScroll\(\), block: 'start' \}\)/)
  })
})

/**
 * DOS PROPIEDADES QUE VIENEN DE OTRA REPARACIÓN DEL MISMO DEFECTO.
 *
 * El rebote del riel se encontró y se arregló DOS VECES, en paralelo y sin que
 * una rama viera a la otra: aquí como REG-337 —con la aritmética en el módulo
 * canónico `lib/ui/traer-a-la-vista.ts`— y en el carril de #398 como REG-342,
 * con una función local en el propio componente. Misma causa, mismo archivo,
 * incluso el mismo caso 5 del mismo test reescrito por los dos.
 *
 * Al absorber ese carril se conserva UNA sola implementación —la canónica, que
 * además acota contra el tope real— y su golden se retira. Pero traía dos casos
 * que aquí no estaban, y son los dos que hablan de PROPIEDADES en vez de
 * ejemplos. Se portan enteros, que es la razón de que este bloque exista.
 *
 * Lo que NO se porta: sus casos de ejemplo y sus comprobaciones de cableado,
 * porque los de arriba ya los cubren con la misma intención y más cobertura.
 */
describe('REG-337 · las dos propiedades portadas del golden de REG-342', () => {
  /** Traduce la geometría en coordenadas de contenido a la del puerto real. */
  const enElPuerto = (itemIzq: number, itemAncho: number, scrollLeft: number, anchoVisible: number) => ({
    scrollLeft,
    puertoIzquierda: 0,
    puertoDerecha: anchoVisible,
    objetivoIzquierda: itemIzq - scrollLeft,
    objetivoDerecha: itemIzq + itemAncho - scrollLeft,
  })

  it('EL INVARIANTE — ninguna entrada produce nada que no sea un scrollLeft', () => {
    // Barrido determinista: sea cual sea la geometría, la respuesta es `null` o
    // un número >= 0 destinado al eje horizontal del riel. No hay forma de que
    // esta función pida mover la página, que es la propiedad que se rompió.
    for (let izq = -200; izq <= 800; izq += 37) {
      for (let ancho = 0; ancho <= 300; ancho += 61) {
        for (let sl = 0; sl <= 600; sl += 97) {
          for (const av of [0, 120, 390, 1024]) {
            const r = destinoDelRielHorizontal(enElPuerto(izq, ancho, sl, av))
            if (r === null) continue
            expect(typeof r).toBe('number')
            expect(Number.isFinite(r)).toBe(true)
            expect(r).toBeGreaterThanOrEqual(0)
          }
        }
      }
    }
  })

  it('el resultado deja el ítem DENTRO de la ventana visible', () => {
    // La propiedad que el médico nota: después de mover, el activo se ve.
    for (const c of [
      { itemIzq: 500, itemAncho: 80, scrollLeft: 0, anchoVisible: 300 },
      { itemIzq: 10, itemAncho: 80, scrollLeft: 400, anchoVisible: 300 },
      { itemIzq: 295, itemAncho: 20, scrollLeft: 0, anchoVisible: 300 },
    ]) {
      const destino = destinoDelRielHorizontal(enElPuerto(c.itemIzq, c.itemAncho, c.scrollLeft, c.anchoVisible))
      expect(destino).not.toBeNull()
      const sl = destino as number
      expect(c.itemIzq).toBeGreaterThanOrEqual(sl - 2)
      expect(c.itemIzq + c.itemAncho).toBeLessThanOrEqual(sl + c.anchoVisible + 2)
    }
  })
})
