/**
 * GOLDEN — un panel que desaparece está afirmando algo.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `PanelPendientes` —«Siguiente acción», lo primero que mira el médico al
 * entrar— junta TRES fuentes: citas del día, cobros y membresías. Las tres se
 * tragaban su fallo:
 *
 *     listarCobros(...).then(setCobros).catch(() => {})
 *     listarMembresias(...).then(setMembresias).catch(() => {})
 *     const { appointments } = useAppointments(...)      // `error` sin recoger
 *
 * y después:
 *
 *     if (acciones.length === 0) return null
 *
 * Con una fuente caída la lista sale corta; con las tres, vacía. Y con la lista
 * vacía **el panel se quitaba del tablero entero**: ni error, ni hueco, ni
 * rastro de que hubiera existido.
 *
 * Un panel que se quita solo no está callándose: está diciendo «hoy no tienes
 * nada que hacer». Y lo dice sin haberlo comprobado. Detrás puede haber un cobro
 * sin cerrar, una membresía vencida o un paciente sin confirmar.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Barriendo los nueve consumidores de `useAppointments` después de la unidad 73:
 * sólo dos recogían `error`. Éste no sólo no lo recogía — además tenía dos
 * `.catch` vacíos, que es la forma más explícita de tragarse un fallo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El panel sólo puede desaparecer cuando **de verdad** no hay nada: cero
 * acciones Y las tres fuentes contestaron. Si alguna falló se queda, y dice
 * cuál — no es lo mismo no haber podido ver los cobros que no haber podido ver
 * la agenda: el médico sabe a qué pantalla ir a mirar a mano.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Con la versión anterior y los cobros denegados en el emulador,
 * `npm run arnes:caida-parcial` marca FALLA: el panel se queda pero **no dice**
 * que le falta una fuente. Eso es la mitad medida en navegador —la lista corta
 * que parece completa—. La otra mitad, la desaparición, pide que las tres
 * fuentes den cero a la vez, y es la que vigila el caso de aquí abajo: que la
 * condición de salida temprana **no dependa sólo del número de acciones**.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No pinta nada**: que el aviso se vea es del arnés, con navegador, y está
 *   medido para el caso de la lista corta.
 * · No comprueba el TEXTO del aviso ni su contraste.
 * · No cubre que el aviso se quite al volver el permiso.
 * · Los otros dos consumidores que siguen tirando `error` —`/asistente` y
 *   `useNotificacionesCitas`— **no se vigilan aquí**: no se han medido, y que no
 *   estén en esta lista significa que nadie los mira.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')

const PANEL = sinComentarios(readFileSync(join('src', 'components', 'PanelPendientes.tsx'), 'utf8'))

describe('un panel que se quita solo dice que no hay nada', () => {
  it('NINGUNA de las tres fuentes se traga su fallo en silencio', () => {
    expect(PANEL, 'volvió el `.catch` vacío: un fallo que no deja rastro')
      .not.toMatch(/\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/)
    expect(PANEL, '`useAppointments` volvió a entregarse sin recoger `error`')
      .toMatch(/\{[^}]*\berror\s*:\s*\w+[^}]*\}\s*=\s*useAppointments\(/)
  })

  it('EL DEFECTO: la salida temprana NO puede depender sólo del número de acciones', () => {
    // `if (acciones.length === 0) return null` a secas es exactamente el
    // defecto: el panel se retira sin haber podido comprobar nada.
    const salida = PANEL.match(/if\s*\(([^)]*)\)\s*return null/)
    expect(salida, 'desapareció la salida temprana; este caso ya no vigila nada').not.toBeNull()
    const condicion = salida![1]
    expect(condicion, 'el panel vuelve a poder desaparecer con una fuente caída')
      .toMatch(/sinConsultar|fallo|error/i)
  })

  it('el aviso distingue las dos formas de engañar: lista vacía y lista corta', () => {
    // Vacía → «no quiere decir que no tengas nada». Corta → «puede faltar algo».
    expect(PANEL).toMatch(/acciones\.length === 0\s*\?/)
  })
})
