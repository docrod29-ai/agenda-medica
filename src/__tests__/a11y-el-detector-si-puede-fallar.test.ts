/**
 * EL DETECTOR DE ACCESIBILIDAD, PROBADO AL REVÉS — A11Y-GATE-001 · REG-331.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Nada impedía una regresión de accesibilidad en la superficie del paciente.
 * `A11Y-GATE-001` lo contaba así en el backlog: **una prueba entre 540**, y esa
 * una es una expresión regular sobre el `viewport` de `layout.tsx`. Ni axe, ni
 * `jsx-a11y`, ni nada que mire una pantalla del paciente.
 *
 * Lo que sí había —`scripts/design/axe-*.mjs`, que es axe de verdad dentro de
 * Chromium— necesita servidor levantado y emulador sembrado. Corre cuando
 * alguien se acuerda. **Un guardián que sólo corre cuando alguien se acuerda no
 * es una red**, y de hecho ninguna de sus salidas está sellada en ningún techo.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Midiendo antes de tocar nada. El analizador nuevo, corrido contra las diez
 * superficies declaradas, devolvió **23 hallazgos** el primer día: ocho campos
 * de formulario sin etiqueta, siete botones que trabajan sin decirlo, cinco
 * pantallas con estado asíncrono y ni un solo `aria-live`, dos sin `<h1>` y las
 * cinco estrellas de la reseña, que son cinco botones que el lector de pantalla
 * anuncia como «botón», «botón», «botón», «botón», «botón».
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Familia: **`sin_medir`**. Ninguno de los 23 es un error de quien
 * lo escribió — son omisiones que **ninguna herramienta del repositorio podía
 * ver**. `tsc` no sabe de nombres accesibles; `eslint.config.mjs` son 18 líneas
 * sin `jsx-a11y`; el trinquete de diseño lo dice él mismo en su cabecera: «no
 * vigila accesibilidad ni contraste».
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * En la superficie del paciente el techo es **0 y se prohíbe**. No es techo que
 * baja como el de diseño: son diez archivos, caben en una tarde, y es la
 * superficie donde el lector **no puede detectar el error** (regla
 * `patient-facing-ai.md`). En el resto de la aplicación no se toca nada: poner
 * hoy en rojo 200 pantallas es la forma segura de que alguien borre el guardián
 * el martes (REG-245).
 *
 * ── QUÉ HACE ESTE ARCHIVO EN CONCRETO ───────────────────────────────────────
 *
 * Éste es el guardián **del guardián**. La compuerta vive en
 * `a11y-la-superficie-del-paciente-no-pierde-terreno.test.ts` y su forma
 * natural es `expect(total).toBe(0)` — que es exactamente la forma de prueba
 * que se queda en verde para siempre el día que el detector deja de detectar.
 * Un `toBe(0)` no distingue «no hay defectos» de «no hay detector».
 *
 * Así que aquí cada una de las 15 reglas se prueba **al revés**: se le mete el
 * defecto sintético y se comprueba que grita, y se le mete la versión corregida
 * y se comprueba que se calla. Las dos mitades importan. Sólo la primera
 * dejaría pasar un detector que grita siempre, que es igual de inútil y además
 * enseña a ignorarlo.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No prueba que el detector encuentre TODAS las formas del defecto.** Prueba
 *   una forma por regla. Una variante nueva que se le escape necesita su propio
 *   caso aquí — y el sitio donde eso se descubre es una pantalla real, no este
 *   archivo.
 * - **No mide accesibilidad.** Mide el detector. Que las 15 reglas funcionen no
 *   dice que una pantalla sea usable con lector de pantalla; dice que estas 15
 *   regresiones concretas ya no pueden entrar calladas.
 * - **No sustituye a axe ni a mirar la pantalla.** El contraste pintado, el
 *   orden real del foco y la trampa de foco de un modal siguen necesitando un
 *   navegador (`scripts/design/axe-*.mjs`) y ojos (regla de diseño: «no se
 *   aprueba una interfaz leyendo el código»).
 */
import { describe, it, expect } from 'vitest'
import { analizarTsx, REGLAS } from '../../scripts/design/lib/a11y-jsx.mjs'
import { contraste, leerColor, componer } from '../../scripts/design/lib/contraste-wcag.mjs'

type Hallazgo = { regla: string; linea: number; detalle: string }
const analizar = analizarTsx as (ruta: string, codigo: string) => Hallazgo[]

/** Envuelve un fragmento en un componente con `<h1>`, para aislar la regla que se prueba. */
const pantalla = (cuerpo: string, cabeza = '') => `
'use client'
${cabeza}
export default function P() {
  return (
    <main>
      <h1>Título</h1>
      ${cuerpo}
    </main>
  )
}
`

const reglasDe = (codigo: string) => analizar('sintetico.tsx', codigo).map(h => h.regla)

/**
 * Cada caso: el defecto sintético, y la corrección mínima que lo apaga.
 * El nombre de la regla es la clave — si alguien renombra una regla y no toca
 * esto, el último bloque del archivo lo caza.
 */
const CASOS: { regla: string; porQue: string; roto: string; arreglado: string }[] = [
  {
    regla: 'botonSoloIconoSinNombre',
    porQue: 'cinco estrellas que el lector de pantalla anuncia como «botón» cinco veces',
    roto: pantalla(`<button onClick={() => f(1)}><Star size={36} /></button>`),
    arreglado: pantalla(`<button aria-label="Calificar con 1 estrella" onClick={() => f(1)}><Star size={36} /></button>`),
  },
  {
    regla: 'enlaceSinNombreAccesible',
    porQue: 'un enlace sin texto es un destino sin nombre',
    roto: pantalla(`<a href="/x"><ChevronRight size={14} /></a>`),
    arreglado: pantalla(`<a href="/x" aria-label="Siguiente"><ChevronRight size={14} /></a>`),
  },
  {
    regla: 'campoSinEtiqueta',
    porQue: 'el `placeholder` NO es etiqueta: desaparece en cuanto se escribe la primera letra',
    roto: pantalla(`<input placeholder="Tu nombre" value={v} onChange={c} />`),
    arreglado: pantalla(`<label htmlFor="n">Tu nombre</label><input id="n" placeholder="Tu nombre" value={v} onChange={c} />`),
  },
  {
    regla: 'interactivoSinTeclado',
    porQue: 'un `div` que se pulsa con el ratón no existe para el teclado',
    roto: pantalla(`<div onClick={abrir}>Ver receta</div>`),
    arreglado: pantalla(`<div role="button" tabIndex={0} onClick={abrir} onKeyDown={abrir}>Ver receta</div>`),
  },
  {
    regla: 'focoInvisible',
    porQue: 'apagar el contorno deja a quien navega con teclado sin saber dónde está',
    roto: pantalla(`<button style={{ outline: 'none' }}>Enviar</button>`),
    arreglado: pantalla(`<button style={{ outlineOffset: 2 }}>Enviar</button>`),
  },
  {
    regla: 'botonOcupadoSinAriaBusy',
    porQue: 'la ruedecita se la queda quien ve; quien no ve oye «no disponible»',
    roto: pantalla(`<button disabled={enviando}>{enviando ? <Loader2 size={14} /> : 'Enviar'}</button>`),
    arreglado: pantalla(`<button disabled={enviando} aria-busy={enviando}>{enviando ? <Loader2 size={14} /> : 'Enviar'}</button>`),
  },
  {
    regla: 'anchoFijoRompeReflujo',
    porQue: 'WCAG 1.4.10: a 320 px de ancho no puede hacer falta desplazamiento horizontal',
    roto: pantalla(`<div style={{ width: 720 }}>contenido</div>`),
    arreglado: pantalla(`<div style={{ maxWidth: 720 }}>contenido</div>`),
  },
  {
    regla: 'imagenSinAlt',
    porQue: 'sin `alt` el lector de pantalla lee el nombre del archivo, o nada',
    roto: pantalla(`<img src={foto} />`),
    arreglado: pantalla(`<img src={foto} alt="" />`),
  },
  {
    regla: 'iframeSinTitulo',
    porQue: 'un marco sin título se anuncia como «marco» y punto',
    roto: pantalla(`<iframe src={url} allow="camera" />`),
    arreglado: pantalla(`<iframe src={url} title="Teleconsulta" allow="camera" />`),
  },
  {
    regla: 'dialogoSinAriaModal',
    porQue: 'sin `aria-modal` el lector de pantalla sigue leyendo lo que hay detrás del diálogo',
    roto: pantalla(`<div role="dialog" aria-label="Confirmar" onKeyDown={e => e.key === 'Escape' && cerrar()}>x</div>`),
    arreglado: pantalla(`<div role="dialog" aria-modal="true" aria-label="Confirmar" onKeyDown={e => e.key === 'Escape' && cerrar()}>x</div>`),
  },
  {
    regla: 'dialogoSinNombre',
    porQue: 'un diálogo sin nombre se anuncia sin decir de qué es',
    roto: pantalla(`<div role="dialog" aria-modal="true" onKeyDown={e => e.key === 'Escape' && cerrar()}>x</div>`),
    arreglado: pantalla(`<div role="dialog" aria-modal="true" aria-label="Confirmar" onKeyDown={e => e.key === 'Escape' && cerrar()}>x</div>`),
  },
  {
    regla: 'dialogoSinEscape',
    porQue: 'un modal que no cierra con Escape es una trampa para quien no usa ratón',
    roto: pantalla(`<div role="dialog" aria-modal="true" aria-label="Confirmar">x</div>`),
    arreglado: pantalla(`<div role="dialog" aria-modal="true" aria-label="Confirmar" onKeyDown={e => e.key === 'Escape' && cerrar()}>x</div>`),
  },
  {
    regla: 'sinEncabezadoPrincipal',
    porQue: 'sin `<h1>` no hay dónde saltar: el lector de pantalla arranca por el principio cada vez',
    roto: `export default function P() { return (<main><h2>Sección</h2></main>) }`,
    arreglado: `export default function P() { return (<main><h1>Título</h1><h2>Sección</h2></main>) }`,
  },
  {
    regla: 'saltoDeNivelDeEncabezado',
    porQue: 'saltar un nivel rompe el esquema por el que se navega',
    roto: `export default function P() { return (<main><h1>T</h1><h3>S</h3></main>) }`,
    arreglado: `export default function P() { return (<main><h1>T</h1><h2>S</h2></main>) }`,
  },
  {
    regla: 'estadoAsincronoSinRegionViva',
    porQue: 'el error aparece en pantalla y el lector de pantalla no dice absolutamente nada',
    roto: pantalla(`{error && <p>{error}</p>}`, `const [error, setError] = useState('')`),
    arreglado: pantalla(`{error && <p role="alert">{error}</p>}`, `const [error, setError] = useState('')`),
  },
]

describe('cada regla del detector grita cuando debe', () => {
  for (const c of CASOS) {
    it(`${c.regla} — ${c.porQue}`, () => {
      expect(reglasDe(c.roto), 'el defecto sintético NO disparó la regla').toContain(c.regla)
    })
  }
})

describe('y se calla cuando el defecto está corregido', () => {
  for (const c of CASOS) {
    it(`${c.regla} deja de gritar con la corrección mínima`, () => {
      /**
       * La otra mitad. Un detector que grita siempre pasa la primera tanda
       * entera y no sirve para nada: pone en rojo la corrección igual que el
       * defecto, así que nadie lo puede poner en verde y acaba desactivado.
       */
      expect(reglasDe(c.arreglado), 'la regla sigue gritando con el defecto ya corregido').not.toContain(c.regla)
    })
  }
})

describe('el detector no inventa hallazgos donde no los hay', () => {
  it('una pantalla correcta no produce NI UN hallazgo', () => {
    const limpia = `
'use client'
export default function P() {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  return (
    <main>
      <h1>Reservar cita</h1>
      <h2>Tus datos</h2>
      <label htmlFor="nombre">Nombre</label>
      <input id="nombre" value={v} onChange={c} />
      <p role="alert">{error}</p>
      <button disabled={enviando} aria-busy={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</button>
      <button aria-label="Cerrar"><X size={14} /></button>
      <img src={foto} alt="Consultorio" />
    </main>
  )
}
`
    expect(analizar('limpia.tsx', limpia)).toEqual([])
  })

  it('un botón con texto dentro de un `<span>` tiene nombre — no se marca', () => {
    /**
     * El nombre accesible puede venir de cualquier descendiente, no sólo del
     * hijo directo. Una versión anterior sólo miraba un nivel y habría marcado
     * esto: un falso positivo así es lo que acaba con un guardián.
     */
    expect(reglasDe(pantalla(`<button><Icon size={14} /><span>Guardar</span></button>`)))
      .not.toContain('botonSoloIconoSinNombre')
  })

  it('un campo envuelto por su `<label>` está etiquetado sin `htmlFor`', () => {
    expect(reglasDe(pantalla(`<label>Nombre<input value={v} onChange={c} /></label>`)))
      .not.toContain('campoSinEtiqueta')
  })

  it('un `<input type="hidden">` no necesita etiqueta', () => {
    expect(reglasDe(pantalla(`<input type="hidden" name="csrf" value={t} />`)))
      .not.toContain('campoSinEtiqueta')
  })
})

describe('la lista de reglas y el detector no se separan', () => {
  it('toda regla que el detector puede emitir está en REGLAS', () => {
    /**
     * `REGLAS` es lo que el techo enumera. Si el detector emite una regla que
     * no está en la lista, el techo no la cuenta y el hallazgo se pierde por el
     * hueco entre las dos — que es el mismo defecto de REG-160: validar una
     * cosa y escribir en otra.
     */
    const emitidas = new Set(CASOS.map(c => c.regla))
    for (const r of emitidas) expect(REGLAS as string[], `la regla ${r} no está declarada`).toContain(r)
  })

  it('toda regla declarada tiene su caso al revés en este archivo', () => {
    /**
     * Y la dirección contraria: una regla nueva sin caso aquí es una regla que
     * nadie ha probado que funcione.
     */
    const probadas = new Set(CASOS.map(c => c.regla))
    for (const r of REGLAS as string[]) expect([...probadas], `la regla ${r} no se prueba al revés`).toContain(r)
  })
})

describe('la aritmética del contraste es la de WCAG, no una aproximación', () => {
  it('negro sobre blanco es 21:1 y blanco sobre blanco es 1:1', () => {
    expect(contraste('#000000', '#FFFFFF')).toBe(21)
    expect(contraste('#FFFFFF', '#FFFFFF')).toBe(1)
  })

  it('un color translúcido se compone con su fondo antes de medirse', () => {
    /**
     * Sin componer, `rgba(242,239,233,0.08)` se mediría como casi blanco sobre
     * el lienzo `#0B0C0E` y daría ~17:1. Compuesto de verdad da ~1,2:1, que es
     * lo que se ve. Medir la alfa como si fuera opaca es cómo un guardián de
     * contraste puede pasar en verde con el fallo vivo.
     */
    const sinComponer = contraste('#F2EFE9', '#0B0C0E')
    const compuesto = contraste('rgba(242,239,233,0.08)', '#0B0C0E')
    expect(sinComponer!).toBeGreaterThan(15)
    expect(compuesto!).toBeLessThan(1.5)
  })

  it('componer respeta la alfa: al 0 % es el fondo, al 100 % es el frente', () => {
    const fondo = leerColor('#0B0C0E')!
    expect(componer({ r: 255, g: 255, b: 255, a: 0 }, fondo)).toMatchObject({ r: 11, g: 12, b: 14 })
    expect(componer({ r: 255, g: 255, b: 255, a: 1 }, fondo)).toMatchObject({ r: 255, g: 255, b: 255 })
  })

  it('un valor de color que no se sabe leer devuelve `null`, no un número inventado', () => {
    /**
     * Regla de seguridad clínica n.º 1 dicha en color: si no se puede medir, se
     * dice que no se puede medir. Un `0` o un `21` de relleno aquí sería un
     * guardián mintiendo en verde.
     */
    expect(contraste('color-mix(in srgb, var(--nexus) 30%, transparent)', '#0B0C0E')).toBeNull()
    expect(contraste('#F2EFE9', 'rgba(0,0,0,0.5)')).toBeNull()
  })
})
