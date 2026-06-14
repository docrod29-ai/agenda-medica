import { forwardRef } from 'react'
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
      {error ? (
        <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 4 }}>{error}</div>
      ) : hint ? (
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>{hint}</div>
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
  const control = (
    <input
      ref={ref}
      id={id}
      className={['input', error ? 'input-error' : '', className].filter(Boolean).join(' ')}
      required={required}
      {...rest}
    />
  )
  if (!label && !hint && !error) return control
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
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
  const control = (
    <textarea
      ref={ref}
      id={id}
      className={['input', className].filter(Boolean).join(' ')}
      required={required}
      {...rest}
    />
  )
  if (!label && !hint && !error) return control
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
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
  const control = (
    <select
      ref={ref}
      id={id}
      className={['input', className].filter(Boolean).join(' ')}
      required={required}
      {...rest}
    >
      {children}
    </select>
  )
  if (!label && !hint && !error) return control
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      {control}
    </Field>
  )
})
