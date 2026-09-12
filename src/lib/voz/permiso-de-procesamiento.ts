export type CapacidadVoz = 'reconocimientoNavegador' | 'transcripcionAudio' | 'lecturaNavegador'
export const AVISO_VOZ_LIMITADA = 'Esta función de voz no está disponible con la política de privacidad actual o sin conexión. Puedes escribir. El audio guardado se conserva.'

export class CapacidadVozLimitada extends Error {
  constructor() { super(AVISO_VOZ_LIMITADA); this.name = 'CapacidadVozLimitada' }
}

/** Las voces del navegador pueden usar servidores remotos, incluso al leer texto. */
export async function capacidadVozPermitida(capacidad: CapacidadVoz): Promise<boolean> {
  try {
    const r = await fetch('/api/ia/capacidades', {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000),
    })
    return r.ok && (await r.json())[capacidad] === true
  } catch { return false }
}

export async function iniciarReconocimientoPermitido(iniciar: () => void, sigueActivo: () => boolean): Promise<boolean> {
  if (!await capacidadVozPermitida('reconocimientoNavegador') || !sigueActivo()) return false
  try { iniciar(); return true } catch { return false }
}

export function verificarRespuestaDeVoz(datos: { capacidadLimitada?: unknown } | null): void {
  if (datos?.capacidadLimitada === true) throw new CapacidadVozLimitada()
}
