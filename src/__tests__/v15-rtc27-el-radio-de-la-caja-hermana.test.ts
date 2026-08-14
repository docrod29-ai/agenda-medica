/**
 * RTC-27 — el radio 12 que RT-19 señaló, y el que NO se barre.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La escala de radios del trinquete de diseño es {6, 10, 14, 50, 9999}. RT-19
 * señaló dos derivas concretas a 12: `ResumenPaciente.tsx:104` y el expediente.
 *
 * De las dos, la primera **ya no existe**: la reescritura del resumen (las
 * tarjetas KPI que pasaron a prosa) se la llevó por delante. La que quedaba
 * era la caja «Datos del paciente» del expediente, y ahí el defecto se ve
 * mejor que en la escala: **la caja hermana de la misma pantalla**
 * —«Herramientas clínicas», unas líneas más abajo— usa 10. Dos contenedores
 * del mismo rango, en el mismo pliegue, con esquinas distintas por 2px.
 *
 * Eso es lo que hace que valga la pena: no es «12 no está en la lista», es que
 * la pantalla se contradice a sí misma a dos centímetros de distancia.
 *
 * ── LO QUE **NO** SE HACE, Y ES LA PARTE IMPORTANTE ─────────────────────────
 *
 * Contado en el árbol vivo: **154 apariciones de `borderRadius: 12` en 79
 * archivos**. Ese número no dice «hay 154 defectos»: dice que 12 es un valor
 * de facto del producto que la escala no reconoce. Y con eso hay dos salidas
 * posibles, las dos de diseño:
 *
 *   · la escala está incompleta y debería incluir 12; o
 *   · son 154 sitios que hay que migrar, con revisión visual.
 *
 * **Ninguna se decide barriendo.** Un `sed` de 154 sitios sería el cambio
 * visual más grande de todo V15 y no lo habría mirado nadie — exactamente lo
 * que la regla «no se aprueba una interfaz leyendo el código» prohíbe. Queda
 * declarado aquí para que el dueño del diseño lo resuelva de una vez, y
 * mientras tanto el trinquete lo sigue contando: techo `radiosFueraDeEscala`
 * bajado 627 → 626 con este pago, que es como se retira deuda de una en una.
 *
 * Probado al revés: devolviendo el 12 a la caja falla el caso 1.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Los otros 154.** Declarados arriba, con las dos salidas posibles.
 * · No mide en navegador: 10 contra 12 en una esquina no se juzga con una
 *   captura, se juzga con la escala.
 * · No cubre los radios de `globals.css`, que ya viven en tokens.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const EXPEDIENTE = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')

describe('RTC-27 — la caja y su hermana tienen el mismo radio', () => {
  it('1 · «Datos del paciente» usa un radio de la escala', () => {
    /*
      Se busca el rótulo tal como se PINTA —dentro de su `<span>`—, no la
      cadena suelta: «Datos del paciente» aparece también en comentarios y en
      otros textos de la pantalla, y la primera versión de este caso midió una
      ventana que no era la caja. El contenedor abre unas líneas ANTES del
      rótulo, así que se mira hacia atrás desde ahí.
    */
    const i = EXPEDIENTE.indexOf('>Datos del paciente</span>')
    expect(i, 'no se encontró el rótulo pintado de la caja de datos').toBeGreaterThan(0)
    const ventana = EXPEDIENTE.slice(Math.max(0, i - 900), i)
    expect(ventana).toContain("borderRadius: 10, background: 'var(--s1)'")
    expect(ventana).not.toMatch(/borderRadius: 12, background: 'var\(--s1\)'/)
  })

  it('2 · y la caja hermana de la misma pantalla sigue en 10', () => {
    /**
     * Es la razón del cambio: no «12 no está en la lista», sino que dos
     * contenedores del mismo rango, en el mismo pliegue, tenían esquinas
     * distintas. Si la hermana cambia, este caso avisa de que hay que volver
     * a decidir — no de que esté mal.
     */
    expect(EXPEDIENTE).toMatch(/border: '1px solid var\(--border\)', borderRadius: 10, overflow: 'hidden'/)
  })

  it('3 · el techo de radios fuera de escala BAJÓ, no se declaró', () => {
    const { techos } = JSON.parse(leer('scripts/design/techos-de-diseno.json'))
    expect(techos.radiosFueraDeEscala).toBeLessThanOrEqual(626)
  })
})
