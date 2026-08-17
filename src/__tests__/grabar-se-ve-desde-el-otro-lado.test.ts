/**
 * GRABAR ES UN MODO, Y SE VE DESDE EL OTRO LADO DEL CONSULTORIO.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Con el micrófono abierto la aplicación se veía **igual** que con el micrófono
 * cerrado, salvo un borde de 1 px en la barra `MientrasHablas`. Y esa barra vive
 * pegada abajo de la columna de la nota: en cuanto el médico se desplaza a los
 * antecedentes o abre el antibiograma, deja de tenerla delante.
 *
 * Un micrófono abierto que no se nota tiene los dos errores posibles a la vez:
 * grabar veinte minutos que nadie pidió, o creer que graba y no grabar.
 *
 * Medido el 9-ago-2026 sobre capturas reales: **Abridge tiñe la pantalla
 * entera** mientras escucha; **Heidi la vacía** hasta un botón con anillos que
 * laten. Los dos convierten grabar en un modo del que no se puede dudar.
 *
 * ── LO QUE ESTA PRUEBA PROTEGE, Y NO ES EL ASPECTO ──────────────────────────
 *
 * Tres cosas, y las tres son de seguridad, no de gusto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { EVENTO_GRABANDO, avisarEscucha, POR_QUE_UN_SOLO_EVENTO } from '@/lib/seguridad/estoy-grabando'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const HOOK   = leer('src', 'hooks', 'useGrabacionAudio.ts')
const MARCO  = leer('src', 'components', 'MarcoEscuchando.tsx')  // el porqué; el aspecto vive en el CSS
const LAYOUT = leer('src', 'app', '(dashboard)', 'layout.tsx')
const CSS    = leer('src', 'app', 'globals.css')

describe('la señal sabe apagarse, no sólo encenderse', () => {
  it('el grabador avisa también cuando el micrófono se CIERRA', () => {
    /**
     * El de verdad importante. Sin este aviso el marco se quedaría pintado para
     * siempre después de detener: la pantalla diría que el micrófono sigue
     * abierto cuando ya no lo está. Una señal que sólo sabe encender miente la
     * mitad del tiempo, y la mitad en la que miente es la peligrosa.
     */
    expect(HOOK, 'el grabador no avisa al cerrarse: el marco se quedaría pintado')
      .toContain('avisarEscucha(false)')
    expect(HOOK).toContain('avisarEscucha(true)')
  })

  it('el aviso viaja por el MISMO evento que el latido, no por uno nuevo', () => {
    /**
     * Dos eventos para un solo hecho —«el micrófono está abierto»— es una
     * fuente de verdad partida en dos. Se desincronizan, y entonces la pantalla
     * dice una cosa mientras el grabador hace otra.
     */
    expect(POR_QUE_UN_SOLO_EVENTO).toMatch(/partida en dos/)
    const src = leer('src', 'lib', 'seguridad', 'estoy-grabando.ts')
    expect(src).toContain('new CustomEvent<DetalleDeEscucha>(EVENTO_GRABANDO')
    expect(src, 'apareció un segundo evento para el mismo hecho')
      .not.toMatch(/export const EVENTO_[A-Z_]+ = 'nx:(?!grabando)/)
  })

  it('la forma del evento vive en un sitio, no en cada pantalla que grabe', () => {
    /**
     * `avisarEscucha` existe para que la próxima superficie que grabe no tenga
     * que **acordarse** de la forma del `CustomEvent`. Acordarse es la familia
     * `depende_de_recordar`.
     */
    expect(typeof avisarEscucha).toBe('function')
    expect(EVENTO_GRABANDO).toBe('nx:grabando')
  })
})

describe('el marco no puede romper la aplicación que vigila', () => {
  it('no se traga los clics', () => {
    /**
     * Cubre la pantalla entera. Sin `pointer-events: none` la aplicación queda
     * MUERTA mientras graba — y grabar dura veinte minutos.
     */
    expect(CSS, 'el marco se tragaría cada clic de la pantalla')
      .toMatch(/\.nx-marco-escuchando\s*\{[\s\S]{0,300}?pointer-events:\s*none/)
  })

  it('no desplaza el contenido al encenderse', () => {
    /**
     * El grosor va por dentro (`inset` en la sombra) y no como `border`. Un
     * salto de layout a mitad de consulta es peor que no tener marco.
     */
    expect(CSS).toMatch(/\.nx-marco-escuchando\s*\{[\s\S]{0,300}?box-shadow:\s*inset /)
    expect(CSS, 'un borde real desplazaría todo el contenido')
      .not.toMatch(/\.nx-marco-escuchando\s*\{[\s\S]{0,300}?border:\s*3px/)
  })

  it('ignora el latido sin estado en vez de encenderse con él', () => {
    /**
     * El latido de inactividad viaja por este mismo evento y llega SIN
     * `detail`. Si contara como «encendido», el marco se pintaría por un latido
     * y ya no sabría apagarse.
     */
    expect(MARCO).toMatch(/typeof d\.activo === 'boolean'/)
  })
})

describe('se monta una vez y cubre a todas', () => {
  it('vive en el layout del panel, no en la pantalla de consulta', () => {
    expect(LAYOUT).toContain('<MarcoEscuchando />')
    expect(LAYOUT).toContain("from '@/components/MarcoEscuchando'")
  })
})

describe('el color y el movimiento, decididos y explicados', () => {
  it('NO es rojo', () => {
    /**
     * Rojo es el color de grabar en casi todo el mundo, y aquí no puede serlo:
     * `--peligro` es rojo y significa alergia, valor crítico o dosis fuera de
     * rango. Un marco rojo durante veinte minutos enseña a ignorar el rojo.
     */
    const regla = /\.nx-marco-escuchando\s*\{[\s\S]{0,300}?\}/.exec(CSS)?.[0] ?? ''
    expect(regla).toMatch(/var\(--nexus\)/)
    expect(regla, 'el marco de grabar no puede competir con el rojo clínico')
      .not.toMatch(/var\(--(red|peligro)\)|#[eE]6|#dc2626/)
  })

  it('quien pide menos movimiento recibe un marco FIJO, no ninguno', () => {
    /**
     * Apagar la animación no puede apagar la información. Es la diferencia
     * entre respetar una preferencia y usarla de excusa para no informar.
     */
    /* Hay varios bloques `prefers-reduced-motion` en el archivo; el que
       importa es el que redefine ESTA animación, no el primero que aparezca. */
    const bloques = [...CSS.matchAll(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,500}/g)]
      .map(m => m[0])
    const bloque = bloques.find(b => b.includes('nx-escuchando')) ?? ''
    expect(bloque, 'ningún bloque de movimiento reducido redefine nx-escuchando').not.toBe('')
    expect(bloque, 'sin movimiento el marco desaparecería en vez de quedarse fijo')
      .toMatch(/inset 0 0 0 3px var\(--nexus\)/)
  })
})
