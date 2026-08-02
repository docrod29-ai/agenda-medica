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

/** Los rojos y ámbares que tienen token equivalente. */
const CRUDOS = /#(f87171|ef4444|dc2626|b91c1c|fbbf24|f59e0b|d97706|b45309|92400e)\b/gi

/** Se imprimen o se rasterizan: ahí el literal es lo correcto. */
const PAPEL = [
  'RecetaDocumento.tsx',
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

function tsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) tsx(p, out)
    else if (e.endsWith('.tsx')) out.push(p)
  }
  return out
}

describe('trinquete de color', () => {
  const archivos = tsx('src').filter(p => !PAPEL.some(x => p.endsWith(x)))

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

  it('los tokens siguen definidos en los DOS temas', () => {
    // Si alguien borra la definición de un tema, la migración se vuelve peor que
    // el problema: el color deja de existir en la mitad de las pantallas.
    const css = readFileSync(join('src', 'app', 'globals.css'), 'utf8')
    expect((css.match(/--red:\s*#/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect((css.match(/--amber:\s*#/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})
