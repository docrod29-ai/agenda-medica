/**
 * CONTRASTE WCAG — motor determinista.
 *
 * ── POR QUÉ ESTO ES UN MOTOR Y NO UN COMENTARIO ─────────────────────────────
 *
 * `globals.css` lleva meses documentando cocientes de contraste **calculados a
 * mano**:
 *
 *     red #E66464 → 4.61 · green #1BA34D → 4.63 · purple #A375F2 → 4.62
 *
 * Están bien calculados. Pero un número escrito a mano dentro de un comentario
 * es exactamente la clase de dato que este repositorio ya vio pudrirse tres
 * veces (REG-241): **vale el día que se escribe**. Cambiar un token es una línea;
 * recalcular seis cocientes a mano es un rato — así que no se hace, y el
 * comentario sigue afirmando un número que ya no es cierto, con toda la
 * autoridad de estar escrito en el CSS.
 *
 * Aquí la aritmética se ejecuta. Es la misma regla que gobierna lo clínico
 * (`.claude/rules/clinical-safety.md` §2): **el cálculo corre en un motor
 * determinista con pruebas, no lo estima nadie.** Que el dato sea de diseño y no
 * de dosis no cambia el argumento: un texto que no se lee es un dato que no
 * llega.
 *
 * ── LA FÓRMULA ES LA DE LA NORMA, LITERAL ───────────────────────────────────
 *
 * WCAG 2.1, definición de *relative luminance* y de *contrast ratio*:
 *
 *     c   = canal / 255
 *     c'  = c/12.92                  si c ≤ 0.03928
 *     c'  = ((c + 0.055)/1.055)^2.4  si no
 *     L   = 0.2126·R' + 0.7152·G' + 0.0722·B'
 *     ratio = (L_claro + 0.05) / (L_oscuro + 0.05)
 *
 * Los umbrales: **4.5** para texto normal (AA), **3.0** para texto grande
 * (≥ 24 px, o ≥ 18.66 px en negrita) y para componentes de interfaz (AA 2.1
 * §1.4.11).
 *
 * ── ALFA: LO QUE MÁS SE EQUIVOCA A OJO ──────────────────────────────────────
 *
 * Media paleta de este producto son `rgba(…)` translúcidos —bordes, fondos de
 * insignia— y el contraste de un color translúcido **no existe por sí solo**:
 * depende de lo que tenga debajo. Por eso `componer()` es parte del motor y no
 * un detalle: sin ella, `--badge-red-b: rgba(239,68,68,0.16)` se mediría como si
 * fuera rojo puro y daría un número que ninguna pantalla enseña.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No mide la pantalla, mide un par de colores.** Que dos tokens contrasten
 *   no dice que se usen juntos, ni que el texto encima no esté sobre una imagen,
 *   ni que un `opacity` de un ancestro lo esté rebajando. Eso lo ve un navegador.
 * - **No sabe el tamaño de la letra**, así que quien llama decide si el umbral es
 *   4.5 o 3.0. Aplicar 3.0 «porque es un título» sin comprobar el tamaño es la
 *   forma barata de aprobarlo todo.
 * - No cubre `color-mix()`, `filter`, modos de fusión ni gradientes.
 * - No es un juicio de diseño: 4.5 es el suelo legal, no la meta.
 */

/** Un color ya resuelto: canales 0-255 y alfa 0-1. */
export interface Color {
  r: number
  g: number
  b: number
  a: number
}

/** AA para texto normal. */
export const AA_TEXTO = 4.5
/** AA para texto grande (≥24 px, o ≥18.66 px en negrita) y para componentes. */
export const AA_GRANDE = 3

/**
 * Acepta `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(…)` y `rgba(…)`.
 *
 * Devuelve `null` en vez de lanzar: quien parsea una hoja de estilos se
 * encuentra `var(--x)`, `currentColor` y `transparent`, y un motor que explota
 * ante lo que no entiende obliga a envolver cada llamada en un `try`.
 */
export function parsearColor(texto: string): Color | null {
  const s = texto.trim()

  if (s.startsWith('#')) {
    let h = s.slice(1)
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    if (!/^[0-9a-fA-F]+$/.test(h)) return null
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    }
  }

  const m = /^rgba?\(([^)]*)\)$/.exec(s)
  if (!m) return null
  const partes = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
  if (partes.length < 3 || partes.slice(0, 3).some(Number.isNaN)) return null
  const a = partes.length > 3 && !Number.isNaN(partes[3]) ? partes[3] : 1
  return { r: partes[0], g: partes[1], b: partes[2], a }
}

/**
 * Compone `encima` sobre `debajo` (alpha blending simple, sRGB).
 *
 * `debajo` se asume opaco: en este producto siempre hay un lienzo al fondo. Si
 * no lo fuera habría que componer la pila entera, y eso lo haría el llamador
 * encadenando.
 */
export function componer(encima: Color, debajo: Color): Color {
  const a = encima.a
  return {
    r: encima.r * a + debajo.r * (1 - a),
    g: encima.g * a + debajo.g * (1 - a),
    b: encima.b * a + debajo.b * (1 - a),
    a: 1,
  }
}

/** Luminancia relativa WCAG 2.1. Ignora el alfa: componer primero. */
export function luminanciaRelativa(c: Color): number {
  const canal = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b)
}

/**
 * Cociente de contraste entre un color de primer plano y un fondo.
 *
 * Si el primer plano es translúcido se compone sobre el fondo — que es lo que
 * hace el navegador y lo que casi nadie hace a mano.
 */
export function contraste(frente: Color, fondo: Color): number {
  const f = frente.a < 1 ? componer(frente, fondo) : frente
  const lf = luminanciaRelativa(f)
  const lb = luminanciaRelativa(fondo)
  const [claro, oscuro] = lf > lb ? [lf, lb] : [lb, lf]
  return (claro + 0.05) / (oscuro + 0.05)
}

/** Atajo para textos: acepta cadenas y devuelve `null` si alguna no se entiende. */
export function contrasteDeTexto(frente: string, fondo: string): number | null {
  const f = parsearColor(frente)
  const b = parsearColor(fondo)
  if (!f || !b) return null
  return contraste(f, b)
}

/** Redondeo a dos decimales, para comparar contra lo que dice un comentario. */
export function redondear(n: number): number {
  return Math.round(n * 100) / 100
}
