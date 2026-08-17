'use client'
/**
 * Ayuda del dashboard: el panel del asistente (bot) sin salir de donde estás.
 *
 * ── RTC-05 (registro canónico del equipo rojo) ──────────────────────────────
 *
 * El FAB de 52px vivía en la esquina del pulgar de TODAS las pantallas: en
 * móvil ocluía trabajo clínico en 4 de 6 superficies (el médico mandó capturas
 * con el botón encima de «Peso» y de «Exploración física») y no se enteraba de
 * la grabación. RTC-05 lo mató en móvil y dejó ESCRITO el hueco: «no juzga si
 * la ayuda merece FAB en escritorio».
 *
 * ── RTC-32: el hueco, cerrado — EN EL SHELL NADA FLOTA ──────────────────────
 *
 * La 4ª pasada de §29 nombró los dos FAB de escritorio como uno de los tres
 * residuos que quedaban, y la medición (`medir-cromo-flotante-v15.mjs`,
 * acta `docs/design/capturas/v15-cromo-flotante/medicion-antes.json`) dijo qué
 * defecto era exactamente, que NO era el que se suponía:
 *
 *  · La oclusión NO se reproduce en escritorio: el FAB cae sobre el envoltorio
 *    de la página, nunca sobre texto clínico. RTC-05 tenía razón, y por eso
 *    ése no es el motivo del cambio.
 *  · Lo que sí se midió: el FAB se pintaba con `--nexus-solido`, **el mismo
 *    relleno que la acción primaria de la pantalla**. En 6 de 6 superficies
 *    había por tanto DOS rellenos de marca (§16, y es justo el defecto que
 *    RTC-06 pagó dentro del contenido de Hoy mientras el cromo lo repetía por
 *    encima de todas); en `/operaciones` la ayuda era el ÚNICO relleno de
 *    marca de la pantalla — lo más enfático de Operaciones era el botón de
 *    ayuda.
 *
 * Así que el FAB muere entero: la capacidad **se muda, no se ampu­ta**, al
 * mismo patrón que móvil ya tenía medido y que cuesta los mismos gestos (1).
 *
 *  - MÓVIL: trigger estático en la topbar (igual que desde RTC-05).
 *  - ESCRITORIO: trigger estático en el pie del riel, junto a «Cerrar sesión»
 *    — que es su familia: sistema subordinado, no destino clínico (§15). El
 *    panel se ancla AL LADO DEL RIEL, donde ocurrió el gesto: un panel que
 *    aparece en la esquina opuesta a lo que se pulsó rompe §20.
 *  - GRABANDO desaparece entero (trigger y panel) y vuelve al detener — §8.5
 *    por la compuerta compartida `@/hooks/useGrabando`, no una copia privada.
 *
 * El nombre del evento y la compuerta se declaran AQUÍ una vez, y los dos
 * sitios que disparan usan `DisparadorAyuda` (la lección de `estoy-grabando`:
 * una cadena repetida en dos archivos es una compuerta que se abre sola).
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { AsistenteChat } from '@/components/AsistenteChat'
import { useGrabando } from '@/hooks/useGrabando'
import { HelpCircle, X, BookOpen } from 'lucide-react'

/** Lo despachan los disparadores estáticos; lo escucha este componente. */
export const EVENTO_ABRIR_AYUDA = 'nx:abrir-ayuda'

/**
 * El disparador de la ayuda, allí donde el shell lo necesite (topbar móvil,
 * pie del riel de escritorio). Vive aquí para que el evento y la compuerta de
 * grabación sean UNA sola declaración: un botón que no puede abrir nada no se
 * pinta, y eso no puede depender de que cada sitio se acuerde.
 */
export function DisparadorAyuda({ className, style, children }: {
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  const grabando = useGrabando()
  if (grabando) return null
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_AYUDA))}
      className={className}
      style={style}
      aria-label="Abrir ayuda"
    >
      {children ?? <HelpCircle size={21} />}
    </button>
  )
}

export function BotonAyuda() {
  const [abierto, setAbierto] = useState(false)
  const grabando = useGrabando()

  useEffect(() => {
    const abrir = () => setAbierto(v => !v)
    window.addEventListener(EVENTO_ABRIR_AYUDA, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR_AYUDA, abrir)
  }, [])

  if (grabando) return null

  return (
    <>
      {abierto && (
        <div
          className="boton-ayuda-panel"
          role="dialog"
          aria-label="Asistente de ayuda"
          style={{
            position: 'fixed', zIndex: 60,
            width: 'min(92vw, 380px)',
            background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--nexus) 6%, transparent)' }}>
            <HelpCircle size={17} style={{ color: 'var(--teal)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Asistente de ayuda</span>
            <Link href="/guia" onClick={() => setAbierto(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--teal)', textDecoration: 'none' }}>
              <BookOpen size={13} /> Guía
            </Link>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 2 }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ padding: 14 }}>
            <AsistenteChat alto={320} />
          </div>
        </div>
      )}
      <style>{`
        /* RTC-32 — el panel nace DONDE se pulsó (§20). En escritorio el
           disparador vive en el pie del riel, así que el panel se ancla a su
           lado: 224px del riel (.sidebar) + 12 de aire. Abrirlo en la esquina
           opuesta obligaría a cruzar la pantalla para leer la respuesta de un
           botón que está abajo-izquierda. */
        .boton-ayuda-panel { bottom: 16px; left: 236px; }
        /* Móvil (RTC-05): el disparador vive en la topbar y el panel cuelga de
           ella — no del borde del pulgar. El riel no existe en este ancho. */
        @media (max-width: 768px) {
          .boton-ayuda-panel { top: calc(60px + env(safe-area-inset-top, 0px)); bottom: auto; left: auto; right: 12px; }
        }
      `}</style>
    </>
  )
}
