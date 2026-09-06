/**
 * NINGÚN DIÁLOGO SE COME SU PROPIA SALIDA — REG-518.
 *
 * DE DÓNDE VIENE. REG-517: el dueño no podía firmar una nota desde su iPhone
 * porque el diálogo de confirmación crecía más que la pantalla y sus botones
 * quedaban debajo del pliegue. Aquello se reparó en un archivo. Esto pregunta lo
 * siguiente, que es lo que de verdad importa: **¿cuántos más hay así?**
 *
 * LO QUE SE ENCONTRÓ AL MEDIRLO. Doce superficies con telón modal. Tres las
 * cubre el `<Modal>` del sistema —que SÍ lo tenía bien: `max-height: 92dvh` y
 * `overflow-y: auto`—; dos son capas para cerrar un menú al hacer clic fuera y
 * no llevan contenido; y las demás se dibujaban a mano, cada una a su manera.
 *
 * De ésas, tres tenían la misma herida que REG-517, y una era peor: el panel de
 * ayuda lleva `overflow: hidden` sin tope de alto, así que un contenido que
 * crece se **recorta** en vez de desbordar. Recortar es peor que desbordar:
 * ni siquiera se ve que falta algo.
 *
 * POR QUÉ ESTE GUARDIÁN Y NO CUATRO ARREGLOS. Los cuatro arreglos ya están; lo
 * que faltaba era que el quinto diálogo que alguien escriba no nazca con el
 * mismo defecto. La regla no se puede dejar en la memoria de quien la escribió.
 *
 * LO QUE NO CUBRE, dicho:
 *  · Es una prueba de FUENTE. Que en el aparato se vean los botones lo dice el
 *    teléfono, y este arnés corre en Node.
 *  · Reconoce las formas de cobertura que hoy existen. Una quinta forma legítima
 *    tendría que añadirse aquí, y eso es a propósito: la lista es la política.
 *  · No mira paneles anclados que no son modales (menús, tooltips): ahí quedarse
 *    corto no atrapa a nadie.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()

function tsx(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) tsx(p, acc)
    else if (p.endsWith('.tsx') && !p.includes('__tests__')) acc.push(p)
  }
  return acc
}

/**
 * Telones que NO son diálogos: capas transparentes cuyo único trabajo es cerrar
 * un menú al hacer clic fuera. No llevan contenido, así que no pueden esconder
 * nada. Se declaran una a una — no se detectan por heurística, porque «parece
 * que no tiene contenido» es exactamente como se cuela un diálogo de verdad.
 */
const CAPAS_DE_CLIC: readonly string[] = [
  'src/components/DoctorFilter.tsx',      // cierra el desplegable de médicos
  'src/app/(dashboard)/citas/page.tsx',   // cierra el menú de una cita
  'src/app/(dashboard)/layout.tsx',       // cierra el cajón de navegación
]

/**
 * Las formas de cobertura que hoy existen. Añadir una es cambiar la política, y
 * por eso cada una lleva escrito POR QUÉ vale.
 */
function estaCubierto(src: string): boolean {
  /** 1 · El `<Modal>` del sistema: `max-height: 92dvh` + `overflow-y: auto`. */
  const porElSistema = /className="modal-overlay"|className={\['modal'|<Modal\b/.test(src)
  /** 2 · El patrón compartido, para los diálogos centrados que no pueden ser `<Modal>`. */
  const porElPatron = /nx-dialogo-panel/.test(src)
  /**
   * 3 · Tope PROPIO en línea + el cuerpo que scrollea por clase.
   *
   * Un panel ANCLADO —el de ayuda cuelga de su botón, no está centrado— no
   * puede usar el tope del patrón, que descuenta 40px de un diálogo centrado.
   * Necesita su propia resta. Lo que no puede faltarle es el cuerpo que
   * scrollea, y eso sí es compartido.
   */
  const anclado = /maxHeight/.test(src) && /nx-dialogo-cuerpo/.test(src)
  /** 4 · Todo en línea, de antes del patrón. */
  const enLinea = /maxHeight/.test(src) && /overflowY: 'auto'|overflow: 'auto'/.test(src)
  return porElSistema || porElPatron || anclado || enLinea
}

const superficies = [
  ...tsx(join(RAIZ, 'src/components')),
  ...tsx(join(RAIZ, 'src/app')),
  ...tsx(join(RAIZ, 'src/context')),
].filter(p => {
  const t = readFileSync(p, 'utf8')
  return /position: 'fixed', inset: 0|role="dialog"|aria-modal/.test(t)
})

describe('REG-518 · todo diálogo modal tiene tope de alto', () => {
  it('el barrido encuentra superficies: si no, no vigila nada', () => {
    expect(superficies.length).toBeGreaterThanOrEqual(10)
  })

  it('EL CASO: ningún diálogo puede crecer hasta esconder sus botones', () => {
    const sinCubrir = superficies
      .map(p => p.replace(RAIZ + '/', ''))
      .filter(rel => !CAPAS_DE_CLIC.includes(rel))
      .filter(rel => !estaCubierto(readFileSync(join(RAIZ, rel), 'utf8')))
    expect(
      sinCubrir,
      'diálogos sin tope de alto ni scroll. Usa `<Modal>`, o las clases ' +
      '`nx-dialogo-panel`/`nx-dialogo-cuerpo`. Si es una capa para cerrar un ' +
      'menú y no lleva contenido, decláralo en CAPAS_DE_CLIC con su porqué.',
    ).toEqual([])
  })

  it('CAPAS_DE_CLIC no se pudre: cada entrada sigue existiendo y sigue siendo un telón', () => {
    for (const rel of CAPAS_DE_CLIC) {
      const t = readFileSync(join(RAIZ, rel), 'utf8')
      expect(t, `${rel} ya no dibuja un telón: sobra de la lista`).toMatch(/position: 'fixed', inset: 0/)
    }
  })

  it('el patrón compartido existe en la hoja, con dvh y no vh', () => {
    const css = readFileSync(join(RAIZ, 'src/app/globals.css'), 'utf8')
    expect(css).toMatch(/\.nx-dialogo-panel \{[^}]*max-height: calc\(100dvh/)
    expect(css).toMatch(/\.nx-dialogo-cuerpo \{[^}]*overflow-y: auto/)
  })

  it('y el `<Modal>` del sistema respeta el área segura del teléfono', () => {
    // Beneficia a TODOS los modales del producto de una vez.
    const css = readFileSync(join(RAIZ, 'src/app/globals.css'), 'utf8')
    const bloque = css.slice(css.indexOf('.modal-overlay {'))
    expect(bloque.slice(0, 700)).toMatch(/env\(safe-area-inset-bottom\)/)
  })
})
