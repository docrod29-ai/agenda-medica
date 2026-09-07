'use client'
/**
 * EL BOTÓN DE GOOGLE, UNA VEZ.
 *
 * Estaba copiado a mano en `/login` y en `/registro` —los mismos cuatro
 * `<path>` con los mismos cuatro hexadecimales de marca, el mismo `#fff` y el
 * mismo `#1a1a1a`— y al añadir el alta dentro de `/unirse/[code]` iban a ser
 * tres. Trece colores literales por copia, en pantallas donde cualquier retoque
 * hay que acordarse de hacer tres veces.
 *
 * Los hexadecimales de la marca de Google **no son deuda de tokens**: son la
 * identidad de un tercero y no siguen al tema de esta aplicación. Lo que sí era
 * deuda es tenerlos repetidos. Aquí viven una vez.
 *
 * El fondo blanco y el texto casi negro tampoco son tokens a propósito: la guía
 * de marca de Google fija el botón claro, y pintarlo con `--s1`/`--text` lo
 * volvería invisible en tema oscuro.
 */

export function BotonGoogle({
  onClick, disabled, texto = 'Continuar con Google',
}: {
  onClick: () => void
  disabled?: boolean
  texto?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn"
      style={{
        width: '100%', justifyContent: 'center', gap: 10, minHeight: 48,
        background: '#ffffff', color: '#1a1a1a', border: '1px solid var(--border2)', fontWeight: 600,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-17z"/>
        <path fill="#FBBC05" d="M10.5 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.4l7.9-6.1z"/>
        <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.4-4.6 2.2-8.2 2.2-6.3 0-11.6-3.7-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
      </svg>
      {texto}
    </button>
  )
}
