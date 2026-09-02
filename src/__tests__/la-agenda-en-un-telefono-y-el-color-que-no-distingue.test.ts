/**
 * GOLDEN — la agenda del teléfono no dejaba leer a quién tienes a las diez,
 * y en el consultorio de un solo médico salía entera de color rosa.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Levantando el arnés del emulador con la consulta sintética sembrada y
 * MIRANDO `/calendario` a 390 px y a 1440
 * (`docs/audit/ausculta-transformacion/interno/calendario-hoy-390.png`).
 *
 * ── DEFECTO 1 · LA SEMANA NO CABE EN UN TELÉFONO ────────────────────────────
 *
 * El calendario abría SIEMPRE en vista de semana. A 390 px eso son siete
 * columnas en 366 px: ~44 px por día. En la captura, el bloque de la cita de
 * las 09:45 alcanza a enseñar «09:45» y «Maria» cortado — no se puede saber
 * quién viene ni a qué, que es lo único para lo que se abre la agenda.
 *
 * En vista de día ese mismo bloque tiene el ancho entero: nombre completo
 * («María Guadalupe de la Concepción Villaseñor Etchegaray», que además es el
 * caso de nombre largo que este repositorio ya vigila), estado y duración.
 *
 * La elección se hace UNA vez, al montar. Si el médico cambia a semana en su
 * teléfono, girar la pantalla no puede deshacérselo: la preferencia expresada
 * gana a la inicial.
 *
 * ── DEFECTO 2 · UN COLOR POR MÉDICO DONDE HAY UN SOLO MÉDICO ────────────────
 *
 * `colorMedico` reparte cinco colores por hash del id. Con un solo médico toca
 * el que toque, para siempre — y aquí tocó `--rosa`, el tono que este sistema
 * reserva al acento de ginecología. Medido en el navegador sobre el bloque
 * real: `rgb(244,114,182)`. La agenda entera, todos los días, del color de
 * otra cosa, gastando el único acento que el producto tiene para decir «esto
 * es Ausculta».
 *
 * **La intención correcta ya estaba escrita**, en el comentario de quien llama:
 *
 *     // Multi-doctor: colorea según el médico; un solo médico → cobalto de marca
 *     const color = a.medicoId ? colorMedico(a.medicoId) : 'var(--nexus)'
 *
 * Pero la condición no implementa lo que dice el comentario: pregunta si la
 * CITA tiene médico, no si el consultorio tiene VARIOS. Y una cita de un
 * consultorio de un solo médico también tiene `medicoId`, así que la rama del
 * cobalto no se ejecutaba nunca en el caso para el que se escribió. Es
 * «escrito y sin conectar» en su forma más difícil de ver: no falta el código,
 * falta que la condición diga lo que el comentario promete.
 *
 * El criterio nuevo es el MISMO que ya decide si el selector de médico se
 * dibuja (`activeDoctors.length <= 1`), y vive a tres líneas de él para que no
 * puedan separarse.
 *
 * Verificado después en el navegador: el bloque computa `rgb(42,165,181)`.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Con `useState<View>('semana')` fijo, el primer caso falla. Con la firma
 * `colorMedico(id: string)` sin la cuenta, el segundo falla.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **No mide el ancho renderizado.** Que la vista de día quepa se comprobó
 *   con la captura, no con una aserción: medir el ancho de un bloque exige el
 *   navegador y la sesión, y eso vive en el arnés
 *   (`scripts/carril-excelencia/capturar-con-sesion.mjs`).
 * · **No comprueba el color computado.** Este caso vigila la FIRMA y la
 *   llamada; que el píxel salga cian lo dijo
 *   `scripts/ausculta-transformacion/medir-color.mjs` contra la app servida.
 * · No cubre las otras superficies que pintan por médico: `/citas` ya guarda su
 *   llamada tras `multiMedico &&`, y `/asistente` colorea la lista DE médicos,
 *   donde distinguirlos es justamente el punto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { colorMedico } from '@/components/DoctorFilter'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const CALENDARIO = leer('src/app/(dashboard)/calendario/page.tsx')

describe('el color por médico sólo se usa cuando distingue a alguien', () => {
  it('con un solo médico devuelve el acento de marca, no un tono al azar', () => {
    expect(colorMedico('cualquier-id', 1)).toBe('var(--nexus)')
    expect(colorMedico('otro-id-distinto', 1)).toBe('var(--nexus)')
    // Y con cero, que es lo que se ve mientras la lista carga.
    expect(colorMedico('id', 0)).toBe('var(--nexus)')
  })

  it('con varios médicos sí reparte, y de forma estable', () => {
    const a = colorMedico('medico-a', 3)
    const b = colorMedico('medico-b', 3)
    expect(a).toBe(colorMedico('medico-a', 3))   // determinista
    expect([a, b].every(c => c.startsWith('var(--'))).toBe(true)
  })

  it('el calendario le pasa la CUENTA, no sólo el id', () => {
    // Sin el segundo argumento, la rama del cobalto no se ejecuta nunca en un
    // consultorio de un médico — que es el caso comercial principal.
    expect(CALENDARIO).toMatch(/colorMedico\(a\.medicoId, cuantosMedicos\)/)
    expect(CALENDARIO).toContain('const cuantosMedicos = activeDoctors.length')
  })

  it('y la cuenta sale del MISMO sitio que decide si el selector se dibuja', () => {
    const filtro = leer('src/components/DoctorFilter.tsx')
    // Las dos decisiones usan activeDoctors: si una cambia de criterio, la
    // otra está a tres líneas y se ve.
    expect(filtro).toContain('activeDoctors.length <= 1')
    expect(filtro).toMatch(/export function colorMedico\(id: string, cuantosMedicos = 2\)/)
    expect(filtro).toContain('if (cuantosMedicos <= 1) return')
  })
})

describe('la agenda abre en la vista que cabe', () => {
  it('en un teléfono abre en día, no en semana', () => {
    expect(CALENDARIO).toMatch(/matchMedia\('\(max-width: 640px\)'\)\.matches \? 'dia' : 'semana'/)
  })

  it('se elige al montar, y no se vuelve a imponer', () => {
    /**
     * Con un `useEffect` sobre el ancho, girar el teléfono le desharía al
     * médico el cambio a semana que acababa de hacer. El inicializador
     * perezoso de useState corre UNA vez: la preferencia expresada gana.
     */
    expect(CALENDARIO).toMatch(/useState<View>\(\(\) =>/)
    const cuerpo = CALENDARIO.replace(/\/\*[\s\S]*?\*\//g, ' ')
    expect(cuerpo, 'un efecto sobre el ancho volvería a imponer la vista').not.toMatch(
      /useEffect\([^)]*setView/,
    )
  })

  it('sin ventana elige semana: en el servidor no se anima ni se adivina', () => {
    expect(CALENDARIO).toContain("typeof window !== 'undefined'")
  })
})
