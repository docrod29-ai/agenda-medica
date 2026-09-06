'use client'
/**
 * «NO SE PUDO LEER» NO ES «NO HAY NADA» — Panel de Lujo ZC-001, ZC-004, ZC-005,
 * ZC-006, C-010 y C-037.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Seis superficies distintas cometían el mismo error, y cinco de ellas lo tenían
 * escrito en su propio comentario como algo que NO había que hacer:
 *
 *   - `AlertasDelEpisodio`      — `if (!alertas || alertas.length === 0) return null`
 *   - `CabosSueltosDelPaciente` — `if (!cabos) return null`
 *   - `InternamientosDelPaciente` — `if (!lista || lista.length === 0) return null`
 *   - `ContinuidadPanel`        — `.catch(() => {})`
 *   - `/hospitalizacion/indicadores` — pinta «0 internados» tras el fallo
 *   - `AsientosSection`         — la sección desaparece
 *
 * El estado «no se pudo leer» y el estado «no hay nada» acababan en el MISMO
 * píxel: nada. El potasio crítico que la bandeja existe para enseñar, el
 * resultado sin leer del expediente y los dos ingresos hospitalarios de un
 * paciente se volvían invisibles sin que nadie supiera que hubo un fallo.
 *
 * ── LA CAUSA RAÍZ, Y POR QUÉ ESTO ES UN COMPONENTE ──────────────────────────
 *
 * Cada componente guardaba `null` para las dos cosas —«todavía no» y «no se
 * pudo»— y luego decidía por su cuenta cómo pintarlo. Con un solo estado no se
 * puede distinguir, y sin una pieza compartida cada pantalla nueva vuelve a
 * elegir. Aquí está la decisión, escrita una vez: **el fallo de lectura se ve,
 * dice qué no se pudo leer, y ofrece reintentar**.
 *
 * ── LO QUE NO AFIRMA ────────────────────────────────────────────────────────
 *
 * No dice cuántos elementos había, porque no lo sabe. No dice que estén bien ni
 * que estén mal. Dice exactamente lo único que se sabe: **que no se leyeron**.
 * Ausencia de dato no es dato de ausencia (regla 4 de seguridad clínica) — esto
 * es esa regla dicha en píxeles.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * No reintenta solo, ni guarda cola, ni avisa a nadie más: si el médico no está
 * mirando esta pantalla, esto no le llega. Tampoco distingue «sin permiso» de
 * «sin red» por su cuenta: eso lo traduce `enEspanolLlano` a partir del error.
 */
import { AlertTriangle, RotateCw } from 'lucide-react'
import { enEspanolLlano } from '@/lib/texto-es'

export interface NoSePudoLeerProps {
  /**
   * QUÉ no se pudo leer, en sustantivo y en la lengua del médico: «las alertas
   * de este paciente», «sus ingresos hospitalarios». Se usa tal cual dentro de
   * «No se pudieron leer …», así que va en plural o con su artículo.
   */
  que: string
  /** El error crudo, sólo para traducirlo a español llano. No se imprime. */
  error?: unknown
  /** Reintentar la lectura. Sin él no se pinta el botón: no se ofrece lo que no hay. */
  alReintentar?: () => void
  /** `'bloque'` (por defecto) ocupa el sitio de la sección; `'linea'` cabe dentro de una fila. */
  variante?: 'bloque' | 'linea'
}

export function NoSePudoLeer({ que, error, alReintentar, variante = 'bloque' }: NoSePudoLeerProps) {
  const porque = error === undefined ? '' : enEspanolLlano(error)
  const encabezado = `No se pudieron leer ${que}.`

  return (
    <div
      /*
       * `role="status"` y no `role="alert"`: interrumpir al médico con un
       * anuncio asertivo por un fallo de lectura le quita el foco de donde
       * estaba. Esto se lee cuando llega a ello; lo que no puede es no estar.
       */
      role="status"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: variante === 'linea' ? '9px 12px' : '13px 15px',
        marginBottom: variante === 'linea' ? 0 : 16,
        borderRadius: 10,
        border: '1px solid color-mix(in srgb, var(--amber) 40%, var(--border))',
        background: 'color-mix(in srgb, var(--amber) 7%, transparent)',
      }}
    >
      <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--text)' }}>
        <strong>{encabezado}</strong>
        {porque ? ` ${porque}` : ''}
        {/*
          Lo que sigue es el punto entero del componente: decir que lo que se ve
          NO es la respuesta. Sin esta frase, el médico lee el hueco como «no
          hay nada» — que es lo que pasaba antes.
        */}
        <div style={{ color: 'var(--text3)', marginTop: 4, fontSize: 12 }}>
          Lo que ves abajo no está completo: puede haber información que no se cargó.
        </div>
      </div>
      {alReintentar && (
        <button
          type="button"
          onClick={alReintentar}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            minHeight: 44, minWidth: 44, padding: '0 12px',
            background: 'var(--s3)', color: 'var(--text)', font: 'inherit', fontSize: 14,
            border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', cursor: 'pointer',
          }}
        >
          <RotateCw size={14} /> Reintentar
        </button>
      )}
    </div>
  )
}

export const POR_QUE_EXISTE =
  'El estado «no se pudo leer» y el estado «no hay nada» acababan en el mismo ' +
  'píxel: nada. Ausencia de dato no es dato de ausencia, y eso también se pinta.'
