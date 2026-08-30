import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * REG-502 — EL SECRETO DEL SEGUNDO FACTOR VIAJABA A UN TERCERO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La pantalla de enrolamiento de 2FA dibujaba el QR pidiéndoselo a un servicio
 * externo:
 *
 *     https://api.qrserver.com/v1/create-qr-code/?data=<otpauth://...>
 *
 * El `otpauth://` **lleva dentro la semilla compartida** que genera los códigos.
 * Ponerla en la cadena de consulta de una URL hacia un servidor ajeno la entrega
 * entera —y de paso queda en los registros de ese servidor y en cualquier
 * intermediario que vea la URL—. Un segundo factor cuya semilla se publicó ya no
 * es un segundo factor: es una contraseña más, en manos de alguien más.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría WS-13 del Master Completion Loop. Y no era desconocido: el propio
 * `csp-guard.test.ts` lo llevaba anotado como «HALLAZGO abierto» en su lista de
 * exenciones, y `configuracion/secciones-seguridad.tsx` **ya lo había arreglado**
 * en local con un comentario que nombra la fuga.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Había DOS pantallas de enrolamiento de TOTP y se arregló UNA. El arreglo
 * existía, estaba escrito y estaba a tres archivos de distancia. Por eso este
 * guardián no vigila una pantalla: vigila **la propiedad**, en todo el código
 * que se sirve al navegador. Una tercera pantalla de enrolamiento nacería
 * vigilada.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Un `otpauth://` no se le entrega a nadie. El QR se dibuja en el navegador.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No prueba que el QR se VEA ni que se pueda escanear: eso es navegador.
 * · No prohíbe `api.qrserver.com` en general — sigue usándose para QR de
 *   enlaces PÚBLICOS (auto-agenda y reservas), donde no viaja ningún secreto.
 *   Esa distinción es el punto: lo que se prohíbe es el SECRETO, no el servicio.
 * · No cubre otras formas de sacar el secreto (copiarlo a mano, una captura).
 */

const RAIZ = 'src'
const OMITIR = new Set(['__tests__', 'node_modules'])

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (OMITIR.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) fuentes(p, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p)
  }
  return acc
}

/**
 * QUÉ MARCA A UN ARCHIVO COMO MANEJADOR DEL SECRETO TOTP.
 *
 * Se vigila POR ARCHIVO y no por línea, y la razón es la lección del defecto:
 * la línea culpable no decía `otpauth` por ninguna parte —decía `qrUrl`—, así
 * que buscar el secreto en la línea habría dejado pasar el defecto original.
 * Y buscar `qrUrl` a secas señala a cualquiera que llame así a una variable:
 * la pantalla de reservas tiene un `qrUrl` que es la dirección PÚBLICA del
 * consultorio, y confundirla con un secreto sería gritar donde no hay fuego.
 *
 * La propiedad de verdad es: **un archivo que acuña o maneja un secreto TOTP no
 * le pide el dibujo a nadie.**
 */
const MARCA_TOTP = /otpauth|TotpSecret|TotpMultiFactorGenerator|generateQrCodeUrl|@\/lib\/mfa/
/** Servicios externos que dibujan un QR a partir de lo que se les manda. */
const SERVICIO_DE_QR = /https?:\/\/[a-z0-9.-]*(qrserver|goqr|quickchart|chart\.googleapis)[a-z0-9.-]*/i

function esComentario(linea: string): boolean {
  const l = linea.trim()
  return l.startsWith('*') || l.startsWith('//') || l.startsWith('/*')
}

/** Archivos que manejan el secreto TOTP y además llaman a un servicio de QR. */
function fugasDeSecreto(): { archivo: string; linea: number; texto: string }[] {
  const fugas: { archivo: string; linea: number; texto: string }[] = []
  for (const archivo of fuentes(RAIZ)) {
    const src = readFileSync(archivo, 'utf8')
    if (!MARCA_TOTP.test(src)) continue
    src.split('\n').forEach((texto, i) => {
      if (esComentario(texto)) return
      if (SERVICIO_DE_QR.test(texto)) fugas.push({ archivo, linea: i + 1, texto: texto.trim() })
    })
  }
  return fugas
}

describe('REG-502 · el secreto del segundo factor no se le entrega a nadie', () => {
  it('ninguna línea manda un otpauth:// a un host externo', () => {
    const fugas = fugasDeSecreto()
    expect(
      fugas.map(f => `${f.archivo}:${f.linea} → ${f.texto}`).join('\n'),
    ).toBe('')
  })

  it('las DOS pantallas de enrolamiento dibujan el QR en el navegador', () => {
    const pantallas = [
      'src/app/(dashboard)/cumplimiento/seguridad/page.tsx',
      'src/app/(dashboard)/configuracion/secciones-seguridad.tsx',
    ]
    for (const p of pantallas) {
      const src = readFileSync(p, 'utf8')
      // Genera el QR en local...
      expect(src, `${p} debe generar el QR en local`).toMatch(/import\(['"]qrcode['"]\)/)
      // ...y no le pasa el secreto a un servicio de QR.
      expect(src, `${p} no debe mandar el secreto fuera`).not.toMatch(
        /qrserver[^\n]*encodeURIComponent\(qrUrl\)/,
      )
    }
  })

  it('el guardián sabe fallar, y sabe NO fallar', () => {
    // Probado al revés sin tocar el árbol. Éste es el archivo culpable de antes:
    // maneja el secreto Y llama al servicio de QR.
    const culpable = `import { TotpMultiFactorGenerator } from 'firebase/auth'
      const src = \`https://api.qrserver.com/v1/create-qr-code/?data=\${encodeURIComponent(qrUrl)}\``
    expect(MARCA_TOTP.test(culpable)).toBe(true)
    expect(culpable.split('\n').some(l => !esComentario(l) && SERVICIO_DE_QR.test(l))).toBe(true)

    // Y éste NO es culpable: llama al mismo servicio con una dirección PÚBLICA
    // y no toca ningún secreto. Un guardián que no distingue esto obliga a
    // apagarlo, y un guardián apagado no vigila nada.
    const inocente = `const url = \`\${origin}/reservar/\${clinicId}\`
      const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?data=\${encodeURIComponent(url)}\``
    expect(MARCA_TOTP.test(inocente)).toBe(false)
  })
})
