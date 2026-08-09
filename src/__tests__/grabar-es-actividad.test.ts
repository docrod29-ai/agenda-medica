/**
 * GRABAR ES ACTIVIDAD, Y SALIR GRABANDO AVISA — REG-287.
 *
 * ── LOS DOS ÚLTIMOS P0 DE INTEGRIDAD, Y COMPARTÍAN CAUSA ────────────────────
 *
 * **Nadie sabía que se estaba grabando.**
 *
 * ── 1. La sesión se cerraba en mitad del dictado ───────────────────────────
 *
 * `AutoLogout` escucha `mousemove`, `mousedown`, `keydown`, `touchstart` y
 * `scroll`. Su propio comentario nombra el escenario que lo rompe:
 *
 *   *«el médico DICTA, y dictar no genera mousemove ni teclas»*
 *
 * **Lo conocía.** Su defensa fue *guardar la nota antes de cerrar*. Eso salva el
 * texto — y sigue cerrando la sesión a mitad de frase en un pase de UCI de media
 * hora.
 *
 * **Guardar la nota no era el arreglo: era el consuelo.**
 *
 * ── 2. Salir no avisaba ────────────────────────────────────────────────────
 *
 * No había **ningún** `beforeunload` en toda la aplicación. Cerrar la pestaña o
 * recargar durante el dictado paraba la grabación sin decir nada.
 *
 * Los trozos ya volcados sobreviven en IndexedDB y al volver aparece el
 * ofrecimiento de recuperación — pero el médico no lo sabe **en el momento en
 * que decide**, que es el único que importa.
 *
 * ── POR QUÉ UN EVENTO Y NO UNA REFERENCIA ──────────────────────────────────
 *
 * El grabador no debe saber que existe un cierre por inactividad, ni al revés.
 * Si se conocieran, cada pantalla nueva que grabe tendría que **acordarse** de
 * avisar — y «acordarse» es la familia `depende_de_recordar`, que este
 * repositorio ya tiene contada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  EVENTO_GRABANDO, LATIDO_MS, POR_QUE_NO_BASTABA_GUARDAR_LA_NOTA,
} from '@/lib/seguridad/estoy-grabando'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const HOOK = leer('src/hooks/useGrabacionAudio.ts')
const LOGOUT = leer('src/components/AutoLogout.tsx')

describe('el nombre del evento vive en UN sitio', () => {
  it('y los dos lados lo importan, no lo teclean', () => {
    /**
     * Una cadena literal repetida en dos archivos es una compuerta que se abre
     * sola el día que alguien corrige una errata en uno de los dos.
     */
    expect(HOOK).toContain("from '@/lib/seguridad/estoy-grabando'")
    expect(LOGOUT).toContain("from '@/lib/seguridad/estoy-grabando'")
    expect(HOOK).not.toContain(`'${EVENTO_GRABANDO}'`)
    expect(LOGOUT).not.toContain(`'${EVENTO_GRABANDO}'`)
  })

  it('el evento lleva prefijo de la aplicación', () => {
    /** Sin prefijo, un evento de una librería podría llamarse igual. */
    expect(EVENTO_GRABANDO.startsWith('nx:')).toBe(true)
  })
})

describe('el latido', () => {
  it('late cada minuto, muy por debajo de los 30 del cierre', () => {
    expect(LATIDO_MS).toBe(60_000)
  })

  it('el grabador emite uno INMEDIATO además del periódico', () => {
    /**
     * Si se empieza a grabar en el minuto 29 de inactividad, el primer
     * `setInterval` llegaría tarde: la sesión se habría cerrado ya.
     */
    expect(HOOK).toMatch(/Uno inmediato/)
    expect(HOOK).toMatch(/window\.dispatchEvent\(new CustomEvent\(EVENTO_GRABANDO\)\)\n/)
  })

  it('sólo late mientras se graba o está en pausa', () => {
    /** Latir siempre convertiría el cierre por inactividad en decorativo. */
    expect(HOOK).toMatch(/if \(estado !== 'grabando' && estado !== 'pausado'\) return/)
  })

  it('y se limpia al parar', () => {
    expect(HOOK).toMatch(/window\.clearInterval\(latido\)/)
  })
})

describe('el latido SÍ cancela el aviso — y es la decisión que hace que sirva', () => {
  it('`AutoLogout` reinicia directamente, sin pasar por la guarda del aviso', () => {
    /**
     * Durante la cuenta atrás sólo el botón reactiva, y con razón: un
     * `mousemove` perdido no puede impedir un cierre legítimo en un equipo
     * compartido.
     *
     * Una grabación en curso NO es un `mousemove` perdido: es prueba positiva
     * de que hay alguien delante hablando. Sin esto, el aviso saldría en el
     * minuto 30 del dictado y cerraría igual — el defecto seguiría abierto con
     * un arreglo puesto encima.
     */
    expect(LOGOUT).toMatch(/const onGrabando = \(\) => reiniciar\(\)/)
  })

  it('y la decisión queda escrita para poder revertirla', () => {
    expect(LOGOUT).toMatch(/decisión de seguridad y se deja escrita/)
  })

  it('el resto de eventos sigue respetando la guarda del aviso', () => {
    /** El arreglo no puede desactivar el cierre por inactividad entero. */
    expect(LOGOUT).toMatch(/if \(avisandoRef\.current\) return/)
  })
})

describe('salir grabando avisa', () => {
  it('hay un `beforeunload` mientras se graba', () => {
    expect(HOOK).toMatch(/window\.addEventListener\('beforeunload', alSalir\)/)
  })

  it('y se quita al parar: no puede quedar avisando fuera de la grabación', () => {
    /**
     * Un `beforeunload` que sobrevive a la grabación pregunta al salir de
     * CUALQUIER pantalla. Eso se aprende a ignorar en dos días, y entonces
     * tampoco se lee el que importa.
     */
    expect(HOOK).toMatch(/window\.removeEventListener\('beforeunload', alSalir\)/)
  })

  it('el aviso no depende del texto, que los navegadores ignoran', () => {
    expect(HOOK).toMatch(/e\.preventDefault\(\)/)
    expect(HOOK).toMatch(/ignoran el texto/)
  })
})

describe('la lección, escrita donde se lee', () => {
  it('el módulo declara por qué guardar la nota no bastaba', () => {
    expect(POR_QUE_NO_BASTABA_GUARDAR_LA_NOTA).toMatch(/el consuelo, no el arreglo/)
  })
})
