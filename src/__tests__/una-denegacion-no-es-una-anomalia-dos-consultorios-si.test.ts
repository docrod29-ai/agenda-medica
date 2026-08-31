/**
 * GOLDEN — LAS DENEGACIONES DE AUTORIZACIÓN NO SE ESCRIBÍAN EN NINGÚN SITIO.
 *
 * ── QUÉ FALTABA (WS-13) ─────────────────────────────────────────────────────
 *
 * El censo lo decía con precisión: «las anomalías de autorización siguen sin
 * instrumentar, y hasta que no se escriban en algún sitio no hay nada que leer».
 *
 * `verificar.ts` deniega bien y lo apunta con `safeLog.warn`. **Un log de
 * servidor no es una señal**: hay que ir a buscarlo, en el sitio correcto, el día
 * correcto, y sospechando ya lo que se busca. Es el mismo defecto que REG-396
 * cerró para los incidentes de IA y REG-420 para los errores del navegador.
 *
 * ── LA FRONTERA, Y NO ES UN NÚMERO INVENTADO ────────────────────────────────
 *
 * **Una denegación es el sistema funcionando.** Alguien pulsó algo que su rol no
 * puede. Avisar de cada una convierte el canal en ruido, y un canal ruidoso deja
 * de leerse justo el día que importa.
 *
 * Dos patrones no son ruido:
 *
 *  1. **Un mismo usuario denegado en DOS consultorios distintos.** Un miembro de
 *     un consultorio no tiene por qué tocar otro; que le rebote la puerta de dos
 *     inquilinos no es un rol mal configurado, es alguien probando dónde entra.
 *     Bastan dos porque el segundo ya no tiene explicación inocente — es
 *     cualitativo, como en REG-420, no una cifra elegida.
 *  2. **Insistencia sobre la misma capacidad.** Un rol mal puesto da una
 *     denegación y el usuario pide permiso. Aquí sí hace falta un número, y se
 *     declara como lo que es: una cota operativa, no una cifra clínica.
 *
 * ── LO QUE NO SE ANOTA ──────────────────────────────────────────────────────
 *
 * Nada del paciente. Una anomalía de autorización se investiga con **quién y
 * dónde**, nunca con sobre qué expediente. Por eso la ruta va sin parámetros:
 * `/api/expediente/abc123xyz789` llevaría un identificador de paciente dentro.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **NO cubre los 5xx del servidor**, la otra mitad que el censo nombra. Medir
 *   el error de TODA ruta HTTP exige instrumentar el borde y decidir dónde viven
 *   esas métricas — la misma infraestructura que `WS-12.p99` deja abierta. Son el
 *   mismo bloqueo y se dice.
 * · **NO cubre las denegaciones sin actor** (401 sin token). Sin uid no hay patrón
 *   que seguir, y escribirlas llenaría la colección de filas que no dicen nada.
 * · **NO marca lo avisado como visto**, al revés que los errores del navegador:
 *   una denegación es un registro de seguridad y sacarla del radar por haber
 *   avisado una vez perdería la serie. La ventana las deja de contar sola.
 * · **El canal sigue sin destino**: `OPS_ALERTA_WEBHOOK` es acción del dueño. Sin
 *   él, `enviarAlertaOps` lo declara y no da nada por avisado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  anomalias, comoSeCuentan, rutaSinParametros, COLECCION,
  CONSULTORIOS_PARA_SER_SONDEO, INSISTENCIAS_PARA_MIRAR, LO_QUE_NO_SE_ANOTA,
  type Denegacion,
} from '@/lib/ops/lo-que-no-deberia-pasar'

const VERIFICAR = readFileSync('src/lib/authz/verificar.ts', 'utf8')
const VIGILANTE = readFileSync('src/app/api/cron/vigilante/route.ts', 'utf8')
const REGLAS = readFileSync('firestore.rules', 'utf8')
const MATRIZ = readFileSync('src/lib/authz/matriz-acceso.ts', 'utf8')

const d = (uid: string, clinicId: string, capacidad = 'clinico.escribir'): Denegacion =>
  ({ uid, clinicId, capacidad, ruta: '/api/x', cuando: '2026-08-30T10:00:00.000Z' })

describe('una denegación suelta no avisa', () => {
  it('una sola no es nada', () => {
    expect(anomalias([d('u1', 'c1')])).toHaveLength(0)
  })

  it('ni cuatro del mismo usuario contra la misma capacidad', () => {
    /* Por debajo de la cota es alguien descubriendo que no puede. */
    expect(anomalias(Array.from({ length: INSISTENCIAS_PARA_MIRAR - 1 }, () => d('u1', 'c1'))))
      .toHaveLength(0)
  })

  it('ni varias repartidas entre capacidades distintas', () => {
    /**
     * Diez denegaciones repartidas entre diez capacidades es alguien perdido por
     * la aplicación. Contar en total, y no por capacidad, habría convertido eso
     * en una alarma.
     */
    const sueltas = ['a', 'b', 'c', 'd', 'e', 'f'].map(c => d('u1', 'c1', c))
    expect(anomalias(sueltas)).toHaveLength(0)
  })

  it('y sin actor no hay patrón que seguir', () => {
    expect(anomalias([d('', 'c1'), d('', 'c2')])).toHaveLength(0)
  })
})

describe('dos consultorios distintos sí', () => {
  it('el mismo usuario rebotado en dos inquilinos es un sondeo', () => {
    const r = anomalias([d('u1', 'c1'), d('u1', 'c2')])
    expect(r).toHaveLength(1)
    expect(r[0].clase).toBe('sondeo_entre_consultorios')
    expect(r[0].consultorios).toEqual(['c1', 'c2'])
  })

  it('bastan DOS, y eso está declarado', () => {
    expect(CONSULTORIOS_PARA_SER_SONDEO).toBe(2)
  })

  it('el sondeo manda: no se cuenta además como insistencia', () => {
    /* Sin esto, un mismo hecho saldría dos veces con dos nombres y el conteo del
       aviso dejaría de significar algo. */
    const muchas = [
      ...Array.from({ length: 8 }, () => d('u1', 'c1')),
      d('u1', 'c2'),
    ]
    const r = anomalias(muchas)
    expect(r).toHaveLength(1)
    expect(r[0].clase).toBe('sondeo_entre_consultorios')
  })

  it('dos usuarios distintos en el mismo consultorio no son un sondeo', () => {
    expect(anomalias([d('u1', 'c1'), d('u2', 'c1')])).toHaveLength(0)
  })
})

describe('la insistencia, que sí necesita un número', () => {
  it('cinco contra la misma capacidad se mira', () => {
    const r = anomalias(Array.from({ length: INSISTENCIAS_PARA_MIRAR }, () => d('u1', 'c1', 'cobros.ver')))
    expect(r).toHaveLength(1)
    expect(r[0].clase).toBe('insistencia')
    expect(r[0].veces).toBe(INSISTENCIAS_PARA_MIRAR)
    expect(r[0].capacidades).toEqual(['cobros.ver'])
  })

  it('y el número está declarado como cota operativa, no como cifra clínica', () => {
    expect(INSISTENCIAS_PARA_MIRAR).toBe(5)
    const src = readFileSync('src/lib/ops/lo-que-no-deberia-pasar.ts', 'utf8')
    expect(src).toContain('No es una cifra clínica')
  })
})

describe('no se anota nada del paciente', () => {
  it('la ruta viaja sin sus parámetros', () => {
    /* `/api/expediente/abc123xyz789` llevaría un identificador de paciente. */
    expect(rutaSinParametros('/api/expediente/abc123xyz789')).toBe('/api/expediente/<id>')
    expect(rutaSinParametros('/api/expediente/abc123xyz789?q=1')).toBe('/api/expediente/<id>')
    expect(rutaSinParametros('/api/cobros')).toBe('/api/cobros')
  })

  it('y está dicho qué no se guarda', () => {
    expect(LO_QUE_NO_SE_ANOTA).toContain('Nada del paciente')
  })
})

describe('el dato se escribe y alguien lo lee', () => {
  it('se anota donde se deniega', () => {
    /* Sin esto la colección estaría vacía y el vigilante leería cero para
       siempre: el defecto entero era que nadie escribía. */
    expect(VERIFICAR).toContain('anotarDenegacion({')
    expect(VERIFICAR).toContain('rutaSinParametros(quien.ruta)')
  })

  it('y el vigilante lo lee', () => {
    expect(VIGILANTE).toContain('anomalias(denegaciones)')
    expect(VIGILANTE).toContain('COLECCION_AUTHZ')
  })

  it('el vigilante NO las marca como vistas', () => {
    /* Al revés que los errores del navegador: una denegación es un registro de
       seguridad y sacarla del radar por haber avisado perdería la serie. */
    const bloque = VIGILANTE.slice(VIGILANTE.indexOf('anomaliasAvisadas'), VIGILANTE.indexOf('anomaliasAvisadas') + 1600)
    expect(bloque).not.toContain('visto: true')
  })
})

describe('la colección está declarada en los tres sitios', () => {
  it('en las reglas, cerrada por las dos puntas', () => {
    expect(REGLAS).toContain('match /platform_authz_denegadas/{denId}')
    const bloque = REGLAS.slice(REGLAS.indexOf('platform_authz_denegadas'), REGLAS.indexOf('platform_authz_denegadas') + 200)
    expect(bloque).toContain('allow read, write: if false')
  })

  it('en la matriz de acceso', () => {
    expect(MATRIZ).toContain("ruta: 'platform_authz_denegadas/{denId}'")
  })

  it('y el respaldo del consultorio la deja fuera, como toda `platform_*`', () => {
    /* No es un olvido: es de la plataforma, no del consultorio. Meterla en el
       archivo que el médico descarga le entregaría datos de otros. */
    expect(COLECCION.startsWith('platform_')).toBe(true)
    expect(readFileSync('src/lib/clinica/respaldo.ts', 'utf8')).toContain("'platform_*'")
  })
})

describe('cómo se cuenta', () => {
  it('sin anomalías lo dice, no calla', () => {
    expect(comoSeCuentan([])).toContain('Sin anomalías')
  })

  it('distingue el sondeo de la insistencia en el texto del aviso', () => {
    const r = anomalias([
      d('u1', 'c1'), d('u1', 'c2'),
      ...Array.from({ length: 6 }, () => d('u2', 'c9', 'cobros.ver')),
    ])
    const texto = comoSeCuentan(r)
    expect(texto).toContain('sondeo')
    expect(texto).toContain('insistencia')
  })
})
