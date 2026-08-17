/**
 * El scroll programático respeta `prefers-reduced-motion` — y lo pregunta en
 * UN solo sitio. V15-VISUAL-SYSTEM-001 (Fase 10, §18 pasos 8-9), novena
 * rebanada: la medición de motion contra el código real.
 *
 * QUÉ FALLABA: `globals.css` tiene el apagador global de §24
 * (`animation-duration: 0.01ms !important` + `scroll-behavior: auto
 * !important`) y PARECÍA que el producto entero respetaba la preferencia.
 * Pero `scrollIntoView({ behavior: 'smooth' })` NO lee `scroll-behavior` de
 * CSS: cuando el comportamiento llega como opción de JavaScript, la
 * especificación lo aplica tal cual. Cinco sitios del producto (ClinicalSpine,
 * AsistenteChat, dos saltos de /consulta y /consultor) animaban el
 * desplazamiento aunque el usuario hubiera pedido menos movimiento. El único
 * que lo hacía bien era `CierreAlPulgar` — con una copia local que nadie más
 * reutilizaba.
 *
 * CÓMO SE DESCUBRIÓ: la novena rebanada midió los pasos 8-9 de §18 (motion,
 * polish) contra el código real antes de decidir el cierre de Fase 10, con
 * grep de `behavior: 'smooth'` sobre src/ — la misma disciplina de inventario
 * que la séptima rebanada aplicó a los roles tipográficos.
 *
 * CAUSA RAÍZ: la preferencia se respetaba EN LA HOJA (donde el apagador
 * global alcanza) y cada sitio de JavaScript decidía por su cuenta — y todos
 * menos uno decidieron mal, porque «smooth» es lo que uno escribe sin pensar.
 *
 * LA REGLA QUE LO HACE SEGURO: `comportamientoScroll()` en
 * `src/lib/ui/movimiento.ts` — una sola implementación que consulta
 * matchMedia (misma razón de existir que `activable.ts`), y este guardián
 * caza cualquier `behavior: 'smooth'` escrito a mano en código de producto
 * para que el séptimo sitio futuro no repita el defecto.
 *
 * QUÉ NO CUBRE: el comportamiento pintado (que el salto sea instantáneo de
 * verdad bajo la preferencia) lo mide el arnés de navegador real de esta
 * corrida (`scripts/design/medir-motion-reduced-v15.mjs`) con
 * `emulateMedia({ reducedMotion: 'reduce' })`. Tampoco cubre animaciones de
 * Web Animations API ni rAF a mano (hoy no existen en el producto), ni
 * decide CUÁNDO desplazar — sólo CÓMO.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('comportamientoScroll — la función', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('devuelve auto cuando el usuario pidió menos movimiento', async () => {
    vi.stubGlobal('window', {
      matchMedia: (q: string) => ({ matches: q.includes('prefers-reduced-motion') }),
    })
    const { comportamientoScroll } = await import('@/lib/ui/movimiento')
    expect(comportamientoScroll()).toBe('auto')
  })

  it('devuelve smooth cuando no hay preferencia', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    const { comportamientoScroll } = await import('@/lib/ui/movimiento')
    expect(comportamientoScroll()).toBe('smooth')
  })

  it('devuelve auto sin ventana (SSR): nada se anima donde nada se pinta', async () => {
    vi.stubGlobal('window', undefined)
    const { comportamientoScroll } = await import('@/lib/ui/movimiento')
    expect(comportamientoScroll()).toBe('auto')
  })
})

describe('ningún sitio de producto escribe smooth a mano', () => {
  // El barrido recorre TODO src/ menos las pruebas y la propia implementación:
  // el guardián existe para el séptimo sitio que todavía no se escribió.
  const sospechosos: string[] = []
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre)
      if (statSync(ruta).isDirectory()) {
        if (nombre === '__tests__' || nombre === 'node_modules') continue
        recorrer(ruta)
      } else if (/\.(tsx?|css)$/.test(nombre)) {
        const texto = readFileSync(ruta, 'utf8')
        if (/behavior:\s*['"]smooth['"]|scrollBehavior:\s*['"]smooth['"]|scroll-behavior:\s*smooth/.test(texto)) {
          sospechosos.push(ruta)
        }
      }
    }
  }

  it('behavior smooth sólo puede salir de comportamientoScroll()', () => {
    recorrer(join(process.cwd(), 'src'))
    const fueraDeLugar = sospechosos.filter(r => !r.endsWith(join('lib', 'ui', 'movimiento.ts')))
    expect(fueraDeLugar).toEqual([])
  })
})

describe('los seis sitios preguntan al mismo sitio (y su conducta no cambió)', () => {
  const SITIOS: Array<[string, RegExp]> = [
    // [archivo, la llamada con su block original intacto — freeze funcional]
    ['src/components/expediente/ClinicalSpine.tsx', /behavior:\s*comportamientoScroll\(\),\s*block:\s*'start'/],
    ['src/components/CierreAlPulgar.tsx', /behavior:\s*comportamientoScroll\(\),\s*block:\s*'center'/],
    ['src/components/AsistenteChat.tsx', /scrollIntoView\(\{\s*behavior:\s*comportamientoScroll\(\)\s*\}\)/],
    ['src/app/(dashboard)/consultor/page.tsx', /scrollIntoView\(\{\s*behavior:\s*comportamientoScroll\(\)\s*\}\)/],
  ]

  for (const [archivo, patron] of SITIOS) {
    it(`${archivo} usa comportamientoScroll con su block original`, () => {
      const texto = leer(archivo)
      expect(texto).toMatch(/from '@\/lib\/ui\/movimiento'/)
      expect(texto).toMatch(patron)
    })
  }

  it('/consulta usa comportamientoScroll en sus DOS saltos (medicamentos center, ancla start)', () => {
    const texto = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    expect(texto).toMatch(/from '@\/lib\/ui\/movimiento'/)
    expect(texto).toMatch(/seccion-medicamentos'\)\?\.scrollIntoView\(\{ behavior: comportamientoScroll\(\), block: 'center' \}\)/)
    expect(texto).toMatch(/r\.slice\(1\)\)\?\.scrollIntoView\(\{ behavior: comportamientoScroll\(\), block: 'start' \}\)/)
  })

  it('CierreAlPulgar ya no carga su copia local de matchMedia (una sola fuente)', () => {
    const texto = leer('src/components/CierreAlPulgar.tsx')
    expect(texto).not.toMatch(/matchMedia/)
    // Y el foco sigue viajando con el scroll — la conducta a11y que ya tenía.
    expect(texto).toMatch(/destino\.focus\(\{ preventScroll: true \}\)/)
  })
})

describe('el apagador global de la hoja sigue vivo (veto de deriva)', () => {
  it('globals.css conserva el bloque prefers-reduced-motion universal', () => {
    const css = leer('src/app/globals.css')
    // El bloque que apaga animación/transición para TODO el árbol: si alguien
    // lo borra confiando en que «los componentes ya lo respetan», los
    // componentes sólo cubren el scroll de JavaScript — no las animaciones CSS.
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{/)
    expect(css).toMatch(/animation-duration: 0\.01ms !important/)
    expect(css).toMatch(/transition-duration: 0\.01ms !important/)
  })
})
