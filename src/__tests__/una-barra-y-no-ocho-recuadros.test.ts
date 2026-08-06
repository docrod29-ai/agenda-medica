/**
 * UNA BARRA DE TRES NIVELES, NO OCHO RECUADROS — REG-181.
 *
 * ── LA PANTALLA QUE LO MOTIVÓ (5-ago-2026) ───────────────────────────────────
 *
 * El Dr. mandó la captura de su consulta: ocho bloques de aviso apilados sobre
 * la nota, ~40 elementos, y **sólo uno le impedía firmar**. Tres eran rojos y
 * dos de los tres no bloqueaban nada.
 *
 * Lo que se comprueba aquí no es que la barra se vea bonita: es que **ningún
 * aviso se perdió al reordenarlos**, que lo que puede matar hoy no se pliega, y
 * que la tabla de niveles no se pueda degradar en silencio — que es el riesgo
 * que este rediseño introduce.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  construirAvisos, resumirAvisos, fijos, plegables, naceAbierto,
  NIVEL, NO_SE_PLIEGAN, CABEN_SIN_ESTORBAR,
  type OrigenAviso,
} from '@/lib/expediente/avisos-consulta'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const barra = leer('src', 'components', 'AntesDeFirmar.tsx')
const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

/** Los nueve orígenes, para que añadir uno obligue a declarar su nivel. */
const ORIGENES: OrigenAviso[] = [
  'dosis_incompleta', 'alergia_medicamento', 'contradiccion_negacion',
  'desajuste_temporal', 'via_asumida', 'interaccion', 'controlado',
  'conflicto_extraccion', 'dato_no_precisado',
]

describe('la tabla de niveles no se puede degradar en silencio', () => {
  it('los nueve orígenes tienen nivel explícito', () => {
    for (const o of ORIGENES) {
      expect(NIVEL[o], `${o} sin nivel declarado`).toBeDefined()
      expect(['bloquea', 'revisa', 'contexto']).toContain(NIVEL[o])
    }
  })

  it('la tabla no tiene entradas de más ni de menos', () => {
    expect(Object.keys(NIVEL).sort()).toEqual([...ORIGENES].sort())
  })

  it('sólo la dosis bloquea — es la única compuerta que pidió el Dr.', () => {
    const bloquean = ORIGENES.filter(o => NIVEL[o] === 'bloquea')
    expect(bloquean).toEqual(['dosis_incompleta'])
  })

  it('«bloquea» NO significa «es lo más grave»', () => {
    // El cruce alergia ↔ medicamento es lo peor de la pantalla y no bloquea:
    // esa decisión es del médico dueño, no del software.
    expect(NIVEL.alergia_medicamento).toBe('revisa')
    expect(NO_SE_PLIEGAN).toContain('alergia_medicamento')
  })
})

describe('lo que puede matar hoy nunca se pliega', () => {
  it('alergia ↔ medicamento sale a la vista aunque haya veinte avisos más', () => {
    const avisos = construirAvisos({
      alergiaMedicamento: [{ mensaje: 'penicilina con amoxicilina', severidad: 'critica' }],
      conflictos: Array.from({ length: 20 }, (_, i) => `conflicto ${i}`),
    })
    expect(fijos(avisos).map(a => a.origen)).toContain('alergia_medicamento')
    expect(plegables(avisos).map(a => a.origen)).not.toContain('alergia_medicamento')
  })

  it('la contradicción del dictado tampoco se pliega', () => {
    const avisos = construirAvisos({
      contradicciones: [{ condicion: 'diabetes', mensaje: 'la nota afirma diabetes' }],
    })
    expect(fijos(avisos)).toHaveLength(1)
  })

  it('el desajuste temporal sí se pliega — es de otro peso', () => {
    const avisos = construirAvisos({
      desajustes: [{ condicion: 'fractura', mensaje: 'la nota la da por actual' }],
    })
    expect(plegables(avisos)).toHaveLength(1)
    expect(fijos(avisos)).toHaveLength(0)
  })
})

describe('ningún aviso se perdió al reordenarlos', () => {
  it('los siete motores siguen llegando a la barra', () => {
    const avisos = construirAvisos({
      dosisIncompletas: [{ med: 'levotiroxina', mensaje: 'sin cantidad' }],
      alergiaMedicamento: [{ mensaje: 'penicilina', severidad: 'critica' }],
      contradicciones: [{ condicion: 'diabetes', mensaje: 'x' }],
      desajustes: [{ condicion: 'fractura', mensaje: 'y' }],
      viasAsumidas: ['losartán'],
      avisoDeVia: 'No se dictó la vía de losartán',
      interacciones: [{ titulo: 'AINE + IECA', detalle: 'riesgo renal', severidad: 'mayor' }],
      controlados: [{ farmaco: 'clonazepam', requisito: 'receta especial' }],
      conflictos: ['dos fechas distintas'],
      faltantesCriticos: ['confirmación bacteriológica'],
    })
    const origenes = new Set(avisos.map(a => a.origen))
    for (const o of ORIGENES) expect(origenes, `${o} se perdió`).toContain(o)
  })

  it('el conteo del encabezado dice la verdad', () => {
    const avisos = construirAvisos({
      dosisIncompletas: [{ med: 'a', mensaje: 'm' }, { med: 'b', mensaje: 'm' }],
      conflictos: ['c1', 'c2', 'c3'],
    })
    expect(resumirAvisos(avisos)).toEqual({ bloquean: 2, revisar: 3 })
  })

  it('sin nada que decir, no hay avisos', () => {
    expect(construirAvisos({})).toHaveLength(0)
    expect(resumirAvisos([])).toEqual({ bloquean: 0, revisar: 0 })
  })
})

describe('los ecos se caen — cuatro de las nueve viñetas lo eran', () => {
  it('un faltante que nombra un fármaco ya bloqueado no se repite', () => {
    const avisos = construirAvisos({
      dosisIncompletas: [{ med: 'dapagliflozina', mensaje: 'sin cantidad' }],
      faltantesCriticos: ['Dosis de dapagliflozina no especificada'],
    })
    expect(avisos.filter(a => a.origen === 'dato_no_precisado')).toHaveLength(0)
    expect(avisos).toHaveLength(1)
  })

  it('pero un faltante de otra cosa sí llega', () => {
    const avisos = construirAvisos({
      dosisIncompletas: [{ med: 'dapagliflozina', mensaje: 'sin cantidad' }],
      faltantesCriticos: ['Confirmación bacteriológica no referida'],
    })
    expect(avisos.filter(a => a.origen === 'dato_no_precisado')).toHaveLength(1)
  })
})

describe('lo ya descartado no resucita', () => {
  it('«Ya lo revisé» sobre la contradicción la quita', () => {
    expect(construirAvisos({
      contradicciones: [{ condicion: 'diabetes', mensaje: 'x' }],
      revisados: new Set(['negacion:diabetes']),
    })).toHaveLength(0)
  })

  it('la vía descartada tampoco vuelve', () => {
    expect(construirAvisos({
      viasAsumidas: ['losartán'],
      avisoDeVia: 'No se dictó la vía de losartán',
      revisados: new Set(['via:losartán']),
    })).toHaveLength(0)
  })

  it('pero lo que BLOQUEA no se puede descartar de ninguna forma', () => {
    // Un botón que sólo esconde el mensaje sería una promesa falsa: la firma
    // seguiría sin dejarse pulsar y el médico no sabría por qué.
    const a = construirAvisos({
      dosisIncompletas: [{ med: 'levotiroxina', mensaje: 'sin cantidad' }],
      revisados: new Set(['dosis:levotiroxina']),
    })
    expect(a).toHaveLength(1)
    expect(a[0].descartable).toBe(false)
  })
})

describe('el plegado no esconde lo que cabe', () => {
  it(`con ${CABEN_SIN_ESTORBAR} o menos nace abierto`, () => {
    expect(naceAbierto(1)).toBe(true)
    expect(naceAbierto(CABEN_SIN_ESTORBAR)).toBe(true)
  })
  it('con más, se pliega para devolver la nota a la pantalla', () => {
    expect(naceAbierto(CABEN_SIN_ESTORBAR + 1)).toBe(false)
  })
  it('sin plegables, no hay grupo que abrir', () => {
    expect(naceAbierto(0)).toBe(false)
  })
})

describe('está conectado de verdad, no sólo escrito', () => {
  it('la consulta usa la barra y ya no los siete recuadros', () => {
    expect(page).toContain('<AntesDeFirmar')
    expect(page).toContain('construirAvisos(')
  })

  it('los títulos de los recuadros viejos desaparecieron de la pantalla', () => {
    for (const t of [
      'title="No se dictó la vía de administración"',
      'title="La nota afirma algo que en el dictado se negó"',
      'title="Alergia ↔ medicamento"',
      'title="Dosis incompleta — no se puede firmar hasta corregirlo"',
    ]) expect(page, `quedó el recuadro viejo: ${t}`).not.toContain(t)
  })

  it('el panel de revisión ya no va suelto: vive plegado dentro', () => {
    expect(page).toContain('sinMarco')
    // Un solo montaje del panel en toda la pantalla.
    expect(page.split('<RevisionPanel').length - 1).toBe(1)
  })

  it('la barra no se puede cerrar entera', () => {
    // Se pliegan niveles; la barra no. Sin ella el médico no tendría dónde
    // enterarse — que es peor que el ruido que se está quitando.
    expect(barra).not.toContain('Ocultar')
    expect(barra).toContain('POR_QUE_NO_SE_PUEDE_CERRAR')
  })

  it('el renglón que bloquea lleva role="alert"', () => {
    expect(barra).toContain("role={bloquean > 0 ? 'alert' : 'status'}")
  })

  it('el botón lleva al sitio del problema', () => {
    expect(barra).toContain('Escribir la dosis')
    expect(page).toContain("getElementById('seccion-medicamentos')")
    expect(page).toContain('id="seccion-medicamentos"')
  })

  it('y el precio que se paga está escrito, no escondido', () => {
    expect(barra).toContain('EL_PRECIO_QUE_SE_PAGA')
  })
})
