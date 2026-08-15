/**
 * El bloqueo ARCO es un campo del paciente — y el tipo tenía que enterarse.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `arcoBloqueo` está vivo en el producto por los dos extremos:
 *
 *   escribe   `src/app/api/arco/cancelar/route.ts`  → `set({ arcoBloqueo })`
 *   lee       `estaBloqueadoArco`                   → impide reactivación,
 *                                                     recordatorios y campañas
 *
 * y **no existía en `Patient`**. La señal de que faltaba llevaba tiempo a la
 * vista: `estaBloqueadoArco` no recibe un paciente, recibe una forma
 * estructural (`{ arcoBloqueo?: MarcaBloqueo | null }`) — un rodeo escrito
 * alrededor del hueco, no una decisión de diseño.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Por un rojo de CI que no era mío. Una prueba de otra corrida quiso construir
 * un paciente bloqueado con `Partial<Patient>` y `tsc` la rechazó:
 *
 *     error TS2353: Object literal may only specify known properties,
 *     and 'arcoBloqueo' does not exist in type 'Partial<Patient>'
 *
 * El defecto no era de esa prueba: era del tipo. Una prueba no podía expresar
 * un estado que el producto sí sabe escribir.
 *
 * ── POR QUÉ IMPORTA MÁS QUE UN TIPO ─────────────────────────────────────────
 *
 * Es un campo con consecuencia **legal**: marca a quien ejerció cancelación
 * ARCO y pidió quedar fuera de todo contacto. Un campo así, invisible para el
 * tipo del paciente, es la puerta por la que se cuela un módulo nuevo que
 * arma una campaña, no lo mira porque no lo ve, y le escribe a alguien que
 * pidió por escrito que no se le escribiera.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando la línea de `Patient`, `npx tsc --noEmit` vuelve a dar el TS2353 de
 * arriba — comprobado. Y el caso 1 de aquí cae, que es lo que protege el hueco
 * aunque esa otra prueba desapareciera.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba que un módulo nuevo mire el campo.** Declararlo lo hace
 *   visible; no obliga a nadie a leerlo. Quien filtre destinatarios sigue
 *   teniendo que llamar a `estaBloqueadoArco`.
 * · No cubre `firestore.rules` ni el manifiesto del respaldo: `arcoBloqueo`
 *   vive dentro del documento del paciente, que ya está declarado en los tres
 *   sitios; esto no añade una colección.
 * · No decide la política de contacto. Sólo dice que el dato existe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { estaBloqueadoArco, marcaDeBloqueo } from '@/lib/arco/cancelacion'
import type { Patient } from '@/types'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('el bloqueo ARCO existe en el tipo del paciente', () => {
  it('1 · `Patient` declara `arcoBloqueo`, con la forma que ya existía', () => {
    const tipos = leer('src/types/index.ts')
    expect(tipos, 'el campo desapareció de Patient').toMatch(/arcoBloqueo\?:\s*MarcaBloqueo \| null/)
    // Una sola forma: se importa la que ya existe, no se copia.
    expect(tipos).toContain("import type { MarcaBloqueo } from '@/lib/arco/cancelacion'")
  })

  it('2 · y un paciente así tipado sigue mordiendo la compuerta', () => {
    /**
     * El caso 1 comprueba la declaración; éste comprueba que la declaración
     * sirve para lo que existe. Si el tipo y la compuerta se separaran, aquí
     * dejaría de compilar o de pasar.
     */
    const p: Partial<Patient> = {
      id: 'pac-1',
      arcoBloqueo: marcaDeBloqueo({ ahoraMs: Date.parse('2026-01-01T00:00:00.000Z'), uid: 'uid', solicitudId: 's1', motivo: 'lo pidió' }),
    }
    expect(estaBloqueadoArco(p)).toBe(true)
    expect(estaBloqueadoArco({ id: 'pac-2' } as Partial<Patient>)).toBe(false)
  })

  it('3 · los dos extremos del campo siguen conectados', () => {
    /**
     * «El dato tiene que LLEGAR»: quien lo escribe y quien lo lee tienen que
     * seguir hablando del mismo campo. Si la ruta dejara de escribirlo, el
     * bloqueo sería una marca que nadie pone.
     */
    expect(leer('src/app/api/arco/cancelar/route.ts')).toContain('arcoBloqueo: marca')
    expect(leer('src/lib/arco/cancelacion.ts')).toContain('p?.arcoBloqueo?.bloqueadoEn')
    expect(leer('src/lib/reactivacion.ts')).toContain('estaBloqueadoArco(')
  })
})
