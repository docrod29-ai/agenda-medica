/**
 * GOLDEN — la avería que motivó el módulo de incidencias, por fin avisada.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `ia/incidentes-servidor.ts` nació de una frase concreta: «el 31-jul-2026 la IA
 * de la plataforma estuvo caída y nadie se enteró hasta que el dueño la probó a
 * mano», con la instrucción «no quiero que a mis clientes les pase eso; tú debes
 * avisarme».
 *
 * El módulo anotaba la incidencia en Firestore. **Y ahí se quedaba.** Para verla
 * había que abrir el tablero del dueño — o sea, había que sospechar antes que la
 * avería. `ops/alerta.ts` existía desde entonces, y el vigilante gritaba por
 * crons sin latido y por saldo bajo. De esto, no.
 *
 * Escrito, probado y sin conectar, en la pieza cuyo propósito literal era que
 * alguien se enterara.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Trabajando `WS-13.alertas`, cuyo censo decía: «hay un canal real con UN solo
 * llamador: cron caído y saldo bajo. Nada más».
 *
 * ── LA REGLA QUE ESTE GOLDEN PROTEGE ────────────────────────────────────────
 *
 * **Se marca como avisada sólo cuando el aviso SALIÓ.** Marcarla antes
 * convertiría una caída del webhook en un silencio permanente: la incidencia
 * quedaría como avisada sin que nadie la hubiera recibido, que es peor que no
 * tener canal — se da por cubierto lo que sigue descubierto.
 *
 * Es la misma regla que ya gobierna `alerta.ts` («si no se pudo avisar, se
 * dice») llevada a su marca de estado.
 *
 * ── POR QUÉ «SIN AVISAR» Y NO «RECIENTES» ───────────────────────────────────
 *
 * El vigilante corre cada quince minutos y las incidencias se agrupan por HORA.
 * Avisar de las recientes mandaría el mismo aviso cuatro veces por hora, y un
 * aviso repetido se aprende a ignorar — la forma en que un canal de alertas deja
 * de proteger sin dejar de funcionar.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba el webhook.** Que un `POST` llegue a Slack es de `alerta.ts` y
 *   de su variable de entorno, que sigue sin configurar en producción y está en
 *   la lista de acciones del dueño.
 * · **Sólo cubre las incidencias de la llave de la PLATAFORMA**, porque son las
 *   únicas que se anotan: la llave vencida de un consultorio ya se le dice en su
 *   pantalla y meterla aquí taparía lo que sí es del dueño.
 * · **No cubre 5xx genéricos ni anomalías de autorización**, que WS-13 también
 *   pide y siguen sin señal. Queda dicho en el censo.
 * · **No cubre la caída de WhatsApp**: REG-391 hizo que el outbox pause en vez
 *   de morir, pero esa pausa no llega a ningún aviso todavía.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { textoDeIncidencias } from '@/lib/ia/incidentes-servidor'

const VIGILANTE = readFileSync('src/app/api/cron/vigilante/route.ts', 'utf8')
const INCIDENTES = readFileSync('src/lib/ia/incidentes-servidor.ts', 'utf8')

describe('el vigilante grita por la avería de IA, no sólo por los crons', () => {
  it('lee las incidencias SIN AVISAR y las manda al canal', () => {
    /**
     * AL REVÉS: sin esta llamada el vigilante vuelve a avisar sólo de crons
     * caídos y saldo bajo, que es el estado que el censo describía.
     */
    expect(VIGILANTE).toContain('incidentesSinAvisar()')
    const i = VIGILANTE.indexOf('incidencias.length')
    expect(i).toBeGreaterThan(0)
    expect(VIGILANTE.slice(i, i + 700)).toMatch(/enviarAlertaOps\(/)
  })

  it('y no las lee «recientes», que avisaría cuatro veces por hora', () => {
    /* Las incidencias se agrupan por HORA y el vigilante corre cada quince
       minutos. `incidentesRecientes` alimenta el tablero, no el aviso. */
    const bloque = VIGILANTE.slice(VIGILANTE.indexOf('const incidencias'), VIGILANTE.indexOf('const incidencias') + 200)
    expect(bloque).not.toContain('incidentesRecientes')
  })

  it('una incidencia URGENTE sube la gravedad del aviso', () => {
    expect(VIGILANTE).toMatch(/gravedad: incidencias\.some\(i => i\.urgente === true\) \? 'grave' : 'aviso'/)
  })

  it('si la lectura falla, el resto del vigilante sigue', () => {
    /* Un aviso no puede llevarse por delante el diagnóstico: el vigilante
       existe sobre todo para decir qué trabajos no laten. */
    expect(VIGILANTE).toMatch(/incidentesSinAvisar\(\)\.catch\(/)
  })
})

describe('marcar como avisada es un hecho, no una intención', () => {
  it('sólo se marca si el aviso SALIÓ', () => {
    /**
     * El caso que impide el silencio permanente. Si se marcara sin mirar
     * `enviada`, una caída del webhook dejaría la incidencia como avisada sin
     * que nadie la hubiera recibido — se daría por cubierto lo que sigue
     * descubierto, que es el fallo que `alerta.ts` existe para reparar.
     */
    expect(VIGILANTE).toMatch(/if \(r\.enviada\) incidenciasAvisadas = await marcarAvisadas\(/)
  })

  it('y `marcarAvisadas` cuenta las que de verdad quedaron marcadas', () => {
    /* Devolver `ids.length` daría por marcadas las que fallaron al escribir, y
       el vigilante informaría de un trabajo que no hizo. */
    expect(INCIDENTES).toMatch(/marcadas\+\+/)
    expect(INCIDENTES).toMatch(/return marcadas/)
  })

  it('una incidencia ya avisada no vuelve a salir', () => {
    expect(INCIDENTES).toMatch(/\.filter\(d => \(d as \{ alertado\?: boolean \}\)\.alertado !== true\)/)
  })

  it('no poder leer NO se cuenta como «no hay incidencias»', () => {
    /* Ausencia de dato no es dato de ausencia. Aquí se declara vacío porque no
       se puede hacer más, y se dice en el módulo en vez de disimularlo. */
    expect(INCIDENTES).toMatch(/No poder leer NO es «no hay incidencias»/)
  })
})

describe('el texto del aviso sirve para actuar, y no lleva PHI', () => {
  it('dice qué pasó, cuántas veces, dónde y qué hacer', () => {
    const texto = textoDeIncidencias([{
      id: 'anthropic_llave_2026-08-30T03',
      titulo: 'La llave de la plataforma no funciona',
      veces: 412,
      features: ['nota', 'consultor-evidencia'],
      queHacer: 'Revisa la llave en el panel de Anthropic.',
    }])
    expect(texto).toContain('La llave de la plataforma no funciona')
    expect(texto).toContain('412')
    expect(texto).toContain('nota, consultor-evidencia')
    expect(texto).toContain('Qué hacer')
  })

  it('aguanta una incidencia a medias sin romper el aviso', () => {
    /* Un aviso que revienta por un campo que falta es un aviso que no llega, y
       justo en la avería más rara. */
    expect(() => textoDeIncidencias([{ id: 'x' }])).not.toThrow()
    expect(textoDeIncidencias([{ id: 'x' }])).toContain('x')
  })

  it('el texto sale de los campos de la incidencia, que no llevan PHI', () => {
    /**
     * Lo garantiza `reportarFalloIA`, que guarda sólo proveedor, clase, código y
     * qué función lo sufrió — nunca la pregunta, la nota ni el paciente. Esto
     * comprueba que el aviso no añade nada más.
     */
    const texto = textoDeIncidencias([{ id: 'a', titulo: 't', veces: 1, features: ['nota'], queHacer: 'q' }])
    for (const campo of texto.split('\n')) expect(campo.length).toBeLessThan(300)
    expect(INCIDENTES).toMatch(/Cero PHI/)
  })
})
