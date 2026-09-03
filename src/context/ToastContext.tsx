'use client'
import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'
import { useDialogoDeTeclado } from '@/hooks/useDialogoDeTeclado'

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

  /**
   * EL TECLADO DE ESTA CONFIRMACIÓN, POR EL CAMINO CANÓNICO.
   *
   * Estaba escrito a mano y le faltaba la trampa de foco. Medido en el
   * navegador el 2-sep: con «¿Eliminar esta cita permanentemente?» abierto,
   * **cinco tabulaciones sacaban el foco del diálogo** y lo dejaban en el
   * enlace «Encuentro» de la navegación de detrás — a pesar del
   * `aria-modal="true"`, que le promete a la tecnología de apoyo que lo de
   * atrás está inerte.
   *
   * Y encima el Enter estaba atado a la VENTANA. Así que pulsar Enter sobre
   * ese enlace, creyendo que se navegaba, **borraba la cita**: medido, la
   * lista pasó de 7 citas a 6. Una tecla apuntada a otra cosa ejecutando un
   * acto destructivo e irreversible es lo más caro que puede hacer un diálogo
   * de confirmación — precisamente el que existe para que nada se borre sin
   * querer.
   *
   * Ahora el foco queda atrapado (`useDialogoDeTeclado`, las cinco cosas:
   * Escape, trampa, foco inicial, scroll bloqueado y foco devuelto) y el Enter
   * vive DENTRO del diálogo, no en la ventana.
   */
  const cajaRef = useRef<HTMLDivElement>(null)
  useDialogoDeTeclado(!!pending, cajaRef, () => cerrar(false))

  /**
   * Enter acepta — pero sólo cuando no hay un control que quiera esa tecla.
   * Con el foco en «Cancelar», Enter cancela: lo dice el botón, no este atajo.
   * Sin esta guarda, las dos cosas pasarían a la vez y ganaría la destructiva.
   */
  const alTeclearEnElDialogo = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    const dentro = e.target as HTMLElement | null
    if (dentro && dentro.closest('button, a, input, textarea, select')) return
    e.preventDefault()
    cerrar(true)
  }

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
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            ref={cajaRef}
            tabIndex={-1}
            onKeyDown={alTeclearEnElDialogo}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 400, background: 'var(--s1)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 16, padding: 22,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {pending.opts.titulo && (
              <div id="nx-confirm-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{pending.opts.titulo}</div>
            )}
            <div id="nx-confirm-desc" style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
              {pending.mensaje}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
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
