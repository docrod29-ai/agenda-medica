/**
 * GOLDEN — el estado operativo tiene que LLEGAR a `/operaciones`, y llegar
 * ARRIBA.
 *
 * ── POR QUÉ ESTE GOLDEN EXISTE SI YA HAY OTRO ──────────────────────────────
 *
 * `v15-operaciones-dice-que-pide-atencion` prueba el MOTOR: dadas unas citas,
 * una lista de espera y un inventario, qué lectura sale. Eso no prueba nada
 * sobre la pantalla. Es exactamente el hueco que describe la regla
 * `el-dato-tiene-que-LLEGAR`: REG-170 escribía `transcripcionMotor` y ninguna
 * nota firmada lo tenía; REG-160 validaba una colección y escribía en otra. Las
 * dos tenían su prueba de contrato en verde.
 *
 * Así que aquí se comprueba lo otro: que la página **lea de verdad** las tres
 * fuentes, que se las pase al motor, que pinte el resultado, y que lo pinte
 * **antes del índice de destinos** — que es todo el cambio de §29. Un motor
 * perfecto renderizado debajo de ocho grupos de enlaces no repara nada.
 *
 * ── QUÉ FALLABA ────────────────────────────────────────────────────────────
 *
 * `/operaciones` era un índice sin estado: la misma pantalla exacta en un
 * consultorio al día y en uno con cinco citas sin responder. Medido en
 * navegador real el 15-ago (`docs/design/capturas/v15-encuentro-v29/`): ocho
 * bloques, todos de enlaces, cero controles que reaccionen a un dato.
 *
 * ── LA REGLA QUE LO HACE SEGURO ────────────────────────────────────────────
 *
 * Tres cosas, y las tres tienen su caso:
 *
 *  1. La franja va **antes** del índice: lo que pide atención domina cuando
 *     existe.
 *  2. Cada lectura se rescata **por separado**. Un `Promise.all` sin `catch`
 *     por rama deja la franja entera muda porque una colección falló, y una
 *     franja muda se lee como consultorio en orden — que es la mentira más cara
 *     que puede decir esta pantalla.
 *  3. Los destinos administrativos **siguen todos ahí**. Reparar la superficie
 *     no puede costar el acceso a `/citas`, `/farmacia` o `/legal`.
 *
 * ── QUÉ NO CUBRE ───────────────────────────────────────────────────────────
 *
 *  · Análisis estático de fuente, como el resto de guardianes de cableado de
 *    esta fase: no monta React. La comprobación en navegador real (1440 y 390,
 *    con excepción real y sin ella) vive en las capturas de `v15-encuentro-v29`.
 *  · No prueba las reglas de Firestore ni la autorización: `/operaciones` sólo
 *    LEE, y lo que puede leer lo decide `firestore.rules`.
 *  · No juzga §29.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PAGE = leer('src/app/(dashboard)/operaciones/page.tsx')
const FRANJA = leer('src/components/operaciones/EstadoDeOperaciones.tsx')

describe('§29 · el estado operativo llega a /operaciones y llega arriba', () => {
  it('1 · la página lee las TRES fuentes reales y se las pasa al motor', () => {
    expect(PAGE).toContain('getAppointments')
    expect(PAGE).toContain('getWaitlist')
    expect(PAGE).toContain('listarItems')
    expect(PAGE).toContain('estadoDeOperaciones({ citas, listaEspera, farmacia')
  })

  it('2 · la franja se PINTA, y se pinta ANTES del índice de destinos', () => {
    // Se busca la ETIQUETA JSX, no el nombre a secas: el `import` y el tipo
    // `EstadoOps` también contienen el identificador, y contarlos haría pasar
    // el caso con la franja renderizada al final de la página. Comprobado:
    // moviéndola debajo del índice, la primera versión de este caso NO mordía.
    const franja = PAGE.indexOf('<EstadoDeOperaciones estado=')
    expect(franja, 'la franja no se renderiza en ningún sitio').toBeGreaterThan(-1)
    expect(PAGE.indexOf('<EstadoDeOperaciones estado=', franja + 1),
      'la franja se pinta más de una vez').toBe(-1)

    // `GRUPOS` se declara arriba del archivo; lo que ordena la pantalla es
    // dónde se RECORRE para pintar.
    const indice = PAGE.indexOf('grupos.map')
    expect(indice, 'no se encontró el recorrido del índice').toBeGreaterThan(-1)
    expect(franja).toBeLessThan(indice)
  })

  it('3 · cada lectura se rescata POR SEPARADO — una rota no calla a las otras', () => {
    expect(PAGE).toContain('rescatar(')
    // Tres rescates, uno por fuente. Si alguien envuelve el `Promise.all`
    // entero en un solo `catch`, este caso se cae.
    expect(PAGE).toContain('const rescatar =')
    expect(PAGE.match(/rescatar\(/g)?.length, 'una llamada por fuente').toBe(3)
    expect(PAGE).toMatch(/catch\(e => \{[\s\S]*?return null \}\)/)
  })

  it('4 · lo que no se pudo leer se pinta APARTE de lo sano', () => {
    // La franja junta excepciones y ciegas para pedir atención…
    expect(FRANJA).toContain('estado.excepciones')
    expect(FRANJA).toContain('estado.ciegas')
    // …y la línea de «sin novedad» sale SÓLO de `sanas`. Si alguien metiera
    // `ciegas` ahí, una colección rota se leería como consultorio en orden.
    expect(FRANJA).toContain('const limpias = estado.sanas')
    const bloqueLimpio = FRANJA.slice(FRANJA.indexOf('data-comprobado-limpio'))
    expect(bloqueLimpio).not.toContain('ciegas')
  })

  it('5 · la franja no muta nada: sus destinos son enlaces, no acciones', () => {
    expect(FRANJA).toContain('<Link')
    // Ni un `onClick` que escriba: la autoridad vive en /citas, /lista-espera
    // y /farmacia, con el detalle delante. Es la misma línea que §29 trazó
    // para /pacientes.
    expect(FRANJA).not.toMatch(/onClick=\{[^}]*(cambiarEstado|update|set[A-Z]|borrar|delete)/)
  })

  it('6 · cargando NO es lo mismo que sin novedad', () => {
    expect(FRANJA).toContain("data-estado-operaciones=\"cargando\"")
    // Mientras se comprueba, la pantalla lo dice; no afirma que no haya nada.
    expect(FRANJA).toContain('Comprobando el estado del consultorio')
  })

  it('7 · los destinos administrativos siguen TODOS accesibles', () => {
    for (const ruta of ['/asistente', '/citas', '/calendario', '/lista-espera',
      '/hospitalizacion', '/uci', '/crm', '/resenas', '/reactivacion', '/farmacia',
      '/finanzas', '/membresias', '/cumplimiento', '/legal', '/migracion']) {
      expect(PAGE, `desapareció el destino ${ruta}`).toContain(`href: '${ruta}'`)
    }
  })
})
