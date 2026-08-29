/**
 * GOLDEN — el color con el que se codifica la gravedad clínica se lee en los
 * DOS temas.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Los paneles clínicos pintaban la gravedad con literales de la paleta de
 * Tailwind en vez de con los tokens semánticos. Un literal no cambia con el
 * tema, así que cada uno se leía en uno y desaparecía en el otro. Medido con
 * la fórmula de luminancia relativa de WCAG 2.1 sobre `--s1`, que es la
 * superficie de esos paneles:
 *
 *   · `#f87171` (rojo)   → 6,61 en oscuro · **2,77** en claro
 *   · `#f59e0b` (ámbar)  → 8,52 en oscuro · **2,15** en claro
 *   · `#22c55e` (verde)  → 8,03 en oscuro · **2,28** en claro
 *   · `#dc2626` (rojo)   → **3,79** en oscuro · 4,83 en claro
 *
 * El mínimo de WCAG 2.2 AA para texto normal es 4,5.
 *
 * Y la jerarquía quedaba invertida donde más importa: en `ValoracionInmuno`,
 * `SEV_COLOR.alta` —la severidad más alta— era el ÚNICO de los tres que
 * reprobaba en tema oscuro. En `GraficaLab`, el `#dc2626` es justo el color
 * que marca un valor de laboratorio **crítico o fuera de rango**: el número
 * que existe para saltar a la vista era el peor leído del panel.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Barriendo `color:` con literal hexadecimal en `src/app` y `src/components`
 * y calculando su contraste contra `--s1` de cada tema. Salieron 140 usos;
 * éstos son los de los paneles clínicos.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Los tokens ya existían y estaban medidos para los dos temas (`--red`,
 * `--amber`, `--green`, `--blue`, `--purple`, `--nexus`), y los propios
 * archivos los usaban a dos renglones de distancia. No era una decisión de
 * diseño: era deriva — la que `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md`
 * mide como «el sistema existe y la aplicación lo esquiva».
 *
 * El tema claro es el que enciende la luz del consultorio, así que la mitad
 * peor leída era la que más se usa.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - Es un barrido de FUENTE. Comprueba que no quede un literal donde tiene que
 *   haber un token; no mide el árbol pintado. El contraste real en navegador
 *   lo miden los arneses axe de `scripts/design/`.
 * - Sólo mira los paneles clínicos de esta lista. El resto de la deuda de
 *   literales la cuenta el trinquete de diseño, que sólo puede bajar.
 * - No dice nada de los literales dentro del HTML que `ValoracionInmuno`
 *   exporta a Word: ahí NO puede haber tokens, porque el documento sale del
 *   navegador y viaja solo. Se declaran abajo como excepción con su motivo.
 * - No vigila el fondo. Un token de texto sobre un fondo equivocado sigue
 *   siendo ilegible.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Los paneles que codifican gravedad clínica con color. Si nace otro, va aquí:
 * un panel que no esté en la lista no se vigila, y eso es lo que hay que
 * declarar (regla 5 de seguridad clínica — señalar de menos, no de más).
 */
const PANELES = [
  // ── Pantallas del día del médico ────────────────────────────────────────
  // Mismo defecto, misma causa: prioridad de la lista de espera, stock bajo y
  // caducado de farmacia, dinero que sube o baja, aviso urgente de la caja de
  // herramientas y el color con el que se distingue a un médico de otro.
  'src/app/(dashboard)/lista-espera/page.tsx',
  'src/app/(dashboard)/farmacia/page.tsx',
  'src/app/(dashboard)/finanzas/page.tsx',
  'src/components/CobrarModal.tsx',
  'src/components/Herramientas.tsx',
  'src/components/DoctorFilter.tsx',
  // ── Paneles clínicos ────────────────────────────────────────────────────
  'src/components/PanelCardiometabolico.tsx',
  'src/components/PanelCirugia.tsx',
  'src/components/PanelGineco.tsx',
  'src/components/PanelPediatria.tsx',
  'src/components/PanelPreventivo.tsx',
  'src/components/PreopAssessment.tsx',
  'src/components/pacientes/ValoracionInmuno.tsx',
  'src/components/laboratorio/GraficaLab.tsx',
]

/**
 * Literales que SÍ pueden quedarse, con su razón. Sólo puede encoger.
 *
 * El HTML que se exporta a Word sale del navegador y se abre en un programa
 * que no conoce `globals.css`: un `var(--red)` ahí se pintaría negro. El
 * documento impreso es papel blanco en los dos temas, así que su tinta es un
 * literal a propósito.
 */
const EXCEPCIONES: Record<string, { hex: string[]; porque: string }> = {
  'src/components/pacientes/ValoracionInmuno.tsx': {
    hex: ['#15201d', '#1a6b52', '#557', '#667', '#778', '#dde'],
    porque: 'HTML exportado a Word: viaja fuera del navegador y no lleva globals.css.',
  },
  'src/components/PanelCardiometabolico.tsx': {
    hex: ['#111', '#333', '#444', '#555', '#ccc'],
    porque: 'Hoja de estilo de la HOJA IMPRESA para el paciente: es papel blanco en los dos temas, y la ventana de impresión no hereda globals.css.',
  },
}

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

/**
 * El archivo SIN comentarios.
 *
 * Los comentarios de este repositorio CITAN el literal que arreglaron —es su
 * trabajo, ahí está la evidencia del defecto— así que un guardián que busque
 * el literal en el texto completo se dispara con la explicación de por qué ya
 * no está. Se mira lo que se EJECUTA; lo que se explica se deja explicar.
 */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

// ── Contraste WCAG 2.1, para que la prueba MIDA en vez de opinar ────────────
const canal = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
const luminancia = (hex: string) => {
  const n = hex.replace('#', '')
  const [r, g, b] = [n.slice(0, 2), n.slice(2, 4), n.slice(4, 6)].map(h => parseInt(h, 16))
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}
const contraste = (a: string, b: string) => {
  const [hi, lo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** `--s1` de cada tema: la superficie sobre la que viven estos paneles. */
const S1_OSCURO = '#131518'
const S1_CLARO = '#FFFFFF'

describe('la prueba puede fallar: la fórmula de contraste da lo que ya está medido', () => {
  it('reproduce los números del comentario de globals.css', () => {
    // Si esto se rompe, lo de abajo no significa nada.
    expect(contraste('#f87171', S1_CLARO)).toBeLessThan(3)
    expect(contraste('#f87171', S1_OSCURO)).toBeGreaterThan(6)
    expect(contraste('#dc2626', S1_OSCURO)).toBeLessThan(4.5)
    // Y los tokens que los sustituyen pasan en los dos temas.
    expect(contraste('#E66464', S1_OSCURO)).toBeGreaterThanOrEqual(4.5)  // --red oscuro
    expect(contraste('#B91C1C', S1_CLARO)).toBeGreaterThanOrEqual(4.5)   // --red claro
    expect(contraste('#F472B6', S1_OSCURO)).toBeGreaterThanOrEqual(4.5)  // --rosa oscuro
    expect(contraste('#BE185D', S1_CLARO)).toBeGreaterThanOrEqual(4.5)   // --rosa claro
  })
})

describe('ningún panel clínico codifica gravedad con un color de un solo tema', () => {
  for (const rel of PANELES) {
    it(rel.replace('src/components/', ''), () => {
      const src = sinComentarios(leer(rel))
      const permitidos = new Set((EXCEPCIONES[rel]?.hex ?? []).map(h => h.toLowerCase()))
      const encontrados = src.split('\n')
        // Ver abajo: `--nexus-solido` es el relleno cuyo contrato ES el blanco.
        .filter(l => !l.includes('nexus-solido'))
        .flatMap(l => [...l.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0]))
        .filter(h => !permitidos.has(h.toLowerCase()))
      expect(
        encontrados,
        `Literal de color en ${rel}. Usa el token semántico (--red/--amber/--green/--blue/--purple/--rosa/--nexus): un literal se lee en un tema y desaparece en el otro.`,
      ).toEqual([])
    })
  }

  it('la lista de excepciones sigue siendo la que se declaró, y sólo esa', () => {
    // Prueba al revés: si alguien mete un literal nuevo colándolo en las
    // excepciones, este caso lo enseña.
    expect(Object.keys(EXCEPCIONES).sort()).toEqual([
      'src/components/PanelCardiometabolico.tsx',
      'src/components/pacientes/ValoracionInmuno.tsx',
    ])
    expect(EXCEPCIONES['src/components/pacientes/ValoracionInmuno.tsx'].hex).toHaveLength(6)
    expect(EXCEPCIONES['src/components/PanelCardiometabolico.tsx'].hex).toHaveLength(5)
    // Toda excepción trae escrito su porqué: sin motivo no es una excepción,
    // es un literal que alguien no quiso arreglar.
    for (const e of Object.values(EXCEPCIONES)) expect(e.porque.length).toBeGreaterThan(40)
  })
})

describe('el texto que va ENCIMA de un relleno semántico usa --sobre-aviso', () => {
  /**
   * `--sobre-aviso` es tinta en oscuro (los rellenos son brillantes) y blanco
   * en claro (los rellenos son profundos). Un `#fff` fijo encima de
   * `var(--green)` funcionaba en claro y se hundía a 1,9:1 en oscuro; un
   * `#000` fijo, al revés.
   */
  for (const rel of PANELES) {
    it(rel.replace('src/components/', ''), () => {
      const src = sinComentarios(leer(rel))
      const blancosONegros = src.split('\n')
        /**
         * `--nexus-solido` es el ÚNICO relleno cuyo contrato es «blanco
         * encima»: está medido así en los dos temas (5,16:1 oscuro · 7,00:1
         * claro, `globals.css`). Ahí el `#fff` no es deriva, es el token
         * funcionando.
         */
        .filter(l => !l.includes('nexus-solido'))
        .flatMap(l => [...l.matchAll(/color:\s*[^,;\n]*'#(?:fff|ffffff|000|000000)'/gi)].map(m => m[0]))
      expect(blancosONegros, `Primer plano fijo sobre relleno semántico en ${rel}`).toEqual([])
    })
  }
})
