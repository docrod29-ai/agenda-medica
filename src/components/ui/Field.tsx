import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

interface FieldShellProps {
  label?: string
  /** Texto de ayuda bajo el control */
  hint?: string
  /** Mensaje de error (tiene prioridad sobre hint) */
  error?: string
  required?: boolean
  htmlFor?: string
  children: ReactNode
}

/** Envoltura etiqueta + control + ayuda/error. Usa la clase `.label`. */
export function Field({ label, hint, error, required, htmlFor, children }: FieldShellProps) {
  return (
    <div className="form-group">
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {/**
        * 11,5px ERA EL TEXTO MÁS PEQUEÑO DE LA APLICACIÓN, Y DICE «la dosis está mal».
        *
        * Este es el mensaje de error bajo un campo — el de la dosis incluida— y el
        * texto de ayuda que explica qué se espera. Estaba medio píxel por debajo
        * del paso más pequeño que el sistema nombra para texto corrido, y medio
        * píxel no lo decidió nadie: es lo que queda al ajustar a ojo.
        *
        * Sube a `--fs-caption` (12px), que es el paso declarado para etiquetas y
        * metadatos. Cambio de medio píxel hacia arriba: sólo puede leerse mejor.
        */}
      {error ? (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--red)', marginTop: 4 }}>{error}</div>
      ) : hint ? (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', marginTop: 4 }}>{hint}</div>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

/** Input de texto. Wrapper sobre `.input`. Si recibe `label`, se envuelve en Field. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, className, id, ...rest },
  ref,
) {
  /**
   * SIN `id`, LA ETIQUETA NO SEÑALA A NADA.
   *
   * `Field` recibe `htmlFor={id}`, pero `id` es opcional y NINGÚN uso de estos
   * controles en el repo lo pasa: `htmlFor` quedaba `undefined` y el `<label>`
   * no se asociaba a ningún campo. Tocar la palabra «Teléfono» no enfocaba el
   * campo —en móvil eso son toques perdidos— y un lector de pantalla anunciaba
   * el control sin nombre.
   *
   * `useId()` da un identificador estable entre servidor y cliente; el `id`
   * explícito, si llega, sigue mandando.
   */
  const idAuto = useId()
  const idFinal = id ?? idAuto
  const control = (
    <input
      ref={ref}
      id={idFinal}
      className={['input', error ? 'input-error' : '', className].filter(Boolean).join(' ')}
      required={required}
      {...rest}
    />
  )
  if (!label && !hint && !error) return control
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={idFinal}>
      {control}
    </Field>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, id, ...rest },
  ref,
) {
  const idAuto = useId()
  const idFinal = id ?? idAuto
  const control = (
    <textarea
      ref={ref}
      id={idFinal}
      className={['input', className].filter(Boolean).join(' ')}
      required={required}
      {...rest}
    />
  )
  if (!label && !hint && !error) return control
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={idFinal}>
      {control}
    </Field>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, className, id, children, ...rest },
  ref,
) {
  const idAuto = useId()
  const idFinal = id ?? idAuto
  const control = (
    <select
      ref={ref}
      id={idFinal}
      className={['input', className].filter(Boolean).join(' ')}
      required={required}
      {...rest}
    >
      {children}
    </select>
  )
  if (!label && !hint && !error) return control
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={idFinal}>
      {control}
    </Field>
  )
})
