'use client'
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

export interface ConfirmOpts {
  titulo?: string
  confirmar?: string
  cancelar?: string
  /** Estilo peligroso (rojo) para acciones destructivas. */
  peligro?: boolean
}

interface PendingConfirm {
  mensaje: string
  opts: ConfirmOpts
  resolve: (v: boolean) => void
}

interface ToastCtx {
  toast: (msg: string, type?: ToastType) => void
  /**
   * Confirmación IN-APP (no usa window.confirm, que se ignora en silencio en
   * apps instaladas / algunos WebViews). Devuelve una promesa: true = aceptar.
   */
  confirm: (mensaje: string, opts?: ConfirmOpts) => Promise<boolean>
}

const Ctx = createContext<ToastCtx>({ toast: () => {}, confirm: async () => false })

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

/**
 * El color del aviso, en tokens.
 *
 * Estaban en hexadecimal —`#22c55e`, `#ef4444`, `#3b82f6`— y el trinquete de
 * color no los veía: busca `color:` seguido de un literal, y aquí la clave es
 * `success:`. El uso está en la línea de abajo, `color: COLORS[t.type]`, con una
 * indirección de por medio.
 *
 * Importa porque un hexadecimal **no cambia de tema**: los tres son los tonos
 * pensados para fondo oscuro, y sobre el crema del tema claro el verde y el azul
 * se quedan por debajo del 4.5:1 de AA. Y esto no es decoración de una pantalla
 * suelta: es el acuse de TODA la aplicación — «Guardado», «No se pudo guardar»,
 * «Receta enviada».
 */
const COLORS: Record<ToastType, string> = {
  success: 'var(--green)',
  error: 'var(--red)',
  info: 'var(--blue)',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const confirm = useCallback((mensaje: string, opts: ConfirmOpts = {}) => {
    return new Promise<boolean>(resolve => setPending({ mensaje, opts, resolve }))
  }, [])

  const cerrar = useCallback((valor: boolean) => {
    setPending(prev => { prev?.resolve(valor); return null })
  }, [])

  // Teclado: Esc = cancelar, Enter = aceptar
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(false) }
      else if (e.key === 'Enter') { e.preventDefault(); cerrar(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, cerrar])

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* Región viva persistente: los lectores de pantalla anuncian cada toast.
          Los errores usan role="alert" (asertivo); el resto role="status". */}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast ${t.type}`}
            role={t.type === 'error' ? 'alert' : 'status'}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
          >
            <span style={{ color: COLORS[t.type], fontWeight: 600, flexShrink: 0 }} aria-hidden="true">{ICONS[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={pending.opts.titulo ? 'nx-confirm-title' : undefined}
          aria-describedby="nx-confirm-desc"
          onClick={() => cerrar(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            /*
             * EL ACOLCHADO RESPETA EL ÁREA SEGURA — REG-517.
             *
             * `padding: 20` a secas ignora la muesca y, sobre todo, la barra
             * inferior de Safari en iPhone. El diálogo llegaba hasta debajo de
             * ella y sus botones quedaban fuera de alcance.
             */
            paddingTop: 'max(20px, env(safe-area-inset-top))',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(20px, env(safe-area-inset-left))',
            paddingRight: 'max(20px, env(safe-area-inset-right))',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 400, background: 'var(--s1)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 16, padding: 22,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              /*
               * ── LOS BOTONES NO PUEDEN SALIRSE DE LA PANTALLA — REG-517 ────
               *
               * El panel no tenía alto máximo ni desbordamiento. Con un mensaje
               * largo —la compuerta previa a firmar llega a listar veintiún
               * avisos— crecía más que la ventana y «Firmar» y «Volver» se iban
               * por abajo. En un teléfono eso no es incómodo: es un diálogo
               * MODAL del que no se puede salir por el camino previsto.
               *
               * Lo encontró el dueño usándolo en su iPhone: «no se ven los
               * botones de hasta abajo».
               *
               * El arreglo es de estructura, no de tamaño de letra: columna con
               * tope de alto, el TEXTO scrollea y la fila de botones se queda
               * fuera del scroll. Así el mensaje puede crecer lo que quiera sin
               * volver a esconder la salida.
               *
               * `dvh` y no `vh`: en Safari de iPhone `100vh` incluye lo que tapa
               * la barra de direcciones, que es exactamente el trozo donde
               * estaban cayendo los botones.
               */
              display: 'flex', flexDirection: 'column',
              maxHeight: 'calc(100dvh - 40px)',
              minHeight: 0,
            }}
          >
            {pending.opts.titulo && (
              <div id="nx-confirm-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{pending.opts.titulo}</div>
            )}
            <div id="nx-confirm-desc" style={{
              fontSize: 14, color: 'var(--text2)', lineHeight: 1.55, whiteSpace: 'pre-line',
              /* Lo que crece es ESTO, no el diálogo. Ver REG-517. */
              overflowY: 'auto', minHeight: 0, flex: '1 1 auto',
              overscrollBehavior: 'contain',
            }}>
              {pending.mensaje}
            </div>
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20,
              /* Fuera del scroll: la salida siempre visible. */
              flex: '0 0 auto',
            }}>
              <button
                onClick={() => cerrar(false)}
                style={{
                  padding: '9px 16px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)',
                }}
              >
                {pending.opts.cancelar || 'Cancelar'}
              </button>
              <button
                autoFocus
                onClick={() => cerrar(true)}
                style={{
                  padding: '9px 16px', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: pending.opts.peligro ? 'var(--red)' : 'var(--nexus-solido)', color: '#fff',
                }}
              >
                {pending.opts.confirmar || 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
