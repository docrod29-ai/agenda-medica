/**
 * EL ENLACE DE LA VIDEOCONSULTA NO LLEVABA CON QUÉ ENTRAR — V9 · REG-268.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El paciente abría su portal (`/mi/<token>`), veía su videoconsulta con el
 * botón «Entrar a la videoconsulta» —la ventana abierta, la hora correcta— lo
 * pulsaba, y la aplicación le contestaba:
 *
 *     «Cita no encontrada.»
 *
 * En la hora de su consulta. Sin ninguna explicación que le sirviera.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `enlaceSalaPaciente()` componía `/teleconsulta/<citaId>?c=<clinicId>` y nada
 * más. Del otro lado, `/api/telesalud/sala` exige **una de dos** pruebas de
 * titularidad:
 *
 *   1. el token HMAC del paciente (`?t=`), o
 *   2. una sesión de miembro del consultorio con `clinico.leer`.
 *
 * El paciente no tiene sesión, y el enlace no le daba token. Así que caía en la
 * rama de rechazo — que devuelve **404** a propósito, para no confirmarle a un
 * desconocido que ese `citaId` existe. La defensa funcionaba perfectamente; lo
 * que estaba mal es que se la estábamos aplicando al dueño de la cita.
 *
 * Lo cruel del caso: en el portal el token **estaba en la barra de
 * direcciones**, a un parámetro de distancia. Sólo había que pasarlo.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditoría de superficie del paciente de `PATIENT-UX-TRUTH-001` (V9),
 * siguiendo el enlace desde donde se construye hasta donde se valida. No lo
 * encontró ninguna prueba: las que había mockeaban `verificarTokenPaciente`, o
 * sea, daban por bueno justo el dato que nunca llegaba.
 *
 * Y no lo encontró nadie de dentro porque **el médico nunca recorre este
 * camino**: su botón de `(dashboard)/citas` sí añade `&t=`, con un token que le
 * emite `/api/telesalud/token`. Sólo fallaba el camino que ningún empleado usa.
 *
 * Familia: **«el dato tiene que LLEGAR»**. El enlace se construía, se enviaba y
 * se abría. Lo que no llegaba era la credencial que lo hace funcionar del otro
 * lado. Igual que REG-167, REG-170 y REG-160.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El token es un parámetro **obligatorio** de `enlaceSalaPaciente`. Opcional,
 * este defecto reaparecería en el siguiente llamador que lo olvide, en
 * silencio. Obligatorio, el compilador obliga a cada llamador a decidir — y
 * quien no tenga token tiene que escribir `''`, que es una decisión, no un
 * descuido.
 *
 * Y quien no tiene token **no emite enlace**: `dondeEsLaCita` prefiere decir
 * «recibirás el enlace» a mandar uno que contesta que la cita no existe. Un
 * paciente sin enlace llama al consultorio; un paciente con un 404 cree que se
 * quedó sin cita.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No prueba el 404 contra la ruta de verdad.** Comprueba que el enlace
 *   lleva el token y que el portal lo pasa. Que `/api/telesalud/sala` acepte
 *   ese token concreto es otra prueba (`telesalud-sala-or.test.ts`) y sigue
 *   mockeada.
 * - **El camino de WhatsApp ya lleva enlace desde REG-309** (bloque al final de
 *   este archivo). Hasta entonces `api/cron/reminders` y el webhook llamaban a
 *   `dondeEsLaCita` sin token y mandaban «recibirás el enlace»: honesto, y sin
 *   enlace. Era `PATIENT-TELE-002`, el último P0 abierto de la superficie del
 *   paciente.
 * - No comprueba la ventana horaria de la sala: eso es `ventanaDeSala`.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { enlaceSalaPaciente } from '@/lib/telesalud/ventana-sala'
import { dondeEsLaCita, esTeleconsulta, SIN_ENLACE, ES_TELECONSULTA } from '@/lib/telesalud/donde-es'

describe('el enlace del paciente lleva su token', () => {
  it('lo añade como `t=` cuando se le da uno', () => {
    const url = enlaceSalaPaciente('cita_123', 'clin_9', 'tok.abc')
    expect(url).toContain('/teleconsulta/cita_123')
    expect(url).toContain('c=clin_9')
    expect(url).toContain('t=tok.abc')
  })

  it('escapa el token en la URL', () => {
    /** Los tokens son base64url y no traen `&` ni `=`, pero componer una URL
     *  concatenando sin escapar es cómo nace el siguiente defecto. */
    expect(enlaceSalaPaciente('c/1', 'k', 'a b&c')).toContain('t=a%20b%26c')
  })

  it('sin token no inventa un `t=` vacío', () => {
    /** Un `?t=` vacío haría `verificarTokenPaciente('')` → null: el mismo 404,
     *  pero con pinta de llevar credencial. Mejor que no aparezca. */
    expect(enlaceSalaPaciente('cita_123', 'clin_9', '')).not.toContain('t=')
  })
})

describe('el mensaje al paciente no manda un enlace que contesta 404', () => {
  const base = { tipo: ES_TELECONSULTA, citaId: 'cita_1', clinicId: 'clin_1', baseUrl: 'https://app.example' }

  it('SIN token: no emite enlace, y lo dice', () => {
    /**
     * Ésta es la que muerde. Antes del arreglo esta llamada devolvía
     * `🔗 https://app.example/teleconsulta/cita_1?c=clin_1` — el enlace roto.
     * Probada al revés: devolviendo el enlace sin token, falla.
     */
    const lugar = dondeEsLaCita(base)
    expect(lugar.esVideo).toBe(true)
    const texto = lugar.lineas.join('\n')
    expect(texto).not.toContain('/teleconsulta/')
    expect(texto).toContain(SIN_ENLACE)
  })

  it('CON token: emite el enlace, y lleva el token', () => {
    const texto = dondeEsLaCita({ ...base, tokenPaciente: 'tok.xyz' }).lineas.join('\n')
    expect(texto).toContain('https://app.example/teleconsulta/cita_1')
    expect(texto).toContain('t=tok.xyz')
  })

  it('una cita presencial sigue dando dirección y no habla de enlaces', () => {
    const lugar = dondeEsLaCita({ tipo: 'consulta', direccion: 'Av. Siempre Viva 1' })
    expect(lugar.esVideo).toBe(false)
    expect(lugar.lineas.join('\n')).toContain('Av. Siempre Viva 1')
  })
})

describe('el portal del paciente PASA su token al botón', () => {
  it('la llamada del portal lleva tres argumentos', () => {
    /**
     * EL DATO TIENE QUE LLEGAR. Que la función acepte el token no sirve de nada
     * si el único sitio del producto que puede darlo no se lo da. Esto se lee
     * del código fuente a propósito: es la comprobación del **otro lado**, y no
     * hay forma de hacerla renderizando el componente sin montar todo el portal.
     *
     * Si alguien vuelve a dejar la llamada en dos argumentos, TypeScript ya
     * falla en el build — esta prueba es el segundo cerrojo, y el que explica
     * por qué.
     */
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'mi', '[token]', 'page.tsx'), 'utf8')
    expect(src).toMatch(/enlaceSalaPaciente\(\s*c\.id\s*,[^)]*,\s*token\s*\)/)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   REG-309 · EL ENLACE QUE VIAJA POR WHATSAPP — `PATIENT-TELE-002`
   ═══════════════════════════════════════════════════════════════════════════

   ── QUÉ FALLABA ────────────────────────────────────────────────────────────

   REG-268 arregló el camino del portal y dejó dicho, con todas las letras, que
   el de WhatsApp seguía abierto: «Esto NO cierra ese hueco: lo hace honesto».

   El recordatorio de la víspera, el de la mañana, la confirmación de una cita
   agendada por el bot y la de lista de espera son los CUATRO mensajes por los
   que se anuncia una videoconsulta — y los cuatro decían «recibirás el enlace
   de la videollamada por este medio antes de tu cita». Ese medio era éste. El
   enlace no llegaba nunca.

   El paciente acababa entrando por el portal, que también le llega por
   WhatsApp: el camino existía, con un paso de más justo cuando va con prisa.

   ── CAUSA RAÍZ ─────────────────────────────────────────────────────────────

   Acuñar el token exige `PORTAL_PACIENTE_SECRET`, y quien componía el mensaje
   era `lib/whatsapp.ts` — un módulo que **también se importa desde el
   navegador**. Firmar ahí habría filtrado el secreto al cliente. Así que
   `dondeEsLaCita` recibe el token como DATO y no lo calcula, y hasta hoy nadie
   se lo daba.

   ── LA REGLA QUE LO HACE SEGURO ────────────────────────────────────────────

   Alcance `agenda`, dos días. Un enlace de WhatsApp se reenvía, se queda en la
   copia de seguridad del teléfono y sobrevive a un cambio de número: con
   alcance clínico sería una credencial al expediente circulando por una app de
   mensajería, y con treinta días sería una llave de un mes.

   ── PROBADO AL REVÉS ───────────────────────────────────────────────────────

   Quitando `tokenPaciente` de cualquiera de los tres llamadores de servidor,
   falla el bloque «los tres llamadores de servidor lo pasan». Cambiando el
   alcance a `clinico`, falla el que lo verifica.

   ── QUÉ **NO** CUBRE ───────────────────────────────────────────────────────

   - **No manda un WhatsApp de verdad.** Que Meta entregue el mensaje y que el
     paciente pueda pulsar el enlace en su teléfono no lo demuestra ninguna
     prueba de este repositorio.
   - **No prueba `/api/telesalud/sala` con este token concreto**: esa ruta sigue
     con su propia prueba y con su mock.
   - **No comprueba la ventana horaria**: si el paciente pulsa el enlace tres
     días después, el token ya caducó y verá el mensaje de enlace inválido, no
     la sala. Es lo buscado, y quien lo decide es `ventanaDeSala` más el TTL.
*/
describe('REG-309 · el token de la sala se acuña en el servidor', () => {
  it('sin identificadores no acuña nada, y no lanza', async () => {
    const { tokenParaLaSala } = await import('@/lib/telesalud/token-de-sala')
    expect(await tokenParaLaSala('', 'pac_1')).toBe('')
    expect(await tokenParaLaSala('clin_1', '')).toBe('')
    expect(await tokenParaLaSala(null, undefined)).toBe('')
  })

  it('la ventana del token son DOS días: cubre el recordatorio de víspera', async () => {
    const { DIAS_DEL_TOKEN_DE_SALA } = await import('@/lib/telesalud/token-de-sala')
    /* Con uno, un recordatorio emitido a las 20:00 de la víspera para una cita
       de las 21:00 caducaba una hora antes de que el paciente entrase. */
    expect(DIAS_DEL_TOKEN_DE_SALA).toBe(2)
  })

  it('los tres llamadores de servidor le pasan el token a `dondeEsLaCita`', () => {
    /**
     * EL DATO TIENE QUE LLEGAR, otra vez y en el otro camino. Que exista quien
     * acuñe no sirve de nada si el mensaje se compone sin llamarlo.
     *
     * Se cuentan las llamadas y se exige que TODAS traigan `tokenPaciente`: con
     * «al menos una» el cuarto mensaje que alguien escriba mañana volvería a
     * salir mudo sin que nadie se entere.
     */
    const fuentes = [
      join(process.cwd(), 'src/app/api/cron/reminders/route.ts'),
      join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
    ]
    let llamadas = 0
    for (const f of fuentes) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/dondeEsLaCita\(\{[\s\S]*?\}\)/g)) {
        llamadas++
        expect(m[0], `una llamada a dondeEsLaCita sin tokenPaciente en ${f}`).toContain('tokenPaciente')
      }
    }
    expect(llamadas, 'los llamadores de servidor de dondeEsLaCita').toBe(3)
  })

  it('sólo se paga la lectura de Firestore cuando la cita ES una videoconsulta', () => {
    /* El cron recorre la agenda entera de cada consultorio: acuñar para cada
       cita presencial serían cientos de lecturas para tirarlas. */
    for (const f of ['src/app/api/cron/reminders/route.ts', 'src/app/api/whatsapp/webhook/route.ts']) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      expect(src, f).toMatch(/esTeleconsulta\([^)]*\)\s*\n?\s*\?\s*await tokenParaLaSala/)
    }
  })

  it('`esTeleconsulta` decide lo mismo que `dondeEsLaCita`, para que no puedan discrepar', () => {
    /**
     * El defecto que este bloque previene: el llamador comparando el tipo por su
     * cuenta. Con `'Teleconsulta'` o con un espacio de más, uno diría que es
     * video y el otro no acuñaría — mensaje de videoconsulta sin enlace, que es
     * exactamente el estado del que venimos.
     */
    for (const tipo of [ES_TELECONSULTA, ' TELECONSULTA ', 'Teleconsulta', 'consulta', '', undefined, null, 42]) {
      expect(esTeleconsulta(tipo), `tipo ${JSON.stringify(tipo)}`)
        .toBe(dondeEsLaCita({ tipo: tipo as string }).esVideo)
    }
  })
})

describe('REG-309 · el token de la sala abre la sala y nada más', () => {
  it('alcance `agenda`: un enlace reenviado por WhatsApp no abre el expediente', async () => {
    /**
     * Se acuña de verdad y se verifica de verdad — no se lee del código fuente,
     * porque lo que importa aquí es lo que el token DICE, no cómo se escribió.
     *
     * `adminDb` va simulado: sin él, cada ejecución se queda ocho segundos
     * esperando a un servidor de metadatos que en esta máquina no existe.
     */
    vi.resetModules()
    vi.doMock('@/lib/firebase-admin', () => ({
      adminDb: { collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ portalTokenVersion: 7 }) }) }) }) }) }) },
    }))
    const { tokenParaLaSala } = await import('@/lib/telesalud/token-de-sala')
    const { verificarTokenPaciente } = await import('@/lib/patient-token')

    const verificado = verificarTokenPaciente(await tokenParaLaSala('clin_1', 'pac_1'))
    expect(verificado).not.toBeNull()
    expect(verificado!.alcance).toBe('agenda')
    expect(verificado!.clinicId).toBe('clin_1')
    expect(verificado!.patientId).toBe('pac_1')
    /* Nace con la versión vigente del paciente: una revocación posterior sube
       ese contador y tumba también este enlace. */
    expect(verificado!.version).toBe(7)
    vi.doUnmock('@/lib/firebase-admin')
    vi.resetModules()
  })

  it('si no se puede leer la versión, se emite igual con la 0 en vez de dejar al paciente sin enlace', async () => {
    /**
     * Falla ABIERTA hacia «el enlace sirve», y es deliberado: la versión existe
     * para poder revocar, y quien no ha revocado nada tiene la 0. Dejar sin
     * enlace a todos los pacientes porque una lectura falló sería castigar al
     * paciente por una incidencia nuestra.
     */
    vi.resetModules()
    vi.doMock('@/lib/firebase-admin', () => ({
      adminDb: { collection: () => { throw new Error('firestore caído') } },
    }))
    const { tokenParaLaSala } = await import('@/lib/telesalud/token-de-sala')
    const { verificarTokenPaciente } = await import('@/lib/patient-token')

    const verificado = verificarTokenPaciente(await tokenParaLaSala('clin_1', 'pac_1'))
    expect(verificado).not.toBeNull()
    expect(verificado!.version).toBe(0)
    vi.doUnmock('@/lib/firebase-admin')
    vi.resetModules()
  })
})
