/**
 * GOLDEN — LA AYUDA DESCRIBE EL MENÚ QUE EXISTE (5-sep-2026)
 *
 * QUÉ FALLABA: la guía de la app le decía al médico que «a la izquierda están
 * las secciones: Dashboard, Citas, Consulta, **Hospitalización, Consultor
 * IA**…» y, más abajo, «En el menú, "Consultor IA"». Las dos frases eran
 * falsas:
 *
 * - el `Consultor` salió del menú en RTC-09 y vive en el expediente del
 *   paciente (una capacidad de IA en un menú obliga a salir del paciente y
 *   volver a decir de quién se hablaba, §3.2);
 * - `Hospitalización` entró en pausa el 4-sep (D-030);
 * - y el menú lleva desde V15-IA-001 siendo cinco destinos, no la lista de
 *   veintiuno que esa frase describía.
 *
 * CÓMO SE DESCUBRIÓ: buscando qué más nombraba a Hospitalización al pausarla.
 * No lo cazó ninguna prueba: la ayuda es texto, y el texto no se rompe.
 *
 * CAUSA RAÍZ: la guía se escribió como prosa suelta, sin nada que la atara a
 * la navegación real. Cada reforma de menú la dejaba un poco más falsa, y una
 * guía falsa es peor que ninguna: la lee justamente quien ya está perdido.
 *
 * LA REGLA QUE LO HACE SEGURO: el paso «Reconoce el menú» se compara contra
 * los destinos que `FlowRail` declara DE VERDAD, y contra lo que está en pausa
 * y lo que se mudó al paciente. Si mañana el riel cambia, esta prueba cae.
 *
 * QUÉ NO CUBRE:
 * - No lee toda la guía: comprueba las afirmaciones sobre DÓNDE ESTÁN las
 *   cosas, que son las que caducan al mover una pantalla. El resto del texto
 *   (qué hace cada función) sigue sin guardián.
 * - No mira la pantalla: que la guía se pinte es cosa de `/guia`.
 * - No juzga la redacción, sólo que no mienta sobre la navegación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { MODULOS_EN_PAUSA } from '@/lib/navegacion/modulos-en-pausa'
import { CAPACIDADES_DEL_PACIENTE } from '@/lib/nav/capacidades-del-paciente'
import { MODULO_LABEL } from '@/lib/modulos'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const AYUDA = leer('src/lib/ayuda/conocimiento.ts')
const FLOW_RAIL = leer('src/components/FlowRail.tsx')

/** Los destinos que el riel declara hoy. */
const destinosDelRiel = (): string[] =>
  [...FLOW_RAIL.matchAll(/<RailLink[^>]*label="([^"]+)"/g)].map(m => m[1])

/** El paso de la guía que le explica el menú a quien entra por primera vez. */
const pasoDelMenu = (): string =>
  AYUDA.match(/\{ t: 'Reconoce el menú', d: '([^']+)'/)?.[1] ?? ''

describe('La ayuda no miente sobre dónde están las cosas', () => {
  it('1 · el paso del menú nombra los destinos que el riel declara', () => {
    const destinos = destinosDelRiel()
    expect(destinos.length).toBeGreaterThanOrEqual(4)
    const paso = pasoDelMenu()
    expect(paso, 'no se encontró el paso «Reconoce el menú»').not.toBe('')
    for (const d of destinos) {
      expect(paso, `la guía no nombra el destino «${d}»`).toContain(d)
    }
  })

  it('2 · …y NO nombra como sección del menú lo que está en pausa', () => {
    const paso = pasoDelMenu()
    for (const clave of MODULOS_EN_PAUSA) {
      const etiqueta = MODULO_LABEL[clave]
      if (!etiqueta) continue
      expect(
        paso.toLowerCase(),
        `la guía sigue mandando al menú por «${etiqueta}», que está en pausa`,
      ).not.toContain(etiqueta.toLowerCase())
    }
  })

  it('3 · lo que se mudó al PACIENTE ya no se busca «en el menú»', () => {
    // RTC-09: el consultor y el antibiograma viven en el expediente. Una guía
    // que los mande al menú hace dar la vuelta larga a quien la obedece.
    for (const cap of CAPACIDADES_DEL_PACIENTE) {
      const enElMenu = new RegExp(`[Ee]n el menú[^.']{0,40}${cap.nombre.split(' ')[0]}`, 'i')
      expect(AYUDA, `la guía manda al menú por «${cap.nombre}»`).not.toMatch(enElMenu)
    }
    expect(AYUDA).not.toMatch(/[Ee]n el menú, "Consultor IA"/)
  })

  it('4 · AL REVÉS: el guardián cae si la guía vuelve a describir el menú viejo', () => {
    // El texto exacto que estuvo mal durante dos reformas de navegación. Si
    // reaparece —copiado de una versión vieja, o reescrito igual— esto lo caza.
    const menuViejo = 'las secciones: Dashboard, Citas, Consulta, Hospitalización, Consultor IA'
    expect(AYUDA).not.toContain(menuViejo)
    // Y la comprobación de que el caso 1 puede fallar: un destino inventado no
    // está en la guía, así que la aserción de arriba no es una tautología.
    expect(pasoDelMenu()).not.toContain('Hospitalización')
  })

  it('5 · el tema de Hospitalización declara que el módulo está en pausa', () => {
    // Sigue funcionando y sigue documentado; lo que cambió es cómo se llega.
    // Una guía que enseña a usar algo sin decir que ya no está en el menú deja
    // al médico buscando un botón que no existe.
    const intro = AYUDA.match(/id: 'hospital', titulo: 'Hospitalización'[\s\S]{0,120}intro: '([^']+)'/)?.[1] ?? ''
    expect(intro).not.toBe('')
    expect(intro.toLowerCase()).toContain('no aparece en el menú')
    expect(intro).toContain('/hospitalizacion')
  })
})
