'use client'
/**
 * Guía en el SITIO donde el médico se atora: la pantalla de Recetas, órdenes y notas.
 *
 * El Dr. lo pidió literal: "no quiero que batallen mis clientes… enséñales a
 * configurar su receta para que no se confundan y sea muy fácil". Mandarlos a
 * leer la guía en otra pantalla es justo lo que no funciona: se configura aquí,
 * así que la explicación vive aquí.
 *
 * Arranca ABIERTA mientras no haya nada configurado, y se pliega sola en cuanto
 * el médico ya subió su formato o eligió su papel — para no estorbar todos los
 * días a quien ya lo resolvió.
 */
import { useState } from 'react'
import { ChevronDown, Ruler, Printer, AlertTriangle, CheckCircle2 } from 'lucide-react'

export interface GuiaConfigurarRecetaProps {
  /** ¿Ya hay algo configurado? Si no, la guía se muestra abierta. */
  yaConfigurado: boolean
}

const PASOS: { t: string; d: string }[] = [
  {
    t: 'Mide tu receta con una regla',
    d: 'De borde a borde: primero el ANCHO, luego el ALTO. Por ejemplo 13 × 23 cm. Todo lo demás depende de este número.',
  },
  {
    t: 'Elige ese tamaño abajo, en “Tamaño de papel”',
    d: 'Si el tuyo no está en la lista, elige “Personalizado” y escribe las medidas en milímetros (13 cm = 130 mm).',
  },
  {
    t: 'Sube tu papel membretado',
    d: 'En “Usa TU propia receta”, sube una foto o PDF de tu receta. Queda de fondo y la app solo encima los datos del paciente y los medicamentos. Si no tienes papel propio, sáltate este paso: se genera un encabezado con los datos de tu consultorio.',
  },
  {
    t: '¿Tu papel ya trae las líneas de Nombre, Edad y Fecha?',
    d: 'Activa “Mi diseño ya tiene campos del paciente impresos” para que la app no las dibuje encima. Luego arrastra cada etiqueta sobre su línea — o pulsa “Detectar campos con IA” y solo acomódalas.',
  },
  {
    t: 'Sube tu firma',
    d: 'Más abajo, en esta misma pantalla, está “Firma + sello”. Firma en una hoja BLANCA con plumón negro, tómale foto de frente con buena luz y recórtala. Saldrá en tus recetas, órdenes y notas.',
  },
  {
    t: 'Guarda y haz una prueba',
    d: 'Pulsa “Guardar template” y luego “Imprimir prueba”. Compara esa hoja contra tu papel real ANTES de usarla con un paciente.',
  },
]

export function GuiaConfigurarReceta({ yaConfigurado }: GuiaConfigurarRecetaProps) {
  const [abierta, setAbierta] = useState(!yaConfigurado)

  return (
    <div style={{
      border: '1px solid rgba(20,184,166,0.35)', borderRadius: 12,
      background: 'rgba(20,184,166,0.06)', overflow: 'hidden',
    }}>
      <button
        onClick={() => setAbierta(v => !v)}
        aria-expanded={abierta}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 15px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
        }}
      >
        <Ruler size={17} style={{ color: 'var(--teal)', flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, display: 'block' }}>
            Cómo dejar tu receta idéntica a tu papel
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            6 pasos · se hace una sola vez
          </span>
        </span>
        {yaConfigurado && !abierta && (
          <CheckCircle2 size={16} style={{ color: 'var(--teal)', flexShrink: 0 }} />
        )}
        <ChevronDown
          size={18}
          style={{ color: 'var(--text3)', flexShrink: 0, transition: 'transform .2s', transform: abierta ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {abierta && (
        <div style={{ padding: '0 15px 15px' }}>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {PASOS.map((p, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text)' }}>{p.t}.</strong> {p.d}
              </li>
            ))}
          </ol>

          {/* El paso que NO está en la app y es el que más confunde: el diálogo
              de impresión del sistema decide el papel FÍSICO. */}
          <div style={{
            display: 'flex', gap: 9, marginTop: 13, padding: '11px 12px',
            fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 9,
          }}>
            <AlertTriangle size={15} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong style={{ color: 'var(--text)' }}>Falta un paso fuera de la app.</strong> Al imprimir,
              tu computadora decide el papel físico. En ese diálogo revisa tres cosas:
              <strong> Tamaño del papel</strong> igual al que elegiste aquí (si no aparece, créalo en
              “Administrar tamaños personalizados”), <strong>Escala 100 %</strong> — nunca “Ajustar al papel” —
              y la <strong>Orientación</strong> que corresponda a tu hoja. Si la miniatura se ve como una
              hoja grande con tu receta chiquita adentro, es exactamente este paso.
            </span>
          </div>

          <div style={{
            display: 'flex', gap: 9, marginTop: 9, padding: '11px 12px',
            fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55,
            background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 9,
          }}>
            <Printer size={15} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong style={{ color: 'var(--text)' }}>¿No tienes papel cortado a la medida?</strong> Elige
              el tamaño de tu receta y deja “Hoja carta + corte”: sale en una hoja carta normal con una
              línea punteada para recortar. Funciona en cualquier impresora, sin configurar nada.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
