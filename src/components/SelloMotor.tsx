'use client'
/**
 * SELLO DE VALIDACIÓN CLÍNICA — la etiqueta que dice si un motor está revisado.
 *
 * ── POR QUÉ EXISTE (PRACTICE-GA-005) ─────────────────────────────────────────
 *
 * El registro clínico clasifica los 89 motores en `validado`,
 * `pendiente_validacion` y `experimental`. Ese estado **lo leían sólo las
 * pruebas**: ninguna pantalla lo consultaba, así que para el médico no existía.
 * Clasificamos con cuidado y la clasificación no llegaba a quien decide.
 *
 * Hoy hay 24 motores sin validar, y algunos están en el camino de la receta
 * —`prescripcion-segura`, `farmacovigilancia`, `dosis-adulto-techos`—. Vender un
 * producto donde la alerta de una receta sale de un motor que el propio registro
 * marca como no revisado, sin decírselo a nadie, no es defendible.
 *
 * ── POR QUÉ ES UNA ETIQUETA Y NO UN MURO ─────────────────────────────────────
 *
 * Instrucción del dueño, literal: «necesito que la aplicación sea fácil de usar,
 * no enredes ni trabas, porque si le ponemos bloqueos y preguntas al médico se
 * va a hartar».
 *
 * Así que esto NO bloquea, NO abre modales y NO pide confirmar nada. Es una
 * etiqueta pequeña junto al resultado. Y el motor **validado no muestra nada**:
 * si todo llevara sello, el sello dejaría de significar algo y en dos días
 * nadie lo vería. Sólo habla lo que tiene algo que decir.
 */
import sellos from '@/lib/clinical/sellos.json'

type Estado = 'validado' | 'pendiente_validacion' | 'experimental'

interface Sello { id: string; nombre: string; especialidad: string; estado: string; referencia: string }

const POR_ID = new Map((sellos as Sello[]).map(s => [s.id, s]))

/** Estado de un motor por su id. `null` si el id no existe en el registro. */
export function estadoDeMotor(id: string): Estado | null {
  const e = POR_ID.get(id)?.estado
  return e === 'validado' || e === 'pendiente_validacion' || e === 'experimental' ? e : null
}

export function nombreDeMotor(id: string): string {
  return POR_ID.get(id)?.nombre ?? id
}

/** Motores que el médico todavía no ha revisado, para la hoja de revisión. */
export function motoresSinValidar(): Sello[] {
  return (sellos as Sello[]).filter(s => s.estado !== 'validado')
}

const TEXTO: Record<Exclude<Estado, 'validado'>, { etiqueta: string; detalle: string }> = {
  pendiente_validacion: {
    etiqueta: 'sin validar',
    detalle: 'Las reglas de este cálculo todavía no las ha revisado un médico responsable. Úsalo como apoyo, no como respuesta.',
  },
  experimental: {
    etiqueta: 'experimental',
    detalle: 'Este cálculo está en construcción y puede cambiar. Úsalo sólo para explorar.',
  },
}

/**
 * Etiqueta junto al resultado de un motor. No renderiza NADA si el motor está
 * validado o si el id no existe — un sello que aparece siempre no es un sello.
 */
export function SelloMotor({ id, className }: { id: string; className?: string }) {
  const estado = estadoDeMotor(id)
  if (!estado || estado === 'validado') return null
  const t = TEXTO[estado]
  return (
    <span
      className={className}
      title={`${nombreDeMotor(id)} — ${t.detalle}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10.5, fontWeight: 600, letterSpacing: '.02em',
        padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap',
        // Ámbar, no rojo: el rojo de esta app significa «peligro clínico» (una
        // alergia, un valor crítico). Que un motor esté sin revisar es una
        // advertencia de PROCEDENCIA, y confundir las dos escalas le quita fuerza
        // a la que sí tiene que parar al médico.
        color: 'var(--amber)', background: 'rgba(217,119,6,.12)',
        border: '1px solid rgba(217,119,6,.35)',
      }}
    >
      {t.etiqueta}
    </span>
  )
}

export const POR_QUE_EL_VALIDADO_NO_LLEVA_SELLO =
  'Porque si todo llevara etiqueta, la etiqueta dejaría de significar algo y en ' +
  'dos días nadie la vería. El sello sólo habla cuando tiene algo que decir.'
