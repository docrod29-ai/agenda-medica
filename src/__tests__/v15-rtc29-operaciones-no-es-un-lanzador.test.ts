/**
 * RTC-29 — `/operaciones` deja de ser un lanzador de aplicaciones.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La re-puntuación §29 del 14-ago-2026 dejó esta pantalla en **4.0/10**
 * (objetivo ≤1.0) con el diagnóstico dicho por su nombre: **es un lanzador de
 * aplicaciones**. Diecinueve azulejos idénticos —mismo borde, mismo radio,
 * mismo peso— bajo antetítulos en versalitas. Nada decía qué se hace primero,
 * qué es raro, qué está caliente. Y ninguno decía **para qué sirve**:
 * «Reactivación», «CRM», «Migración» son etiquetas que sólo entiende quien ya
 * sabe lo que hay detrás.
 *
 * §34 lo nombra sin rodeos: «un tablero donde todo pesa lo mismo no tiene
 * jerarquía: tiene inventario».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * RTC-09 ya había arreglado **qué** vive en esta pantalla (mató el grupo
 * «Clínico» y mandó la IA al paciente). La re-puntuación miró la captura nueva
 * y encontró que nadie había tocado **qué ES** esta pantalla: el defecto no
 * estaba en la lista de destinos sino en su forma.
 *
 * ── LA CAUSA RAÍZ, QUE ERA DE FORMA ─────────────────────────────────────────
 *
 * La rejilla de azulejos de 200px **no dejaba sitio** para decir para qué
 * sirve cada cosa: en ese ancho sólo cabe la etiqueta. La forma imponía el
 * contenido, y el contenido resultante era un menú de iconos.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Todo destino trae su `para`.** El patrón no se inventa aquí: es el
 *    mismo campo que `capacidades-del-paciente` declara desde RTC-09 y el que
 *    ya pintan las «Herramientas clínicas» de la consulta.
 * 2. **Filas, no azulejos**, con UN borde por grupo. Diecinueve cajas eran
 *    diecinueve fronteras compitiendo por atención.
 * 3. **La jerarquía es la cadencia, y es honesta.** Cada grupo dice cada
 *    cuánto se usa —un hecho del oficio— en vez de un contador de pendientes
 *    por área: contarlos costaría una lectura por área en una pantalla
 *    administrativa, y una cifra equivocada es peor que ninguna (§8.5: lo
 *    admin se calla durante el encuentro).
 * 4. **Nada se movió ni se borró**: los mismos destinos, el mismo filtro por
 *    modo y `rutaPermitida`, la misma salida por `salirSeguro`. Eso lo fija
 *    además el freeze de `v15-operaciones-configuracion-cromo-habla-el-sistema`.
 *
 * Probado al revés: quitando un `para` falla el caso 1; devolviendo la rejilla
 * de `minmax(200px…)` falla el 3; quitando `cadencia` falla el 4; devolviendo
 * el botón «Respaldo» a la cabecera de /pacientes falla el 6.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide el score.** Que la pantalla diga para qué sirve cada cosa no
 *   garantiza que §29 baje de 4.0: eso se vuelve a puntuar en navegador, sobre
 *   capturas nuevas, y es la rebanada que sigue.
 * · **No hay contadores por área** — y no es un olvido: está declarado arriba
 *   como decisión. Si algún día se ponen, tendrán que salir de una lectura
 *   real y distinguir «no hay» de «no se pudo leer», como hizo RTC-15.
 * · No cubre el CONTENIDO de los 19 destinos: cada uno tiene su pantalla y sus
 *   propias deudas de §32.
 * · No cubre `/configuracion`, que es la otra mitad de la familia §11.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const sinComentarios = (s: string) => s
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const OPS = leer('src/app/(dashboard)/operaciones/page.tsx')
const OPS_LIMPIO = sinComentarios(OPS)

/** El arreglo GRUPOS, tal como lo lee también el guardián de RTC-09. */
const grupos = () => {
  const inicio = OPS.search(/const GRUPOS:/)
  const cierre = OPS.indexOf('\n]', inicio)
  return OPS.slice(inicio, cierre)
}

describe('RTC-29 — el índice dice para qué sirve cada cosa', () => {
  it('1 · TODO destino declara su `para`', () => {
    const bloque = grupos()
    const hrefs = [...bloque.matchAll(/href:\s*'([^']+)'/g)].map(m => m[1])
    const paras = [...bloque.matchAll(/para:\s*'([^']+)'/g)].map(m => m[1])
    expect(hrefs.length).toBeGreaterThan(15)
    expect(paras.length, 'hay destinos sin decir para qué sirven').toBe(hrefs.length)
  })

  it('2 · el `para` explica, no repite la etiqueta', () => {
    // «Reactivación → Reactivación de pacientes» no explica nada: quien no sabe
    // qué es sigue sin saberlo. Se exige una frase, no un eco.
    const bloque = grupos()
    const filas = [...bloque.matchAll(/label:\s*'([^']+)',\s*para:\s*'([^']+)'/g)]
    expect(filas.length).toBeGreaterThan(15)
    for (const [, label, para] of filas) {
      expect(para.length, `«${label}» tiene un para demasiado corto`).toBeGreaterThan(20)
      expect(
        para.toLowerCase().startsWith(label.toLowerCase()),
        `«${label}» se explica repitiéndose`,
      ).toBe(false)
    }
  })

  it('3 · se pinta como LISTA, no como rejilla de azulejos', () => {
    expect(OPS_LIMPIO, 'volvió la rejilla de azulejos').not.toContain('repeat(auto-fill, minmax(min(200px, 100%), 1fr))')
    // Un borde por GRUPO y separación por línea entre filas: la anatomía de
    // una lista, no la de un menú de iconos.
    expect(OPS_LIMPIO).toMatch(/borderTop: i === 0 \? 'none' : '1px solid var\(--border\)'/)
  })

  it('4 · cada grupo declara su cadencia, y así se ordena la página', () => {
    const bloque = grupos()
    const titulos = [...bloque.matchAll(/titulo:\s*'([^']+)'/g)].length
    const cadencias = [...bloque.matchAll(/cadencia:\s*'([^']+)'/g)].length
    expect(titulos).toBeGreaterThan(3)
    expect(cadencias, 'hay grupos sin cadencia').toBe(titulos)
    /**
     * LA CONDICIÓN SIGUE AL CÓDIGO (4-sep-2026). Esto buscaba `{g.cadencia}`
     * porque el grupo se pintaba dentro del `map` de la página, con `g` como
     * nombre de la variable. Al aparecer el cajón de lo secundario el grupo se
     * extrajo a `GrupoDeDestinos` para no tener dos JSX de la misma lista, y la
     * variable pasó a llamarse `grupo`. Lo que se defiende es lo mismo: que la
     * cadencia llegue a la pantalla, no que se quede declarada en el catálogo.
     */
    expect(OPS_LIMPIO).toMatch(/<CabeceraDeGrupo titulo=\{grupo\.titulo\} cadencia=\{grupo\.cadencia\} \/>/)
  })

  it('5 · sigue siendo un índice: ni primarios ni contadores inventados', () => {
    expect(OPS_LIMPIO).not.toMatch(/btn-primary/)
    // Si algún día hay cifras por área, tendrán que venir de una lectura real
    // — este caso caza la tentación de escribirlas a mano en el catálogo.
    expect(grupos()).not.toMatch(/(pendientes|badge|conteo|count):\s*\d/)
  })
})

describe('RTC-29 — el respaldo aterriza donde vive lo operativo (resto de RTC-15)', () => {
  const PACIENTES = sinComentarios(leer('src/app/(dashboard)/pacientes/page.tsx'))

  it('6 · «Respaldo» ya no está en la cabecera primaria de /pacientes', () => {
    expect(PACIENTES).not.toContain("'Generando…' : 'Respaldo'")
    expect(PACIENTES).not.toContain('/api/clinic/exportar')
  })

  it('7 · y la conducta llegó ENTERA, no reescrita', () => {
    /**
     * Mover no puede significar perder. La ruta de servidor, el streaming, el
     * nombre del archivo y —sobre todo— el aviso de que la ÚLTIMA LÍNEA del
     * archivo declara si quedó completo: un respaldo que no dice lo que le
     * faltó es peor que no tenerlo, porque se guarda y se duerme tranquilo.
     */
    const LIB = leer('src/lib/clinica/descargar-respaldo.ts')
    expect(LIB).toContain('/api/clinic/exportar')
    expect(LIB).toContain('respaldo_ausculta_')
    expect(LIB).toContain('La última línea del archivo dice si quedó completo')
    expect(OPS).toContain('descargarRespaldo(clinicId)')
    expect(OPS_LIMPIO).toContain('Descargar todo el consultorio')
  })

  it('8 · el aviso de lo que el archivo NO trae sigue llegando al médico', () => {
    // El mensaje se muestra pase lo que pase: éxito y error tienen texto, y el
    // toast lo recibe del resultado, no de una cadena escrita en la pantalla.
    expect(OPS_LIMPIO).toMatch(/toast\(r\.mensaje, r\.ok \? 'success' : 'error'\)/)
  })
})
