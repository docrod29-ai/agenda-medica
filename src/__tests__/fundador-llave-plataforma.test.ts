/**
 * EL DUEÑO NO ES UN CLIENTE EN PRUEBA.
 *
 * ── EL INCIDENTE (31-jul-2026) ───────────────────────────────────────────────
 *
 * El dueño corría sobre la llave de la plataforma, que hasta hoy se marcaba como
 * `fuente: 'prueba'`. Eso lo metía en el mismo cubo que un consultorio de
 * cortesía: tope de 30 usos al mes y cartera de créditos. Iba en 24/30.
 *
 * Como el tope lo dejaba sin IA a mitad de mes construyendo su propio producto,
 * la salida práctica fue pegar una llave a mano en Configuración. Esa llave
 * pegada GANA sobre la variable de entorno —está escrito así a propósito: quien
 * pone su llave paga su saldo y no se le ignora— así que al rotar las llaves,
 * Vercel quedó al día y el consultorio siguió llamando con una llave muerta.
 * Toda la IA cayó, con un paciente enfrente.
 *
 * Es decir: el tope mal aplicado no fue una molestia de cuota. **Fue la causa
 * raíz del apagón**, porque empujó a una configuración manual que después
 * envejeció en silencio.
 *
 * §BK lo decía desde el principio: «el acceso del fundador NO debe depender de
 * una suscripción de pago».
 *
 * Estas pruebas fijan que la distinción viva en el NOMBRE DE LA FUENTE, para que
 * los tres que deciden —el gate de créditos, la cartera y el libro de costos—
 * lean el mismo dato y no puedan discrepar.
 */
import { describe, it, expect } from 'vitest'
import { debeCortarCreditos } from '@/lib/ai-keys'
import { claseDe, type FuenteLlave } from '@/lib/finanzas/cost-ledger'
import { aplicaCartera } from '@/lib/finanzas/cartera'
import { quienPaga } from '@/lib/ia/fallo-proveedor'

const CLINICA = 'clinic_del_dr'

describe('el fundador sobre la llave de la plataforma', () => {
  it('NO se le corta por créditos aunque estén agotados', () => {
    expect(debeCortarCreditos('fundador', CLINICA, true)).toBe(false)
  })

  it('NO se le descuenta de la cartera', () => {
    expect(aplicaCartera('fundador', CLINICA)).toBe(false)
  })

  it('su gasto es I+D, no costo de servir a un cliente', () => {
    // §CD: si su consumo probando UCI entra en COGS, el margen deja de ser real.
    expect(claseDe('fundador')).toBe('rnd')
  })

  it('para los mensajes de error, su llave es la de la plataforma', () => {
    expect(quienPaga('fundador')).toBe('plataforma')
  })
})

describe('un CLIENTE sobre la misma llave sí tiene tope', () => {
  // La llave física es la misma; lo que cambia es quién la usa. Sin este tope,
  // cien doctores en prueba queman el saldo del dueño.
  it('se le corta cuando agota sus créditos', () => {
    expect(debeCortarCreditos('prueba', CLINICA, true)).toBe(true)
  })
  it('sí se le descuenta de la cartera', () => {
    expect(aplicaCartera('prueba', CLINICA)).toBe(true)
  })
  it('su gasto SÍ es costo de servir', () => {
    expect(claseDe('prueba')).toBe('customer')
  })
})

describe('llave propia del consultorio', () => {
  it('nunca se corta: paga su propia API', () => {
    expect(debeCortarCreditos('clinica', CLINICA, true)).toBe(false)
    expect(aplicaCartera('clinica', CLINICA)).toBe(false)
  })
  it('su costo no es nuestro', () => {
    expect(claseDe('clinica')).toBe('llave_propia')
  })
})

describe('la unión de fuentes es una sola, no cuatro copias', () => {
  it('las cuatro fuentes están clasificadas en el libro de costos', () => {
    // Si mañana nace una quinta fuente y alguien olvida clasificarla, el gasto
    // cae por defecto en 'customer' y ensucia el margen sin avisar. Esta prueba
    // obliga a pasar por aquí.
    const todas: FuenteLlave[] = ['clinica', 'fundador', 'prueba', 'ninguna']
    expect(todas.map(f => claseDe(f))).toEqual(['llave_propia', 'rnd', 'customer', 'customer'])
  })
})
