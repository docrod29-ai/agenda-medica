import { NextRequest, NextResponse } from 'next/server'

/**
 * Receptor de reportes de CSP (Content-Security-Policy) en modo Report-Only.
 *
 * La CSP global va como `Content-Security-Policy-Report-Only` (ver next.config.ts):
 * NO bloquea nada, solo AVISA aquí cada vez que algo se saldría de la política.
 * Con una semana de estos reportes sabremos qué orígenes usa de verdad la app
 * y podremos apretar la lista antes de cambiar a modo enforce.
 *
 * PRIVACIDAD: el navegador manda `document-uri`/`referrer`, que en esta app pueden
 * traer el token del magic-link (/mi/{token}) o un id de paciente (/expediente/{id}).
 * Por eso NO se registran completos: solo origen + primer segmento de ruta, el resto
 * se redacta. Nunca se loguea PHI ni tokens.
 */

export const runtime = 'nodejs'

/** Deja origen + primer segmento de la ruta; redacta el resto (tokens, ids de paciente). */
function rutaSegura(url: unknown): string {
  if (typeof url !== 'string' || !url) return ''
  try {
    const u = new URL(url)
    const seg = u.pathname.split('/').filter(Boolean)
    const primero = seg.length ? '/' + seg[0] : '/'
    const resto = seg.length > 1 ? '/…' : ''
    return u.origin + primero + resto
  } catch {
    return '[url no parseable]'
  }
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || ''
    const body = await req.json().catch(() => null)
    if (!body) return new NextResponse(null, { status: 204 })

    // Dos formatos: report-uri => { "csp-report": {...} }; report-to => [ { body: {...} }, ... ]
    const reportes: Record<string, unknown>[] = []
    if (Array.isArray(body)) {
      for (const r of body) {
        const b = (r?.body ?? r) as Record<string, unknown>
        if (b) reportes.push(b)
      }
    } else if (body['csp-report']) {
      reportes.push(body['csp-report'] as Record<string, unknown>)
    } else {
      reportes.push(body as Record<string, unknown>)
    }

    for (const r of reportes) {
      // Nombres varían entre report-uri (guiones) y report-to (camelCase).
      const directiva = r['violated-directive'] ?? r['effectiveDirective'] ?? r['effective-directive'] ?? '?'
      const bloqueado = r['blocked-uri'] ?? r['blockedURL'] ?? r['blocked-url'] ?? '?'
      const doc = rutaSegura(r['document-uri'] ?? r['documentURL'] ?? r['document-url'])
      // Solo el ORIGEN del recurso bloqueado (sin ruta/query, para no arrastrar PHI).
      const bloqueadoOrigen = rutaSegura(bloqueado) || String(bloqueado)
      console.warn(`[CSP-RO] directiva=${directiva} bloqueado=${bloqueadoOrigen} en=${doc} (ct=${ct})`)
    }
  } catch {
    // Nunca fallar por un reporte mal formado.
  }
  return new NextResponse(null, { status: 204 })
}
