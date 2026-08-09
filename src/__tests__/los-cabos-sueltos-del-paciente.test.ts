/**
 * LOS CABOS SUELTOS DE ESTE PACIENTE — REG-266.
 *
 * ── EL HUECO, DICHO POR EL PROPIO CÓDIGO ────────────────────────────────────
 *
 * `tareasDePaciente()` en `src/lib/tareas-clinicas/firestore.ts` lleva escrito
 * en su comentario, desde el día que se escribió:
 *
 *     «Los pendientes de UN paciente, **para su expediente**.»
 *
 * Y el expediente no los mostraba. La función **no tenía un solo llamador**.
 *
 * ── POR QUÉ EL INSTRUMENTO NO LA DELATÓ, QUE ES LO INTERESANTE ──────────────
 *
 * Hay OTRA `tareasDePaciente` —la de turnos de enfermería, en
 * `src/lib/uci/enfermeria.ts`— y un barrido por NOMBRE ve un llamador donde no
 * lo hay. Es el quinto medidor de esta sesión que informa mal, y esta vez por
 * lo contrario: informó de MENOS.
 *
 * Por eso la comprobación de que quedó conectado, aquí abajo, **no busca el
 * nombre: busca el módulo**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  cabosDelPaciente,
  comoSeResume,
  POR_QUE_SIN_LEER_VA_PRIMERO,
} from '@/lib/tareas-clinicas/cabos-del-paciente'
import type { TareaClinica, EstadoTarea, Prioridad } from '@/lib/tareas-clinicas/modelo'

const AHORA = Date.parse('2026-08-08T12:00:00.000Z')
const dias = (n: number) => new Date(AHORA + n * 86_400_000).toISOString()

function tarea(x: Partial<TareaClinica> & { titulo: string; estado: EstadoTarea }): TareaClinica {
  return {
    clinicId: 'c', patientId: 'p', tipo: 'estudio_pendiente',
    prioridad: 'normal' as Prioridad, creadaEn: dias(-30), origen: 'nota',
    id: x.titulo, ...x,
  }
}

describe('un resultado que llegó y nadie ha leído va primero, siempre', () => {
  it('gana a lo más vencido', () => {
    /**
     * El modelo lo dice: «completada» es que el trabajo se hizo; «cerrada» es
     * que alguien LO MIRÓ. Entre esas dos vive el daño.
     *
     * Un estudio que aún no se ha hecho y lleva 90 días de retraso es un
     * pendiente administrativo. Un resultado que YA ESTÁ en el sistema y nadie
     * ha abierto es otra cosa completamente.
     */
    const r = cabosDelPaciente([
      tarea({ titulo: 'TAC nunca hecha', estado: 'solicitada', venceEn: dias(-90) }),
      tarea({ titulo: 'Biometría con resultado', estado: 'completada', venceEn: dias(-2) }),
    ], AHORA)

    expect(r.lista[0].tarea.titulo).toBe('Biometría con resultado')
    expect(r.lista[0].grupo).toBe('sin_leer')
    expect(r.sinLeer).toBe(1)
  })

  it('y la razón está escrita, no sólo implementada', () => {
    expect(POR_QUE_SIN_LEER_VA_PRIMERO).toMatch(/nadie que lo lea/)
  })
})

describe('dentro de un grupo, lo más viejo duele más', () => {
  it('ordena por días vencidos, de mayor a menor', () => {
    const r = cabosDelPaciente([
      tarea({ titulo: 'tres días', estado: 'solicitada', venceEn: dias(-3) }),
      tarea({ titulo: 'cuarenta días', estado: 'solicitada', venceEn: dias(-40) }),
      tarea({ titulo: 'un día', estado: 'en_curso', venceEn: dias(-1) }),
    ], AHORA)

    expect(r.lista.map(c => c.tarea.titulo)).toEqual(['cuarenta días', 'tres días', 'un día'])
    expect(r.lista[0].diasVencido).toBe(40)
    expect(r.vencidos).toBe(3)
  })

  it('la prioridad que puso quien la creó desempata — y NO se deduce de nada', () => {
    /**
     * Deducir gravedad del tipo de estudio sí sería criterio médico. Aquí sólo
     * se lee lo que alguien ya decidió.
     */
    const r = cabosDelPaciente([
      tarea({ titulo: 'normal', estado: 'solicitada', venceEn: dias(5), prioridad: 'normal' }),
      tarea({ titulo: 'crítica', estado: 'solicitada', venceEn: dias(5), prioridad: 'critica' }),
      tarea({ titulo: 'alta', estado: 'solicitada', venceEn: dias(5), prioridad: 'alta' }),
    ], AHORA)

    expect(r.lista.map(c => c.tarea.titulo)).toEqual(['crítica', 'alta', 'normal'])
  })

  it('lo que no tiene plazo va al final, no al principio', () => {
    /**
     * Una tarea sin `venceEn` no es urgente: es que nadie le puso fecha.
     * Tratar «sin fecha» como «vence ya» llenaría la cabecera de rojos falsos.
     */
    const r = cabosDelPaciente([
      tarea({ titulo: 'sin plazo', estado: 'solicitada' }),
      tarea({ titulo: 'en tres días', estado: 'solicitada', venceEn: dias(3) }),
    ], AHORA)

    expect(r.lista.map(c => c.tarea.titulo)).toEqual(['en tres días', 'sin plazo'])
    expect(r.lista[1].diasVencido).toBeNull()
    expect(r.vencidos).toBe(0)
    expect(r.enPlazo).toBe(2)
  })
})

describe('lo cerrado no se enseña, pero se cuenta', () => {
  it('cerradas y canceladas salen de la lista', () => {
    const r = cabosDelPaciente([
      tarea({ titulo: 'viva', estado: 'solicitada' }),
      tarea({ titulo: 'cerrada', estado: 'cerrada' }),
      tarea({ titulo: 'cancelada', estado: 'cancelada' }),
    ], AHORA)

    expect(r.lista).toHaveLength(1)
    expect(r.yaCerrados).toBe(2)
  })

  it('y se cuentan para poder distinguir dos cosas que no son iguales', () => {
    /**
     * «Este paciente no tiene pendientes» y «este paciente nunca tuvo ninguno»
     * son afirmaciones distintas sobre su historia.
     */
    const ninguno = cabosDelPaciente([], AHORA)
    const resueltos = cabosDelPaciente([tarea({ titulo: 'x', estado: 'cerrada' })], AHORA)

    expect(ninguno.yaCerrados).toBe(0)
    expect(resueltos.yaCerrados).toBe(1)
    expect(comoSeResume(ninguno)).toBeNull()
    expect(comoSeResume(resueltos)).toBeNull()
  })
})

describe('la cabecera no enseña ceros', () => {
  it('devuelve null cuando no queda nada vivo', () => {
    /**
     * Una tarjeta que dice «0 pendientes» ocupa el mismo sitio que una que
     * dice algo. Enseñar ceros entrena a no mirar — la misma lección que el
     * aviso clínico que grita de más.
     */
    expect(comoSeResume(cabosDelPaciente([], AHORA))).toBeNull()
  })

  it('y nombra sólo los grupos que existen', () => {
    const r = cabosDelPaciente([
      tarea({ titulo: 'a', estado: 'completada' }),
      tarea({ titulo: 'b', estado: 'solicitada', venceEn: dias(9) }),
    ], AHORA)

    expect(comoSeResume(r)).toBe('1 sin leer · 1 en plazo')
  })

  it('singular y plural de «vencido»', () => {
    const uno = cabosDelPaciente([tarea({ titulo: 'a', estado: 'solicitada', venceEn: dias(-1) })], AHORA)
    const dos = cabosDelPaciente([
      tarea({ titulo: 'a', estado: 'solicitada', venceEn: dias(-1) }),
      tarea({ titulo: 'b', estado: 'solicitada', venceEn: dias(-2) }),
    ], AHORA)

    expect(comoSeResume(uno)).toBe('1 vencido')
    expect(comoSeResume(dos)).toBe('2 vencidos')
  })
})

describe('los datos sucios no lo tumban', () => {
  it('un `venceEn` que no es una fecha se trata como sin plazo', () => {
    /**
     * `Date.parse('mañana')` es `NaN`, y `NaN < ahora` es `false`. Sin la
     * comprobación explícita, una fecha corrupta acabaría en «en plazo» por
     * accidente en vez de por decisión — y funcionaría igual hasta el día que
     * dejara de hacerlo.
     */
    const r = cabosDelPaciente([tarea({ titulo: 'x', estado: 'solicitada', venceEn: 'mañana' })], AHORA)
    expect(r.lista[0].grupo).toBe('en_plazo')
    expect(r.lista[0].diasVencido).toBeNull()
  })

  it('una lista ausente no lanza', () => {
    expect(() => cabosDelPaciente(undefined as unknown as TareaClinica[], AHORA)).not.toThrow()
  })

  it('una prioridad desconocida no rompe el orden', () => {
    const r = cabosDelPaciente([
      tarea({ titulo: 'rara', estado: 'solicitada', venceEn: dias(4), prioridad: 'urgentísima' as Prioridad }),
      tarea({ titulo: 'crítica', estado: 'solicitada', venceEn: dias(4), prioridad: 'critica' }),
    ], AHORA)
    expect(r.lista[0].tarea.titulo).toBe('crítica')
  })
})

describe('y quedó CONECTADO — que es donde este defecto nació', () => {
  const RAIZ = process.cwd()
  const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8')

  it('el expediente monta el componente', () => {
    const pag = leer('src', 'app', '(dashboard)', 'expediente', '[patientId]', 'page.tsx')
    expect(pag).toContain('<CabosSueltosDelPaciente')
  })

  it('y le pasa `tareasDePaciente` DEL MÓDULO CORRECTO', () => {
    /**
     * Ésta es la comprobación que importa. Hay dos funciones con este nombre:
     * la de Firestore y la de turnos de enfermería en UCI. Buscar el nombre
     * suelto daría verde con la equivocada — que es exactamente por lo que el
     * barrido de motores sin conectar no vio este hueco.
     */
    const pag = leer('src', 'app', '(dashboard)', 'expediente', '[patientId]', 'page.tsx')
    expect(pag).toMatch(/import \{ tareasDePaciente \} from '@\/lib\/tareas-clinicas\/firestore'/)
    expect(pag).not.toContain('@/lib/uci/enfermeria')
  })

  it('el componente no cierra tareas: eso lo valida /pendientes', () => {
    /**
     * Cerrar es «alguien lo miró y decidió», y esa transición ya la valida
     * `cambiarEstado`. Repetirla en una segunda pantalla la desalinea en la
     * primera prisa.
     */
    const c = leer('src', 'components', 'CabosSueltosDelPaciente.tsx')
    expect(c).not.toContain('cambiarEstado')
    expect(c).toContain('/pendientes')
  })

  it('el color nunca es el único portador del grupo', () => {
    /** Quien no distingue rojo de ámbar vería tres filas iguales. */
    const c = leer('src', 'components', 'CabosSueltosDelPaciente.tsx')
    expect(c).toMatch(/ETIQUETA\[grupo\]/)
  })
})
