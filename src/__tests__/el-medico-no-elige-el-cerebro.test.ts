/**
 * EL MÉDICO NO ELIGE EL CEREBRO — 7-sep-2026.
 *
 * ── LO QUE PASABA ───────────────────────────────────────────────────────────
 *
 * La pantalla de consulta enseñaba, antes de cada nota, tres botones: ⚡ Rápida
 * (1 crédito), ⭐ Estándar (3) y 💎 Máxima (10). El médico elegía, el cliente
 * mandaba `motor` en el cuerpo de la petición y `/api/expediente/procesar` lo
 * obedecía tal cual.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Lo dijo el dueño, textual: «el usuario no debe ver ni elegir el tipo de
 * inteligencia con la que vas a realizar la nota. Tú vas a elegirla de acuerdo
 * a las necesidades y el criterio que necesites […] Si es algo muy fácil y
 * nomás hacer la nota, utiliza el modelo más rápido, y si necesitas pensar,
 * pues lo usas».
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Es una decisión de ingeniería disfrazada de decisión clínica. Para contestar
 * bien «¿⭐ o 💎?» hay que saber qué modelo hay detrás de cada emoji y cómo
 * rinde en este caso — y eso no lo sabe, ni tiene por qué, quien tiene al
 * paciente enfrente. Además el error se paga en los dos sentidos: de menos, una
 * nota difícil sin razonamiento; de más, diez créditos y treinta segundos para
 * un catarro.
 *
 * ── LA REGLA QUE ESTO HACE SEGURO ───────────────────────────────────────────
 *
 * El punto de partida del enrutador es **Estándar**, no Rápida. El vocabulario
 * de señales es vocabulario, no criterio (regla 5 de `clinical-safety.md`): un
 * término que falte significa que ese caso no se detecta como complejo, no que
 * sea simple. Con el punto de partida en Rápida cada hueco sería una nota
 * difícil redactada con el modelo más barato, en silencio.
 *
 * ── LO QUE ESTA PRUEBA NO CUBRE ─────────────────────────────────────────────
 *
 * · Que el modelo elegido RINDA como se espera. Esto compara claves de motor,
 *   no calidad; eso vive en `contratos-de-evaluacion.ts` y sigue esperando al
 *   médico.
 * · El copiloto de UCI, el consultor de evidencia y la transcripción: cada uno
 *   elige su modelo por su cuenta y esta prueba no los mira.
 * · Que la pantalla se vea bien sin el menú. Eso no se aprueba leyendo código.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { elegirMotorAutomatico, dentroDelTecho } from '@/lib/ia/motor-automatico'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
const ruta = leer('src/app/api/expediente/procesar/route.ts')

describe('lo fácil se redacta rápido', () => {
  it('un seguimiento corto y sin señales baja a Rápida', () => {
    const e = elegirMotorAutomatico({
      tipo: 'seguimiento',
      transcripcion: 'Viene a control. Se siente bien, sin molestias. Continúa igual. Cita en tres meses.',
    })
    expect(e.clave).toBe('rapida')
  })

  it('el pase en vivo es Rápida siempre, aunque el caso sea gravísimo', () => {
    const e = elegirMotorAutomatico(
      { tipo: 'ingreso', transcripcion: 'Paciente en choque séptico con noradrenalina y meropenem.' },
      { enVivo: true },
    )
    expect(e.clave).toBe('rapida')
  })
})

describe('lo difícil se piensa', () => {
  it('un antibiótico saca la nota de Rápida', () => {
    const e = elegirMotorAutomatico({
      tipo: 'seguimiento',
      transcripcion: 'Control. Le doy amoxicilina por la faringitis. Cita en una semana.',
    })
    expect(e.clave).toBe('maxima')
    expect(e.porQue.join(' ')).toContain('antimicrobianos')
  })

  it.each([
    ['embarazo',        'La paciente cursa embarazo de 22 semanas de gestación.'],
    ['anticoagulación', 'Trae INR de control por la warfarina.'],
    ['función renal',   'Tiene creatinina elevada, en protocolo de hemodiálisis.'],
    ['oncología',       'Va a iniciar quimioterapia la semana que viene.'],
    ['gravedad',        'Ingresa por sepsis, con lactato elevado.'],
    ['dosis por kilo',  'Se calcula a 15 mg/kg por dosis.'],
    ['alergia',         'Es alérgico a la penicilina, hizo anafilaxia.'],
  ])('%s sube el nivel', (_motivo, texto) => {
    expect(elegirMotorAutomatico({ tipo: 'seguimiento', transcripcion: texto }).clave).toBe('maxima')
  })

  it('una historia clínica nunca es trivial, aunque sea corta y sin señales', () => {
    const e = elegirMotorAutomatico({ tipo: 'historia_clinica', transcripcion: 'Viene a valoración general.' })
    expect(e.clave).toBe('maxima')
  })

  it('cuatro pautas distintas son polifarmacia aunque no se nombre ningún fármaco de las listas', () => {
    const e = elegirMotorAutomatico({
      tipo: 'seguimiento',
      transcripcion: 'Uno cada 8 horas, otro cada 12 horas, el tercero cada 24 horas y el último cada 6 horas.',
    })
    expect(e.clave).toBe('maxima')
  })
})

describe('la asimetría: cuando no se sabe, NO se acelera', () => {
  /**
   * Ésta es la prueba al revés de la que importa. Si el punto de partida fuera
   * Rápida, este caso —largo, de primera vez, sin una sola palabra de las
   * listas— saldría con el modelo más barato y nadie se enteraría.
   */
  it('un dictado sin ninguna señal conocida se queda en Estándar, no en Rápida', () => {
    const e = elegirMotorAutomatico({
      tipo: 'alta_consulta',
      transcripcion: 'El paciente refiere molestias inespecíficas desde hace varias semanas. '
        + 'Se comenta la evolución y se acuerda vigilancia.',
    })
    expect(e.clave).toBe('estandar')
  })

  it('un seguimiento largo tampoco cuenta como trivial', () => {
    const largo = 'palabra '.repeat(400)
    expect(elegirMotorAutomatico({ tipo: 'seguimiento', transcripcion: largo }).clave).not.toBe('rapida')
  })
})

describe('el plan pone el techo, y sólo hacia abajo', () => {
  it('un caso que pide Máxima en un plan que llega a Estándar se redacta con Estándar', () => {
    expect(dentroDelTecho('maxima', 'estandar')).toBe('estandar')
  })

  it('un caso trivial NO sube al techo del plan', () => {
    expect(dentroDelTecho('rapida', 'maxima')).toBe('rapida')
  })
})

describe('el dato tiene que LLEGAR: la pantalla ya no ofrece la elección', () => {
  it('la pantalla de consulta no pinta el menú de motores', () => {
    expect(page).not.toContain('Nivel de IA para esta nota')
    expect(page).not.toMatch(/MOTORES_UI\.map/)
    expect(page).not.toMatch(/setMotorSel\(/)
  })

  it('la pantalla no manda `motor` al procesar la nota', () => {
    expect(page).not.toMatch(/motor:\s*\(enVivo \|\| preliminar\)/)
    expect(page).not.toContain('motorEfectivo')
  })

  it('la ruta enruta sola y no obedece lo que venga en el cuerpo', () => {
    expect(ruta).toContain('elegirMotorAutomatico')
    expect(ruta).toContain('dentroDelTecho')
    // `body.motor` puede seguir llegando de una PWA vieja, pero no puede mandar.
    expect(ruta).not.toMatch(/body\.motor\s*\?\s*motorPorClave\(body\.motor\)/)
  })
})
