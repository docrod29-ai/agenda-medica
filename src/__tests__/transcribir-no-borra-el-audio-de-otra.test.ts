/**
 * TRANSCRIBIR UNA GRABACIÓN BORRABA EL AUDIO DE OTRA — REG-283.
 *
 * ── LO QUE PASABA ───────────────────────────────────────────────────────────
 *
 * Dictar 22 min → tocar «Agenda» → volver → dictar 90 s → detener **perdía los
 * 22 minutos**. Sin error, sin aviso, y justo después de una transcripción
 * exitosa — que es cuando menos se sospecha.
 *
 * `detener()` arma el blob con los trozos de la sesión EN CURSO, pero al
 * terminar borraba el rango **completo** de la llave. Y la llave no es por
 * sesión: es `consulta-{patientId}`, la misma cada vez que se abre a ese
 * paciente. Debajo puede haber audio de una grabación anterior que nadie
 * transcribió — porque navegar fuera desmonta el hook y libera el micrófono sin
 * llamar a `detener()`.
 *
 * ── LA DEFENSA ESTABA ESCRITA A MEDIAS ──────────────────────────────────────
 *
 * **El hook ya sabía que ese huérfano existe.** Al empezar a grabar cuenta los
 * trozos que hay y arranca su índice después (`recoveryBaseRef`) para no
 * pisarlo.
 *
 * Protegía al **escribir** y no al **borrar**. Y el comentario de `iniciar()`
 * afirmaba lo contrario de lo que ocurría, que es por lo que se podía leer el
 * código entero sin ver el agujero.
 *
 * ── LO QUE ESTA PRUEBA COMPRUEBA, Y LO QUE NO ───────────────────────────────
 *
 * Comprueba el **rango** —la línea exacta donde vivía el defecto— y que las
 * tres salidas exitosas de `detener()` lo acotan.
 *
 * **NO abre una IndexedDB de verdad.** Eso exigiría una dependencia nueva, y se
 * dice aquí en vez de dejarlo creer: una prueba que no declara su alcance es
 * una prueba que engaña. Lo que queda sin cubrir es el comportamiento del
 * almacén, no la decisión de qué se borra — que es donde estaba el fallo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { rangoABorrar } from '@/hooks/useGrabacionAudio'

const HOOK = readFileSync(join(process.cwd(), 'src/hooks/useGrabacionAudio.ts'), 'utf8')

describe('el rango: sólo se borra lo que se acaba de leer', () => {
  it('con base 0 borra todo — el caso de quien SÍ quiere borrarlo todo', () => {
    const [ini, fin] = rangoABorrar('consulta-p1')
    expect(ini).toEqual(['consulta-p1', 0])
    expect(fin).toEqual(['consulta-p1', Number.MAX_SAFE_INTEGER])
  })

  it('con base 44 respeta los 44 trozos de la grabación anterior', () => {
    /**
     * Ése es el caso real: 22 minutos ya guardados bajo la misma llave, y una
     * sesión nueva que empieza a escribir en el índice 44.
     */
    const [ini] = rangoABorrar('consulta-p1', 44)
    expect(ini).toEqual(['consulta-p1', 44])
  })

  it('la llave no cambia: el aislamiento es por índice, no por llave', () => {
    /**
     * Importa decirlo: la llave sigue siendo la misma para las dos grabaciones
     * —`consulta-{patientId}`— y por eso hizo falta el índice. Si alguien
     * «arregla» esto cambiando la llave, el respaldo dejaría de encontrarse al
     * recargar.
     */
    const [ini, fin] = rangoABorrar('consulta-p1', 44)
    expect((ini as unknown[])[0]).toBe('consulta-p1')
    expect((fin as unknown[])[0]).toBe('consulta-p1')
  })
})

describe('quién acota y quién borra todo, que no es lo mismo', () => {
  it('las TRES salidas exitosas de detener() pasan la base de la sesión', () => {
    const acotadas = HOOK.match(/borrarChunks\(recoveryKeyRef\.current, recoveryBaseRef\.current\)/g) ?? []
    expect(acotadas.length, 'alguna salida de detener() volvió a borrar el rango entero').toBe(3)
  })

  it('ninguna salida de detener() borra ya el rango entero', () => {
    expect(HOOK).not.toMatch(/await borrarChunks\(recoveryKeyRef\.current\)/)
  })

  it('pero `descartarRecovery` SÍ borra todo — es un acto deliberado', () => {
    /**
     * Quien descarta a propósito tiene que poder descartarlo todo. Acotarlo
     * aquí dejaría audio huérfano imposible de eliminar, que es el defecto
     * contrario y también real (ya costó un REG).
     */
    expect(HOOK).toMatch(/const descartarRecovery[\s\S]{0,200}await borrarChunks\(recoveryKey\)/)
  })

  it('y `recuperarAudio` también, porque transcribe el rango entero', () => {
    expect(HOOK).toMatch(/await borrarChunks\(recoveryKey\)\s*\/\/ solo se borra si SÍ se transcribió/)
  })
})

describe('la lección, escrita donde se lee', () => {
  it('el módulo declara que la defensa estaba a medias', () => {
    /**
     * El comentario viejo de `iniciar()` afirmaba lo contrario de lo que
     * ocurría. Un comentario que miente es peor que ninguno: hace que leer el
     * código entero no baste.
     */
    expect(HOOK).toContain('La defensa estaba escrita')
    expect(HOOK).toContain('sólo puede conservar más audio')
  })
})
