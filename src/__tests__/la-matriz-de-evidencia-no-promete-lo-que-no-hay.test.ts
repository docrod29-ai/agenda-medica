import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { INSTANCIADOS, FUERA_DEL_CONTRATO } from '../../scripts/evidence/matriz-proveedores.mjs'
import { PROVEEDORES_INSTANCIADOS } from '@/lib/evidencia/recuperacion-consultor'

/**
 * REG-345 — LA TABLA QUE UN DUEÑO LEE PARA DECIDIR UN GASTO DECÍA «SÍ» DE
 * FUENTES QUE NADIE HA CONSTRUIDO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md` tenía una columna
 * «¿Puede citar hoy?» que contestaba **sí** para ClinicalTrials.gov, la OMS y
 * los CDC. Ninguno de los tres tiene adaptador, ninguno se instancia y ninguno
 * se consulta nunca.
 *
 * La columna no mentía por descuido: miraba `proveedorCanonico`, que es una
 * propiedad del **tipo** —«si algún día hay un `Source`, se llamará así»—, no
 * una capacidad de ejecución. El pie de la tabla lo explicaba. Pero un dueño que
 * abre el documento a decidir si paga una licencia lee la TABLA, no el pie, y se
 * lleva que ya tiene tres fuentes públicas funcionando.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El documento se generaba desde el catálogo —que es una **declaración de
 * intención**— y nunca desde el código que crea los adaptadores, que es la
 * única verdad de ejecución. Dos fuentes, y se eligió la que no manda.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La columna cruza catálogo **y** runtime, y admite tres estados en vez de dos,
 * porque hay tres realidades distintas:
 *
 *   · `sí` — hay licencia y hay adaptador instanciado.
 *   · `sí, pero fuera del contrato` — PMC y openFDA se consultan de verdad, los
 *     llama a mano la ruta. Meterlos en «sin adaptador» sería mentir en la otra
 *     dirección; darles un «sí» limpio también, porque al no pasar por
 *     `planDeConsulta` **no producen aviso**: si openFDA se cae, el médico lee
 *     una respuesta más pobre y no puede distinguirla de una completa.
 *   · `no — sin adaptador` / `no — sin licencia`.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No comprueba que las fuentes **respondan**: sólo que estén cableadas. Que
 *   PubMed conteste hoy es cosa de la red, no de esta prueba.
 * · La lista del script es una COPIA de la del runtime (el generador es JS puro
 *   y no puede importar TS). Por eso el primer caso compara las dos y falla si
 *   se separan — que es la única forma de que una copia sea aceptable.
 * · No arregla que PMC y openFDA no avisen cuando fallan. Eso es un P1 abierto
 *   en el tablero, no algo que esta prueba dé por bueno.
 */

const DOC = readFileSync('docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md', 'utf8')

describe('REG-345 · el documento se deriva del runtime, no de la intención', () => {
  it('la copia del generador no se separa de la lista real de adaptadores', () => {
    expect([...INSTANCIADOS].sort()).toEqual([...PROVEEDORES_INSTANCIADOS].sort())
  })

  it('las tres fuentes sin adaptador YA NO dicen que se consultan', () => {
    for (const nombre of ['ClinicalTrials.gov', 'OMS / WHO', 'CDC (guías y MMWR)']) {
      const fila = DOC.split('\n').find(l => l.startsWith(`| ${nombre}`))
      expect(fila, `falta la fila de ${nombre}`).toBeTruthy()
      expect(fila).toContain('sin adaptador')
    }
  })

  it('lo que SÍ se consulta sigue diciendo que sí', () => {
    const pubmed = DOC.split('\n').find(l => l.startsWith('| PubMed / MEDLINE'))
    expect(pubmed).toContain('**sí**')
    expect(pubmed).not.toContain('sin adaptador')
  })

  it('PMC y openFDA se declaran consultados PERO fuera del contrato', () => {
    for (const nombre of ['PubMed Central', 'FDA / DailyMed']) {
      const fila = DOC.split('\n').find(l => l.startsWith(`| ${nombre}`))
      expect(fila).toContain('fuera del contrato')
      expect(fila).toContain('no avisa si falla')
    }
    // Y están declarados como tales en el generador, no adivinados.
    expect(FUERA_DEL_CONTRATO).toContain('pmc')
    expect(FUERA_DEL_CONTRATO).toContain('fda_dailymed')
  })

  it('el pie explica que hacen falta LAS DOS cosas', () => {
    expect(DOC).toContain('cruza DOS cosas')
    expect(DOC).toContain('no puede leer «no se consultó»')
  })

  it('el guardián sabe fallar: el criterio viejo habría dicho «sí»', () => {
    // Probado al revés sin tocar el árbol. El criterio anterior era «tiene
    // proveedorCanonico», y ClinicalTrials lo tiene: por eso decía sí.
    const entradaClinicalTrials = { id: 'clinicaltrials', proveedorCanonico: 'clinicaltrials' }
    const criterioViejo = !!entradaClinicalTrials.proveedorCanonico
    const criterioNuevo = INSTANCIADOS.includes(entradaClinicalTrials.proveedorCanonico)
      || INSTANCIADOS.includes(entradaClinicalTrials.id)
    expect(criterioViejo).toBe(true)
    expect(criterioNuevo).toBe(false)
  })
})
