/**
 * OXÍGENO CON CIFRAS Y SIN DECLARAR — REG-258.
 *
 * ── TERCERA COSECHA DEL INSTRUMENTO (REG-255) ───────────────────────────────
 *
 *     src/lib/hospital/oxigeno.ts::oxigenoSinDeclarar
 *
 * Escrita, con su comentario, su `NEEDS_CLINICAL_REVIEW` y su prueba — y **sin
 * un solo llamador**.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ────────────────────────────────────
 *
 * Detecta la toma de signos que trae **flujo o FiO₂ registrados** pero sin la
 * casilla de «recibe O₂ suplementario».
 *
 * NEWS2 **suma 2 puntos** por oxígeno suplementario. Sin esa casilla, la
 * puntuación sale más baja de lo que le toca — y NEWS2 es justo lo que dispara
 * la escalada. Un paciente con 5 L/min anotados y la casilla sin marcar puede
 * quedarse dos puntos por debajo del umbral que habría pedido revisión.
 *
 * ── LO QUE NO SE HACE, Y ESTÁ ESCRITO EN EL MOTOR ───────────────────────────
 *
 * **No se deduce.** El propio módulo lo dice:
 *
 *   «decidir que un flujo registrado significa "recibe O₂ suplementario" es una
 *    regla clínica, y aplicarla cambiaría el NEWS2 —el modificador suma
 *    puntos—. Se declara y lo decide el médico. NEEDS_CLINICAL_REVIEW.»
 *
 * Así que se **señala** y decide el médico. Marcar la casilla por él sería
 * inventar una cifra clínica, que es la línea que este proyecto no cruza.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { oxigenoSinDeclarar, POR_QUE_NO_SE_DEDUCE } from '@/lib/hospital/oxigeno'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx'), 'utf8')

describe('el motor CORRE en la tabla de signos', () => {
  it('la ficha lo importa', () => {
    expect(page).toContain("import { textoOxigeno, oxigenoSinDeclarar } from '@/lib/hospital/oxigeno'")
  })

  it('y marca la toma en la celda de oxígeno', () => {
    expect(page).toMatch(/oxigenoSinDeclarar\(s\) && \(/)
  })

  it('el aviso explica el efecto sobre NEWS2, no sólo que falta un dato', () => {
    /**
     * «Falta declarar el oxígeno» no mueve a nadie. «NEWS2 suma 2 puntos por
     * oxígeno: sin esa casilla la puntuación sale más baja» sí.
     */
    expect(page).toMatch(/NEWS2 suma 2 puntos por oxígeno/)
  })

  it('tiene nombre accesible: no es sólo un símbolo', () => {
    expect(page).toMatch(/aria-label="oxígeno con cifras pero sin declarar"/)
  })
})

describe('el motor, medido', () => {
  it('flujo registrado sin la casilla → se señala', () => {
    expect(oxigenoSinDeclarar({ oxigenoFlujoLpm: 5 })).toBe(true)
  })

  it('FiO₂ registrada sin la casilla → se señala', () => {
    expect(oxigenoSinDeclarar({ oxigenoFiO2: 40 })).toBe(true)
  })

  it('con la casilla marcada NO se señala', () => {
    expect(oxigenoSinDeclarar({ oxigeno: true, oxigenoFlujoLpm: 5 })).toBe(false)
  })

  it('sin cifras no se señala nada', () => {
    /** Aire ambiente declarado, o una toma sin ese dato, no son un error. */
    expect(oxigenoSinDeclarar({ oxigeno: false })).toBe(false)
    expect(oxigenoSinDeclarar({})).toBe(false)
    expect(oxigenoSinDeclarar(null)).toBe(false)
  })
})

describe('no se cruza la línea', () => {
  it('la casilla NO se marca sola', () => {
    /**
     * Deducirla cambiaría el NEWS2 sin que nadie lo decidiera. El motor sólo
     * devuelve un booleano de aviso; no toca el dato.
     */
    const mod = readFileSync(join(process.cwd(), 'src/lib/hospital/oxigeno.ts'), 'utf8')
    const fn = mod.slice(mod.indexOf('export function oxigenoSinDeclarar'),
      mod.indexOf('export const POR_QUE_NO_SE_DEDUCE'))
    expect(fn).not.toMatch(/oxigeno\s*=\s*true/)
  })

  it('y la razón queda escrita, con su NEEDS_CLINICAL_REVIEW', () => {
    expect(POR_QUE_NO_SE_DEDUCE).toMatch(/regla clínica/)
    expect(POR_QUE_NO_SE_DEDUCE).toMatch(/NEEDS_CLINICAL_REVIEW/)
  })
})

describe('lo que se decidió NO conectar, y por qué', () => {
  it('`negacionesEnTexto` sigue sin llamador, a propósito', () => {
    /**
     * ── UNA DECISIÓN, NO UN OLVIDO ────────────────────────────────────────
     *
     * `negacionesEnTexto` está en la lista de REG-255 y **se deja ahí**. Su
     * único sitio natural sería otro aviso en pantalla —«el campo de alergias
     * dice que se interrogó y se negó»—, y eso es información de bajo valor
     * compitiendo por el mismo espacio que las alertas que sí bloquean.
     *
     * Añadir ruido es exactamente el defecto que este loop lleva reparando
     * (REG-245, REG-247). **El trinquete no exige cero**: exige que no crezca.
     *
     * Se comprueba que la decisión esté escrita donde se lee, no sólo aquí.
     */
    const doc = readFileSync(join(process.cwd(), 'docs/quality/MOTORES-SIN-CONECTAR.md'), 'utf8')
    expect(doc).toMatch(/negacionesEnTexto/)
    expect(doc).toMatch(/decisión, no un olvido/i)
  })
})
