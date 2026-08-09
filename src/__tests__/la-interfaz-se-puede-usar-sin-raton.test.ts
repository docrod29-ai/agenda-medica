/**
 * LA INTERFAZ SE PUEDE USAR SIN RATÓN — V9 · DESIGN-SYSTEM-001 / A11Y-GATE-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * De **566 archivos de prueba, uno** era de accesibilidad: `a11y-zoom-guard`,
 * una expresión regular sobre `layout.tsx` que comprueba que no se prohíba el
 * zoom. Ni `axe-core`, ni `jest-axe`, ni `@axe-core/playwright` en
 * `package.json`; `eslint.config.mjs` son 18 líneas sin `jsx-a11y`.
 *
 * V9 declara **WCAG 2.2 AA** como objetivo. No había nada que lo sostuviera, y
 * —lo que es peor— nada que impidiera una regresión: se podía añadir hoy un
 * botón de borrar sin nombre y ninguna compuerta se enteraba.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * `PATIENT-UX-TRUTH-001` (8-ago-2026), §3 de
 * `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md`. La auditoría encontró además lo
 * contrario de lo que esperaba: el anillo de foco global, los objetivos táctiles
 * de 44 px bajo `@media (pointer: coarse)` y el contraste medido a mano están
 * por encima de la media del sector. Lo que falta no es criterio: es máquina.
 *
 * ── LA CAUSA RAÍZ QUE SE ATACA ──────────────────────────────────────────────
 *
 * No es que nadie sepa poner un `aria-label`: es que ponerlo u olvidarlo daba
 * exactamente el mismo resultado en verde. Mientras eso sea cierto, la
 * accesibilidad depende de que alguien se acuerde — la familia
 * `depende_de_recordar` otra vez, la misma que hizo mentir tres veces al
 * tablero del loop (REG-241).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Trinquete: la deuda se congela y sólo baja. Y encima, **un archivo nuevo nace
 * sin deuda**: el techo congela lo que ya existía, y lo que no estaba en la foto
 * no tiene nada que congelar.
 *
 * ── PROBADA AL REVÉS ────────────────────────────────────────────────────────
 *
 * Cada una de las cuatro dimensiones tiene abajo su caso con el defecto metido
 * a mano **y** su caso correcto al lado, porque un guardián que también castiga
 * lo bien hecho se desactiva en una semana. Y la regla del archivo nuevo se
 * prueba con el total intacto, que es el único caso donde puede escaparse.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * Esto es un **suelo estático**, y confundirlo con una auditoría de
 * accesibilidad sería peor que no tenerlo:
 *
 * - **No mide contraste.** Ni el de los tokens (ésos están medidos a mano en
 *   `globals.css`, con la fórmula escrita) ni el de los 1 086 hexadecimales de
 *   las pantallas, que no se ha medido nunca.
 * - **No ve el foco**: ni su orden, ni si el modal lo atrapa, ni si Escape
 *   cierra. Son requisitos del sistema de diseño y ninguno se comprueba aquí.
 * - **No sabe si la etiqueta dice algo útil.** `aria-label="botón"` pasa.
 * - **No ejecuta la aplicación.** `axe` sobre las nueve pantallas del paciente
 *   sigue pendiente y necesita entorno con credenciales de Firebase
 *   (`NAV-NAVEGADOR-001`). La directiva V9 §4 exige mirar la pantalla; esto no
 *   sustituye mirarla.
 * - **Los 11 botones sin nombre son un suelo, no un censo.** Sólo se reconoce
 *   el patrón exacto «botón cuyo contenido entero es un icono autocerrado». Un
 *   botón con un icono envuelto en un `<span>` no se cuenta y puede ser igual de
 *   mudo.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { medir, comparar, leerTecho, medirArchivo, DIMENSIONES } from '../../scripts/design/trinquete-de-accesibilidad.mjs'
import { sinComentarios } from '../../scripts/design/trinquete-comun.mjs'

const TECHO = join(process.cwd(), 'docs', 'design', 'a11y-techo.json')

describe('el trinquete de accesibilidad — la deuda sólo baja', () => {
  it('el techo existe y está commiteado', () => {
    expect(existsSync(TECHO)).toBe(true)
  })

  it('la deuda de hoy no supera el techo, y ningún archivo nuevo nace con deuda', () => {
    const { subidas, nuevasSucias, empeorados } = comparar(medir(), leerTecho())
    expect(
      nuevasSucias.map((n: { archivo: string }) => n.archivo),
      'un archivo nuevo tiene que nacer accesible: `aria-label` en el botón de icono, `id` o `aria-label` en el campo, `<button>` en vez de `<div onClick>`',
    ).toEqual([])
    expect(
      subidas.map((s: { dimension: string, antes: number, hoy: number }) => `${s.dimension}: ${s.antes} → ${s.hoy}`),
      `subió en ${empeorados.map((e: { archivo: string }) => e.archivo).join(', ')}`,
    ).toEqual([])
  })

  it('si la deuda baja, el techo se aprieta', () => {
    const { bajadas } = comparar(medir(), leerTecho())
    expect(
      bajadas.map((b: { dimension: string, antes: number, hoy: number }) => `${b.dimension}: ${b.antes} → ${b.hoy}`),
      'corre `node scripts/design/trinquete-de-accesibilidad.mjs --actualizar` y commitea el techo',
    ).toEqual([])
  })

  it('AL REVÉS · un archivo NUEVO con deuda falla aunque el total no se mueva', () => {
    const medicion = medir()
    const nueva = 'src/app/(dashboard)/pantalla-recien-nacida/page.tsx'
    const { subidas, nuevasSucias } = comparar({
      ...medicion,
      archivos: [...medicion.archivos, nueva],
      porArchivo: { ...medicion.porArchivo, [nueva]: 2 },
      detallePorArchivo: {
        ...medicion.detallePorArchivo,
        [nueva]: { botonSinNombre: ['Trash2'], controlSinEtiqueta: ['input'], clicSinTeclado: [], imagenSinAlt: [] },
      },
    }, leerTecho())
    expect(subidas, 'el total no se ha tocado: si falla por el total, esta prueba no prueba lo que dice').toEqual([])
    expect(nuevasSucias.map((n: { archivo: string }) => n.archivo)).toEqual([nueva])
  })
})

describe('qué cuenta como defecto, y qué no', () => {
  const contar = (jsx: string) => medirArchivo(sinComentarios(jsx)).conteo

  it('botón de icono sin nombre → defecto; con `aria-label` → no', () => {
    expect(contar('<button onClick={x}><Trash2 size={14}/></button>').botonSinNombre).toBe(1)
    expect(contar('<button aria-label="Quitar" onClick={x}><Trash2 size={14}/></button>').botonSinNombre).toBe(0)
  })

  it('`title` NO es un nombre accesible', () => {
    /**
     * El caso literal de la auditoría: `receta/[patientId]/[notaId]:924` tenía
     * `title="Quitar"` y un `<Trash2/>` pelado. El `title` no se anuncia de
     * forma fiable, no existe en táctil y no lo ve quien navega con teclado.
     */
    expect(contar('<button title="Quitar" onClick={x}><Trash2 size={14}/></button>').botonSinNombre).toBe(1)
  })

  it('un botón con texto no es un botón de icono', () => {
    expect(contar('<button onClick={x}>Guardar</button>').botonSinNombre).toBe(0)
    expect(contar('<button onClick={x}><Trash2 size={14}/> Quitar</button>').botonSinNombre).toBe(0)
  })

  it('campo sin nada con lo que nombrarlo → defecto; con `id` o `aria-label` → no', () => {
    expect(contar('<input value={v} onChange={f} />').controlSinEtiqueta).toBe(1)
    expect(contar('<input id="dosis" value={v} onChange={f} />').controlSinEtiqueta).toBe(0)
    expect(contar('<input aria-label="Dosis" value={v} onChange={f} />').controlSinEtiqueta).toBe(0)
    expect(contar('<textarea value={v} />').controlSinEtiqueta).toBe(1)
    expect(contar('<select value={v}><option>a</option></select>').controlSinEtiqueta).toBe(1)
  })

  it('un campo envuelto en su `<label>` SÍ está etiquetado', () => {
    /**
     * Señalar de menos, nunca de más. La etiqueta implícita es HTML válido y es
     * como este producto escribe sus casillas; contarla como defecto habría
     * metido 63 falsos positivos en el techo —comprobado— y un guardián que
     * grita donde no hay nada enseña a ignorarlo.
     */
    expect(contar('<label><input type="checkbox" checked={c} onChange={f} /><span>Controlado</span></label>').controlSinEtiqueta).toBe(0)
  })

  it('una `<label>` que sólo está AL LADO del campo no lo etiqueta', () => {
    /**
     * El patrón más repetido del producto: `<label style={lbl}>Notas</label>`
     * seguido de un `<textarea>` sin `id` ni `htmlFor`. Se ve bien y no está
     * atado a nada: el lector de pantalla anuncia el campo sin nombre.
     */
    expect(contar('<div><label style={lbl}>Notas</label><textarea value={v} /></div>').controlSinEtiqueta).toBe(1)
  })

  it('el campo oculto no necesita etiqueta', () => {
    expect(contar('<input type="hidden" value={v} />').controlSinEtiqueta).toBe(0)
  })

  it('`<div onClick>` sin `role` → defecto; con `role` → no', () => {
    expect(contar('<div onClick={abrir} style={s}>Abrir</div>').clicSinTeclado).toBe(1)
    expect(contar('<div role="button" tabIndex={0} onClick={abrir}>Abrir</div>').clicSinTeclado).toBe(0)
    expect(contar('<button onClick={abrir}>Abrir</button>').clicSinTeclado).toBe(0)
  })

  it('`<img>` sin `alt` → defecto; `alt=""` es una decisión declarada y no lo es', () => {
    expect(contar('<img src={u} style={s} />').imagenSinAlt).toBe(1)
    expect(contar('<img src={u} alt="" style={s} />').imagenSinAlt).toBe(0)
    expect(contar('<img src={u} alt="Firma del médico" />').imagenSinAlt).toBe(0)
  })

  it('lo que está dentro de un comentario no es código', () => {
    /**
     * Los dos únicos `<img>` sin `alt` de la primera medición eran la palabra
     * `<img>` dentro de un comentario que explicaba otra cosa. Cien por cien de
     * falsos positivos, y en un proyecto que comenta tanto como éste eso no es
     * una anécdota: es la diferencia entre un medidor y un ruido.
     */
    expect(contar('{/* aquí iba un <img> sin alt */}\n<img src={u} alt="ok" />').imagenSinAlt).toBe(0)
    expect(contar('/* <button><Trash2/></button> */\n<button aria-label="ok"><Trash2/></button>').botonSinNombre).toBe(0)
  })

  it('una URL no es un comentario', () => {
    /**
     * Al quitar comentarios es fácil comerse medio archivo por culpa de
     * `https://`. Si eso pasara, el trinquete mediría de menos y bajaría el
     * techo sin que nadie hubiera arreglado nada.
     */
    expect(sinComentarios('const u = "https://ejemplo.mx/a"')).toContain('https://ejemplo.mx/a')
  })

  it('mide las cuatro dimensiones que dice medir', () => {
    const conteo = contar(`
      <div onClick={x}>
        <button><Trash2 size={12}/></button>
        <input value={v} />
        <img src={u} />
      </div>
    `)
    for (const d of DIMENSIONES) expect(conteo[d], `la dimensión ${d} no se está midiendo`).toBeGreaterThanOrEqual(1)
    expect(conteo.total).toBe(DIMENSIONES.reduce((n: number, d: string) => n + conteo[d], 0))
  })
})
