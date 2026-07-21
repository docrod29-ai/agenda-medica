import { describe, it, expect } from 'vitest'
import { copiloto, textoParaNota, sistolica, diastolica, mgDeTexto } from '@/lib/expediente/copiloto'

describe('Silencio por defecto', () => {
  it('una consulta normal NO dispara nada: sin ruido no hay confianza', () => {
    expect(copiloto({
      edad: 34, sexo: 'Masculino', alergias: 'Ninguna',
      diagnosticos: [{ descripcion: 'Faringitis aguda' }],
      medicamentos: [{ nombre: 'Paracetamol', dosis: '500 mg' }],
      signos: { ta: '118/76', fc: 78, temperatura: 37.2 },
    })).toHaveLength(0)
  })

  it('sin datos no inventa nada', () => {
    expect(copiloto({})).toHaveLength(0)
  })
})

describe('Alergia contra lo recetado', () => {
  it('CRÍTICO: alérgico a penicilina y se receta una cefalosporina', () => {
    const r = copiloto({
      edad: 40, alergias: 'Penicilina (exantema)',
      medicamentos: [{ nombre: 'Ceftriaxona', dosis: '1 g' }],
    })
    const a = r.find(x => x.id.startsWith('alergia:'))!
    expect(a.nivel).toBe('critico')
    expect(a.titulo).toMatch(/Ceftriaxona/)
    expect(a.detalle).toMatch(/betalact/i)
  })

  it('detecta la familia, no solo el nombre exacto: sulfas y TMP-SMX', () => {
    const r = copiloto({ edad: 40, alergias: 'Alergia a sulfas', medicamentos: [{ nombre: 'Sulfametoxazol con trimetoprim' }] })
    expect(r.some(x => x.nivel === 'critico')).toBe(true)
  })

  it('"Ninguna" o "Negadas" no dispara falsas alarmas', () => {
    for (const a of ['Ninguna', 'Negadas', 'No refiere alergias', '']) {
      expect(copiloto({ edad: 40, alergias: a, medicamentos: [{ nombre: 'Amoxicilina' }] })).toHaveLength(0)
    }
  })

  it('una alergia que NO tiene que ver con lo recetado se queda callada', () => {
    expect(copiloto({ edad: 40, alergias: 'Alergia al polen', medicamentos: [{ nombre: 'Amoxicilina' }] })).toHaveLength(0)
  })
})

describe('Dosis pediátrica contra el peso real', () => {
  it('CRÍTICO: la dosis recetada rebasa el rango para ese peso', () => {
    const r = copiloto({
      edad: 6,
      medicamentos: [{ nombre: 'Paracetamol', dosis: '1 g' }],   // 1000 mg en un niño de 20 kg
      signos: { peso: 20 },
    })
    const d = r.find(x => x.id === 'ped:dosis:Paracetamol')!
    expect(d.nivel).toBe('critico')
    expect(d.titulo).toMatch(/rebasa/i)
    expect(d.detalle).toMatch(/200 a 300/)   // 10-15 mg/kg × 20 kg
  })

  it('una dosis correcta se informa sin alarma', () => {
    const d = copiloto({ edad: 6, medicamentos: [{ nombre: 'Paracetamol', dosis: '250 mg' }], signos: { peso: 20 } })
      .find(x => x.id === 'ped:dosis:Paracetamol')!
    expect(d.nivel).toBe('accion')
    expect(d.titulo).not.toMatch(/rebasa/i)
  })

  it('si falta el peso, pide ESE dato en una línea en vez de pintar un formulario', () => {
    const r = copiloto({ edad: 6, medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }] })
    const p = r.find(x => x.id === 'ped:falta-peso')!
    expect(p.pide).toBe('peso')
    expect(p.textoNota).toBe('')
  })

  it('en adultos no se mete con la dosis pediátrica', () => {
    expect(copiloto({ edad: 40, medicamentos: [{ nombre: 'Paracetamol', dosis: '1 g' }], signos: { peso: 70 } })
      .some(x => x.id.startsWith('ped:'))).toBe(false)
  })
})

describe('Ajuste renal de lo recetado', () => {
  it('CRÍTICO: metformina con función renal muy baja', () => {
    const r = copiloto({
      edad: 75, sexo: 'Masculino',
      medicamentos: [{ nombre: 'Metformina', dosis: '850 mg' }],
      labs: { creatinina: 3.2 },
    })
    const m = r.find(x => x.id === 'renal:Metformina')!
    expect(m.nivel).toBe('critico')
    expect(m.detalle).toMatch(/acidosis láctica/i)
  })

  it('con función renal normal no molesta', () => {
    expect(copiloto({ edad: 40, sexo: 'Masculino', medicamentos: [{ nombre: 'Metformina' }], labs: { creatinina: 0.9 } })
      .some(x => x.id.startsWith('renal:'))).toBe(false)
  })
})

describe('Riesgo gestacional', () => {
  it('CRÍTICO: isotretinoína en mujer en edad fértil', () => {
    const r = copiloto({ edad: 24, sexo: 'Femenino', medicamentos: [{ nombre: 'Isotretinoína' }] })
    const g = r.find(x => x.id.startsWith('gesta:'))!
    expect(g.nivel).toBe('critico')
    // El detalle debe orientar sobre el embarazo (texto correcto en ambos casos:
    // suspender si embarazada / descartar si no).
    expect(g.detalle).toMatch(/embaraz/i)
  })
  it('no aplica a hombres ni fuera de la edad fértil', () => {
    expect(copiloto({ edad: 24, sexo: 'Masculino', medicamentos: [{ nombre: 'Isotretinoína' }] })
      .some(x => x.id.startsWith('gesta:'))).toBe(false)
    expect(copiloto({ edad: 70, sexo: 'Femenino', medicamentos: [{ nombre: 'Isotretinoína' }] })
      .some(x => x.id.startsWith('gesta:'))).toBe(false)
  })
})

describe('Signos vitales que ya cruzaron umbral', () => {
  it('qSOFA se declara positivo SOLO cuando los dos componentes medibles ya suman 2', () => {
    const positivo = copiloto({ edad: 70, signos: { fr: 26, ta: '88/54' } })
    expect(positivo.find(x => x.id === 'vital:qsofa')!.nivel).toBe('critico')
    // Con uno solo NO se afirma, porque el puntaje todavía podría no llegar.
    expect(copiloto({ edad: 70, signos: { fr: 26, ta: '130/80' } }).some(x => x.id === 'vital:qsofa')).toBe(false)
  })

  it('hipoxemia, hipotensión y crisis hipertensiva salen como críticas', () => {
    expect(copiloto({ edad: 60, signos: { spo2: 86 } }).find(x => x.id === 'vital:hipoxemia')!.nivel).toBe('critico')
    expect(copiloto({ edad: 60, signos: { ta: '85/50' } }).find(x => x.id === 'vital:hipotension')!.nivel).toBe('critico')
    expect(copiloto({ edad: 60, signos: { ta: '190/115' } }).find(x => x.id === 'vital:crisis-ht')!.nivel).toBe('critico')
  })

  it('una sola toma alta NO diagnostica hipertensión y el texto lo dice', () => {
    const h = copiloto({ edad: 50, signos: { ta: '150/95' } }).find(x => x.id === 'vital:ht')!
    expect(h.nivel).toBe('info')
    expect(h.detalle).toMatch(/no diagnostica/i)
  })

  it('signos normales no generan nada', () => {
    expect(copiloto({ edad: 40, signos: { ta: '120/78', fc: 72, fr: 16, temperatura: 36.6, spo2: 98 } })).toHaveLength(0)
  })
})

describe('Cálculos que salen solos', () => {
  it('IMC se calcula sin pedir nada, y en niños avisa que va por percentil', () => {
    const adulto = copiloto({ edad: 40, signos: { peso: 92, talla: 170 } }).find(x => x.id === 'calc:imc')!
    expect(adulto.titulo).toMatch(/31\.8/)
    expect(adulto.detalle).toMatch(/Obesidad clase I/)
    const nino = copiloto({ edad: 10, signos: { peso: 40, talla: 140 } }).find(x => x.id === 'calc:imc')!
    expect(nino.detalle).toMatch(/percentil/i)
  })

  it('TFG y FIB-4 se calculan si los laboratorios ya están en la nota', () => {
    const r = copiloto({ edad: 62, sexo: 'Masculino', labs: { creatinina: 1.4, ast: 45, alt: 30, plaquetas: 180 } })
    expect(r.find(x => x.id === 'calc:tfg')).toBeDefined()
    expect(r.find(x => x.id === 'calc:fib4')).toBeDefined()
  })
})

describe('Metas según el diagnóstico', () => {
  it('diabetes fija la meta de LDL y dice cuánto falta', () => {
    const m = copiloto({ edad: 55, diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2' }], labs: { ldl: 130 } })
      .find(x => x.id === 'meta:ldl')!
    expect(m.titulo).toMatch(/100/)
    expect(m.detalle).toMatch(/faltan 30/i)
    expect(m.nivel).toBe('accion')
  })

  it('con ASCVD la meta baja', () => {
    const m = copiloto({ edad: 60, diagnosticos: [{ descripcion: 'Cardiopatía isquémica, infarto previo' }] })
      .find(x => x.id === 'meta:ldl')!
    expect(m.titulo).toMatch(/70/)
  })

  it('en diabetes recuerda el FIB-4 aunque las enzimas estén normales', () => {
    const f = copiloto({ edad: 55, diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2' }] })
      .find(x => x.id === 'meta:fib4-tamizaje')!
    expect(f.detalle).toMatch(/AUNQUE las enzimas/i)
    expect(f.pide).toMatch(/AST/)
  })

  it('si los laboratorios ya están, ya no lo pide: lo calcula', () => {
    const r = copiloto({ edad: 55, diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2' }], labs: { ast: 40, alt: 35, plaquetas: 200 } })
    expect(r.some(x => x.id === 'meta:fib4-tamizaje')).toBe(false)
    expect(r.some(x => x.id === 'calc:fib4')).toBe(true)
  })
})

describe('Orden y salida', () => {
  it('lo que puede dañar al paciente va primero', () => {
    const r = copiloto({
      edad: 8, alergias: 'Penicilina',
      medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }],
      signos: { peso: 25, talla: 128, ta: '100/65' },
    })
    expect(r[0].nivel).toBe('critico')
    const niveles = r.map(x => x.nivel)
    expect(niveles.indexOf('info')).toBeGreaterThan(niveles.indexOf('critico'))
  })

  it('el texto para la nota omite lo que no vale la pena documentar', () => {
    const r = copiloto({ edad: 6, medicamentos: [{ nombre: 'Amoxicilina' }] })   // solo "falta peso"
    expect(textoParaNota(r)).toBe('')
  })

  it('no repite el mismo hallazgo dos veces', () => {
    const r = copiloto({ edad: 40, alergias: 'Penicilina', medicamentos: [{ nombre: 'Amoxicilina' }, { nombre: 'Amoxicilina' }] })
    expect(new Set(r.map(x => x.id)).size).toBe(r.length)
  })
})

describe('Utilidades', () => {
  it('lee la tensión arterial escrita como texto', () => {
    expect(sistolica('120/80')).toBe(120)
    expect(diastolica('120/80')).toBe(80)
    expect(sistolica('mal dato')).toBeUndefined()
    expect(sistolica(undefined)).toBeUndefined()
  })
  it('convierte gramos a miligramos en el texto de la dosis', () => {
    expect(mgDeTexto('1 g')).toBe(1000)
    expect(mgDeTexto('500 mg')).toBe(500)
    expect(mgDeTexto('0.5 g')).toBe(500)
    expect(mgDeTexto('una cucharada')).toBeUndefined()
  })
})

describe('Riesgo cardiovascular con PREVENT', () => {
  const paciente = {
    edad: 50, sexo: 'Femenino',
    diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2, hipertensión arterial' }],
    medicamentos: [{ nombre: 'Losartán', dosis: '50 mg' }],
    signos: { ta: '160/95' },
    labs: { colesterolTotal: 200, hdl: 45, tfg: 90 },
  }

  it('calcula el riesgo con lo que ya está en la nota, sin pedir nada', () => {
    const r = copiloto(paciente).find(x => x.id === 'prevent:riesgo')!
    expect(r.titulo).toMatch(/9\.2%/)          // el caso de referencia validado
    expect(r.textoNota).toMatch(/PREVENT/)
  })

  it('si falta un laboratorio dice CUÁL en una línea, sin formulario', () => {
    const r = copiloto({ ...paciente, labs: { colesterolTotal: 200 } }).find(x => x.id === 'prevent:falta')!
    expect(r.pide).toMatch(/HDL/)
    expect(r.textoNota).toBe('')
  })

  it('NO aplica en prevención secundaria: ahí la meta la fija el evento previo', () => {
    const r = copiloto({ ...paciente, diagnosticos: [{ descripcion: 'Infarto agudo de miocardio previo' }] })
    expect(r.some(x => x.id.startsWith('prevent:'))).toBe(false)
  })

  it('fuera de 30 a 79 años no se menciona siquiera', () => {
    expect(copiloto({ ...paciente, edad: 25 }).some(x => x.id.startsWith('prevent:'))).toBe(false)
    expect(copiloto({ ...paciente, edad: 85 }).some(x => x.id.startsWith('prevent:'))).toBe(false)
  })

  it('detecta el antihipertensivo y la estatina de la propia receta', () => {
    const sinEstatina = copiloto(paciente).find(x => x.id === 'prevent:riesgo')!
    const conEstatina = copiloto({ ...paciente, medicamentos: [...paciente.medicamentos, { nombre: 'Atorvastatina', dosis: '40 mg' }] })
      .find(x => x.id === 'prevent:riesgo')!
    expect(conEstatina.titulo).not.toBe(sinEstatina.titulo)
  })
})

describe('Regresión: PREVENT no rompe el silencio por defecto', () => {
  it('en una faringitis NO pide laboratorios de riesgo cardiovascular', () => {
    expect(copiloto({
      edad: 34, sexo: 'Masculino', alergias: 'Ninguna',
      diagnosticos: [{ descripcion: 'Faringitis aguda' }],
      medicamentos: [{ nombre: 'Paracetamol', dosis: '500 mg' }],
      signos: { ta: '118/76', fc: 78, temperatura: 37.2 },
    })).toHaveLength(0)
  })

  it('en un paciente con hipertensión SÍ los pide, porque ahí sí viene al caso', () => {
    const r = copiloto({
      edad: 55, sexo: 'Masculino',
      diagnosticos: [{ descripcion: 'Hipertensión arterial sistémica' }],
      signos: { ta: '150/92' },
    })
    expect(r.some(x => x.id === 'prevent:falta')).toBe(true)
  })
})
