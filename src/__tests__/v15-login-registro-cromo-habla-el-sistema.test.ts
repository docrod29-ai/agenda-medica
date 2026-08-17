/**
 * V15-REMAINING-SCREENS-001 (§32/§34, cuarta rebanada) — LA PUERTA DE ENTRADA
 * (/login + /registro) HABLA EL SISTEMA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * /login y /registro son las pantallas que TODO médico cruza antes de tocar
 * nada clínico — y /registro es además la primera impresión del producto en
 * la prueba de 14 días. Compartían la familia de defectos de las rebanadas
 * 1-3, más dos propios:
 *
 *   1. LA CTA DE /registro PINTABA #000 SOBRE var(--teal) — 2.99:1 en tema
 *      claro, EXACTAMENTE el defecto ya medido y pagado en el chip del
 *      directorio de /pacientes (rebanada 6 de VISUAL-SYSTEM) y en la casilla
 *      de /orden (rebanada 3). El botón que convierte al visitante en cliente
 *      reprobaba AA en el tema que sale por defecto con luz de consultorio.
 *      Y su estado deshabilitado era un gris a mano (--s3/--text3), no el
 *      .btn:disabled del sistema.
 *
 *   2. /registro tenía DOS idiomas de formulario en la misma puerta: /login
 *      hablaba .form-group/.label/.input y /registro lo re-dibujaba todo a
 *      mano — y su hack onFocus/onBlur que mutaba borderColor por JavaScript
 *      NO daba anillo de foco (.input:focus pone borde + box-shadow del
 *      token; el hack sólo cambiaba un color de borde de 1px, invisible como
 *      indicador). El teclado navegaba un formulario sin foco visible en la
 *      pantalla de alta.
 *
 *   3. TEMA: el aviso de restablecer contraseña de /login pintaba
 *      rgba(20,184,166,…) — el teal CRUDO del tema oscuro fijado a mano (en
 *      claro ni el tinte ni el borde cambiaban), con teal COMO TEXTO del
 *      mensaje (lección TrialBanner). Y el borde de la caja de prueba de
 *      /registro era rgba(61,90,254,0.22) — el ÍNDIGO VIEJO, un acento que ya
 *      ni existe como token.
 *
 *   4. §24: «¿Olvidaste tu contraseña?» y «← Volver» eran botones de texto de
 *      ~18px de alto; las CTA (submit, Google, MFA) quedaban en los 36px fijos
 *      de .btn. Ninguno llegaba al objetivo táctil de 44.
 *
 *   5. WCAG 1.4.1: los enlaces DENTRO de frase («Inicia sesión», términos,
 *      privacidad, «Crea una gratis →») se distinguían sólo por color —
 *      textDecoration: 'none' explícito.
 *
 *   6. Código muerto: /registro declaraba useState<'form' | 'verifying'> que
 *      nunca se leía, y ambas páginas importaban Stethoscope sin usarlo.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Por el inventario-por-grep de REMAINING-SCREENS-001 (roles §2 vs fontSize
 * inline por pantalla). El estado vivo dejó /login + /registro nombradas como
 * cuarta rebanada tras /orden.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Freeze funcional (§1/§42): los flujos de auth NO cambian — mismo
 * signInWithEmailAndPassword, mismo resolver de MFA, misma redirección por
 * invite, mismo sendPasswordResetEmail con respuesta que no revela si el
 * correo existe, mismo createUserWithEmailAndPassword + sendEmailVerification
 * + trackConversion, mismo precio desde PLANES (nunca un número a mano —
 * la lección documentada en el propio archivo). Este guardián fija todo eso.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No mide estilos computados, foco real, contraste ni axe — eso lo hace el
 * arnés `scripts/design/capturar-login-registro-v15.mjs` en navegador real
 * (incluye el alta y el login REALES contra el emulador). No cubre el flujo
 * de Google (redirección externa, no se puede clicar en el arnés) ni que el
 * correo de verificación LLEGUE — sólo que se siga pidiendo. El botón blanco
 * de Google conserva sus hex de marca a propósito (lineamientos de Google);
 * este guardián no los veta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOGIN = readFileSync(join('src', 'app', 'login', 'page.tsx'), 'utf8')
const REGISTRO = readFileSync(join('src', 'app', 'registro', 'page.tsx'), 'utf8')
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('V15 puerta de entrada — la CTA de /registro es la primaria del sistema (la razón de ser)', () => {
  it('la CTA habla btn-primary: --nexus-solido + blanco, no #000 sobre teal (2.99:1 en claro)', () => {
    const codigo = sinComentarios(REGISTRO)
    expect(codigo).not.toContain("'#000'")
    expect(codigo).not.toMatch(/background: valid \? 'var\(--teal\)'/)
    expect(REGISTRO).toMatch(/type="submit"\s+className="btn btn-primary"/)
  })

  it('el estado deshabilitado lo pone .btn:disabled, no un gris a mano', () => {
    expect(REGISTRO).toContain('disabled={!valid || submitting}')
    const codigo = sinComentarios(REGISTRO)
    expect(codigo).not.toMatch(/valid \? 'var\(--teal\)' : 'var\(--s3\)'/)
    expect(codigo).not.toMatch(/cursor: valid && !submitting/)
  })

  it('sólo hay UNA voz primaria por página (§16)', () => {
    expect((REGISTRO.match(/btn btn-primary/g) ?? []).length).toBe(1)
    // /login: una por rama exclusiva (MFA o formulario normal — nunca conviven).
    expect((LOGIN.match(/btn btn-primary/g) ?? []).length).toBe(2)
  })
})

describe('V15 puerta de entrada — /registro habla el idioma de formulario del sistema', () => {
  it('los tres campos son .input con .label asociada (htmlFor + id)', () => {
    expect((REGISTRO.match(/className="input"/g) ?? []).length).toBe(3)
    for (const id of ['reg-tu-nombre-completo', 'reg-correo-electronico', 'reg-contrasena']) {
      expect(REGISTRO).toContain(`htmlFor="${id}"`)
      expect(REGISTRO).toContain(`id="${id}"`)
    }
    expect((REGISTRO.match(/className="label"/g) ?? []).length).toBe(3)
  })

  it('el hack de foco por JavaScript murió: el anillo lo pone .input:focus', () => {
    const codigo = sinComentarios(REGISTRO)
    expect(codigo).not.toContain('style.borderColor')
    expect(codigo).not.toContain('onFocus={e =>')
  })

  it('el estado muerto <"form" | "verifying"> y el import sin uso murieron', () => {
    expect(REGISTRO).not.toContain("'form' | 'verifying'")
    expect(REGISTRO).not.toContain('Stethoscope')
    expect(LOGIN).not.toContain('Stethoscope')
  })
})

describe('V15 puerta de entrada — tokens POR TEMA', () => {
  it('el aviso de restablecer de /login habla color-mix sobre var(--teal), no el teal crudo', () => {
    expect(sinComentarios(LOGIN)).not.toContain('rgba(20,184,166')
    expect((LOGIN.match(/color-mix\(in srgb, var\(--teal\)/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('el texto del aviso es var(--text): el tinte marca, el texto informa (lección TrialBanner)', () => {
    const aviso = LOGIN.slice(LOGIN.indexOf('{info && ('), LOGIN.indexOf('{info}'))
    expect(aviso).toContain("color: 'var(--text)'")
  })

  it('el borde índigo VIEJO de la caja de prueba de /registro murió', () => {
    expect(sinComentarios(REGISTRO)).not.toContain('rgba(61,90,254')
    expect(REGISTRO).toContain('color-mix(in srgb, var(--nexus) 22%, transparent)')
  })
})

describe('V15 puerta de entrada — objetivo táctil 44 (§24)', () => {
  it('las CTA de auth llevan minHeight 48 (.btn trae height 36 fijo; min-height gana)', () => {
    expect((LOGIN.match(/minHeight: 48/g) ?? []).length).toBe(3)   // Google, MFA, submit
    expect((REGISTRO.match(/minHeight: 48/g) ?? []).length).toBe(2) // Google, submit
  })

  it('«¿Olvidaste tu contraseña?» y «← Volver» alcanzan 44 de alto', () => {
    expect((LOGIN.match(/minHeight: 44/g) ?? []).length).toBe(2)
  })
})

describe('V15 puerta de entrada — enlaces dentro de frase se distinguen sin color (WCAG 1.4.1)', () => {
  it('«Inicia sesión», términos y privacidad van subrayados', () => {
    const codigo = sinComentarios(REGISTRO)
    expect(codigo).not.toContain("textDecoration: 'none'")
    expect((REGISTRO.match(/textDecoration: 'underline'/g) ?? []).length).toBe(3)
  })

  it('«Crea una gratis →» va subrayado', () => {
    const codigo = sinComentarios(LOGIN)
    expect(codigo).not.toContain("textDecoration: 'none'")
    expect(LOGIN).toContain("textDecoration: 'underline'")
  })
})

describe('V15 puerta de entrada — la página vive en un landmark (§24)', () => {
  it('las dos páginas envuelven su contenido en <main> (axe: landmark-one-main/region)', () => {
    for (const src of [LOGIN, REGISTRO]) {
      expect(src).toContain('<main')
      expect(src).toContain('</main>')
    }
  })
})

describe('V15 puerta de entrada — roles de §2', () => {
  it('los metadatos del pie hablan .nx-meta, no un 12px a mano', () => {
    expect((LOGIN.match(/className="nx-meta"/g) ?? []).length).toBeGreaterThanOrEqual(1)
    expect((REGISTRO.match(/className="nx-meta"/g) ?? []).length).toBeGreaterThanOrEqual(1)
  })
})

describe('V15 puerta de entrada — freeze funcional (§1/§42)', () => {
  it('/login conserva el flujo completo: password, MFA, Google con selector de cuenta, reset', () => {
    expect(LOGIN).toContain('signInWithEmailAndPassword(auth, email, password)')
    expect(LOGIN).toContain('resolverLoginTotp(mfaResolver, mfaCode)')
    expect(LOGIN).toContain("provider.setCustomParameters({ prompt: 'select_account' })")
    expect(LOGIN).toContain('sendPasswordResetEmail(auth, email.trim())')
  })

  it('/login conserva la redirección por invite y el destino', () => {
    expect(LOGIN).toContain('const destino = invite ? `/unirse/${invite}` : \'/dashboard\'')
    expect(LOGIN).toContain('router.replace(destino)')
  })

  it('el reset sigue sin revelar si el correo existe (privacidad)', () => {
    expect(LOGIN).toContain('Si ese correo tiene cuenta, te llegará un enlace para restablecer la contraseña.')
  })

  it('/registro conserva el alta completa: cuenta + perfil + verificación + conversión', () => {
    expect(REGISTRO).toContain('createUserWithEmailAndPassword(auth, email.trim(), password)')
    expect(REGISTRO).toContain('updateProfile(cred.user, { displayName: nombre.trim() })')
    expect(REGISTRO).toContain('sendEmailVerification(cred.user)')
    expect((REGISTRO.match(/trackConversion\('CompleteRegistration'\)/g) ?? []).length).toBe(2)
  })

  it('/registro conserva la validación y el destino tras el alta', () => {
    expect(REGISTRO).toContain("const valid = nombre.trim().length > 2 && email.includes('@') && password.length >= 6")
    expect(REGISTRO).toContain("const destinoTrasRegistro = invite ? `/unirse/${invite}` : '/setup'")
  })

  it('el precio sigue saliendo del catálogo, nunca de un número a mano (la lección del propio archivo)', () => {
    expect(REGISTRO).toContain('PLANES.agenda.precioMXN.toLocaleString')
    expect(sinComentarios(REGISTRO)).not.toMatch(/\$\s?499/)
  })

  it('los dos ojos de contraseña conservan su nombre accesible', () => {
    for (const src of [LOGIN, REGISTRO]) {
      expect(src).toContain("aria-label={showPwd ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}")
    }
  })

  it('el layout móvil de /registro sigue: una columna y beneficios retirados bajo 768', () => {
    expect(REGISTRO).toContain('.registro-layout { grid-template-columns: 1fr !important; }')
    expect(REGISTRO).toContain('.registro-layout > div:first-child { display: none !important; }')
  })
})
