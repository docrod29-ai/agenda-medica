/**
 * EL LABORATORIO HECHO, EL RESULTADO EN EL SISTEMA, Y NADIE QUE LO LEA.
 *
 * «No dar seguimiento a un resultado» es de las causas más constantes de daño
 * evitable en consulta externa, y no ocurre por ignorancia clínica: ocurre
 * porque el pendiente vivía en una frase dentro de una nota firmada — sin dueño,
 * sin fecha, y en un sitio donde nadie vuelve a mirar.
 *
 * Las pruebas que mandan aquí son dos: que «completada» NO sea «cerrada», y que
 * una tarea sin dueño se note.
 */
import { describe, it, expect } from 'vitest'
import {
  puedeTransicionar, estaVencida, debeEscalar, estaViva, ordenWorklist,
  type TareaClinica,
} from '@/lib/tareas-clinicas/modelo'

const AHORA = Date.parse('2026-08-01T12:00:00Z')
const hace = (h: number) => new Date(AHORA - h * 3_600_000).toISOString()
const dentro = (h: number) => new Date(AHORA + h * 3_600_000).toISOString()

const tarea = (p: Partial<TareaClinica> = {}): TareaClinica => ({
  clinicId: 'c1', patientId: 'p1', tipo: 'estudio_pendiente',
  titulo: 'Biometría hemática', prioridad: 'normal', estado: 'solicitada',
  creadaEn: hace(24), origen: 'nota', ...p,
})

describe('el ciclo de vida', () => {
  it('el camino normal se puede recorrer entero', () => {
    for (const [de, a] of [['solicitada', 'aceptada'], ['aceptada', 'en_curso'], ['en_curso', 'completada'], ['completada', 'cerrada']] as const) {
      expect(puedeTransicionar(de, a).permitido, `${de}→${a}`).toBe(true)
    }
  })

  it('se puede empezar directo: quien la toma suele arrancar en el mismo gesto', () => {
    expect(puedeTransicionar('solicitada', 'en_curso').permitido).toBe(true)
  })

  it('UNA CERRADA NO SE REABRE, y el motivo lo explica', () => {
    // Cerrar ES la constancia de que alguien la revisó: reabrirla borraría eso.
    const v = puedeTransicionar('cerrada', 'en_curso')
    expect(v.permitido).toBe(false)
    expect(v.motivo).toMatch(/alguien la revisó/)
  })

  it('una cancelada tampoco revive', () => {
    const v = puedeTransicionar('cancelada', 'solicitada')
    expect(v.permitido).toBe(false)
    expect(v.motivo).toMatch(/no revive/)
  })

  it('NO SE PUEDE SALTAR DE SOLICITADA A CERRADA', () => {
    /**
     * Es el atajo que vacía el sistema de sentido: cerrar sin haber hecho nada
     * convierte el worklist en una lista que se limpia sola.
     */
    expect(puedeTransicionar('solicitada', 'cerrada').permitido).toBe(false)
  })

  it('una completada SÍ puede volver a en_curso: el resultado puede obligar a repetir', () => {
    expect(puedeTransicionar('completada', 'en_curso').permitido).toBe(true)
  })

  it('se puede cancelar desde cualquier estado vivo', () => {
    for (const de of ['solicitada', 'aceptada', 'en_curso'] as const) {
      expect(puedeTransicionar(de, 'cancelada').permitido, de).toBe(true)
    }
  })

  it('quedarse donde está no es una transición', () => {
    expect(puedeTransicionar('en_curso', 'en_curso').permitido).toBe(false)
  })
})

describe('vencimiento', () => {
  it('vencida es haberse pasado de la fecha', () => {
    expect(estaVencida(tarea({ venceEn: hace(1) }), AHORA)).toBe(true)
    expect(estaVencida(tarea({ venceEn: dentro(1) }), AHORA)).toBe(false)
  })

  it('SIN FECHA NUNCA VENCE — y eso es el problema que esto viene a resolver', () => {
    // Un pendiente sin fecha no reclama nunca. Por eso derivarlas sin fecha
    // sería reproducir el fallo con otra forma.
    expect(estaVencida(tarea({ venceEn: undefined }), AHORA)).toBe(false)
  })

  it('lo cerrado y lo cancelado ya no vence', () => {
    expect(estaVencida(tarea({ venceEn: hace(100), estado: 'cerrada' }), AHORA)).toBe(false)
    expect(estaVencida(tarea({ venceEn: hace(100), estado: 'cancelada' }), AHORA)).toBe(false)
  })

  it('una fecha basura no vence nada', () => {
    expect(estaVencida(tarea({ venceEn: 'pronto' }), AHORA)).toBe(false)
  })
})

describe('escalamiento', () => {
  it('LO CRÍTICO SIN DUEÑO ESCALA YA, sin esperar a vencer', () => {
    /**
     * Si un resultado crítico no tiene a quién reclamarle, el problema es ahora
     * mismo. Esperar a la fecha sería esperar a que el daño ya esté hecho.
     */
    const r = debeEscalar(tarea({ prioridad: 'critica', venceEn: dentro(48) }), AHORA)
    expect(r.escalar).toBe(true)
    expect(r.motivo).toMatch(/sin nadie asignado/)
  })

  it('lo crítico CON dueño y en plazo no escala', () => {
    expect(debeEscalar(tarea({ prioridad: 'critica', ownerUid: 'u1', venceEn: dentro(48) }), AHORA).escalar).toBe(false)
  })

  it('vencida y sin dueño: el motivo lo distingue', () => {
    const r = debeEscalar(tarea({ venceEn: hace(2) }), AHORA)
    expect(r.escalar).toBe(true)
    expect(r.motivo).toMatch(/nadie la tomó/)
  })

  it('vencida CON dueño también escala, pero dice otra cosa', () => {
    const r = debeEscalar(tarea({ venceEn: hace(2), ownerUid: 'u1' }), AHORA)
    expect(r.escalar).toBe(true)
    expect(r.motivo).toMatch(/sigue abierta/)
  })

  it('lo ya cerrado no escala aunque venciera hace un mes', () => {
    expect(debeEscalar(tarea({ venceEn: hace(720), estado: 'cerrada' }), AHORA).escalar).toBe(false)
  })
})

describe('el orden del worklist', () => {
  it('lo que hay que escalar va primero, aunque sea lo más nuevo', () => {
    const vieja = tarea({ creadaEn: hace(500), titulo: 'vieja normal' })
    const critica = tarea({ creadaEn: hace(1), prioridad: 'critica', titulo: 'crítica sin dueño' })
    const lista = [vieja, critica].sort((a, b) => ordenWorklist(a, b, AHORA))
    expect(lista[0].titulo).toBe('crítica sin dueño')
  })

  it('a igualdad de urgencia, lo más viejo arriba', () => {
    const a = tarea({ creadaEn: hace(10), ownerUid: 'u1', titulo: 'antigua' })
    const b = tarea({ creadaEn: hace(2), ownerUid: 'u1', titulo: 'reciente' })
    expect([b, a].sort((x, y) => ordenWorklist(x, y, AHORA))[0].titulo).toBe('antigua')
  })

  it('un crítico de hoy no queda enterrado bajo seguimientos de hace un mes', () => {
    // Ordenar sólo por fecha es exactamente lo que esconde lo urgente.
    const seguimientos = Array.from({ length: 20 }, (_, i) => tarea({ creadaEn: hace(700 + i), ownerUid: 'u1', tipo: 'seguimiento' }))
    const critico = tarea({ creadaEn: hace(1), prioridad: 'critica', tipo: 'resultado_por_revisar', titulo: 'crítico' })
    const lista = [...seguimientos, critico].sort((a, b) => ordenWorklist(a, b, AHORA))
    expect(lista[0].titulo).toBe('crítico')
  })
})

describe('qué sigue vivo', () => {
  it('todo menos cerrada y cancelada', () => {
    for (const e of ['solicitada', 'aceptada', 'en_curso', 'completada'] as const) {
      expect(estaViva(tarea({ estado: e })), e).toBe(true)
    }
    expect(estaViva(tarea({ estado: 'cerrada' }))).toBe(false)
    expect(estaViva(tarea({ estado: 'cancelada' }))).toBe(false)
  })

  it('COMPLETADA SIGUE VIVA — es la distinción que sostiene todo el módulo', () => {
    /**
     * El laboratorio ya se hizo y el resultado está en el sistema. Si eso saliera
     * del worklist, nadie lo leería nunca: es justo el hueco donde ocurre el daño.
     */
    expect(estaViva(tarea({ estado: 'completada' }))).toBe(true)
  })
})
