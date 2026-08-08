/**
 * EL ENLACE DE LA VIDEOCONSULTA NO LLEVABA CON QUÉ ENTRAR — V9 · REG-265.
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
 * - **El camino de WhatsApp sigue sin enlace.** `api/cron/reminders` y el
 *   webhook llaman a `dondeEsLaCita` sin token porque hoy no lo emiten; desde
 *   este cambio mandan el texto «recibirás el enlace» en vez de un enlace roto.
 *   Emitirlo ahí exige acuñar el token en el servidor y está abierto en el
 *   backlog de V9 como `PATIENT-TELE-002`. **Esto NO cierra ese hueco: lo hace
 *   honesto.**
 * - No comprueba la ventana horaria de la sala: eso es `ventanaDeSala`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { enlaceSalaPaciente } from '@/lib/telesalud/ventana-sala'
import { dondeEsLaCita, SIN_ENLACE, ES_TELECONSULTA } from '@/lib/telesalud/donde-es'

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
