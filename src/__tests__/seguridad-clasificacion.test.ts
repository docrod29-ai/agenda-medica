/**
 * GOLDEN — el esquema de gravedad de las alertas clínicas.
 *
 * Lo que se protege aquí no es una lista de fármacos: es la propiedad que hace
 * útil el sistema de alertas. Con `info | advertencia | critica`, «este fármaco
 * está contraindicado en el embarazo», «ajusta la dosis por función renal» y
 * «vigila el potasio» caían todas en «crítica». Cuando todo es crítico nada lo
 * es, y el médico aprende a pasar por encima del rojo.
 */
import { describe, it, expect } from 'vitest'
import {
  CLASIFICACIONES, conductaDe, etiquetaDe, detiene, masGrave,
  desdeSeveridadHeredada, type Clasificacion,
} from '@/lib/seguridad/clasificacion'

describe('El orden del tipo ES el orden de gravedad', () => {
  it('están los ocho niveles del charter, del peor al más leve', () => {
    expect(CLASIFICACIONES).toEqual([
      'BLOCK', 'CONTRAINDICATED', 'AVOID', 'NOT_RECOMMENDED',
      'DOSE_ADJUST', 'MONITOR', 'PASSIVE', 'INFORMATION',
    ])
  })

  it('cada nivel tiene conducta y etiqueta — ninguno se queda mudo', () => {
    for (const c of CLASIFICACIONES) {
      expect(['detener', 'confirmar', 'informar']).toContain(conductaDe(c))
      expect(etiquetaDe(c).length).toBeGreaterThan(0)
    }
  })
})

describe('Qué detiene y qué no', () => {
  it('sólo lo que no debe administrarse detiene', () => {
    expect(detiene('BLOCK')).toBe(true)
    expect(detiene('CONTRAINDICATED')).toBe(true)
  })

  it('AJUSTAR LA DOSIS no detiene — es la distinción que motivó todo esto', () => {
    // Bloquear la firma por «ajusta la dosis» es exactamente lo que enseña al
    // médico a ignorar las alertas.
    expect(detiene('DOSE_ADJUST')).toBe(false)
    expect(conductaDe('DOSE_ADJUST')).toBe('confirmar')
  })

  it('vigilar e informar no interrumpen', () => {
    expect(conductaDe('MONITOR')).toBe('informar')
    expect(conductaDe('PASSIVE')).toBe('informar')
    expect(conductaDe('INFORMATION')).toBe('informar')
  })
})

describe('masGrave — manda la peor alerta de la receta, no la última', () => {
  it('elige la más grave del conjunto', () => {
    expect(masGrave(['MONITOR', 'BLOCK', 'DOSE_ADJUST'])).toBe('BLOCK')
    expect(masGrave(['INFORMATION', 'AVOID'])).toBe('AVOID')
  })

  it('sin alertas no hay conducta que aplicar', () => {
    expect(masGrave([])).toBeNull()
  })

  it('un valor desconocido no se cuela como grave', () => {
    // Defensivo: si un dato viejo trae una clasificación que ya no existe, lo
    // peligroso sería que se leyera como BLOCK y detuviera todo.
    expect(masGrave(['MONITOR', 'INVENTADO' as Clasificacion])).toBe('MONITOR')
  })
})

describe('El puente desde el modelo viejo NO inventa gravedad', () => {
  it('cada traducción conserva la conducta que hay hoy', () => {
    // 'critica' hoy detiene la firma → CONTRAINDICATED detiene.
    expect(detiene(desdeSeveridadHeredada('critica'))).toBe(true)
    // 'advertencia' hoy sólo avisa → MONITOR informa.
    expect(conductaDe(desdeSeveridadHeredada('advertencia'))).toBe('informar')
    expect(conductaDe(desdeSeveridadHeredada('info'))).toBe('informar')
  })

  it('NO traduce «crítica» a BLOCK', () => {
    // Subirlo a BLOCK convertiría en muro lo que hoy avisa: sería cambiar
    // conducta clínica desde una tabla de conversión.
    expect(desdeSeveridadHeredada('critica')).not.toBe('BLOCK')
  })
})
