/**
 * LA ASISTENTE ENTRÓ SIN CONTRASEÑA, SIN CORREO Y A OTRO CONSULTORIO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Reporte del dueño (7-sep-2026), literal: «al momento de generar la cuenta con
 * un enlace no pide contraseña y la asistente no tiene contraseña y no manda al
 * correo la confirmación, no le ha llegado» y «lo que genera el médico, por
 * ejemplo ajuste de configuración, debe aparecerle a la asistente igual».
 *
 * Tres síntomas, tres causas distintas, todas en el camino de la invitación:
 *
 *  1. **Sin contraseña.** `/unirse/[code]` no daba de alta a nadie: rebotaba a
 *     `/registro`. Con una sesión ya abierta ni siquiera ofrecía crear cuenta —
 *     enseñaba «Aceptar y entrar»— y como el médico que generó el enlace YA es
 *     miembro de esa clínica, `/api/clinic/unirse` contestaba `ok` por el atajo
 *     de «ya perteneces a esta clínica». Resultado: se trabajaba dentro de la
 *     sesión del médico. Nunca se pidió contraseña porque nunca se creó cuenta.
 *
 *  2. **Sin correo.** El alta mandaba la verificación así:
 *     `void sendEmailVerification(u).catch(() => console.warn(…))`. Si Firebase
 *     no aceptaba el envío, el único rastro era un `console.warn` que la persona
 *     que se da de alta no ve jamás. Y en ningún sitio se decía a qué dirección
 *     se había escrito, así que un correo mal tecleado no se notaba.
 *
 *  3. **Otro consultorio.** Si el rebote a `/registro` se perdía —pestaña
 *     cerrada, ida y vuelta de `signInWithRedirect` con Google— el siguiente
 *     arranque entraba sin membresía y el layout mandaba a `/setup`, que es
 *     «crea tu consultorio». La asistente lo rellenaba (no había otra puerta) y
 *     salía siendo ADMINISTRADORA DE UN CONSULTORIO VACÍO Y PROPIO. Por eso
 *     nada de lo que configuraba el médico le aparecía: `useConfig` lee
 *     `clinics/{clinicId}/config/main` y ella estaba mirando otro `clinicId`.
 *     La invitación seguía «pendiente» en el panel del médico.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Uso real: la primera asistente dada de alta en producción. El reporte llegó
 * como tres quejas sueltas; recorrer el camino entero (`/unirse` → `/registro`
 * → `/unirse`, y el atajo de `/api/clinic/unirse`) enseñó que eran el mismo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * · El alta ocurre EN la pantalla de la invitación, con contraseña a la vista.
 * · `pedirCorreoDeConfirmacion` nunca devuelve éxito sin haberlo intentado, y
 *   reintenta sin URL de vuelta antes de darse por vencido.
 * · La invitación puede ser NOMINATIVA (`emailInvitado`): sólo la acepta ese
 *   correo, y lo comprueba el servidor — no la pantalla.
 * · Con invitación pendiente, el destino de quien no tiene consultorio es
 *   terminarla, no crear uno (`destinoSinConsultorio`).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · **Que el correo LLEGUE.** Lo envía Firebase, no este repositorio: aquí sólo
 *   se comprueba que se pide y que el fallo se cuenta. Si la plantilla o el
 *   dominio de la consola de Firebase están mal, esto pasa en verde y el correo
 *   no llega igual. Ese extremo se mira en la consola, no en CI.
 * · La ejecución de `firestore.rules` (eso vive en `emulator/`): aquí sólo se
 *   fija que la forma congelada admita el campo nuevo.
 * · Que la pantalla se vea bien. Se comprueba que el campo de contraseña y el
 *   alta EXISTEN en el archivo, no cómo están pintados.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { documentoDeInvitacion } from '@/lib/invitations'
import { invitacionEsParaEsteCorreo, correoNormalizado } from '@/lib/security/invitacion-vigente'
import {
  recordarInvitacion, invitacionPendiente, olvidarInvitacion, destinoSinConsultorio,
  esCodigoDeInvitacion, CLAVE_INVITACION_PENDIENTE, type AlmacenSimple,
} from '@/lib/clinica/invitacion-pendiente'
import { pedirCorreoDeConfirmacion } from '@/lib/auth/correo-de-confirmacion'

const RAIZ = process.cwd()
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8')
/** Sin comentarios: los de este repo citan a propósito el código viejo. */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const AHORA = Date.parse('2026-09-07T12:00:00.000Z')

function almacenDePrueba(): AlmacenSimple & { datos: Map<string, string> } {
  const datos = new Map<string, string>()
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => { datos.set(k, v) },
    removeItem: (k) => { datos.delete(k) },
  }
}

describe('1 · la invitación puede llevar destinatario, y la forma congelada lo admite', () => {
  it('el correo se guarda normalizado y no aparece si viene vacío', () => {
    const con = documentoDeInvitacion({
      code: 'ABCDEFGHJK', clinicId: 'c1', clinicNombre: 'Consultorio Sintético', role: 'secretaria',
      creador: { uid: 'u-medico', email: 'medico@ejemplo.mx' },
      emailInvitado: '  Maria.Perez@Ejemplo.MX  ', ahoraMs: AHORA,
    })
    expect(con.emailInvitado).toBe('maria.perez@ejemplo.mx')

    const sin = documentoDeInvitacion({
      code: 'ABCDEFGHJK', clinicId: 'c1', clinicNombre: 'Consultorio Sintético', role: 'secretaria',
      creador: { uid: 'u-medico', email: 'medico@ejemplo.mx' },
      emailInvitado: '   ', ahoraMs: AHORA,
    })
    // Firestore rechaza `undefined` y la regla congela las claves: si no hay
    // correo, la clave no puede existir.
    expect('emailInvitado' in sin).toBe(false)
    expect(Object.values(sin).some(v => v === undefined)).toBe(false)
  })

  it('la regla de Firestore admite exactamente las claves que escribe el módulo', () => {
    const reglas = leer('firestore.rules')
    const m = reglas.match(/match \/clinic_invitations\/\{code\}[\s\S]*?keys\(\)\.hasOnly\(\[([^\]]*)\]\)/)
    expect(m).not.toBeNull()
    const enRegla = [...m![1].matchAll(/'([^']+)'/g)].map(x => x[1])
    expect(enRegla).toContain('emailInvitado')

    const d = documentoDeInvitacion({
      code: 'X', clinicId: 'c', clinicNombre: 'n', role: 'medico',
      creador: { uid: 'u', email: 'e' }, nombreInvitado: 'Invitada',
      emailInvitado: 'invitada@ejemplo.mx', especialidad: 'Medicina interna', ahoraMs: AHORA,
    })
    for (const k of Object.keys(d)) expect(enRegla, `la regla no admite «${k}»`).toContain(k)
  })
})

describe('2 · una invitación con destinatario sólo la acepta ese correo', () => {
  it('sin destinatario sigue siendo al portador — las ya emitidas no se rompen', () => {
    expect(invitacionEsParaEsteCorreo({}, 'quien.sea@ejemplo.mx').ok).toBe(true)
    expect(invitacionEsParaEsteCorreo({ emailInvitado: '' }, 'quien.sea@ejemplo.mx').ok).toBe(true)
  })

  it('el correo invitado entra aunque venga con otra caja o con espacios', () => {
    const inv = { emailInvitado: 'maria@ejemplo.mx' }
    expect(invitacionEsParaEsteCorreo(inv, '  MARIA@Ejemplo.mx ').ok).toBe(true)
  })

  /**
   * AL REVÉS: se le mete el defecto. Sin esta guarda, el enlace reenviado por
   * WhatsApp —o la sesión del médico que generó el enlace— aceptaba igual.
   */
  it('otro correo NO entra, y el motivo nombra las dos direcciones', () => {
    const r = invitacionEsParaEsteCorreo({ emailInvitado: 'maria@ejemplo.mx' }, 'el.medico@ejemplo.mx')
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('inalcanzable')
    expect(r.motivo).toContain('maria@ejemplo.mx')
    expect(r.motivo).toContain('el.medico@ejemplo.mx')
  })

  it('una sesión sin correo tampoco pasa: ausencia de dato no es permiso', () => {
    for (const nada of [null, undefined, '', '   ', 42]) {
      expect(invitacionEsParaEsteCorreo({ emailInvitado: 'maria@ejemplo.mx' }, nada).ok).toBe(false)
    }
  })

  it('correoNormalizado no inventa un correo con lo que no es texto', () => {
    expect(correoNormalizado(undefined)).toBe('')
    expect(correoNormalizado({ email: 'x' })).toBe('')
    expect(correoNormalizado(' A@B.mx ')).toBe('a@b.mx')
  })

  it('el servidor lo comprueba en LOS DOS caminos, no sólo en la transacción', () => {
    const ruta = sinComentarios(leer('src/app/api/clinic/unirse/route.ts'))
    expect(ruta).toContain('invitacionEsParaEsteCorreo')
    // El atajo de «ya perteneces a esta clínica» era justo por donde entraba la
    // sesión del médico: si vuelve a responder `ok` sin comprobar, esto cae.
    const atajo = ruta.slice(ruta.indexOf('memberSnap.exists'), ruta.indexOf('runTransaction'))
    expect(atajo).toContain('invitacionEsParaEsteCorreo')
    // Y dentro de la transacción, antes de escribir la membresía.
    const tx = ruta.slice(ruta.indexOf('runTransaction'))
    expect(tx.indexOf('invitacionEsParaEsteCorreo')).toBeGreaterThan(-1)
    expect(tx.indexOf('invitacionEsParaEsteCorreo')).toBeLessThan(tx.indexOf('tx.set(memberRef'))
  })
})

describe('3 · la invitación a medias no se convierte en un consultorio nuevo', () => {
  it('lo que no tiene forma de código no se recuerda ni se obedece', () => {
    for (const basura of ['', 'abc', 'ABCDEFGHJKL', 'ABCDEFGHI0', null, 7]) {
      expect(esCodigoDeInvitacion(basura)).toBe(false)
      expect(destinoSinConsultorio(basura as string | null)).toBe('/setup')
    }
    expect(esCodigoDeInvitacion('ABCDEFGHJK')).toBe(true)
  })

  it('con invitación pendiente el destino es aceptarla; sin ella, crear consultorio', () => {
    expect(destinoSinConsultorio('ABCDEFGHJK')).toBe('/unirse/ABCDEFGHJK')
    expect(destinoSinConsultorio(null)).toBe('/setup')
  })

  it('el código sobrevive guardado y se olvida al consumirlo', () => {
    const a = almacenDePrueba()
    recordarInvitacion('abcdefghjk', a)
    expect(a.datos.get(CLAVE_INVITACION_PENDIENTE)).toBe('ABCDEFGHJK')
    expect(invitacionPendiente(a)).toBe('ABCDEFGHJK')
    olvidarInvitacion(a)
    expect(invitacionPendiente(a)).toBeNull()
  })

  it('un almacén que revienta (modo privado) no tumba el alta', () => {
    const roto: AlmacenSimple = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    }
    expect(() => recordarInvitacion('ABCDEFGHJK', roto)).not.toThrow()
    expect(invitacionPendiente(roto)).toBeNull()
    expect(() => olvidarInvitacion(roto)).not.toThrow()
  })

  /**
   * AL REVÉS: si alguien vuelve a poner `router.replace('/setup')` a secas en
   * el layout, esto cae — y ése es exactamente el renglón que creaba el
   * consultorio fantasma.
   */
  it('el layout y /setup consultan la invitación pendiente antes de crear nada', () => {
    const layout = sinComentarios(leer('src/app/(dashboard)/layout.tsx'))
    expect(layout).toContain('destinoSinConsultorio(invitacionPendiente())')
    expect(layout).not.toMatch(/needsSetup\s*\)\s*\{\s*router\.replace\('\/setup'\)/)

    const setup = sinComentarios(leer('src/app/setup/page.tsx'))
    expect(setup).toContain('invitacionPendiente()')
    expect(setup).toContain('destinoSinConsultorio')
  })
})

describe('4 · el correo de confirmación se pide, y si no se pudo se DICE', () => {
  it('el primer intento lleva la URL de vuelta a la aplicación', async () => {
    const vistos: unknown[] = []
    const r = await pedirCorreoDeConfirmacion(
      { email: 'maria@ejemplo.mx' },
      async (ajustes) => { vistos.push(ajustes) },
      'https://ausculta.example',
    )
    expect(r.enviado).toBe(true)
    if (!r.enviado) throw new Error('inalcanzable')
    expect(r.a).toBe('maria@ejemplo.mx')
    expect(r.conUrlDeVuelta).toBe(true)
    expect(vistos).toEqual([{ url: 'https://ausculta.example/login', handleCodeInApp: false }])
  })

  /**
   * `auth/unauthorized-continue-uri` hacía fallar el envío ENTERO. Mejorar el
   * aterrizaje no puede costar el correo, que es lo que importa.
   */
  it('si la URL de vuelta no está autorizada, se reintenta sin ella', async () => {
    let intentos = 0
    const r = await pedirCorreoDeConfirmacion(
      { email: 'maria@ejemplo.mx' },
      async (ajustes) => {
        intentos++
        if (ajustes) throw Object.assign(new Error('nope'), { code: 'auth/unauthorized-continue-uri' })
      },
      'https://ausculta.example',
    )
    expect(intentos).toBe(2)
    expect(r.enviado).toBe(true)
    if (!r.enviado) throw new Error('inalcanzable')
    expect(r.conUrlDeVuelta).toBe(false)
  })

  it('si los dos intentos fallan NO dice que lo mandó, y trae el motivo', async () => {
    const r = await pedirCorreoDeConfirmacion(
      { email: 'maria@ejemplo.mx' },
      async () => { throw Object.assign(new Error('x'), { code: 'auth/too-many-requests' }) },
      'https://ausculta.example',
    )
    expect(r.enviado).toBe(false)
    if (r.enviado) throw new Error('inalcanzable')
    expect(r.porQue).toBe('auth/too-many-requests')
    expect(r.a).toBe('maria@ejemplo.mx')
  })

  it('sin navegador (sin origen) se pide igual, sin URL de vuelta', async () => {
    const vistos: unknown[] = []
    const r = await pedirCorreoDeConfirmacion({ email: 'a@b.mx' }, async (aj) => { vistos.push(aj) }, null)
    expect(r.enviado).toBe(true)
    expect(vistos).toEqual([undefined])
  })

  it('/registro ya no se traga el fallo en un console.warn: lo pinta', () => {
    const src = sinComentarios(leer('src/app/registro/page.tsx'))
    expect(src).toContain('pedirCorreoDeConfirmacion')
    expect(src).toContain('setAvisoCorreo')
    expect(src).not.toContain("console.warn('[registro] no se pudo enviar la verificación de correo')")
  })
})

describe('5 · la pantalla de la invitación pide contraseña y da de alta ahí mismo', () => {
  const pagina = leer('src/app/unirse/[code]/page.tsx')
  const codigo = sinComentarios(pagina)

  it('tiene campo de contraseña, con su etiqueta y su interruptor de ver/ocultar', () => {
    expect(codigo).toContain('unirse-contrasena')
    expect(codigo).toMatch(/htmlFor="unirse-contrasena"/)
    expect(codigo).toMatch(/type=\{showPwd \? 'text' : 'password'\}/)
    expect(codigo).toMatch(/aria-label=\{showPwd \? 'Ocultar la contraseña' : 'Mostrar la contraseña'\}/)
  })

  it('crea la cuenta aquí y pide el correo de confirmación antes de entrar', () => {
    expect(codigo).toContain('createUserWithEmailAndPassword')
    expect(codigo).toContain('pedirCorreoDeConfirmacion')
    // El rebote a /registro era el origen del problema: ya no existe.
    expect(codigo).not.toContain('/registro?invite=')
  })

  it('con una sesión abierta dice de QUIÉN es y deja salir de ella', () => {
    expect(codigo).toContain('invitacionEsParaEsteCorreo')
    expect(codigo).toContain('signOut')
    expect(pagina).toContain('No soy yo · crear una cuenta nueva')
  })

  it('recuerda el código antes de irse a Google, para poder volver', () => {
    expect(codigo).toContain('recordarInvitacion')
    const google = codigo.slice(codigo.indexOf('const conGoogle'))
    expect(google.indexOf('recordarInvitacion')).toBeLessThan(google.indexOf('signInWithRedirect'))
  })

  it('el correo llega fijado cuando la invitación es nominativa', () => {
    expect(codigo).toContain('readOnly={!!correoFijado}')
  })
})
