/**
 * TRINQUETE DE COLOR — el rojo y el ámbar crudos no vuelven a crecer.
 *
 * ── QUÉ ROMPÍA ───────────────────────────────────────────────────────────────
 *
 * Los colores clínicos estaban escritos a mano en 55 pantallas: cuatro rojos y
 * ocho ámbares distintos. El problema no es la variedad, es que **un hexadecimal
 * no cambia de tema**: `#f87171` es el rosa pensado PARA FONDO OSCURO y sobre el
 * crema del tema claro da 2.5:1 — por debajo del 4.5:1 de AA. Y no es
 * decoración: es el color del mensaje de error bajo un campo de dosis, del
 * atraso en el MAR y de las alertas clínicas.
 *
 * `--red` y `--amber` están medidos en los dos temas (ver `globals.css`).
 *
 * ── POR QUÉ UN TECHO Y NO UN CERO ────────────────────────────────────────────
 *
 * Igual que el trinquete de lint: el saneamiento es progresivo y lo que importa
 * es que **no entre deuda nueva**. Cuando el número baje, se baja el techo.
 *
 * ── LO QUE NO CUENTA: EL PAPEL ───────────────────────────────────────────────
 *
 * Las superficies que se IMPRIMEN conservan el hexadecimal a propósito: la
 * receta se rasteriza con html2canvas sobre un clon del nodo, y una variable que
 * no resuelva ahí deja sin color justo lo que existe para verse. Ver el
 * comentario de `RecetaDocumento.tsx`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Los colores crudos que tienen token equivalente.
 *
 * Empezó siendo sólo rojos y ámbares —los de las alertas— y ése era el hueco:
 * el trinquete vigilaba el color del error y dejaba pasar el del acierto.
 * «Verificada por farmacia» en `#0d9488`, los estados en verde, los enlaces en
 * azul: 97 usos que sobre el crema del tema claro se quedan igual de flojos que
 * el rosa que motivó todo esto. Todos tenían ya su token en los dos temas.
 */
const CRUDOS = /#(f87171|ef4444|dc2626|b91c1c|fbbf24|f59e0b|d97706|b45309|92400e|16a34a|22c55e|4ade80|1ba34d|15803d|0d9488|14b8a6|2dd4bf|0f766e|3b82f6|60a5fa|2563eb|1d4ed8|a78bfa|7c3aed|8b5cf6|6d28d9)\b/gi

/**
 * PALETAS CATEGÓRICAS — el literal también es lo correcto aquí, y por otra razón.
 *
 * Un color semántico DICE algo (esto está mal, esto está bien) y por eso tiene
 * que seguir al tema y cumplir contraste. Una paleta categórica sólo tiene que
 * DISTINGUIR: las trece etiquetas de paciente, o los colores de avatar, existen
 * para no confundirse entre sí.
 *
 * Migrarlas sería peor que dejarlas: de los trece colores de etiqueta sólo cinco
 * tienen token, así que «frecuente» pasaría a ser el mismo verde que «éxito» y
 * quedaría una paleta donde tres etiquetas se ven iguales. Distinguir es su
 * función; perderla es romperlas.
 */
const PALETAS = [
  join('lib', 'avatar-color.ts'),
  join('types', 'index.ts'),
]

/** Se imprimen o se rasterizan: ahí el literal es lo correcto. */
const PAPEL = [
  'RecetaDocumento.tsx',
  /**
   * Generan HTML para Word (.doc). Una variable CSS **no existe** dentro de un
   * documento de Word: el token no resuelve y el «[FALTA CÉDULA PROFESIONAL]»
   * saldría sin color justo en el aviso que existe para verse. Mismo criterio
   * que la receta rasterizada.
   */
  'nota-word.ts',
  'receta-word.ts',
  join('receta', '[patientId]', '[notaId]', 'page.tsx'),
  join('orden', '[patientId]', '[notaId]', 'page.tsx'),
  join('nota', '[patientId]', '[notaId]', 'page.tsx'),
  join('nota', '[patientId]', 'page.tsx'),
]

/**
 * Techo actual de usos en PRIMER PLANO (`color:` / `color=`).
 *
 * Bajar este número al migrar más pantallas. Subirlo es introducir un color que
 * no cambia de tema — y eso es lo que este trinquete existe para impedir.
 */
const TECHO_PRIMER_PLANO = 0

/**
 * Techo de usos en FONDO Y BORDE (`rgba(...)` con los mismos colores).
 *
 * Estos no rompen el contraste del texto —son fondos al 8-12 %— pero comparten
 * la raíz: un literal no cambia de tema, así que el aviso rojo que en oscuro se
 * ve como una capa tenue, en claro se ve exactamente igual de tenue sobre un
 * fondo crema, y deja de leerse como aviso. Migrados a
 * `color-mix(in srgb, var(--red) N%, transparent)`, que sí sigue el tema.
 *
 * Cero, y se queda en cero: ya no hay ninguno fuera del papel.
 */
const TECHO_FONDO = 0

/**
 * ═══ EL HUECO QUE ESTE TRINQUETE TENÍA, Y SU MEDIDA REAL ═══
 *
 * Los tres controles de arriba miran FORMAS concretas: `color:` seguido de un
 * literal, un ternario que asigna a algo llamado `color`, un sufijo de alfa.
 * Todos daban CERO — y con 265 colores crudos vivos en el repositorio.
 *
 * El caso que lo destapó: `ToastContext` declaraba
 *
 *     const COLORS: Record<ToastType, string> = {
 *       success: '#22c55e', error: '#ef4444', info: '#3b82f6',
 *     }
 *
 * y lo usaba tres líneas más abajo como `color: COLORS[t.type]`. La clave no es
 * `color:`, es `success:`, así que el guardián no lo veía. Y no es una pantalla
 * suelta: es el acuse de TODA la aplicación — «Guardado», «No se pudo guardar».
 *
 * Un guardián que mira formas persigue la sintaxis de ayer. Éste mira el HECHO:
 * cualquier color de `CRUDOS` escrito a mano, esté en la forma que esté. Y
 * `CRUDOS` no es una lista arbitraria — son exactamente los colores que YA
 * tienen token en los dos temas, así que para todos ellos la respuesta es
 * siempre la misma: usa el token.
 *
 * ── LO QUE NO CUENTA, Y POR QUÉ ──────────────────────────────────────────────
 *
 * · `var(--red, #b91c1c)` — un respaldo dentro de `var()` es la práctica
 *   CORRECTA, no deuda: si el token existe gana el token, y si no existe el
 *   color no desaparece. Penalizarlo empujaría a quitar los respaldos.
 * · Los comentarios — este mismo archivo cita `#22c55e` para explicar el fallo.
 *   Una prueba que no distingue el código de su explicación acaba obligando a no
 *   explicar nada.
 * · `PAPEL` y `PALETAS`, con su razón escrita arriba.
 *
 * ── POR QUÉ 265 Y NO 0 ───────────────────────────────────────────────────────
 *
 * Migrar 265 usos en 57 pantallas de una sentada es un cambio visual enorme que
 * nadie puede revisar de verdad, y el riesgo de romper una alerta clínica es
 * real. Igual que el trinquete de lint: **la cifra sólo baja**. Lo que este
 * número impide desde hoy es que entre uno más.
 */
const TECHO_CRUDOS = 256

/**
 * `.tsx` **y** `.ts`.
 *
 * El trinquete sólo miraba las pantallas, y los colores de los SCORES vivían en
 * módulos de librería: `news2.ts` tenía `{ bajo: '#0d9488', medio: '#d97706',
 * alto: '#dc2626' }` a la vista de nadie. O sea que el color de la insignia de
 * deterioro —el que más falta hace que se lea— era invisible para el guardián
 * puesto justamente a vigilar eso.
 */
function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== '__tests__') fuentes(p, out); continue }
    if (e.endsWith('.tsx') || e.endsWith('.ts')) out.push(p)
  }
  return out
}

describe('trinquete de color', () => {
  const archivos = fuentes('src').filter(p => ![...PAPEL, ...PALETAS].some(x => p.endsWith(x)))

  it(`no hay más de ${TECHO_PRIMER_PLANO} colores crudos en primer plano`, () => {
    const pat = /color\s*[:=]\s*(['"])(#[0-9a-fA-F]{6})\1/g
    const culpables: string[] = []
    for (const p of archivos) {
      const s = readFileSync(p, 'utf8')
      for (const m of s.matchAll(pat)) {
        if (CRUDOS.test(m[2])) culpables.push(`${p} → ${m[2]}`)
        CRUDOS.lastIndex = 0
      }
    }
    expect(culpables, culpables.slice(0, 12).join('\n')).toHaveLength(TECHO_PRIMER_PLANO)
  })

  it(`no hay más de ${TECHO_FONDO} rgba crudos en fondo o borde`, () => {
    // Los mismos colores, escritos como rgba() para fondos y bordes.
    const pat = /rgba\(\s*(239\s*,\s*68\s*,\s*68|248\s*,\s*113\s*,\s*113|220\s*,\s*38\s*,\s*38|185\s*,\s*28\s*,\s*28|245\s*,\s*158\s*,\s*11|251\s*,\s*191\s*,\s*36|217\s*,\s*119\s*,\s*6|180\s*,\s*83\s*,\s*9|74\s*,\s*222\s*,\s*128|34\s*,\s*197\s*,\s*94|22\s*,\s*163\s*,\s*74)\s*,/g
    const culpables: string[] = []
    for (const p of archivos) {
      for (const m of readFileSync(p, 'utf8').matchAll(pat)) culpables.push(`${p} → rgba(${m[1]}…`)
    }
    expect(culpables, culpables.slice(0, 12).join('\n')).toHaveLength(TECHO_FONDO)
  })

  it('un color clínico no se escoge con un hexadecimal en un ternario', () => {
    /**
     * `const color = nivel === 'critica' ? '#dc2626' : …` no lo veía el patrón
     * `color:` de arriba, así que las alertas del apoyo a la decisión clínica
     * seguían con hexadecimales que no cambian de tema. Es el mismo fallo por
     * un hueco de sintaxis.
     */
    const pat = /(?:const|let)\s+\w*[cC]olor\w*\s*=\s*[^\n]*\?[^\n]*'(#[0-9a-fA-F]{6})'/g
    const culpables: string[] = []
    for (const p of archivos) {
      for (const m of readFileSync(p, 'utf8').matchAll(pat)) {
        if (CRUDOS.test(m[1])) culpables.push(`${p} → ${m[1]}`)
        CRUDOS.lastIndex = 0
      }
    }
    expect(culpables, culpables.join('\n')).toEqual([])
  })

  it('nadie le pega un sufijo de alfa a un color', () => {
    /**
     * EL FALLO QUE ESTE GUARDIÁN VIENE A IMPEDIR, Y QUE YO MISMO COMETÍ.
     *
     * `algo.color + '18'` funciona mientras `color` sea un hexadecimal. En
     * cuanto pasa a ser `var(--purple)` —que es a donde va toda esta
     * migración— produce `var(--purple)18`: CSS inválido, que el navegador
     * descarta EN SILENCIO. El fondo del badge simplemente desaparece y nada
     * se queja.
     *
     * v913 convirtió esos mapas a tokens y dejó dos concatenaciones vivas. Lo
     * correcto es `color-mix`, que sí acepta una variable.
     */
    /**
     * Las DOS formas de escribirlo. La primera versión de esta prueba sólo
     * miraba `color + '18'`, y el mismo fallo escrito como plantilla
     * —`${color}55`— seguía pasando: había once, uno de ellos en el panel
     * cardiometabólico, roto desde v872 sin que nadie lo notara, porque un
     * borde que no se pinta no se queja.
     */
    const pat = /\.?color\s*\+\s*'[0-9a-fA-F]{2}'|\$\{[A-Za-z_][\w.]*\}[0-9a-fA-F]{2}\b/gi
    const culpables: string[] = []
    for (const p of archivos) {
      for (const m of readFileSync(p, 'utf8').matchAll(pat)) culpables.push(`${p} → ${m[0]}`)
    }
    expect(culpables, culpables.join('\n')).toEqual([])
  })

  it(`no hay más de ${TECHO_CRUDOS} colores crudos, en la forma que sea`, () => {
    /**
     * El control ANCHO. Los tres de arriba siguen valiendo —fijan en CERO las
     * formas ya saneadas, y son los que dan el mensaje preciso—; éste es el que
     * no se puede esquivar cambiando de sintaxis.
     */
    const porArchivo: [string, number][] = []
    let total = 0
    for (const p of archivos) {
      const codigo = readFileSync(p, 'utf8')
        // La explicación no es deuda (ver arriba).
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
        // Un respaldo dentro de var() es lo correcto, no deuda.
        .replace(/var\(\s*--[\w-]+\s*,\s*#[0-9a-fA-F]{3,8}\s*\)/g, 'var(--x)')
      const n = (codigo.match(CRUDOS) ?? []).length
      CRUDOS.lastIndex = 0
      if (n) { porArchivo.push([p, n]); total += n }
    }
    const peores = porArchivo.sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([p, n]) => `  ${n}  ${p}`).join('\n')
    expect(total, `crudos: ${total} (techo ${TECHO_CRUDOS}). Los peores:\n${peores}`)
      .toBeLessThanOrEqual(TECHO_CRUDOS)
  })

  it('el control ancho NO pasa por vacío (si se rompe, todo lo demás sobra)', () => {
    /**
     * Un guardián que no encuentra archivos pasa en verde y no protege nada. Si
     * algún día el barrido deja de ver `src/`, esto se pone rojo antes de que el
     * techo empiece a mentir.
     */
    expect(archivos.length).toBeGreaterThan(200)
    expect(TECHO_CRUDOS).toBeGreaterThan(0)
    // Y el patrón tiene que casar de verdad contra un color conocido.
    expect(CRUDOS.test('#ef4444')).toBe(true)
    CRUDOS.lastIndex = 0
    expect(CRUDOS.test('#123456')).toBe(false)
    CRUDOS.lastIndex = 0
  })

  it('el acuse de TODA la app ya no usa hexadecimales', () => {
    /**
     * `ToastContext` es el caso que destapó el hueco: el color del «Guardado» y
     * del «No se pudo guardar» de la aplicación entera.
     */
    const toast = readFileSync(join('src', 'context', 'ToastContext.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    expect(toast).toContain("success: 'var(--green)'")
    expect(toast).toContain("error: 'var(--red)'")
    expect(toast).toContain("info: 'var(--blue)'")
    // Y el botón destructivo del confirm, que era el otro crudo del archivo.
    expect(toast).not.toContain("'#dc2626'")
  })

  it('al IMPRIMIR, los colores clínicos son los del tema claro', () => {
    /**
     * Un médico que trabaja en modo oscuro imprimía sus alertas con el rojo
     * pensado para fondo oscuro sobre papel blanco. En la hoja no se puede
     * corregir después, así que la regla de impresión fija los cuatro.
     */
    const css = readFileSync(join('src', 'app', 'globals.css'), 'utf8')
    const i = css.indexOf('@media print')
    const bloque = css.slice(i, i + 1200)
    for (const t of ['--red:', '--amber:', '--green:', '--blue:']) {
      expect(bloque, `falta ${t} en @media print`).toContain(t)
    }
  })

  it('los tokens siguen definidos en los DOS temas', () => {
    // Si alguien borra la definición de un tema, la migración se vuelve peor que
    // el problema: el color deja de existir en la mitad de las pantallas.
    const css = readFileSync(join('src', 'app', 'globals.css'), 'utf8')
    expect((css.match(/--red:\s*#/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect((css.match(/--amber:\s*#/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})
