'use client'
import { createContext, useContext, useRef, useCallback, useSyncExternalStore } from 'react'

/**
 * Almacén REACTIVO de tareas en curso (pensamientos de IA) que vive en el layout
 * del dashboard — por ENCIMA del navegador de páginas. Así, si la IA está
 * "pensando" y te cambias de pantalla, la petición sigue y su resultado queda
 * guardado aquí; al volver, la pantalla lee el estado y muestra el resultado (o
 * el "pensando" si aún no termina). El componente puede desmontarse sin perder
 * nada: el `.then` del fetch escribe en este almacén (referencia estable), no en
 * el estado del componente.
 */
type Updater<T> = T | ((prev: T | undefined) => T)

class TareaStore {
  private data = new Map<string, unknown>()
  private listeners = new Set<() => void>()
  get(key: string): unknown { return this.data.get(key) }
  set(key: string, v: unknown) {
    const prev = this.data.get(key)
    const next = typeof v === 'function' ? (v as (p: unknown) => unknown)(prev) : v
    if (next === prev) return
    this.data.set(key, next)
    this.listeners.forEach(l => l())
  }
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }
}

const Ctx = createContext<TareaStore | null>(null)

export function TareasProvider({ children }: { children: React.ReactNode }) {
  const store = useRef<TareaStore>(new TareaStore()).current
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

/**
 * Lee y escribe una tarea por clave, de forma reactiva (re-renderiza al cambiar).
 * setValue acepta un valor o una función (prev) => next (como useState).
 */
export function useTarea<T>(key: string): [T | undefined, (v: Updater<T>) => void] {
  const store = useContext(Ctx)
  const val = useSyncExternalStore(
    store ? store.subscribe : () => () => {},
    () => (store ? store.get(key) : undefined) as T | undefined,
    () => undefined,
  )
  const set = useCallback((v: Updater<T>) => { store?.set(key, v as unknown) }, [store, key])
  return [val, set]
}
