/**
 * NINGÚN DIÁLOGO SE ESCRIBE SU PROPIO TECLADO — y el que confirma un borrado,
 * menos que ninguno.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * Auditando el teclado del producto (unidad 99), preguntándole a cada capa que
 * tapa la pantalla por dónde le entra el foco. El diálogo de `confirm()` —el
 * que pregunta «¿Eliminar esta cita permanentemente?» y el que gobierna TODA
 * confirmación destructiva de la aplicación— tenía el teclado escrito a mano y
 * le faltaba la trampa de foco.
 *
 * Medido en Chromium, con el diálogo abierto:
 *
 *   · **cinco tabulaciones sacaban el foco del diálogo** y lo dejaban en el
 *     enlace «Encuentro» de la navegación de detrás — a pesar de su
 *     `aria-modal="true"`, que le promete a la tecnología de apoyo que lo de
 *     atrás está inerte;
 *   · y el Enter estaba atado a la VENTANA, así que pulsarlo sobre ese enlace,
 *     creyendo que se navegaba, **borraba la cita**: la lista pasó de 7 a 6.
 *
 * Una tecla apuntada a otra cosa ejecutando un acto destructivo e irreversible
 * es lo más caro que puede hacer justo el diálogo que existe para que nada se
 * borre sin querer.
 *
 * ── POR QUÉ NADIE LO VIO ────────────────────────────────────────────────────
 *
 * `ToastContext.tsx` vive en `src/context/`, y los dos barridos anteriores de
 * diálogos miraban `src/components` y `src/app`. Una carpeta fuera de la lista
 * es una carpeta sin vigilar, y no se nota: el barrido sale verde igual.
 *
 * El arnés de diálogos tampoco lo alcanzaba, y lo dice en su cabecera: «sólo
 * los diálogos que este guion sabe abrir… no estar aquí significa que NO se
 * vigilan». Estaba declarado. Declarado no es cubierto.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Toda capa que tapa la pantalla pasa por uno de los DOS teclados canónicos:
 *
 *   · `useDialogoDeTeclado` — las cinco cosas de un diálogo modal: Escape,
 *     trampa de foco, foco inicial, scroll bloqueado y foco devuelto.
 *   · `useCerrarConEscape` — lo que necesita un menú o un desplegable, que no
 *     debe atrapar el foco pero sí debe poder cerrarse sin ratón.
 *
 * `<Modal>` cuenta como el primero: es quien lo usa por dentro.
 *
 * Y el atajo de Enter vive DENTRO del diálogo, no en la ventana, y cede ante
 * cualquier control que quiera esa tecla. Sin esa cesión, pulsar Enter sobre
 * «Cancelar» dispara las dos cosas a la vez y gana la destructiva: medido al
 * revés, la agenda pasó de 8 citas a 7 mientras el médico cancelaba.
 *
 * Probado al revés en el navegador, no sólo aquí: quitando el gancho, 38 de 40
 * tabulaciones se van fuera, el foco arranca en «Eliminar» y Escape no cierra;
 * quitando la cesión, Enter sobre «Cancelar» borra la cita.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide el foco**: eso lo hacen los arneses de navegador
 *   (`la-confirmacion-no-se-dispara-sola`, `todo-dialogo-se-cierra-con-escape`).
 *   Un gancho llamado no es un foco atrapado.
 * · **No sabe de un diálogo que no se declare como tal.** Una capa sin
 *   `role="dialog"` y sin `inset: 0` pasa por aquí sin despeinarse; sigue
 *   habiendo que mirar el producto.
 * · No juzga el ORDEN del foco dentro del diálogo, ni lo que oye un lector de
 *   pantalla.
 * · No cubre `alert()`/`confirm()` del navegador — no se usan aquí, pero si
 *   alguien los metiera, este guardián no los vería.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(__dirname, '..', '..')

/** Todo el .tsx del producto. Incluye `src/context`, que es donde estaba el que faltaba. */
function fuentes(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== '__tests__') fuentes(p, acc) }
    else if (n.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

/**
 * Sin comentarios. Un `role="dialog"` citado en una nota que explica un arreglo
 * viejo no es un diálogo — y esa confusión ya dio dos falsos positivos al
 * medir esto a mano.
 */
const sinComentarios = (s: string) => s
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const ARCHIVOS = fuentes(join(RAIZ, 'src')).map(p => ({
  ruta: p.slice(RAIZ.length + 1),
  src: sinComentarios(readFileSync(p, 'utf8')),
}))

/**
 * Que lo LLAME, no que lo importe.
 *
 * La primera versión buscaba el nombre a secas, y la línea del `import` ya lo
 * contenía: un archivo que importara el gancho y no lo llamara pasaba en verde.
 * Se vio probando al revés — quitar la llamada dejaba el caso 2 contento.
 */
const tieneTecladoCanonico = (s: string) =>
  /useDialogoDeTeclado\s*\(|useCerrarConEscape\s*\(|<Modal[\s>]/.test(s)

describe('ningún diálogo se escribe su propio teclado', () => {
  it('1 · el barrido mira TODO src, `context` incluido', () => {
    // La carpeta que se quedó fuera de los dos barridos anteriores.
    expect(ARCHIVOS.some(a => a.ruta.startsWith('src/context/'))).toBe(true)
    expect(ARCHIVOS.some(a => a.ruta.startsWith('src/components/'))).toBe(true)
    expect(ARCHIVOS.some(a => a.ruta.startsWith('src/app/'))).toBe(true)
    expect(ARCHIVOS.length).toBeGreaterThan(50)
  })

  it('2 · todo role="dialog" pasa por un teclado canónico', () => {
    const sinTeclado = ARCHIVOS
      .filter(a => /role=["']dialog["']/.test(a.src) && !tieneTecladoCanonico(a.src))
      .map(a => a.ruta)
    expect(sinTeclado, `diálogos con el teclado a mano:\n  ${sinTeclado.join('\n  ')}`).toEqual([])
  })

  it('3 · toda capa que tapa la pantalla pasa por un teclado canónico', () => {
    // `position: fixed` + `inset: 0` es una capa sobre todo lo demás: o atrapa
    // el foco, o al menos se cierra sin ratón.
    const tapa = /position:\s*['"]fixed['"][\s\S]{0,120}?inset:\s*0|inset:\s*0[\s\S]{0,120}?position:\s*['"]fixed['"]/
    const sueltas = ARCHIVOS
      .filter(a => tapa.test(a.src) && !tieneTecladoCanonico(a.src))
      .map(a => a.ruta)
    expect(sueltas, `capas a pantalla completa sin teclado:\n  ${sueltas.join('\n  ')}`).toEqual([])
  })

  it('4 · el Enter de la confirmación vive dentro del diálogo, no en la ventana', () => {
    const s = readFileSync(join(RAIZ, 'src/context/ToastContext.tsx'), 'utf8')
    // Atarlo a la ventana es lo que dejaba borrar una cita desde un enlace de
    // detrás: el atajo llegaba aunque el foco estuviera en otro sitio.
    expect(s).not.toMatch(/window\.addEventListener\(\s*['"]keydown['"]/)
    expect(s).toContain('onKeyDown={alTeclearEnElDialogo}')
  })

  it('5 · y cede ante cualquier control que quiera esa tecla', () => {
    const s = readFileSync(join(RAIZ, 'src/context/ToastContext.tsx'), 'utf8')
    // Sin la cesión, Enter sobre «Cancelar» dispara las dos cosas y gana la
    // destructiva: medido al revés, 8 citas → 7 mientras el médico cancelaba.
    const i = s.indexOf('const alTeclearEnElDialogo')
    expect(i).toBeGreaterThan(-1)
    const cuerpo = s.slice(i, i + 500)
    expect(cuerpo).toContain("closest('button, a, input, textarea, select')")
    expect(cuerpo).toMatch(/if \([^)]*closest[^)]*\)\) return/)
  })

  it('6 · la confirmación destructiva usa el gancho canónico, no una copia', () => {
    const s = readFileSync(join(RAIZ, 'src/context/ToastContext.tsx'), 'utf8')
    expect(s).toContain('useDialogoDeTeclado(!!pending, cajaRef')
    // Y el gancho necesita la caja para poder atrapar el foco dentro de ella.
    expect(s).toContain('ref={cajaRef}')
  })

  it('7 · el gancho canónico sigue haciendo las cinco cosas', () => {
    // Si alguna se cayera de aquí, se caería en los 19 sitios a la vez.
    const h = readFileSync(join(RAIZ, 'src/hooks/useDialogoDeTeclado.ts'), 'utf8')
    expect(h).toContain("'Escape'")          // cierra
    expect(h).toMatch(/Tab/)                  // trampa de foco
    expect(h).toMatch(/\.focus\(\)/)          // foco inicial y devuelto
    expect(h).toMatch(/overflow/)             // scroll del cuerpo bloqueado
  })
})
