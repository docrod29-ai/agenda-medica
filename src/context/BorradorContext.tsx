'use client'
import { createContext, useContext, useRef } from 'react'

/**
 * Almacén EN MEMORIA de borradores de nota, que vive en el layout del dashboard
 * (por encima del navegador de páginas). Así, al moverte entre pantallas y
 * volver, la nota está EXACTAMENTE como la dejaste — sin recargar, sin parpadeo,
 * sin "restaurar". (localStorage sigue como respaldo para recargas/crashes.)
 *
 * No usa estado reactivo a propósito: es un cajón (ref) que sobrevive la
 * navegación; cada pantalla lo lee al montar y lo escribe al cambiar.
 */
type Borrador = Record<string, unknown>

interface BorradorCtx {
  leer: (clave: string) => Borrador | null
  escribir: (clave: string, datos: Borrador) => void
  borrar: (clave: string) => void
}

const Ctx = createContext<BorradorCtx | null>(null)

export function BorradorProvider({ children }: { children: React.ReactNode }) {
  const cajon = useRef<Map<string, Borrador>>(new Map())
  const api = useRef<BorradorCtx>({
    leer: (clave) => cajon.current.get(clave) ?? null,
    escribir: (clave, datos) => { cajon.current.set(clave, datos) },
    borrar: (clave) => { cajon.current.delete(clave) },
  })
  return <Ctx.Provider value={api.current}>{children}</Ctx.Provider>
}

/** Devuelve el almacén de borradores en memoria (o un no-op si falta el provider). */
export function useBorrador(): BorradorCtx {
  return useContext(Ctx) ?? { leer: () => null, escribir: () => {}, borrar: () => {} }
}
