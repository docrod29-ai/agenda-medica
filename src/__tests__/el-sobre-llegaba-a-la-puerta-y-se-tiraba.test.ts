/**
 * GOLDEN — LA PROYECCIÓN DECÍA QUE VENÍA RECORTADA Y NINGUNA PANTALLA LO DECÍA.
 *
 * ── QUÉ FALLABA (WS-10) ─────────────────────────────────────────────────────
 *
 * REG-405 le dio a problemas y a medicación el mismo sobre que las alergias ya
 * tenían desde REG-363: `asOf`, `version` y **`historialRecortado`**. El sobre
 * llegaba a las dos pantallas y las dos lo tiraban en la puerta:
 *
 *   · la consulta se quedaba sólo con `.vigentes` y `.problemas`;
 *   · el expediente lo DEVOLVÍA del `useMemo` y la desestructuración lo dejaba
 *     fuera — `const { problemas, vigentes } = useMemo(...)`. El defecto entero
 *     cabía en esa línea.
 *
 * Y las dos escribían debajo de la lista «de lo último que se dijo de cada
 * problema en sus notas firmadas», que es una afirmación sobre el expediente
 * **entero**. Sobre una ventana es falsa, y el médico no tiene forma de saberlo
 * mirando la pantalla.
 *
 * No es cosmético: sobre un historial recortado un fármaco anterior al techo
 * desaparece de la lista vigente y, con ella, de la comprobación de
 * interacciones.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * «El dato tiene que LLEGAR» en su último tramo: el productor lo calculó bien, el
 * transporte lo trajo entero, y el consumidor lo descartó al abrirlo. Es el mismo
 * tramo que falló en REG-530 —donde el motor leía cuatro dimensiones y la ruta le
 * pasaba dos— y aquí ni siquiera hubo que cambiar el productor.
 *
 * ── UNA FRASE, NO CINCO ─────────────────────────────────────────────────────
 *
 * La misma oración estaba escrita a mano **tres veces** en dos pantallas, para
 * las alergias. Dos copias más habrían sido la forma habitual de que la próxima
 * diga algo distinto sin que nadie lo note. Ahora hay una definición y las cinco
 * pasan por ella.
 *
 * `avisoDeHistorialRecortado(false)` devuelve cadena vacía a propósito: quien la
 * pinta no tiene que acordarse de comprobar el booleano antes.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO persiste la proyección. Sigue sin hacerse a propósito: guardar un caché
 *   sin decidir quién manda cuando discrepa de las notas crea la segunda fuente
 *   de verdad que `WS-10.proyeccion-no-es-segunda-verdad` prohíbe.
 * · NO cambia el TECHO de lectura ni lo hace configurable. Dice que hubo recorte,
 *   no cuánto se quedó fuera: el productor sabe que truncó, no cuánto había.
 * · NO se comprobó en navegador que la frase se vea. Se comprueba que el dato
 *   llegue al componente y que las cinco copias pasen por una sola definición.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  avisoDeHistorialRecortado, estadoDeProblemas, POR_QUE_EL_RECORTE_SE_DICE,
} from '@/lib/expediente/problemas-activos'

const CONSULTA = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
const EXPEDIENTE = readFileSync('src/app/(dashboard)/expediente/[patientId]/page.tsx', 'utf8')

describe('la frase, una sola vez', () => {
  it('dice que puede faltar, no que falte', () => {
    /* «Puede haber más» y no «hay más»: el productor sabe que truncó, no cuánto
       se quedó fuera. Afirmar lo segundo sería inventar. */
    expect(avisoDeHistorialRecortado(true)).toContain('puede haber más')
    expect(avisoDeHistorialRecortado(true)).toContain('recortado')
  })

  it('y calla cuando no hay nada que decir', () => {
    /* Cadena vacía y no `null`: quien la pinta no tiene que acordarse de
       comprobar el booleano antes de usarla. */
    expect(avisoDeHistorialRecortado(false)).toBe('')
  })

  it('ninguna pantalla la vuelve a escribir a mano', () => {
    /**
     * Estaba tres veces en dos pantallas. Una cuarta copia es la forma habitual
     * de que la próxima diga algo distinto sin que nadie lo note.
     */
    for (const src of [CONSULTA, EXPEDIENTE]) {
      expect(src).not.toContain('El historial vino recortado: puede haber más')
    }
  })

  it('todas pasan por la definición única', () => {
    /**
     * PREMISA CAMBIADA AL FUSIONAR (6-sep-2026). Eran cinco usos; ahora son
     * cuatro. El que falta NO se perdió: el panel de riesgos que lo usaba se
     * retiró en favor del motor de `main` —`banderas-de-riesgo.ts`, el que ya
     * está en producción—, que dice lo mismo con `avisoDeBanderasIncompletas`.
     *
     * Lo que este caso protege sigue igual y por eso el guardián se queda: el
     * aviso de historial recortado tiene UNA definición y nadie la reescribe.
     */
    const veces = (s: string) => (s.match(/avisoDeHistorialRecortado\(/g) ?? []).length
    expect(veces(CONSULTA)).toBeGreaterThanOrEqual(3)
    expect(veces(EXPEDIENTE)).toBeGreaterThanOrEqual(3)
  })
})

describe('el sobre ya no se tira en la puerta', () => {
  it('el expediente lo DESESTRUCTURA, que era el defecto exacto', () => {
    /* `const { problemas, vigentes } = useMemo(...)` lo dejaba fuera aunque el
       `useMemo` lo devolviera. El defecto entero cabía en esa línea. */
    expect(EXPEDIENTE).toContain('const { problemas, vigentes, proyeccionRecortada } = useMemo(')
    expect(EXPEDIENTE).toContain('avisoDeHistorialRecortado(proyeccionRecortada)')
  })

  it('la consulta lo pinta junto a la lista que afirma de más', () => {
    expect(CONSULTA).toContain('avisoDeHistorialRecortado(historialTruncado)')
  })

  it('y va pegado a la frase que sin él es falsa', () => {
    /**
     * «De lo último que se dijo de cada problema en sus notas firmadas» afirma
     * sobre el expediente entero. Si el aviso se pintara en otra parte de la
     * pantalla, la frase seguiría leyéndose sola.
     */
    const i = CONSULTA.indexOf('De lo último que se dijo de cada problema')
    const j = CONSULTA.indexOf('avisoDeHistorialRecortado(historialTruncado)')
    expect(j).toBeGreaterThan(i)
    expect(j - i).toBeLessThan(600)
  })
})

describe('el productor sigue diciendo la verdad', () => {
  const nota = (fecha: string) => ({ fecha, estado: 'firmada', diagnosticos: [{ descripcion: 'Diabetes', tipo: 'definitivo', estado: 'cronico' }] })

  it('marca el recorte cuando se lo dicen', () => {
    const r = estadoDeProblemas([nota('2026-01-01')] as never, '2026-08-30T00:00:00.000Z', { historialIncompleto: true })
    expect(r.historialRecortado).toBe(true)
  })

  it('y no lo inventa cuando no', () => {
    const r = estadoDeProblemas([nota('2026-01-01')] as never, '2026-08-30T00:00:00.000Z')
    expect(r.historialRecortado).toBe(false)
    expect(avisoDeHistorialRecortado(r.historialRecortado)) .toBe('')
  })

  it('el porqué está escrito donde se lee la proyección', () => {
    expect(POR_QUE_EL_RECORTE_SE_DICE).toContain('expediente ENTERO')
  })
})
