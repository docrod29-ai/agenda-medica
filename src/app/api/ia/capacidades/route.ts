import { NextResponse } from 'next/server'
import { modoIA } from '@/lib/ia/configuracion-privada'

export const dynamic = 'force-dynamic'

/** Sólo capacidades públicas. Nunca endpoint, credencial ni datos de clínica. */
export function GET() {
  const externa = modoIA() === 'HYBRID'
  return NextResponse.json({ reconocimientoNavegador: externa, transcripcionAudio: externa, lecturaNavegador: externa }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
