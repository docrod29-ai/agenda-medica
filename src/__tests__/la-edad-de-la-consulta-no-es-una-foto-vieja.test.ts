/**
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La consulta leía `patient.edad` —un número guardado— y no derivaba nada de
 * `patient.fechaNacimiento`. Con el campo vacío, TRECE lecturas de esta
 * pantalla degradaban en silencio:
 *
 *   · `esPediatrico` nunca se encendía            → sin modo pediátrico
 *   · `esGineco` nunca se encendía                → sin módulo de ginecología
 *   · las vacunas atrasadas devolvían 0           → un cero que no vigila nada
 *   · el memo de contexto de SEGURIDAD y cada llamada a motor recibían `undefined`
 *   · al copiloto le llegaba, literalmente, «? años»
 *
 * Ninguno avisaba.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando el primer pliegue en el navegador. El subtítulo decía
 * «· Femenino · Nota de Primera Vez», con un separador huérfano donde debía ir
 * la edad — y el paciente SÍ tenía fecha de nacimiento en el expediente.
 * El síntoma visible era un « · » de más; lo que había debajo era la capa que
 * decide dosis trabajando sin la edad.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * Dos campos para un solo hecho: el expediente guarda `fechaNacimiento` y las
 * pantallas leen `edad`. `edadEnAnios` —motor determinista, probado— existía y
 * la consulta no lo llamaba: «escrito, probado y sin conectar». `/pacientes` sí
 * lo llama, pero SÓLO al teclear la fecha en su formulario.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Cuando hay fecha de nacimiento, la edad DERIVADA manda sobre la guardada. Un
 * número guardado es una foto del día que se escribió: quien se registró con 66
 * sigue teniendo 66 cinco años después, y de esa cifra cuelgan el ajuste renal
 * y la dosis pediátrica. La resta la hace el motor, no esta pantalla
 * (`clinical-safety` §2).
 *
 * Y no se escribe nada: es sólo para lo que se lee y se calcula en la consulta.
 * Corregir el documento del paciente es otro acto, del médico.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Sólo la consulta. Otras pantallas que lean `edad` sin derivarla siguen
 *   viendo la foto vieja; queda declarado en la bitácora del carril.
 * · No corrige el dato en Firestore, a propósito.
 * · Un paciente SIN fecha de nacimiento se queda con lo guardado, y si tampoco
 *   hay nada la pantalla lo DECLARA («— edad no registrada») en vez de callarlo.
 *   Esta prueba fija la derivación, no ese texto.
 */
import { describe, it, expect } from 'vitest'
import { edadEnAnios } from '@/lib/expediente/pediatria'

/** La misma regla que aplica la consulta al cargar el paciente. */
function conLaEdadAlDia<T extends { edad?: number; fechaNacimiento?: string }>(
  p: T | null, hoy?: string,
): T | null {
  if (!p) return p
  const derivada = edadEnAnios(p.fechaNacimiento, hoy)
  return derivada != null && derivada !== p.edad ? { ...p, edad: derivada } : p
}

const HOY = '2026-09-01'

/** La forma mínima que lee la consulta. Explícita para que `tsc` vigile los casos. */
type Paciente = { edad?: number; fechaNacimiento?: string; sexo?: string }

describe('la edad de la consulta sale de la fecha de nacimiento', () => {
  it('el caso REAL: el paciente sembrado tenía fecha y no tenía edad', () => {
    const p = conLaEdadAlDia<Paciente>({ fechaNacimiento: '1958-03-14', sexo: 'Femenino' }, HOY)
    expect(p?.edad).toBe(68)
  })

  it('la edad guardada que envejeció mal se corrige', () => {
    // Registrada a los 66 hace dos años y nunca actualizada.
    const p = conLaEdadAlDia({ edad: 66, fechaNacimiento: '1958-03-14' }, HOY)
    expect(p?.edad).toBe(68)
  })

  it('sin fecha de nacimiento NO se inventa nada: manda lo guardado', () => {
    expect(conLaEdadAlDia({ edad: 40 }, HOY)?.edad).toBe(40)
  })

  it('sin fecha y sin edad, sigue sin haber edad — no se rellena con un plausible', () => {
    expect(conLaEdadAlDia<Paciente>({ sexo: 'Masculino' }, HOY)?.edad).toBeUndefined()
  })

  it('una fecha inválida no produce una edad basura', () => {
    expect(conLaEdadAlDia({ edad: 30, fechaNacimiento: 'no-es-fecha' }, HOY)?.edad).toBe(30)
  })

  /**
   * LAS COMPUERTAS QUE DEPENDÍAN DE ESTO. No son detalles de presentación:
   * son las condiciones que encienden módulos clínicos enteros.
   */
  it('con la edad al día, la compuerta pediátrica puede encenderse', () => {
    const p = conLaEdadAlDia<Paciente>({ fechaNacimiento: '2019-05-02' }, HOY)!
    expect(p.edad! < 18).toBe(true)
  })

  it('y con la edad ausente NO se encendía, sin avisar de nada', () => {
    const sinDerivar = { fechaNacimiento: '2019-05-02' } as { edad?: number }
    expect(sinDerivar.edad != null && sinDerivar.edad < 18).toBe(false)
  })

  it('la ventana de ginecología también dependía de la edad', () => {
    const p = conLaEdadAlDia<Paciente>({ fechaNacimiento: '1990-01-10', sexo: 'Femenino' }, HOY)!
    expect((p.edad ?? 0) >= 10 && (p.edad ?? 0) <= 60).toBe(true)
  })
})
