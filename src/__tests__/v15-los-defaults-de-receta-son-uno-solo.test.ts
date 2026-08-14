/**
 * Los valores por defecto de la receta salen de UN solo sitio.
 *
 * ── CÓMO SE ENCONTRÓ ────────────────────────────────────────────────────────
 *
 * Buscando los literales teal que quedaban (RTC-19, 3ª tanda) apareció
 * `colorAccento: '#14b8a6'` **dos veces**: en `DEFAULT_CONFIG` (`@/types`) y en
 * un `RX_DEFAULTS` propio de la pantalla de configuración. Mirando el resto del
 * bloque, no era un campo duplicado: eran **los trece campos**, copiados uno a
 * uno.
 *
 * Comparados campo por campo el día que se encontró, **coincidían exactamente**
 * — ninguno sobraba, ninguno faltaba, ninguno divergía. Y eso es precisamente
 * el problema: coincidían **por suerte, no por construcción**.
 *
 * ── POR QUÉ IMPORTA, Y DÓNDE SE PAGARÍA ─────────────────────────────────────
 *
 * La siguiente vez que alguien cambie el aviso legal, la vigencia en días o el
 * tamaño de papel en uno de los dos sitios, el otro se queda atrás. Y la
 * diferencia no sale en una pantalla: sale **impresa en una receta**, que es
 * donde nadie la busca y donde lleva cédula profesional debajo.
 *
 * Es la regla cardinal del repositorio —«nunca duplicar la fuente de verdad de
 * una entidad clínica»— en su forma más silenciosa: dos copias que hoy dicen lo
 * mismo no dan ningún síntoma.
 *
 * ── EL ARREGLO ──────────────────────────────────────────────────────────────
 *
 * `RX_DEFAULTS` deja de ser una copia y pasa a ser
 * `DEFAULT_CONFIG.recetaConfig`. Lo que se guarda en Firestore y lo que se
 * imprime salen ya del mismo sitio.
 *
 * Probado al revés: devolviendo la copia literal a la pantalla falla el caso 1.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba que los valores sean los correctos.** Qué vigencia debe
 *   tener una receta es política clínica, no una prueba: aquí sólo se exige que
 *   haya UNA respuesta, no cuál.
 * · **No cubre las otras plantillas** (notas, órdenes), que tienen sus propios
 *   defaults y no se han contado.
 * · `colorAccento` sigue siendo un hex literal, y con razón escrita: un
 *   `<input type="color">` sólo acepta `#rrggbb` y la receta se imprime sin
 *   hoja de estilos que resuelva una variable.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CONFIG } from '@/types'

const PANTALLA = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/configuracion/secciones-recetas.tsx'), 'utf8',
)

describe('los defaults de la receta no se copian', () => {
  it('1 · la pantalla DERIVA los suyos del canónico, no los reescribe', () => {
    expect(PANTALLA).toMatch(/const RX_DEFAULTS: RecetaConfig = DEFAULT_CONFIG\.recetaConfig!/)
    // Y ya no queda el bloque copiado campo por campo.
    expect(PANTALLA).not.toMatch(/const RX_DEFAULTS: RecetaConfig = \{/)
  })

  it('2 · el canónico existe y trae los campos que la receta necesita', () => {
    /**
     * Si el caso 1 pasara con un canónico vacío, la pantalla habría quedado
     * sin defaults y la receta saldría con huecos. Se comprueba que el sitio
     * del que ahora depende de verdad los tiene.
     */
    const rx = DEFAULT_CONFIG.recetaConfig
    expect(rx, 'DEFAULT_CONFIG ya no trae recetaConfig').toBeTruthy()
    for (const campo of ['paperSize', 'estilo', 'colorAccento', 'vigenciaDias', 'avisoLegal']) {
      expect(rx, `falta ${campo} en el default canónico`).toHaveProperty(campo)
    }
  })

  it('3 · y el color de acento sigue siendo un hex de verdad', () => {
    // Un `<input type="color">` sólo acepta `#rrggbb`, y la receta se imprime.
    expect(DEFAULT_CONFIG.recetaConfig!.colorAccento).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
