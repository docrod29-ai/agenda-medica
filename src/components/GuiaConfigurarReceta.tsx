'use client'
/**
 * QUÉ HACER CUANDO LA PRUEBA NO SALIÓ IGUAL QUE TU PAPEL.
 *
 * ── DE DÓNDE VIENE ESTE COMPONENTE ──────────────────────────────────────────
 *
 * Nació como una guía de SEIS pasos, desplegada arriba del todo de «Recetas,
 * órdenes y notas», porque el Dr. pidió: «no quiero que batallen mis clientes».
 * No funcionó, y el mismo Dr. dijo por qué: «esto se me hace muy complejo […]
 * la pantalla está muy llena y los va a confundir».
 *
 * La guía explicaba lo que la pantalla debería hacer sola. Seis pasos de texto
 * arriba de nueve tarjetas de controles es MÁS pantalla, no menos: para cuando
 * el médico termina de leer, ya no sabe cuál de las nueve tarjetas era el paso
 * tres. Así que los pasos se convirtieron en la pantalla misma —tres tarjetas
 * numeradas, una por paso, con el control dentro— y aquí sólo queda lo que la
 * app **no puede arreglar por su cuenta**.
 *
 * ── QUÉ QUEDA, Y POR QUÉ ────────────────────────────────────────────────────
 *
 * Tres averías, en orden de frecuencia real, cada una con lo que la causa. La
 * primera vive FUERA de la aplicación —el diálogo de impresión del sistema
 * decide el papel físico— y es la que más se confunde con un defecto nuestro:
 * la receta sale perfecta y la hoja no.
 *
 * Se muestra sólo cuando el médico dice que la prueba no cuadró. Un texto de
 * ayuda que se lee siempre es ruido; leído en el minuto en que algo falló, es
 * la respuesta.
 */
import type { ReactNode } from 'react'
import { AlertTriangle, Printer, Ruler } from 'lucide-react'

interface Averia {
  sintoma: string
  causa: string
  arreglo: ReactNode
  icono: ReactNode
}

const AVERIAS: Averia[] = [
  {
    sintoma: 'Salió chiquita en medio de una hoja grande',
    causa: 'Es el diálogo de impresión de tu computadora, no la app: está encogiendo la hoja para que quepa.',
    arreglo: (
      <>
        Al imprimir, revisa tres cosas en esa ventana: <strong>Tamaño del papel</strong> igual
        al que elegiste aquí (si no aparece, créalo en «Administrar tamaños personalizados»),
        <strong> Escala 100 %</strong> — nunca «Ajustar al papel» — y la <strong>Orientación</strong> que
        corresponda a tu hoja.
      </>
    ),
    icono: <Printer size={16} style={{ color: 'var(--amber)' }} />,
  },
  {
    sintoma: 'Los medicamentos taparon mi logo o mi pie de página',
    causa: 'La zona donde cae el texto está más grande que el hueco libre de tu papel.',
    arreglo: (
      <>
        Aquí abajo, en <strong>Dónde cae el texto</strong>, sube el margen de arriba o el de abajo —
        o arrastra el recuadro de la vista previa hasta el hueco libre de tu diseño.
      </>
    ),
    icono: <Ruler size={16} style={{ color: 'var(--nexus)' }} />,
  },
  {
    sintoma: 'El nombre, la edad o la fecha cayeron en otro lugar',
    causa: 'Tu papel ya trae esas líneas impresas y la app las colocó en un sitio distinto.',
    arreglo: (
      <>
        Vuelve al paso 1, abre <strong>Ajustar dónde caen los datos</strong> y arrastra cada etiqueta
        sobre su línea; <strong>Detectar los campos</strong> vuelve a leer tu formato y las coloca solas.
        Si tu papel ya los trae escritos y no quieres que la app los repita, activa
        <strong> Mi papel ya trae los datos del paciente</strong>.
      </>
    ),
    icono: <AlertTriangle size={16} style={{ color: 'var(--text3)' }} />,
  },
]

export function GuiaConfigurarReceta() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {AVERIAS.map((a) => (
        <div
          key={a.sintoma}
          style={{
            display: 'flex', gap: 10, padding: '10px 12px',
            background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10,
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 2 }}>{a.icono}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>«{a.sintoma}»</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{a.causa}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{a.arreglo}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
