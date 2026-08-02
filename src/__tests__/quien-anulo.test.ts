/**
 * GOLDEN — quién anuló un cobro.
 *
 * `cancelarCobro` exige autor, y su propio comentario dice por qué: «sin ellos
 * una anulación es dinero que se esfuma del corte sin nadie a quien preguntar».
 * Las reglas de Firestore lo sellan además contra el uid de quien firma, con un
 * comentario que llama a lo contrario «sustracción de efectivo indetectable».
 *
 * Y el corte de caja —la ÚNICA pantalla donde alguien cuadra el dinero—
 * enseñaba el importe, el paciente, el motivo y la fecha… **y no quién**.
 *
 * O sea: el campo anti-fraude estaba guardado, validado en el servidor, y
 * ausente justo donde servía. El control existe cuando se puede preguntar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { quienAnulo } from '@/lib/corte-caja'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('quienAnulo', () => {
  it('usa el nombre sellado al anular', () => {
    expect(quienAnulo({ canceladoPorNombre: 'Ana Recepción', canceladoPor: 'uid-1' })).toBe('Ana Recepción')
  })

  it('para los anulados ANTES, traduce el uid con la lista del consultorio', () => {
    expect(quienAnulo({ canceladoPor: 'uid-1' }, { 'uid-1': 'Dr. Rodríguez' })).toBe('Dr. Rodríguez')
  })

  it('si no se puede traducir, enseña algo BUSCABLE, no un hueco', () => {
    // Un hueco se lee como «nadie lo anuló», que es exactamente la impresión que
    // este campo existe para impedir.
    expect(quienAnulo({ canceladoPor: 'abcdef123456' })).toBe('usuario abcdef…')
    expect(quienAnulo({ canceladoPor: 'abcdef123456' }, { otro: 'X' })).toBe('usuario abcdef…')
  })

  it('sin autor lo DICE', () => {
    expect(quienAnulo({})).toBe('sin autor registrado')
    expect(quienAnulo({ canceladoPor: '  ' })).toBe('sin autor registrado')
  })

  it('un nombre en blanco no gana al uid traducible', () => {
    expect(quienAnulo({ canceladoPorNombre: '   ', canceladoPor: 'uid-1' }, { 'uid-1': 'Ana' })).toBe('Ana')
  })
})

describe('el nombre se sella al anular, como ya hacía la cortesía', () => {
  it('cancelarCobro lo guarda', () => {
    const s = leer('src', 'lib', 'cobros.ts')
    expect(s).toContain('canceladoPorNombre: (autorNombre || \'\').trim()')
    // Un uid no le dice nada a la persona que cuadra la caja.
    expect(s).toContain('canceladoPorNombre?: string')
  })

  it('y quien anula se lo pasa', () => {
    const s = leer('src', 'app', '(dashboard)', 'finanzas', 'page.tsx')
    expect(s).toContain('user.uid, user.displayName || user.email')
  })
})

describe('el corte de caja lo enseña', () => {
  const s = leer('src', 'app', '(dashboard)', 'corte-caja', 'page.tsx')

  it('la lista de anulados dice quién', () => {
    expect(s).toContain('anuló ${quienAnulo(c, nombrePorUid)}')
  })

  it('y sabe traducir los uid viejos', () => {
    expect(s).toContain('useDoctors()')
    expect(s).toContain('nombrePorUid')
  })
})
