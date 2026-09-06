/**
 * CADA CAMPO DICE CÓMO SE LLAMA, Y CADA PESTAÑA DICE QUE LO ES.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Panel de Lujo, 6-sep-2026. Cuatro hallazgos de la misma familia:
 *
 *   C-025   campos cuya única etiqueta era el `placeholder`: el buscador de la
 *           guía, el de dosificación de UCI, el autocompletado de CIE-10, el
 *           alta hospitalaria («Nombre completo», «Edad», «Teléfono»,
 *           «Alergias (o niega)») y los campos de dosis y vía del ingreso.
 *   ASM-025 en la pestaña de mensajes de WhatsApp, las etiquetas eran
 *           `<label className="t-caption">` **sin `htmlFor`** y los campos sin
 *           `id`: a la vista hay etiqueta, en el árbol de accesibilidad no.
 *   ZC-012  el panel de enfermería: doce selectores de Braden/Morse sin nombre,
 *           y el `<label>` de ingresos/egresos sin asociar.
 *   C-026   `ui/Tabs` pintaba pestañas como botones sueltos: sin
 *           `role="tablist"`, sin `role="tab"`, sin `aria-selected`.
 *   D-006   el mínimo táctil de 44 px llegaba de alto pero no de ancho a los
 *           botones que sólo llevan un icono.
 *
 * ── POR QUÉ EL PLACEHOLDER NO ES UNA ETIQUETA ───────────────────────────────
 *
 * Porque **desaparece en cuanto se escribe la primera letra**, justo cuando
 * hace falta saber qué es el campo. Y porque axe lo acepta
 * (`label` tiene salida por `non-empty-placeholder`), así que el hueco no salía
 * en ninguna medición automática: es un defecto que sólo se ve mirando.
 *
 * ── CÓMO SE ARREGLÓ, Y POR QUÉ ASÍ ──────────────────────────────────────────
 *
 * Donde la etiqueta es única y estática: `htmlFor` + `id`, que además hace que
 * tocar la palabra enfoque el campo — en el teléfono eso son toques que hoy se
 * pierden. Donde el control vive dentro de un `.map()` no puede haber un `id`
 * estable sin inventar uno por fila, así que el nombre va en `aria-label`, que
 * es una asociación igual de válida y no puede colisionar.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · No es axe. No mide contraste, ni foco visible, ni orden de tabulación real;
 *   comprueba el CONTRATO del archivo. Los arneses `arnes:*` sí miran el
 *   navegador, y no corren en esta suite porque necesitan emulador.
 * · El trinquete de campos sin nombre NO exige cero: exige que no suban. Lo que
 *   queda son controles sin etiqueta visible cercana de la que sacar el nombre
 *   (casillas dentro de su propio `<label>`, selectores de archivo, colores y
 *   deslizadores), y los de otras rebanadas.
 * · No comprueba que el nombre sea BUENO, sólo que exista. El caso «un ejemplo
 *   como nombre» (`aria-label="+52 614 123 4567"`) se cazó a mano y tiene su
 *   propio caso abajo para que no vuelva.
 * · `Tabs`: no se renderiza. Que las flechas muevan de verdad el foco sólo se
 *   comprueba en el navegador.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8')

describe('los campos que la auditoría nombró uno a uno', () => {
  const CASOS: [string, string, RegExp][] = [
    ['C-025 · buscador de la guía', 'src/app/(dashboard)/guia/page.tsx', /aria-label="Buscar en la guía"/],
    ['C-025 · buscador de dosificación UCI', 'src/app/(dashboard)/uci/dosificacion/page.tsx', /aria-label="Buscar fármaco o clase"/],
    ['C-025 · autocompletado CIE-10', 'src/components/Cie10Autocomplete.tsx', /aria-label=\{etiqueta \?\? 'Diagnóstico \(buscar en CIE-10\)'\}/],
    ['C-025 · alergias del ingreso', 'src/app/(dashboard)/hospitalizacion/page.tsx', /aria-label="Alergias \(o «niega»\)"/],
    ['C-025 · dosis del ingreso', 'src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx', /aria-label="Dosis \(ej\. 1 g\)"/],
    ['C-025 · vía del ingreso', 'src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx', /aria-label="Vía \(ej\. IV\)"/],
    ['ASM-025 · plantilla de WhatsApp', 'src/app/(dashboard)/configuracion/secciones-comunicacion.tsx', /aria-label="Nombre aprobado en Meta"/],
    ['ASM-025 · horas de silencio', 'src/app/(dashboard)/configuracion/secciones-comunicacion.tsx', /aria-label="Desde"[\s\S]*aria-label="Hasta"/],
    ['ZC-011 · buscador de herramientas', 'src/components/Herramientas.tsx', /aria-label="Buscar herramienta clínica"/],
  ]

  it.each(CASOS)('%s', (_n, archivo, patron) => {
    expect(leer(archivo)).toMatch(patron)
  })

  it('C-025 · el autocompletado de CIE-10 ACEPTA una etiqueta de fuera', () => {
    /*
     * El equipo rojo lo señaló: el componente no tenía ninguna prop de
     * etiqueta, así que sus dos llamadores no podían arreglarlo aunque
     * quisieran. Sin esta prop, el defecto sólo se puede tapar por dentro.
     */
    const src = leer('src/components/Cie10Autocomplete.tsx')
    expect(src).toMatch(/etiqueta\?: string/)
    expect(src).toMatch(/\{ value, onChange, placeholder, etiqueta, style \}/)
  })
})

describe('ZC-012 · el panel de enfermería', () => {
  const src = leer('src/components/hospital/PanelEnfermeria.tsx')

  it('ingresos y egresos tienen su etiqueta ASOCIADA, cada una a la suya', () => {
    expect(src).toMatch(/htmlFor="enf-ingresos">Ingresos \(mL\)<\/label><input id="enf-ingresos"/)
    expect(src).toMatch(/htmlFor="enf-egresos">Egresos \(mL\)<\/label><input id="enf-egresos"/)
  })

  it('los doce selectores de Braden y Morse se llaman por su ítem', () => {
    expect(src).toMatch(/aria-label=\{`Braden · \$\{it\.label\}`\}/)
    expect(src).toMatch(/aria-label=\{`Morse · \$\{it\.label\}`\}/)
  })

  it('el SBAR se llama por lo que es, no por su ayuda', () => {
    /* El placeholder «Situación · Antecedentes · Evaluación · Recomendación»
       es la AYUDA de cómo rellenarlo, no el nombre del campo. */
    expect(src).toMatch(/aria-label="Entrega de turno \(SBAR\)"/)
  })
})

describe('C-026 · las pestañas se anuncian como pestañas', () => {
  const src = leer('src/components/ui/Tabs.tsx')

  it('tiene el patrón completo, no la mitad', () => {
    expect(src).toMatch(/role="tablist"/)
    expect(src).toMatch(/role="tab"/)
    expect(src).toMatch(/aria-selected=\{activa\}/)
  })

  it('la lista tiene nombre', () => {
    expect(src).toMatch(/aria-label=\{etiqueta\}/)
  })

  it('una sola parada de tabulación para todo el grupo', () => {
    /* Sin esto, recorrer las 17 pestañas de Configuración a teclado cuesta 17
       pulsaciones antes de llegar al contenido. */
    expect(src).toMatch(/tabIndex=\{activa \? 0 : -1\}/)
  })

  it('las flechas y las teclas de extremo mueven entre pestañas', () => {
    for (const tecla of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      expect(src, tecla).toContain(`e.key === '${tecla}'`)
    }
  })

  it('`aria-controls` no se inventa', () => {
    /* Apuntar a un id que no existe es peor que no apuntar a nada: lo pone
       quien usa el componente, si tiene un panel con id. */
    expect(src).toMatch(/aria-controls=\{t\.panelId\}/)
    expect(src).toMatch(/panelId\?: string/)
  })
})

describe('D-006 · el objetivo táctil llega también de ancho', () => {
  const css = leer('src/app/globals.css')

  it('un botón que sólo lleva un icono mide 44 de ancho en puntero grueso', () => {
    expect(css).toMatch(/button:not\(\.mobile-topbar-btn\):has\(> svg:only-child\) \{ min-width: 44px !important; \}/)
  })

  it('y sigue viviendo dentro del bloque de puntero grueso', () => {
    /* En ratón no aplica: un botón de icono de 32 px con puntero fino no es un
       problema, y engordarlos todos deformaría filas que hoy están bien. */
    const bloque = css.slice(css.indexOf('@media (pointer: coarse)'))
    expect(bloque.indexOf(':has(> svg:only-child)')).toBeGreaterThan(-1)
    expect(bloque.indexOf(':has(> svg:only-child)')).toBeLessThan(bloque.indexOf('@media', 1))
  })
})

/* ════════════════════════════════════════════════════════════════════════ */

/**
 * EL TRINQUETE DE CAMPOS SIN NOMBRE.
 *
 * Cuenta los controles de formulario sin ninguna forma de nombre en las
 * pantallas de esta rebanada. Sólo puede bajar. Se prueba al revés por
 * construcción: un campo nuevo sin etiqueta sube el número y esto se pone rojo.
 */
const SUPERFICIES = [
  'src/app/(dashboard)/uci',
  'src/app/(dashboard)/hospitalizacion',
  'src/app/(dashboard)/configuracion',
  'src/app/(dashboard)/farmacia',
  'src/app/(dashboard)/antibiograma',
  'src/app/(dashboard)/consultor',
  'src/app/(dashboard)/guia',
  'src/components/hospital',
]

/** Medido el 6-sep-2026, después de reparar C-025, ASM-025, ZC-012 y D-004. */
const TECHO_SIN_NOMBRE = 81

function tsx(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n)
    if (statSync(r).isDirectory()) tsx(r, acc)
    else if (n.endsWith('.tsx')) acc.push(r)
  }
  return acc
}

describe('trinquete de campos sin nombre', () => {
  const sinNombre: { archivo: string; n: number }[] = []
  for (const base of SUPERFICIES) {
    for (const f of tsx(join(RAIZ, base))) {
      const src = readFileSync(f, 'utf8')
      let n = 0
      const re = /<(input|select|textarea)\b([\s\S]*?)(\/>|>)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        const attrs = m[2]
        if (/aria-label|aria-labelledby|\bid=\{|\bid="/.test(attrs)) continue
        if (/type=["']hidden["']/.test(attrs)) continue
        n++
      }
      if (n) sinNombre.push({ archivo: f.replace(RAIZ + '/', ''), n })
    }
  }
  const total = sinNombre.reduce((s, x) => s + x.n, 0)

  it(`no sube de ${TECHO_SIN_NOMBRE}`, () => {
    expect(
      total,
      `campos sin nombre por archivo:\n${sinNombre.map(x => `  ${x.n}  ${x.archivo}`).join('\n')}`,
    ).toBeLessThanOrEqual(TECHO_SIN_NOMBRE)
  })
})

describe('un ejemplo no es un nombre', () => {
  /**
   * AL REVÉS: esto se escribió porque el arreglo automático lo hizo mal.
   *
   * El primer paso del arreglo copió el `placeholder` al `aria-label`, y en seis
   * campos el placeholder era un EJEMPLO («+52 614 123 4567», «123456»,
   * «12345678», «p. ej. meropenem», «vacío = no documentado»). Un nombre así es
   * peor que ninguno: el lector de pantalla anuncia un número de teléfono
   * inventado donde debería decir de qué es el campo. Se corrigieron a mano y
   * esto vigila que no vuelvan.
   */
  const SOSPECHOSOS = /aria-label="(\+?\d[\d\s]{4,}|p\. ej\.[^"]*|vacío = [^"]*|no se acepta [^"]*|https?:[^"]*|\$ MXN)"/

  it.each(SUPERFICIES)('%s no usa un ejemplo como nombre', (base) => {
    const malos: string[] = []
    for (const f of tsx(join(RAIZ, base))) {
      const m = SOSPECHOSOS.exec(readFileSync(f, 'utf8'))
      if (m) malos.push(`${f.replace(RAIZ + '/', '')}: ${m[0]}`)
    }
    expect(malos).toEqual([])
  })
})
