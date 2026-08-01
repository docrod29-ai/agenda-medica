/**
 * EL FIN DE LA PRUEBA NO PUEDE DEJAR A NADIE SIN SU EXPEDIENTE.
 *
 * ── LA DECISIÓN DEL DUEÑO ────────────────────────────────────────────────────
 *
 * «Se bloquea la IA, y la agenda y el expediente quedan en solo lectura. Nunca
 * se le borra nada ni se le cierra el expediente a un médico que no pagó.»
 *
 * ── Y LA MITAD QUE FALTABA ───────────────────────────────────────────────────
 *
 * Las reglas de Firestore ya cortaban las escrituras del cliente. Pero las rutas
 * de IA corren con Admin SDK, que las **ignora**: un consultorio con la prueba
 * vencida seguía quemando la llave del dueño indefinidamente. Dinero saliendo en
 * tiempo real, sin nada que lo parara.
 *
 * ── POR QUÉ ESTE ARCHIVO LEE `firestore.rules` ───────────────────────────────
 *
 * La misma pregunta se responde en dos motores que no comparten código: las
 * reglas de Firestore y este TypeScript. Dos implementaciones de una regla
 * divergen — es cuestión de tiempo, y la divergencia sería invisible: uno
 * bloquearía y el otro no, según por dónde entrara la petición.
 *
 * No se puede compartir el código, así que se comparan los TEXTOS.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  pruebaVencida, puedeEscribir, puedeUsarIA, estadoPaywall,
  GRACIA_MS, ESTADOS_SIN_ESCRITURA,
} from '@/lib/finanzas/paywall-prueba'

const AHORA = Date.parse('2026-07-31T12:00:00.000Z')
const DIA = 86_400_000
/** Prueba que venció hace 3 días: fuera de la gracia sin lugar a dudas. */
const VENCIDA = { status: 'trial', trialEndsAtMs: AHORA - 3 * DIA }

describe('cuándo se considera vencida', () => {
  it('vencida hace días → sí', () => {
    expect(pruebaVencida(VENCIDA, AHORA)).toBe(true)
  })

  it('todavía corriendo → no', () => {
    expect(pruebaVencida({ status: 'trial', trialEndsAtMs: AHORA + 5 * DIA }, AHORA)).toBe(false)
  })

  it('hay un día de gracia después de la fecha', () => {
    /**
     * No es generosidad: la fecha de corte y el momento en que alguien logra
     * pagar rara vez coinciden, y quedarse fuera del expediente por unas horas
     * de diferencia horaria es un daño desproporcionado.
     */
    const justoVencida = { status: 'trial', trialEndsAtMs: AHORA - 1000 }
    expect(pruebaVencida(justoVencida, AHORA)).toBe(false)              // dentro de la gracia
    expect(pruebaVencida(justoVencida, AHORA + GRACIA_MS)).toBe(true)   // fuera
  })

  it('quien PAGA nunca se bloquea, aunque tenga fecha vieja', () => {
    // El webhook mapea trialing→active, así que un cliente al día está en
    // 'active' y este camino ni se activa.
    expect(pruebaVencida({ status: 'active', trialEndsAtMs: AHORA - 90 * DIA }, AHORA)).toBe(false)
  })

  it('el pase libre del dueño y las cortesías tampoco', () => {
    expect(pruebaVencida({ ...VENCIDA, paseLibre: true }, AHORA)).toBe(false)
  })

  it('FALLA ABIERTO: sin reloj no se bloquea', () => {
    /**
     * Las clínicas viejas no tienen `trialEndsAtMs`. Dejar fuera a un
     * consultorio legítimo por un campo ausente es peor que dejar pasar a uno
     * vencido: el primero se queda sin poder atender, el segundo sólo cuesta
     * unas llamadas.
     */
    expect(pruebaVencida({ status: 'trial' }, AHORA)).toBe(false)
    expect(pruebaVencida({ status: 'trial', trialEndsAtMs: 0 }, AHORA)).toBe(false)
    expect(pruebaVencida(null, AHORA)).toBe(false)
  })
})

describe('qué se corta y qué NO', () => {
  it('la IA es lo primero que se corta', () => {
    // Cada llamada gasta dinero del dueño en tiempo real; leer un expediente no
    // cuesta nada. Cortar primero lo que sangra es lo que separa un paywall de
    // un castigo.
    expect(puedeUsarIA(VENCIDA, AHORA)).toBe(false)
  })

  it('las escrituras nuevas también', () => {
    expect(puedeEscribir(VENCIDA, AHORA)).toBe(false)
  })

  it('un estado terminal corta aunque no haya prueba de por medio', () => {
    for (const st of ESTADOS_SIN_ESCRITURA) {
      expect(puedeEscribir({ status: st }, AHORA), st).toBe(false)
    }
  })

  it('EL MENSAJE DICE PRIMERO LO QUE CONSERVA', () => {
    /**
     * Al revés suena a amenaza, y el médico que lo lee está en su consultorio
     * con pacientes: lo que necesita saber en ese segundo es que sus
     * expedientes están enteros.
     */
    const e = estadoPaywall(VENCIDA, AHORA)
    const pos = (t: string) => e.mensaje.toLowerCase().indexOf(t)
    expect(pos('conservas')).toBeGreaterThanOrEqual(0)
    expect(pos('conservas')).toBeLessThan(pos('se detuvo'))
    expect(e.mensaje).toMatch(/no se pierde nada/i)
  })

  it('siempre enumera lo que sigue funcionando', () => {
    const e = estadoPaywall(VENCIDA, AHORA)
    expect(e.loQueSigueFuncionando.length).toBeGreaterThan(0)
    expect(e.loQueSigueFuncionando.join(' ')).toMatch(/imprimir/i)
    expect(e.loQueSigueFuncionando.join(' ')).toMatch(/exportar/i)
  })

  it('con la prueba viva no hay mensaje ninguno', () => {
    // Un aviso que aparece cuando no pasa nada enseña a ignorar los avisos.
    expect(estadoPaywall({ status: 'trial', trialEndsAtMs: AHORA + DIA }, AHORA).mensaje).toBe('')
  })
})

describe('el espejo con firestore.rules no puede desincronizarse', () => {
  const reglas = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')

  it('el día de gracia vale lo mismo en los dos sitios', () => {
    // En las reglas está escrito como `trialMs + 86400000`.
    expect(GRACIA_MS).toBe(86_400_000)
    expect(reglas).toMatch(/trialMs \+ 86400000/)
  })

  it('la regla sigue comparando el mismo campo y el mismo estado', () => {
    expect(reglas).toMatch(/trialEndsAtMs/)
    expect(reglas).toMatch(/status == 'trial'/)
  })

  it('la regla sigue fallando ABIERTO sin reloj', () => {
    // `trialMs > 0` es lo que hace que un campo ausente no bloquee.
    expect(reglas).toMatch(/trialMs > 0/)
  })

  it('los estados terminales son los mismos', () => {
    for (const st of ESTADOS_SIN_ESCRITURA) {
      expect(reglas, `firestore.rules ya no bloquea '${st}'`).toContain(`'${st}'`)
    }
  })

  it('LA LECTURA NUNCA SE CORTA — y la regla lo dice por escrito', () => {
    /**
     * El expediente no es nuestro: es del paciente, y la NOM-004 le da derecho a
     * él. `clinicaPuedeEscribir` gobierna sólo la escritura; si alguien la
     * usara para `allow read`, esto es lo que lo cazaría.
     */
    expect(reglas).toMatch(/allow read: if isMember\(clinicId\)/)
    expect(reglas).not.toMatch(/allow read:[^\n]*clinicaPuedeEscribir/)
  })
})
