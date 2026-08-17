/**
 * Las transiciones INLINE de los componentes TSX hablan los tokens de
 * movimiento — y los dos instrumentos quedan DECLARADOS, no migrados.
 * V15-MOTION-001 (§43 orden 14, §18 paso 8), tercera rebanada.
 *
 * QUÉ FALLABA: tras la primera rebanada (globals.css tokenizada), quedaban
 * 28 declaraciones `transition:` inline en 21 archivos TSX escribiendo su
 * duración a mano (90ms, .1s, .12s, 0.15s, 0.2s, 0.25s, .3s conviviendo sin
 * criterio) y curvas sueltas (`ease`, default). El sistema tenía una voz en
 * la hoja y veinte dialectos en los componentes.
 *
 * CÓMO SE DESCUBRIÓ: el inventario por grep de la primera rebanada de
 * MOTION-001 (anotado en el estado V15 con la lista completa de archivos),
 * hecho justo para que esta rebanada no tuviera que redescubrirlo.
 *
 * CAUSA RAÍZ: `style` inline no puede heredar una clase, así que cada
 * componente copió la duración de la vecina — el mismo defecto que la hoja
 * tenía antes de la primera rebanada, repetido archivo por archivo. Los
 * custom properties SÍ se resuelven en style inline (se computan en el
 * elemento), así que la migración era posible desde el día uno.
 *
 * LA REGLA QUE LO HACE SEGURO: toda `transition:` inline de src/ habla
 * `var(--mov-*)` con `var(--mov-curva)`, o es `none` (opt-out explícito,
 * p. ej. el papel imprimible de /nota), o está en la lista de INSTRUMENTOS
 * declarados: los medidores de nivel de micrófono (MientrasHablas 90ms,
 * consulta 60ms) siguen la señal EN VIVO con `linear` — una curva con easing
 * o un token más lento los haría MENTIR sobre lo que capta el micrófono
 * (regla 3 de seguridad clínica dicha en movimiento: el instrumento enseña
 * la verdad, no una versión suavizada). La lista es EXACTA (archivo + valor):
 * si alguien «normaliza» un instrumento al token, este guardián lo caza.
 *
 * QUÉ NO CUBRE: el valor pintado en pantalla (lo mide el arnés
 * `scripts/design/medir-motion-inline-v15.mjs` con getComputedStyle en
 * navegador real, incluido que el apagador !important de §24 le GANA al
 * style inline bajo prefers-reduced-motion); las `animation`/`@keyframes`;
 * y transiciones montadas por JavaScript fuera de un atributo style.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = join(process.cwd(), 'src')

function archivosTsx(dir: string): string[] {
  const salida: string[] = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) salida.push(...archivosTsx(ruta))
    else if (nombre.endsWith('.tsx')) salida.push(ruta)
  }
  return salida
}

/** INSTRUMENTOS: siguen una señal en vivo; el valor es EXACTO a propósito. */
const INSTRUMENTOS: ReadonlyArray<{ archivo: string; valor: string }> = [
  { archivo: 'src/components/MientrasHablas.tsx', valor: "'width 90ms linear'" },
  {
    archivo: 'src/app/(dashboard)/consulta/[patientId]/page.tsx',
    valor: "'width 60ms linear, background 200ms'",
  },
]

type Sitio = { archivo: string; linea: number; texto: string }

function sitiosDeTransicion(): Sitio[] {
  const sitios: Sitio[] = []
  for (const ruta of archivosTsx(RAIZ)) {
    const lineas = readFileSync(ruta, 'utf8').split('\n')
    lineas.forEach((texto, i) => {
      // `transition:` literal — no captura textTransform ni transitionDelay.
      if (/[^a-zA-Z-]transition:|^transition:/.test(texto) && !/^\s*(\/\/|\*|\/\*)/.test(texto)) {
        sitios.push({ archivo: ruta.slice(process.cwd().length + 1), linea: i + 1, texto })
      }
    })
  }
  return sitios
}

describe('toda transición inline habla los tokens (o está declarada)', () => {
  const sitios = sitiosDeTransicion()

  it('el barrido encuentra sitios (si esto da 0, el regex se rompió, no el producto)', () => {
    expect(sitios.length).toBeGreaterThan(20)
  })

  it('cada sitio: var(--mov-*) con curva, `none`, o instrumento declarado', () => {
    const fuera: string[] = []
    for (const s of sitios) {
      const esInstrumento = INSTRUMENTOS.some(
        (inst) => s.archivo === inst.archivo && s.texto.includes(`transition: ${inst.valor}`),
      )
      if (esInstrumento) continue
      const esNone = /transition:\s*(none|'none'|"none")/.test(s.texto)
      if (esNone) continue
      const hablaTokens =
        s.texto.includes('var(--mov-') && s.texto.includes('var(--mov-curva)')
      if (!hablaTokens) fuera.push(`${s.archivo}:${s.linea} → ${s.texto.trim()}`)
    }
    expect(fuera, `transiciones inline sin token:\n${fuera.join('\n')}`).toEqual([])
  })

  it('ninguna transición inline con token trae además una duración a mano', () => {
    const mezcladas = sitios.filter(
      (s) => s.texto.includes('var(--mov-') && /\d+m?s\b/.test(s.texto),
    )
    expect(
      mezcladas.map((s) => `${s.archivo}:${s.linea}`),
      'un sitio no puede hablar token Y milisegundos a mano a la vez',
    ).toEqual([])
  })
})

describe('los instrumentos quedan declarados, exactos y con su razón escrita', () => {
  for (const inst of INSTRUMENTOS) {
    it(`${inst.archivo} conserva su transición de instrumento ${inst.valor}`, () => {
      const fuente = readFileSync(join(process.cwd(), inst.archivo), 'utf8')
      expect(fuente).toContain(`transition: ${inst.valor}`)
      // La decisión vive JUNTO al código, no sólo en el estado del programa.
      expect(fuente).toContain('INSTRUMENTO, no interfaz')
      expect(fuente).toContain('No migrar a var(--mov-*)')
    })
  }

  it('la lista de instrumentos no crece en silencio (2 medidores de micrófono)', () => {
    expect(INSTRUMENTOS).toHaveLength(2)
  })
})

describe('representantes de cada papel (el mapa de la rebanada, congelado)', () => {
  const lee = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8')

  it('feedback de control → rapido (Sidebar, BottomNav color, chevrones)', () => {
    expect(lee('src/components/Sidebar.tsx')).toContain(
      "transition: 'all var(--mov-rapido) var(--mov-curva)'",
    )
    expect(lee('src/components/BottomNav.tsx')).toContain(
      "transition: 'color var(--mov-rapido) var(--mov-curva)'",
    )
    expect(lee('src/components/SelloProcedencia.tsx')).toContain(
      "transition: 'transform var(--mov-rapido) var(--mov-curva)'",
    )
  })

  it('fundido de estado → normal (velo del cajón, atenuado del ícono)', () => {
    expect(lee('src/app/(dashboard)/layout.tsx')).toContain(
      "transition: 'opacity var(--mov-normal) var(--mov-curva)'",
    )
    expect(lee('src/components/BottomNav.tsx')).toContain(
      "transition: 'opacity var(--mov-normal) var(--mov-curva)'",
    )
  })

  it('movimiento espacial → lento (el cajón móvil desliza, las barras llenan)', () => {
    expect(lee('src/app/(dashboard)/layout.tsx')).toContain(
      "transition: 'transform var(--mov-lento) var(--mov-curva)'",
    )
    expect(lee('src/app/superadmin/page.tsx')).toContain(
      "transition: 'width var(--mov-lento) var(--mov-curva)'",
    )
  })
})
