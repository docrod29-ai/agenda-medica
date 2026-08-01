/**
 * SÓLO SE DERIVA LO QUE EL MÉDICO ESCRIBIÓ.
 *
 * Un estudio en la orden es un hecho: está en la lista. Que «este paciente
 * debería volver en tres meses» es criterio clínico, y no sale de un archivo de
 * software — si el médico no puso fecha, no se le inventa una.
 *
 * Y no es sólo una cuestión de límites: un worklist que se llena de tareas que
 * nadie pidió se abandona en una semana, y entonces tampoco se ve el estudio que
 * sí importaba.
 */
import { describe, it, expect } from 'vitest'
import { tareasDeNota, tareaDeResultado, DIAS_PARA_RECLAMAR_ESTUDIO } from '@/lib/tareas-clinicas/derivar'

const AHORA = Date.parse('2026-08-01T12:00:00Z')
const NOTA = {
  id: 'n1', clinicId: 'c1', pacienteId: 'p1', pacienteNombre: 'Paciente Sintético',
  medicoUid: 'u-med', medicoNombre: 'Dra. Ficticia',
}

describe('los estudios pedidos', () => {
  it('UNO POR ESTUDIO, no «revisar los estudios»', () => {
    /**
     * Agruparlos en una sola tarea permite cerrarla habiendo mirado sólo el
     * primero — que es exactamente cómo se pierde el segundo.
     */
    const t = tareasDeNota({ ...NOTA, estudiosOrden: ['Biometría hemática', 'Perfil tiroideo'] }, AHORA)
    const estudios = t.filter(x => x.tipo === 'estudio_pendiente')
    expect(estudios).toHaveLength(2)
    expect(estudios.map(e => e.titulo)).toEqual(['Biometría hemática', 'Perfil tiroideo'])
  })

  it('nacen con FECHA: sin ella un pendiente no reclama nunca', () => {
    const t = tareasDeNota({ ...NOTA, estudiosOrden: ['Biometría'] }, AHORA)[0]
    expect(t.venceEn).toBe(new Date(AHORA + DIAS_PARA_RECLAMAR_ESTUDIO * 86_400_000).toISOString())
  })

  it('y con DUEÑO: quien pidió el estudio es quien ve el resultado', () => {
    const t = tareasDeNota({ ...NOTA, estudiosOrden: ['Biometría'] }, AHORA)[0]
    expect(t.ownerUid).toBe('u-med')
  })

  it('el detalle dice cuándo se cierra, que es la parte que se malentiende', () => {
    const t = tareasDeNota({ ...NOTA, estudiosOrden: ['Biometría'] }, AHORA)[0]
    expect(t.detalle).toMatch(/resultado esté revisado, no cuando el estudio esté hecho/)
  })

  it('los renglones vacíos no generan tareas fantasma', () => {
    const t = tareasDeNota({ ...NOTA, estudiosOrden: ['', '   ', 'Biometría'] }, AHORA)
    expect(t.filter(x => x.tipo === 'estudio_pendiente')).toHaveLength(1)
  })
})

describe('la receta', () => {
  it('una tarea por consulta, no por medicamento', () => {
    // La receta se entrega entera: seis tareas para una hoja sería ruido.
    const t = tareasDeNota({ ...NOTA, medicamentos: [{ nombre: 'Losartán' }, { nombre: 'Metformina' }] }, AHORA)
    const recetas = t.filter(x => x.tipo === 'receta_por_entregar')
    expect(recetas).toHaveLength(1)
    expect(recetas[0].titulo).toMatch(/2 medicamentos/)
  })

  it('sin medicamentos no hay nada que entregar', () => {
    expect(tareasDeNota({ ...NOTA, medicamentos: [] }, AHORA).filter(x => x.tipo === 'receta_por_entregar')).toHaveLength(0)
  })

  it('vence pronto: una receta se entrega el mismo día o no se entrega', () => {
    const t = tareasDeNota({ ...NOTA, medicamentos: [{ nombre: 'X' }] }, AHORA)[0]
    expect(Date.parse(t.venceEn!) - AHORA).toBeLessThanOrEqual(86_400_000)
  })
})

describe('EL SEGUIMIENTO NO SE INVENTA', () => {
  it('sin fecha del médico, no hay tarea de seguimiento', () => {
    /**
     * Inventar un «vuelva en tres meses» sería criterio clínico salido de un
     * archivo de software. Y además llenaría el worklist de tareas que nadie
     * pidió, que es como se abandona un worklist.
     */
    const t = tareasDeNota({ ...NOTA, estudiosOrden: ['Biometría'] }, AHORA)
    expect(t.filter(x => x.tipo === 'seguimiento')).toHaveLength(0)
  })

  it('con fecha del médico, sí — y vence ese día', () => {
    const t = tareasDeNota({ ...NOTA, proximoSeguimiento: '2026-11-01' }, AHORA)
    const seg = t.find(x => x.tipo === 'seguimiento')!
    expect(seg).toBeTruthy()
    expect(seg.venceEn?.slice(0, 10)).toBe('2026-11-01')
    expect(seg.detalle).toMatch(/2026-11-01/)
  })

  it('una fecha ilegible deja la tarea SIN vencimiento, no con una inventada', () => {
    const t = tareasDeNota({ ...NOTA, proximoSeguimiento: 'en tres meses' }, AHORA)
    expect(t.find(x => x.tipo === 'seguimiento')!.venceEn).toBeUndefined()
  })
})

describe('una nota sin cabos sueltos no genera nada', () => {
  it('cero tareas, no una «revisar la consulta»', () => {
    expect(tareasDeNota(NOTA, AHORA)).toEqual([])
  })
})

describe('cuando LLEGA el resultado', () => {
  const p = { clinicId: 'c1', patientId: 'p1', estudio: 'Potasio', ahoraMs: AHORA }

  it('el estudio hecho NO es el final del camino', () => {
    // Ésta es la mitad que faltaba: alguien tiene que mirarlo.
    const t = tareaDeResultado({ ...p, critico: false })
    expect(t.tipo).toBe('resultado_por_revisar')
    expect(t.estado).toBe('solicitada')
  })

  it('un valor CRÍTICO nace con prioridad crítica y vence el mismo día', () => {
    const t = tareaDeResultado({ ...p, critico: true })
    expect(t.prioridad).toBe('critica')
    expect(Date.parse(t.venceEn!) - AHORA).toBeLessThanOrEqual(86_400_000)
    expect(t.detalle).toMatch(/crítico/i)
  })

  it('uno normal es «alta», no «normal»: un resultado sin leer nunca es rutina', () => {
    expect(tareaDeResultado({ ...p, critico: false }).prioridad).toBe('alta')
  })

  it('deja constancia de que vino del laboratorio', () => {
    expect(tareaDeResultado({ ...p, critico: false }).origen).toBe('laboratorio')
  })
})
