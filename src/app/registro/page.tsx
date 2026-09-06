'use client'
import { esFalloDeRed, MENSAJE_SIN_RED } from '@/lib/auth/fallo-de-red'
import { enEspanolLlano } from '@/lib/texto-es'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
/**
 * EL PRECIO SALE DEL CATÁLOGO, NO DE UN NÚMERO ESCRITO A MANO.
 *
 * Aquí decía «Después solo $499 MXN/mes» y **no existe ningún plan de $499**:
 * ése es el precio de un MÉDICO ADICIONAL. Los planes reales empiezan en $349
 * (Agenda) y el que trae IA cuesta $899.
 *
 * O sea: el número que convencía al médico de registrarse era falso, y lo
 * descubría en el peor momento posible — con la tarjeta en la mano, al final del
 * alta. Leerlo de `PLANES` hace imposible que vuelva a desincronizarse.
 */
import { PLANES } from '@/lib/planes-ia'
import { MarcaAuth } from '@/components/brand/MarcaAuth'
import Link from 'next/link'
import { MetaPixel, trackConversion } from '@/components/MetaPixel'
import { MarcaAusculta } from '@/components/MarcaAusculta'
import { EsperaDeLaPuerta } from '@/components/landing/EsperaDeLaPuerta'
import { LEMA } from '@/lib/marca'

/**
 * LA PUERTA DE ENTRADA VENDÍA EL PRODUCTO DE HACE DOS VERSIONES — Panel de Lujo
 * N-018 (P2).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Los seis beneficios eran agenda, bot de WhatsApp, recordatorios, lista de
 * espera, Google Calendar y portal del asistente. Ni una palabra de la nota por
 * voz. Y eso es EXACTAMENTE lo que la portada retiró a propósito y dejó escrito
 * en su propia cabecera (`src/app/page.tsx`):
 *
 *   «Ausculta se vendía como un agendador con bot de WhatsApp. Eso fue verdad y
 *    dejó de serlo… su promesa —salir de la consulta con la nota hecha sin dejar
 *    de mirar al paciente— no aparecía en la portada.»
 *
 * La portada se corrigió y la PUERTA DE REGISTRO se quedó atrás: quien llegaba
 * directo a `/registro` —por un enlace compartido, por un anuncio— seguía
 * leyendo la promesa vieja en el último sitio antes de dar de alta su cuenta.
 *
 * ── DE DÓNDE SALE ESTE TEXTO ─────────────────────────────────────────────────
 *
 * De `RECORRIDO`, la lista de la portada, resumida a una línea por paso. La
 * agenda y el bot **siguen** —son verdad y son parte del producto— pero al
 * final, que es el sitio que la portada ya les asignó.
 *
 * Lo correcto sería que las dos pantallas leyeran UNA lista de un módulo
 * compartido, y no dos copias. `RECORRIDO` vive dentro de `src/app/page.tsx`,
 * sin exportar, y ese archivo es de otra rebanada de esta reparación: mover la
 * lista a `src/lib/marca.ts` va en `handoff-UI-CONFIG.md`.
 */
const BENEFICIOS = [
  'Te oye y sabe quién habló: separa lo que dijo el paciente de lo que dijiste tú',
  'Deja vacío lo que nadie dijo, en vez de rellenar huecos',
  'Te avisa antes de firmar: dosis, alergias e interacciones',
  'La receta sale contigo, lista para imprimir o mandar',
  'Agenda, recordatorios por WhatsApp y lista de espera',
  'Portal simplificado para tu asistente',
]

export default function RegistroPage() {
  // El fallback era un <div> negro de alto de pantalla: con la conexión mala,
  // la puerta de registro se veía como una página rota. Mismo hueco que
  // /login — ver EsperaDeLaPuerta.
  return (
    <Suspense fallback={<EsperaDeLaPuerta />}>
      <RegistroInner />
    </Suspense>
  )
}

function RegistroInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invite = searchParams.get('invite')   // si viene de /unirse/CODE
  const destinoTrasRegistro = invite ? `/unirse/${invite}` : '/setup'

  const { user, loading } = useAuth()
  const [nombre, setNombre] = useState('')
  const [email, setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace(destinoTrasRegistro)
  }, [user, loading, router, destinoTrasRegistro])

  // Completa el registro con Google por REDIRECCIÓN (Safari) y muestra errores.
  useEffect(() => {
    getRedirectResult(auth).then((res) => {
      // Solo devuelve usuario JUSTO tras un alta por Google → cuenta como conversión.
      if (res?.user) trackConversion('CompleteRegistration')
    }).catch((err: unknown) => {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/unauthorized-domain') setError('Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).')
      /* C-022 — mismo motivo que en /login: el código de Firebase no se pinta. */
      else if (code) { console.warn('[registro] fallo de Google', code); setError(`No se pudo registrar con Google. ${enEspanolLlano(err)}`) }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !email.trim() || password.length < 6) return
    setError('')
    setSubmitting(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: nombre.trim() })
      /**
       * VERIFICACIÓN DE CORREO — no existía en ninguna parte.
       *
       * `sendEmailVerification` no aparecía ni una vez en el repo, y este mismo
       * archivo declaraba un estado `'verifying'` que nunca se usaba.
       *
       * Si el médico teclea mal su correo, la cuenta se crea igual, el
       * consultorio se crea igual, y el día que pierda la contraseña el correo
       * de recuperación va a una dirección que no existe. No hay recuperación
       * posible sin soporte humano — justo lo que el producto quiere evitar.
       *
       * NO se bloquea el acceso con esto: un médico que acaba de registrarse
       * tiene que poder entrar y ver la aplicación. Se manda el correo y se
       * avisa desde dentro. Bloquear sería cambiar la promesa comercial, y esa
       * decisión no es mía.
       */
      void sendEmailVerification(cred.user).catch(() => {
        // Si el envío falla no se rompe el alta: el médico ya tiene cuenta.
        console.warn('[registro] no se pudo enviar la verificación de correo')
      })
      trackConversion('CompleteRegistration')  // conversión Meta: registro completado
      router.replace(destinoTrasRegistro)
    } catch (err: unknown) {
      // La red primero: sin ella no hubo alta que fallara.
      if (esFalloDeRed(err)) { setError(MENSAJE_SIN_RED); return }
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/email-already-in-use') {
        setError('Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?')
      } else if (code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.')
      } else {
        setError(`No se pudo crear la cuenta. ${enEspanolLlano(err)}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setSubmitting(true)
    // Redirección SIEMPRE (no popup): el popup de Firebase se cuelga/bloquea.
    try {
      await signInWithRedirect(auth, new GoogleAuthProvider())
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (esFalloDeRed(err)) { setError(MENSAJE_SIN_RED); return }
      if (code === 'auth/unauthorized-domain') {
        setError('Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).')
      } else {
        console.warn('[registro] fallo de Google', code)
        setError(`No se pudo registrar con Google. ${enEspanolLlano(err)}`)
      }
      setSubmitting(false)
    }
  }

  const valid = nombre.trim().length > 2 && email.includes('@') && password.length >= 6

  return (
    /* <main>: la página entera es el landmark — axe (landmark-one-main/region)
       lo pedía desde siempre; primera medición de la puerta en V15 lo pagó. */
    <main style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'grid', gridTemplateColumns: '1fr 1fr',
    }} className="registro-layout">
      <MetaPixel />

      {/* Left — benefits */}
      <div style={{
        background: 'var(--bg)',
        padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        borderRight: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
      }}>
        {/* Halo cobalto soft */}
        <div style={{
          position: 'absolute', top: '50%', left: '20%', transform: 'translate(-30%, -50%)',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--nexus-soft) 0%, transparent 65%)',
          pointerEvents: 'none', opacity: 0.6,
        }} />
        {/* Motivo de red/nexo de marca — muy tenue, detrás del panel de beneficios */}
        <MarcaAuth style={{ bottom: '-4%', left: '50%', transform: 'translateX(-50%)', width: 'min(640px, 110%)', opacity: 0.13 }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: 'var(--s1)', border: '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MarcaAusculta size={24} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>Ausculta</div>
              {/* Era «El consultorio, conectado»: la promesa retirada, y la
                  tercera copia a mano de una frase que ahora tiene constante.
                  Ver DESCRIPCION en src/lib/marca.ts. */}
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{LEMA}</div>
            </div>
          </div>

          <h2 className="nx-display" style={{
            fontSize: 40, color: 'var(--text)', lineHeight: 1.05, marginBottom: 14,
            fontWeight: 500, letterSpacing: '-0.03em',
          }}>
            Sal de la consulta<br />
            <span style={{ color: 'var(--nexus)', fontStyle: 'italic' }}>con la nota hecha.</span>
          </h2>
          <p style={{
            fontSize: 15, color: 'var(--text2)', marginBottom: 36, lineHeight: 1.6,
            letterSpacing: '-0.005em', maxWidth: 380,
          }}>
            Sin dejar de mirar al paciente. Y con la agenda, las recetas y los cobros
            en la misma herramienta.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {BENEFICIOS.map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={16} color="var(--nexus)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, color: 'var(--text2)', letterSpacing: '-0.005em' }}>{b}</span>
              </div>
            ))}
          </div>

          {/* El borde hablaba rgba(61,90,254,…) — el ÍNDIGO VIEJO fijado a mano,
              un acento que ya ni existe como token. color-mix sobre var(--nexus)
              sigue al acento vigente en los dos temas. */}
          <div style={{
            marginTop: 40, padding: '18px 22px',
            background: 'var(--nexus-soft)', border: '1px solid color-mix(in srgb, var(--nexus) 22%, transparent)',
            borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text)', fontWeight: 600, marginBottom: 6, letterSpacing: '-0.005em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nexus)' }} />
              14 días de prueba gratis
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, letterSpacing: '-0.005em' }}>
              Sin tarjeta de crédito. Después, desde ${PLANES.agenda.precioMXN.toLocaleString('es-MX')} MXN/mes.
              Cancela cuando quieras.
            </div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Crea tu cuenta
          </h1>
          {/*
            N-011 — EN EL TELÉFONO NO QUEDABA NI UNA PALABRA DE LA OFERTA.

            `@media (max-width: 768px)` esconde el panel izquierdo entero, y ahí
            vivían las únicas apariciones de «tarjeta» y del precio: por debajo de
            768 px el formulario quedaba solo, con un botón que dice «Comenzar
            prueba gratis» sin decir de qué prueba ni si va a pedir tarjeta.

            No hace falta traer el panel: basta con que esta tira exista siempre
            —en el escritorio repite lo de al lado, que no estorba— y con que el
            precio siga saliendo de `PLANES`, no de un número tecleado.
          */}
          <p style={{
            fontSize: 14, color: 'var(--text2)', lineHeight: 1.55, margin: '0 0 16px',
            padding: '10px 12px', borderRadius: 10,
            background: 'var(--nexus-soft)',
            border: '1px solid color-mix(in srgb, var(--nexus) 22%, transparent)',
          }}>
            <b>14 días gratis · sin tarjeta.</b> Después, desde ${PLANES.agenda.precioMXN.toLocaleString('es-MX')} MXN/mes.
            Cancela cuando quieras.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 32 }}>
            ¿Ya tienes cuenta?{' '}
            {/* Subrayado: enlace DENTRO de una frase — sólo color no lo distingue
                (WCAG 1.4.1, la misma razón de a.nx-ident). */}
            <Link href="/login" style={{ color: 'var(--teal)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Inicia sesión
            </Link>
          </p>

          {/* Google — registro en un clic */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="btn"
            style={{
              width: '100%', justifyContent: 'center', gap: 10, minHeight: 48,
              background: '#fff', color: '#1a1a1a', border: '1px solid var(--border2)', fontWeight: 600,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-17z"/>
              <path fill="#FBBC05" d="M10.5 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.4l7.9-6.1z"/>
              <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.4-4.6 2.2-8.2 2.2-6.3 0-11.6-3.7-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
            </svg>
            Continuar con Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>o con tu correo</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Los campos hablan el sistema (.form-group/.label/.input) en vez del
              dialecto inline que traían: el hack onFocus/onBlur que mutaba
              borderColor a mano NO daba anillo de foco visible con teclado —
              .input:focus sí (borde + box-shadow del token), y el placeholder
              gana el tono AA por tema que la clase ya tiene medido. /login ya
              hablaba estas clases: la puerta de entrada era la única pantalla
              con dos idiomas de formulario a la vez. */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Nombre */}
            <div className="form-group">
              <label className="label" htmlFor="reg-tu-nombre-completo">
                Tu nombre completo
              </label>
              <input
                id="reg-tu-nombre-completo"
                className="input"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Dr. Juan García"
                autoFocus
              />
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="label" htmlFor="reg-correo-electronico">
                Correo electrónico
              </label>
              <input
                id="reg-correo-electronico"
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="doctor@email.com"
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="label" htmlFor="reg-contrasena">
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-contrasena"
                  className="input"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  /* Sin esto el lector de pantalla sólo dice «botón». */
                  aria-label={showPwd ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                  /* Área táctil 44×44 (axe: target-size; regla propia de diseño). */
                  style={{
                    position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                    display: 'flex', padding: 0,
                  }}
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" style={{
                background: 'color-mix(in srgb, var(--red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            {/* La CTA de la puerta de entrada pintaba #000 sobre var(--teal) —
                2.99:1 en claro, EXACTAMENTE el defecto ya medido y pagado en el
                chip del directorio de /pacientes y en la casilla de /orden. La
                primaria del sistema (btn-primary) es el par medido:
                --nexus-solido + blanco (5.16:1 oscuro / 7:1 claro). El estado
                deshabilitado lo pone .btn:disabled (opacity), no un gris a mano.
                minHeight 48: la CTA primaria de una pantalla táctil no baja del
                objetivo de 44 (§24) — .btn trae height 36 fijo y min-height gana. */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!valid || submitting}
              style={{ width: '100%', justifyContent: 'center', minHeight: 48, fontSize: 15 }}
            >
              {submitting
                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creando cuenta…</>
                : 'Comenzar prueba gratis →'
              }
            </button>

            {/* Metadato (.nx-meta) y enlaces subrayados: dentro de una frase, sólo
                color no distingue un enlace (WCAG 1.4.1). */}
            <p className="nx-meta" style={{ textAlign: 'center' }}>
              Al registrarte aceptas los{' '}
              <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'underline', textUnderlineOffset: 3 }}>términos de servicio</a>
              {' '}y la{' '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'underline', textUnderlineOffset: 3 }}>política de privacidad</a>.
            </p>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .registro-layout { grid-template-columns: 1fr !important; }
          .registro-layout > div:first-child { display: none !important; }
        }
      `}</style>
    </main>
  )
}
