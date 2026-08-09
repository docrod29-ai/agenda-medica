/**
 * «CUADRO DE EDICIÓN, EN BLANCO» — V9 · A11Y-GATE-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * En la autoagenda pública, la etiqueta y el campo eran **hermanos** dentro de
 * un `<div>`:
 *
 *     <div>
 *       <label>Teléfono / WhatsApp *</label>
 *       <input value={telefono} … />     ← sin id, sin aria-label
 *     </div>
 *
 * Se ven pegados. Para un lector de pantalla no lo están: no hay nada que ate
 * uno con otro. Quien reservaba su cita a ciegas oía **«cuadro de edición, en
 * blanco»** cuatro veces seguidas y tenía que adivinar cuál era el teléfono.
 *
 * Lo mismo en el formulario de derechos ARCO —el que por ley tiene que poder
 * usar cualquiera— y en la reseña, donde el campo de texto no tenía etiqueta de
 * ninguna clase: sólo un marcador de posición, que desaparece al escribir y que
 * muchos lectores no anuncian.
 *
 * Y las cinco estrellas de la reseña eran cinco botones cuyo único contenido
 * era un icono: «botón, botón, botón, botón, botón», sin forma de saber cuál
 * era «muy bueno».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Contando, como todo lo de esta iteración. `PATIENT-UX-TRUTH-001` midió la red
 * de accesibilidad y encontró **1 prueba entre 540**, y era una expresión
 * regular sobre `layout.tsx`. Con el objetivo declarado en WCAG 2.2 AA, eso no
 * es un objetivo: es una intención.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * En la superficie del paciente, **cero** controles sin nombre accesible. No es
 * un trinquete que baja: es cero, porque ya está en cero y volver a subir sería
 * una regresión, no deuda heredada.
 *
 * Las tres formas legítimas de dar nombre valen todas —`aria-label`,
 * `aria-labelledby`, y `htmlFor` emparejado con un `id`—, más el caso en que un
 * componente del propio archivo parametriza el `htmlFor`. Lo que no vale es que
 * el texto esté al lado y nada más.
 *
 * La superficie se lee de `lib/paciente/superficie.ts`, declarada UNA vez: en
 * tres documentos y ninguna parte del código era la familia
 * `depende_de_recordar`, y la décima pantalla del paciente habría entrado sin
 * que nadie la auditara.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No es `axe`.** Lee TEXTO, no un árbol de accesibilidad. No ve contraste
 *   real, ni orden de foco, ni si un modal atrapa el foco, ni si el objetivo
 *   táctil mide 44×44. Eso exige la aplicación corriendo en un navegador, y
 *   este entorno no tiene las credenciales de Firebase para levantarla
 *   (`BLOCKERS.md`).
 * - **Señala de menos a propósito.** Un botón cuyo cuerpo es `{algo}` se da por
 *   bueno, porque `{algo}` puede ser texto. Un guardián que grita de más enseña
 *   a ignorarlo, igual que un aviso clínico.
 * - **Sólo mira la superficie del paciente.** El panel del médico tiene 41
 *   botones sólo-icono y 4 `aria-label`; eso sigue abierto y no lo tapa esta
 *   prueba.
 * - **No dice que las pantallas estén bien.** Nadie ha abierto una.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { revisar } from '@/lib/paciente/accesibilidad'
import { SUPERFICIE_DEL_PACIENTE, ARCHIVOS_DEL_PACIENTE } from '@/lib/paciente/superficie'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('la superficie del paciente está declarada, y existe', () => {
  it('las nueve pantallas están en disco', () => {
    // Una lista que nombra un archivo borrado audita el vacío y sale verde.
    const fantasmas = ARCHIVOS_DEL_PACIENTE.filter(a => !existsSync(join(process.cwd(), a)))
    expect(fantasmas, 'pantalla declarada que ya no existe').toEqual([])
  })

  it('están las nueve, y las de PHI coinciden con lo declarado en seguridad', () => {
    expect(SUPERFICIE_DEL_PACIENTE.length).toBeGreaterThanOrEqual(9)
    const conPHI = SUPERFICIE_DEL_PACIENTE.filter(p => p.conPHI).map(p => p.ruta.split('/')[1]).sort()
    const declaradas = leer('src/lib/security/rutas-privadas.ts')
    for (const r of conPHI) {
      expect(declaradas, `${r} dice llevar PHI y no está en RUTAS_PACIENTE_CON_PHI`).toContain(`'${r}'`)
    }
  })
})

describe('ningún control del paciente se queda sin nombre', () => {
  it('cero hallazgos en las nueve pantallas', () => {
    const todos = ARCHIVOS_DEL_PACIENTE.flatMap(a => revisar(a, leer(a)))
    expect(
      todos.map(h => `${h.archivo}:${h.linea} [${h.regla}] ${h.fragmento}`),
      'un control del paciente sin nombre accesible',
    ).toEqual([])
  })
})

describe('el detector NO es de cartón', () => {
  // Sin este bloque, una expresión regular mal escrita dejaría la prueba de
  // arriba siempre verde y nadie se enteraría. Aquí se le da de comer justo lo
  // que tiene que cazar, y justo lo que NO debe.

  it('caza el campo cuya etiqueta sólo está al lado', () => {
    const malo = `<div><label>Teléfono</label><input value={t} onChange={f} /></div>`
    expect(revisar('x.tsx', malo).map(h => h.regla)).toEqual(['campo-sin-nombre'])
  })

  it('acepta las tres formas legítimas de dar nombre', () => {
    expect(revisar('x.tsx', `<input aria-label="Teléfono" />`)).toEqual([])
    expect(revisar('x.tsx', `<span id="e1">Tel</span><input aria-labelledby="e1" />`)).toEqual([])
    expect(revisar('x.tsx', `<label htmlFor="tel">Tel</label><input id="tel" />`)).toEqual([])
  })

  it('acepta el control envuelto por su etiqueta', () => {
    expect(revisar('x.tsx', `<label>Acepto <input type="checkbox" /></label>`)).toEqual([])
  })

  it('y NO acepta uno que quedó fuera de la etiqueta que se cerró antes', () => {
    const malo = `<label>Acepto</label><input type="checkbox" />`
    expect(revisar('x.tsx', malo)).toHaveLength(1)
  })

  it('acepta el `htmlFor` que parametriza un componente del propio archivo', () => {
    const bueno = `
      <Campo id="tel" label="Teléfono"><input id="tel" value={t} /></Campo>
      function Campo({ id, label, children }) { return <div><label htmlFor={id}>{label}</label>{children}</div> }`
    expect(revisar('x.tsx', bueno)).toEqual([])
  })

  it('pero NO si nadie parametriza nada: un id suelto no es una etiqueta', () => {
    expect(revisar('x.tsx', `<Campo id="tel" label="Teléfono" /><input id="tel" />`)).toHaveLength(1)
  })

  it('caza el botón que sólo lleva un icono', () => {
    const malo = `<button onClick={f}><Star size={36} /></button>`
    expect(revisar('x.tsx', malo).map(h => h.regla)).toEqual(['boton-sin-nombre'])
  })

  it('y NO se queja de un botón con icono Y texto, ni del que se llama', () => {
    expect(revisar('x.tsx', `<button><Save size={14} /> Guardar</button>`)).toEqual([])
    expect(revisar('x.tsx', `<button aria-label="5 estrellas"><Star /></button>`)).toEqual([])
    expect(revisar('x.tsx', `<button>{enviando ? <Loader2 /> : 'Enviar'}</button>`)).toEqual([])
  })

  it('un campo oculto no necesita nombre', () => {
    expect(revisar('x.tsx', `<input type="hidden" value={t} />`)).toEqual([])
  })
})
