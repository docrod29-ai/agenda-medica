/**
 * GOLDEN — el motor de dosificación por fin le llega al médico, y el formulario
 * no convierte «no sé» en un número.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `src/lib/dosing/motor.ts` llevaba semanas escrito y probado —291 líneas que
 * eligen cuál de las cuatro reglas del fármaco aplica a ESTE paciente y
 * devuelven `SPECIALIST_REVIEW` cuando falta un dato— **sin que lo llamara
 * nadie**. La pantalla `/uci/dosificacion` enseñaba y firmaba el *dataset*, que
 * es otra cosa: el médico veía las reglas, no la selección.
 *
 * Lo destapó el guardián de huérfanos al repararse en v935. Antes, el nombre
 * `motor` coincidía con otros módulos y éste pasaba por «usado».
 *
 * ── Y EL ERROR QUE UN FORMULARIO INTRODUCE SIEMPRE ───────────────────────────
 *
 * El motor recibe tipos exactos; un formulario devuelve texto. `Number('')` es
 * **0**, no `NaN`. Un peso vacío leído como `0 kg` no manda a revisión: manda a
 * una dosis en mg/kg calculada sobre cero. Un CrCl vacío leído como `0 mL/min`
 * elige la rama renal más agresiva del dataset para un riñón sano.
 *
 * Por eso `construirContexto` existe y por eso estas pruebas son sobre el vacío.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  construirContexto, conValidacionDelMedico, numeroOpcional, boolOpcional, COMO_SE_LEE,
} from '@/lib/dosing/consulta'
import { recomendar } from '@/lib/dosing/motor'
import { fechaCorta } from '@/lib/formato/fecha'

describe('un campo vacío es «no sé», nunca un cero', () => {
  it('`numeroOpcional` no convierte el vacío en 0', () => {
    // Number('') === 0 y Number('   ') === 0: ésa es la trampa.
    expect(numeroOpcional('')).toBeUndefined()
    expect(numeroOpcional('   ')).toBeUndefined()
    expect(numeroOpcional(undefined)).toBeUndefined()
  })

  it('ni el texto que no es número', () => {
    expect(numeroOpcional('setenta')).toBeUndefined()
    expect(numeroOpcional('70kg')).toBeUndefined()
  })

  it('y rechaza los negativos, que son dedazos', () => {
    // Un CrCl de -8 elegiría la rama renal más agresiva del dataset.
    expect(numeroOpcional('-8')).toBeUndefined()
    expect(numeroOpcional('0')).toBe(0)   // cero ESCRITO sí es un dato
    expect(numeroOpcional('72.5')).toBe(72.5)
  })

  it('`boolOpcional`: sin elegir NO es «no»', () => {
    // «¿es neumonía?» sin responder tiene que quedar en faltantes, no en «no».
    expect(boolOpcional('')).toBeUndefined()
    expect(boolOpcional(undefined)).toBeUndefined()
    expect(boolOpcional('si')).toBe(true)
    expect(boolOpcional('no')).toBe(false)
  })
})

describe('construirContexto no inventa lo que no se declaró', () => {
  it('un formulario en blanco deja todo sin declarar', () => {
    const c = construirContexto({ farmaco: 'meropenem' })
    expect(c.pesoKg).toBeUndefined()
    expect(c.crClMlMin).toBeUndefined()
    expect(c.gravedad).toBeUndefined()
    expect(c.rrt).toBeUndefined()
    expect(c.esNeumonia).toBeUndefined()
  })

  it('descarta los valores que no están en el dominio', () => {
    // Un desplegable manipulado no puede colar una rama que el motor no conoce.
    const c = construirContexto({ farmaco: 'x', gravedad: 'gravisimo', rrt: 'CVVHDX', escalarPeso: 'kg' })
    expect(c.gravedad).toBeUndefined()
    expect(c.rrt).toBeUndefined()
    expect(c.escalarPeso).toBeUndefined()
  })

  it('los textos en blanco no viajan como cadena vacía', () => {
    const c = construirContexto({ farmaco: 'meropenem', indicacion: '  ', organismo: '' })
    expect(c.indicacion).toBeUndefined()
    expect(c.organismo).toBeUndefined()
  })
})

describe('EL CASO QUE SE ROMPÍA: el vacío llegando como cero', () => {
  it('sin peso, una regla en mg/kg pide el peso en vez de dosificar sobre 0', () => {
    const rec = recomendar(construirContexto({ farmaco: 'Amikacin', pesoKg: '' }))
    expect(rec.estado).toBe('SPECIALIST_REVIEW')
    expect(rec.faltantes.join(' ')).toMatch(/peso|escalar/i)
  })

  it('un fármaco que no está en el dataset NO se deduce de otro parecido', () => {
    const rec = recomendar(construirContexto({ farmaco: 'antibiótico inventado' }))
    expect(rec.estado).toBe('SPECIALIST_REVIEW')
    expect(rec.reglaAplicada).toBeNull()
    expect(rec.faltantes.join(' ')).toMatch(/cada fármaco tiene su farmacocinética/i)
  })
})

describe('el rastro de auditoría incluye lo que disparó el bloqueo', () => {
  it('los tres booleanos aparecen en `entradasUsadas`', () => {
    /**
     * Antes no salían: `renalInestable`, `esNeumonia` y
     * `sedacionYVentilacionAseguradas` cambian el resultado —pueden BLOQUEAR— y
     * el rastro no los mencionaba. Un registro que omite el dato por el que se
     * bloqueó no explica la decisión que se tomó.
     */
    const rec = recomendar(construirContexto({
      farmaco: 'meropenem', renalInestable: 'si', esNeumonia: 'no',
      sedacionYVentilacionAseguradas: 'no',
    }))
    expect(rec.entradasUsadas.renalInestable).toBe(true)
    expect(rec.entradasUsadas.esNeumonia).toBe(false)
    expect(rec.entradasUsadas.sedacionYVentilacionAseguradas).toBe(false)
  })
})

describe('la validación la pone quien puede saberla', () => {
  const rec = recomendar(construirContexto({ farmaco: 'meropenem' }))

  it('el motor puro sólo puede decir «como mínimo, sin validar»', () => {
    // No lee Firestore, y hace bien. Ese campo es un piso, no un veredicto.
    expect(rec.validacion).toBe('sin_validar')
  })

  it('con firma vigente, la pantalla lo levanta y dice quién y cuándo', () => {
    const con = conValidacionDelMedico(rec, {
      estado: 'validado',
      firma: {
        farmaco: 'meropenem', validadoPor: 'u1', validadoPorNombre: 'Dr. X',
        fecha: '2026-08-01T10:00:00.000Z', versionDataset: '1.0', huellaDataset: 'h', nota: '',
      },
    })
    expect(con.validacion).toBe('validado_por_medico')
    expect(con.avisoValidacion).toContain('Dr. X')
        /* Antes exigía el ISO literal. La fecha sigue llegando —es lo que este caso
       protege—, pero ahora en es-MX, como todo el producto (unidad 93). Se
       compara con el mismo formateador para no clavar una abreviatura de mes
       que depende del ICU del entorno. */
    expect(con.avisoValidacion).toContain(fechaCorta('2026-08-01'))
  })

  it('una firma CADUCADA no cuenta como validada', () => {
    // Describe unos números que ya no son los que están en pantalla.
    const con = conValidacionDelMedico(rec, {
      estado: 'caducada', porQue: 'Se validó la versión 0.9 y ahora está cargada la 1.0.',
      firma: {
        farmaco: 'meropenem', validadoPor: 'u1', validadoPorNombre: 'Dr. X',
        fecha: '2026-07-01T10:00:00.000Z', versionDataset: '0.9', huellaDataset: 'vieja', nota: '',
      },
    })
    expect(con.validacion).toBe('sin_validar')
    expect(con.avisoValidacion).toContain('0.9')
  })
})

describe('la pantalla llama al motor de verdad', () => {
  const s = readFileSync(
    join(process.cwd(), 'src', 'app', '(dashboard)', 'uci', 'dosificacion', 'page.tsx'), 'utf8')

  it('importa y ejecuta `recomendar`', () => {
    expect(s).toContain("from '@/lib/dosing/motor'")
    expect(s).toContain('recomendar(construirContexto(campos))')
  })

  it('y superpone las firmas del consultorio', () => {
    expect(s).toContain('conValidacionDelMedico(rec, estadoDe(')
  })

  it('un BLOQUEO no enseña ninguna cifra', () => {
    // El motor ya devuelve `reglaAplicada: null`; la pantalla no debe rellenarlo
    // por su cuenta desde el dataset.
    expect(s).toContain('{rec.reglaAplicada && (')
    expect(COMO_SE_LEE.BLOCKED.explicacion).toMatch(/no se enseña ninguna cifra/i)
  })

  it('los tres estados tienen su explicación en pantalla', () => {
    for (const k of ['CLEAR', 'BLOCKED', 'SPECIALIST_REVIEW'] as const) {
      expect(COMO_SE_LEE[k].explicacion.length).toBeGreaterThan(60)
    }
  })
})
