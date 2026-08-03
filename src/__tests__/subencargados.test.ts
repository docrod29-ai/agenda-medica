/**
 * TRINQUETE LEGAL — la lista de subencargados no se queda corta en silencio.
 *
 * ── LO QUE ENCONTRÉ ──────────────────────────────────────────────────────────
 *
 * El contrato de encargo promete «una lista pública y actualizada de dichos
 * subencargados». Esa lista sí existía —la tabla de `/seguridad`, con región y
 * acuerdo de tratamiento— pero declaraba **seis** proveedores mientras el código
 * usaba **nueve**.
 *
 * Los que faltaban no eran menores:
 *
 *  · **AssemblyAI** recibe el AUDIO de la consulta para separar las voces;
 *  · **Daily** transporta la videoconsulta;
 *  · **Twilio** manda mensajes al paciente.
 *
 * La lista pública de quién recibe datos del paciente **omitía a dos proveedores
 * que reciben datos del paciente**. Una lista incompleta es peor que ninguna:
 * parece completa.
 *
 * Y el aviso de privacidad y el contrato hablaban de «categorías» en prosa, cada
 * uno con su redacción: tres textos legales diciendo lo mismo de tres formas, a
 * un proveedor nuevo de contradecirse.
 *
 * ── LO QUE ESTE GUARDIÁN EXIGE ───────────────────────────────────────────────
 *
 * Que toda clave de proveedor presente en el código esté declarada. Es lo que
 * convierte la lista en un inventario verificable en vez de una redacción.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  SUBENCARGADOS, listaEnTexto, categoriasEnUso, POR_QUE_UNA_SOLA_LISTA,
} from '@/lib/legal/subencargados'

function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== '__tests__') fuentes(p, out); continue }
    if (e.endsWith('.ts') || e.endsWith('.tsx')) out.push(p)
  }
  return out
}

/**
 * Claves de entorno que delatan a un TERCERO al que se le entregan datos.
 *
 * No entran los secretos propios (`CRON_SECRET`, `PORTAL_PACIENTE_SECRET`…):
 * ésos no son un proveedor, son una llave nuestra. `NCBI_API_KEY` tampoco: a
 * PubMed se le manda una consulta bibliográfica, no datos del paciente.
 */
const PROPIAS = [
  'CRON_SECRET', 'PORTAL_PACIENTE_SECRET', 'RECETA_DISENO_SECRET', 'NEXT_PUBLIC_APP_URL',
  'NCBI_API_KEY', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_WEBHOOK_TOKEN', 'META_APP_SECRET', 'GOOGLE_CLIENT_SECRET',
  'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY',
  'STRIPE_WEBHOOK_SECRET', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PROJECT_ID',
]

describe('la lista está completa', () => {
  it('toda clave de proveedor en el código está declarada', () => {
    const usadas = new Set<string>()
    for (const f of fuentes('src')) {
      for (const m of readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        const k = m[1]
        if (PROPIAS.includes(k)) continue
        if (!/KEY|TOKEN|SECRET|URL/.test(k)) continue
        usadas.add(k)
      }
    }
    const declaradas = new Set(SUBENCARGADOS.map(s => s.huella))
    const sinDeclarar = [...usadas].filter(k => !declaradas.has(k)).sort()
    expect(
      sinDeclarar,
      `Estas claves de proveedor aparecen en el código y NO están en la lista de ` +
      `subencargados, así que el aviso, el contrato y la página pública mienten por ` +
      `omisión: ${sinDeclarar.join(', ')}. Decláralas o añádelas a PROPIAS con su razón.`,
    ).toEqual([])
  })

  it('los CUATRO que faltaban están', () => {
    // 360dialog lo encontró este mismo guardián al ejecutarse la primera vez:
    // estaba nombrado entre paréntesis dentro de la fila de Meta, y eso lo dejaba
    // fuera de la lista como empresa — que es lo que importa al firmar un
    // acuerdo de tratamiento con cada una.
    expect(SUBENCARGADOS.map(s => s.nombre)).toContain('360dialog')
  })

  it('los tres del hallazgo original están', () => {
    const nombres = SUBENCARGADOS.map(s => s.nombre).join(' · ')
    expect(nombres).toContain('AssemblyAI')
    expect(nombres).toContain('Daily')
    expect(nombres).toContain('Twilio')
  })

  it('quien recibe audio o vídeo del paciente está marcado como tal', () => {
    // Es la distinción que le importa al titular: no es lo mismo quien procesa
    // un cobro que quien recibe el audio de una consulta.
    for (const n of ['AssemblyAI', 'Daily', 'OpenAI', 'Anthropic']) {
      const s = SUBENCARGADOS.find(x => x.nombre.includes(n))
      expect(s?.tocaDatosDeSalud, n).toBe(true)
    }
    expect(SUBENCARGADOS.find(x => x.nombre === 'Stripe')?.tocaDatosDeSalud).toBe(false)
  })

  it('cada uno trae su acuerdo de tratamiento', () => {
    for (const s of SUBENCARGADOS) {
      expect(s.pol, s.nombre).toMatch(/^https:\/\//)
      expect(s.region.trim(), s.nombre).not.toBe('')
      expect(s.uso.trim(), s.nombre).not.toBe('')
    }
  })
})

describe('una sola fuente para los tres documentos', () => {
  const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

  it('la página pública ya no lleva su propia copia', () => {
    const s = leer('src', 'app', 'seguridad', 'page.tsx')
    expect(s).toContain("from '@/lib/legal/subencargados'")
    expect(s).not.toContain('const SUBENCARGADOS = [')
  })

  it('el aviso de privacidad NOMBRA a los subencargados, no sólo sus categorías', () => {
    const s = leer('src', 'lib', 'aviso-privacidad.ts')
    expect(s).toContain('listaEnTexto()')
    // La prosa de categorías sola dejaba al paciente sin saber a quién.
    expect(s).not.toContain('(nube, mensajería, procesamiento de pagos e inteligencia artificial)')
  })

  it('el contrato de encargo usa la MISMA lista', () => {
    const s = leer('src', 'lib', 'contrato-encargo.ts')
    expect(s).toContain('listaEnTexto()')
    expect(s).toContain('una sola fuente')
  })

  it('y el texto que se inserta nombra a cada uno con su región', () => {
    const t = listaEnTexto()
    expect(t).toContain('AssemblyAI')
    expect(t).toContain('Daily')
    expect(t).toMatch(/Puede tratar datos de salud/)
    expect(t).toMatch(/No trata datos de salud/)
  })

  it('las categorías salen de la lista, no de una frase escrita a mano', () => {
    expect(categoriasEnUso()).toContain('telesalud')
    expect(POR_QUE_UNA_SOLA_LISTA).toMatch(/parece completa/)
  })
})
