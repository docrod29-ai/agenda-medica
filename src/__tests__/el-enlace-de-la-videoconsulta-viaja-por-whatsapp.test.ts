/**
 * EL ENLACE DE LA VIDEOCONSULTA QUE VIAJA POR WHATSAPP — V9 · REG-291.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La videoconsulta se anuncia por WhatsApp: la confirma el bot al agendar y la
 * recuerdan el aviso de 24 h y el del mismo día. En esos tres mensajes, el
 * paciente NO recibía enlace.
 *
 * Antes de REG-268 recibía uno roto —sin token, y `/api/telesalud/sala` contesta
 * **404 «Cita no encontrada»** a quien no acredita titularidad—. REG-268 cerró
 * el camino del portal y dejó los mensajes diciendo la verdad: «recibirás el
 * enlace por este medio antes de tu cita». Honesto, y falso por omisión: no
 * había ningún otro medio que lo mandara. El paciente que sólo usa WhatsApp
 * seguía sin poder llegar a una consulta que ya pagó.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Estaba escrito por la propia reparación anterior: REG-268 declaró el hueco en
 * su sección «lo que NO cierra» y lo dejó abierto como `PATIENT-TELE-002` (P0)
 * en el backlog de V9. Esta unidad lo cierra.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El token exige `PORTAL_PACIENTE_SECRET`, que sólo vive en el servidor.
 * `donde-es.ts` y `lib/whatsapp.ts` se importan también desde el navegador, así
 * que ahí no se puede firmar sin filtrar el secreto al paquete del cliente. Como
 * nadie había puesto el acuñado en el lado del servidor, los tres llamadores
 * —que SÍ son servidor— llamaban sin token.
 *
 * Familia: **«el dato tiene que LLEGAR»**, igual que REG-268, REG-167, REG-170 y
 * REG-160. El mensaje se componía y se enviaba; lo que no llegaba era la
 * credencial que abre la puerta del otro lado.
 *
 * ── LAS REGLAS QUE LO HACEN SEGURO ──────────────────────────────────────────
 *
 * 1. **La vida del token se calcula desde la cita, no se fija a ojo.** Un día
 *    fijo caduca ANTES de la consulta cuando el recordatorio salió a T-26 h; un
 *    plazo largo deja una credencial suelta en un hilo de WhatsApp. Vive hasta
 *    que la sala cierra, y ni un día más.
 * 2. **Más allá de ocho días no se emite enlace.** Se dice que llegará aparte, y
 *    llega: lo trae el recordatorio de 24 h. Una cita agendada para dentro de un
 *    mes todavía puede cambiar.
 * 3. **Sin `pacienteId` no hay token.** Una cita sin expediente vinculado no
 *    puede demostrar titularidad, así que su enlace sería un 404.
 * 4. **Alcance `agenda`**, el mínimo con el que la sala deja entrar. No es poder
 *    nuevo: al mismo teléfono ya le llega el enlace del portal, que es lo mismo
 *    durante siete días.
 * 5. **La revocación llega hasta la puerta.** El token lleva
 *    `portalTokenVersion` y `/api/telesalud/sala` la comprueba, que antes no lo
 *    hacía.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No manda un WhatsApp de verdad.** Comprueba el token que se acuña y que
 *   los tres llamadores lo pasan. Que Meta entregue el mensaje es otra cosa.
 * - **No prueba `/api/telesalud/sala` de punta a punta.** Que esa ruta acepte
 *   este token concreto vive en `telesalud-sala-or.test.ts`, y allí
 *   `verificarTokenPaciente` sigue mockeado.
 * - **No cubre el `pacienteId` vacío en producción.** Comprueba que sin él no se
 *   emite enlace; cuántas citas reales están así es un recuento sobre datos con
 *   PHI y por eso no puede vivir en CI.
 * - No comprueba la ventana horaria de la sala: eso es `ventanaDeSala`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'
import { diasDeVidaDelEnlace, MAX_DIAS_ENLACE_SALA, HORAS_DESPUES, MINUTOS_ANTES } from '@/lib/telesalud/ventana-sala'
import { tokenParaLaSala } from '@/lib/telesalud/token-de-sala'
import { verificarTokenPaciente } from '@/lib/patient-token'
import { dondeEsLaCita, SIN_ENLACE, ES_TELECONSULTA } from '@/lib/telesalud/donde-es'

/** Cita sintética. Datos FICTICIOS: nunca PHI real en pruebas. */
const CITA = { fecha: '2030-03-14', hora: '10:00' }
const CLINICA = 'clin_demo'
const PACIENTE = 'pac_demo'
const INICIO = instanteMX(CITA.fecha, CITA.hora, TZ_DEFAULT).getTime()
const H = 3_600_000

afterEach(() => { vi.useRealTimers() })

describe('cuánto vive el enlace que se manda en un mensaje', () => {
  it('el recordatorio de 24 h necesita DOS días, no uno', () => {
    /**
     * Ésta es la que muerde en la elección de la cifra. El cron manda el aviso
     * de 24 h en la ventana de 23 a 26 horas antes. Un token de un día emitido a
     * T-26 h caduca a T-2 h: el paciente abre su enlace media hora antes de la
     * consulta y le contesta que su cita no existe. Otra vez.
     */
    const dias = diasDeVidaDelEnlace(`${CITA.fecha} ${CITA.hora}`, INICIO - 26 * H)
    expect(dias).not.toBeNull()
    expect(dias!).toBeGreaterThanOrEqual(2)
    // Y el token que sale de ahí tiene que seguir vivo al final de la ventana.
    expect(dias! * 24 * H).toBeGreaterThan(26 * H + HORAS_DESPUES * H)
  })

  it('el recordatorio del mismo día se conforma con uno', () => {
    expect(diasDeVidaDelEnlace(`${CITA.fecha} ${CITA.hora}`, INICIO - 3 * H)).toBe(1)
  })

  it('con la sala ya cerrada no se emite enlace', () => {
    const yaCerro = INICIO + (HORAS_DESPUES + 1) * H
    expect(diasDeVidaDelEnlace(`${CITA.fecha} ${CITA.hora}`, yaCerro)).toBeNull()
  })

  it('una cita demasiado lejana tampoco: el recordatorio traerá uno vivo', () => {
    const lejos = INICIO - (MAX_DIAS_ENLACE_SALA + 1) * 24 * H
    expect(diasDeVidaDelEnlace(`${CITA.fecha} ${CITA.hora}`, lejos)).toBeNull()
  })

  it('sin fecha no se inventa una vida', () => {
    expect(diasDeVidaDelEnlace(undefined, Date.now())).toBeNull()
    expect(diasDeVidaDelEnlace('', Date.now())).toBeNull()
  })
})

describe('el token que se acuña sirve del otro lado', () => {
  const base = {
    tipo: ES_TELECONSULTA, clinicId: CLINICA, pacienteId: PACIENTE,
    fechaHora: `${CITA.fecha} ${CITA.hora}`, tz: TZ_DEFAULT,
  }

  it('lleva la clínica, el paciente y el alcance mínimo', () => {
    const t = tokenParaLaSala({ ...base, ahoraMs: INICIO - 26 * H })
    const v = verificarTokenPaciente(t)
    expect(v).not.toBeNull()
    expect(v!.clinicId).toBe(CLINICA)
    expect(v!.patientId).toBe(PACIENTE)
    // `agenda` es lo que la sala necesita. `clinico` abriría los documentos.
    expect(v!.alcance).toBe('agenda')
  })

  it('transporta la versión de revocación del expediente', () => {
    const t = tokenParaLaSala({ ...base, ahoraMs: INICIO - 26 * H, portalTokenVersion: 4 })
    expect(verificarTokenPaciente(t)!.version).toBe(4)
  })

  it('sigue vivo cuando la sala abre, y también cuando cierra', () => {
    vi.useFakeTimers()
    vi.setSystemTime(INICIO - 26 * H)
    const t = tokenParaLaSala({ ...base, ahoraMs: INICIO - 26 * H })

    vi.setSystemTime(INICIO - MINUTOS_ANTES * 60_000)
    expect(verificarTokenPaciente(t), 'debería valer cuando abre la sala').not.toBeNull()

    vi.setSystemTime(INICIO + HORAS_DESPUES * H)
    expect(verificarTokenPaciente(t), 'debería valer hasta que cierra').not.toBeNull()
  })

  it('y ha caducado bastante antes de que se pudra en el hilo de WhatsApp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(INICIO - 26 * H)
    const t = tokenParaLaSala({ ...base, ahoraMs: INICIO - 26 * H })

    vi.setSystemTime(INICIO + (MAX_DIAS_ENLACE_SALA + 1) * 24 * H)
    expect(verificarTokenPaciente(t)).toBeNull()
  })

  it('sin expediente vinculado NO emite token', () => {
    /** Falla cerrado: sin `pacienteId` la sala no puede comprobar titularidad,
     *  así que el enlace sería un 404 con pinta de enlace bueno. */
    expect(tokenParaLaSala({ ...base, pacienteId: '', ahoraMs: INICIO - 3 * H })).toBe('')
    expect(tokenParaLaSala({ ...base, pacienteId: undefined, ahoraMs: INICIO - 3 * H })).toBe('')
  })

  it('una cita presencial no lleva token de sala', () => {
    expect(tokenParaLaSala({ ...base, tipo: 'seguimiento', ahoraMs: INICIO - 3 * H })).toBe('')
  })

  it('una cita demasiado lejana tampoco', () => {
    const lejos = INICIO - (MAX_DIAS_ENLACE_SALA + 2) * 24 * H
    expect(tokenParaLaSala({ ...base, ahoraMs: lejos })).toBe('')
  })
})

describe('el mensaje completo: del texto de WhatsApp a la puerta de la sala', () => {
  /**
   * LA PRUEBA DEL OTRO LADO. No basta con que el token exista: hay que sacarlo
   * del texto que le llega al paciente —tal cual, con su URL escapada— y
   * verificarlo como lo haría el servidor.
   */
  it('el `t=` que va en el mensaje verifica y apunta a ESTE paciente', () => {
    const token = tokenParaLaSala({
      tipo: ES_TELECONSULTA, clinicId: CLINICA, pacienteId: PACIENTE,
      fechaHora: `${CITA.fecha} ${CITA.hora}`, ahoraMs: INICIO - 26 * H, tz: TZ_DEFAULT,
    })
    const texto = dondeEsLaCita({
      tipo: ES_TELECONSULTA, citaId: 'cita_1', clinicId: CLINICA,
      baseUrl: 'https://app.example', tokenPaciente: token,
    }).lineas.join('\n')

    expect(texto).not.toContain(SIN_ENLACE)
    const url = new URL(texto.split('🔗 ')[1].trim())
    const v = verificarTokenPaciente(url.searchParams.get('t'))
    expect(v).not.toBeNull()
    expect(v!.patientId).toBe(PACIENTE)
    expect(v!.clinicId).toBe(CLINICA)
  })

  it('sin token acuñado el mensaje sigue diciendo la verdad', () => {
    const texto = dondeEsLaCita({
      tipo: ES_TELECONSULTA, citaId: 'cita_1', clinicId: CLINICA,
      baseUrl: 'https://app.example', tokenPaciente: '',
    }).lineas.join('\n')
    expect(texto).toContain(SIN_ENLACE)
    expect(texto).not.toContain('/teleconsulta/')
  })
})

describe('los tres mensajes de servidor pasan el token', () => {
  /**
   * EL DATO TIENE QUE LLEGAR. Que exista quien acuña el token no sirve de nada
   * si los sitios que componen el mensaje no se lo dan — que es exactamente el
   * estado en el que quedó REG-268. Se lee del código fuente a propósito: son
   * rutas de servidor con Firestore y WhatsApp detrás, y montarlas enteras para
   * comprobar un argumento sería probar otra cosa.
   *
   * Probado al revés: quitando `tokenPaciente` de cualquiera de las tres
   * llamadas, falla.
   */
  const llamadas = (src: string) =>
    [...src.matchAll(/dondeEsLaCita\(\{[\s\S]*?\n\s*\}\)/g)].map(m => m[0])

  it('el cron de recordatorios (24 h y mismo día)', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'cron', 'reminders', 'route.ts'), 'utf8')
    const l = llamadas(src)
    expect(l.length).toBeGreaterThan(0)
    for (const c of l) expect(c).toContain('tokenPaciente')
  })

  it('el bot de WhatsApp, en sus dos confirmaciones', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts'), 'utf8')
    const l = llamadas(src)
    expect(l.length).toBe(2)
    for (const c of l) expect(c).toContain('tokenPaciente')
  })

  it('ninguno de los dos firma en un módulo que ve el navegador', () => {
    /** `PORTAL_PACIENTE_SECRET` no puede acabar en el paquete del cliente.
     *  `donde-es.ts` se importa desde el portal, así que no firma: recibe. */
    const donde = readFileSync(join(process.cwd(), 'src', 'lib', 'telesalud', 'donde-es.ts'), 'utf8')
    expect(donde).not.toContain('crearTokenPaciente')
    const ventana = readFileSync(join(process.cwd(), 'src', 'lib', 'telesalud', 'ventana-sala.ts'), 'utf8')
    expect(ventana).not.toContain('crearTokenPaciente')
  })
})

describe('la revocación llega hasta la puerta de la sala', () => {
  it('`/api/telesalud/sala` comprueba la versión del expediente', () => {
    /**
     * El botón «revocar enlaces» del expediente sube `portalTokenVersion`.
     * `/api/portal` lo comprobaba desde el principio; esta ruta no, así que
     * revocar no cerraba la sala de video. Con el token viajando por WhatsApp,
     * eso pasa de detalle a agujero.
     */
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'telesalud', 'sala', 'route.ts'), 'utf8')
    expect(src).toContain('tokenVigente')
    expect(src).toContain('portalTokenVersion')
  })
})
