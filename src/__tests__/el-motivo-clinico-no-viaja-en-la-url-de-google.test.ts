/**
 * GOLDEN — el enlace de AGENDA devolvía al navegador el `motivo` clínico de
 * cada cita y lo incrustaba en la URL de Google Calendar.
 *
 * Nace como reproducción REP-071 del Panel de Lujo (sep-2026), hallazgo PO-010
 * del auditor P-ortopedia (P2, subido a P1 por el equipo rojo). Se movió aquí
 * con su arreglo.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 *   · src/app/api/portal/route.ts:118 — `motivo: a.motivo` en la lista blanca
 *     de `leerCitasPaciente`, sin mirar `alcance`; la acción `session` (:354)
 *     lo devuelve con un token de alcance `agenda` (el que emite cualquier
 *     miembro del mostrador para confirmar una cita).
 *   · src/app/mi/[token]/page.tsx:176-177 — `gcalLink` hace
 *     `details=${encodeURIComponent(c.motivo || …)}` hacia
 *     `https://calendar.google.com/…`: texto clínico («Ajuste de metformina»,
 *     «Valoración de VIH») en un PARÁMETRO DE URL hacia un tercero.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor P-ortopedia, hallazgo PO-010 (P2). Equipo rojo (R-P-ortopedia) lo
 * SUBE a P1: el propio archivo declara para `PreguntaHecha` (page.tsx:70-72)
 * que «NO trae `motivo` — el servidor no se lo manda al paciente», y doce
 * líneas más abajo `Cita` sí lo declara y lo manda a Google. patient-token.ts:19
 * ya nombraba el riesgo y lo mitigó con TTL en vez de con alcance.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La lista blanca de la cita se pensó contra `notasInternas` (el campo del
 * dueño) y dejó pasar el motivo como si fuera dato de agenda. Y el enlace de
 * calendario se armó para que «se vea de qué es la cita», sin distinguir el
 * tipo (dato administrativo) del motivo (dato clínico).
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * security-tenant.md: «PHI: nunca en logs, nunca en parámetros de URL, nunca en
 * un mensaje de error». patient-facing-ai §8: aquí se agrava, porque el enlace
 * se reenvía por WhatsApp y acaba donde nadie controla.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * Dos tramos, declarados:
 *  1. HÍBRIDA sobre `gcalLink`: la página es un componente cliente y la función
 *     no se exporta, así que se EXTRAE del texto, se transpila con `typescript`
 *     y se EJECUTA con el `instanteMX` real y una `TIPO_LABEL` sintética. La
 *     URL resultante no debe llevar el motivo. Si la reparación renombra o
 *     borra `gcalLink`, la extracción falla con mensaje explícito: adaptar la
 *     prueba, no es defecto de la reparación.
 *  2. CONTRATO TEXTUAL sobre route.ts: la ruta no se monta sin Firestore; se
 *     exige que la lista blanca de la cita o la acción `session` miren
 *     `alcance` para decidir si viaja `motivo`. Es un proxy grueso a propósito
 *     del test real (respuesta `session` con token `agenda` sin `motivo`).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No hace la petición HTTP real ni comprueba el JSON que llega al navegador
 * (el-dato-tiene-que-llegar: pendiente sobre el sitio vivo). No cubre el
 * recordatorio de WhatsApp (otro camino). No cubre otros lectores de `citas`
 * en la pantalla (la tarjeta hoy no pinta el motivo). No opina sobre si con
 * alcance `clinico` el motivo puede ir en la URL de Google: la regla dice que
 * PHI en URL no, en ningún alcance, y el tramo 1 lo exige así.
 *
 * ── EL ARREGLO ───────────────────────────────────────────────────────────────
 * Dos capas, porque una sola no bastaba:
 *  1. `gcalLink` manda el TIPO de cita («Seguimiento»), que es administrativo.
 *     Con sólo esto, el motivo seguiría llegando al navegador del paciente.
 *  2. `leerCitasPaciente(clinicId, patientId, alcance)` devuelve `motivo` SÓLO
 *     con alcance `clinico`. Es la decisión PL-P1 del dueño.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import ts from 'typescript'
import { instanteMX } from '@/lib/timezone'

const leer = (...p: string[]) => readFileSync(path.join(process.cwd(), ...p), 'utf8')
const pagina = leer('src', 'app', 'mi', '[token]', 'page.tsx')
const ruta = leer('src', 'app', 'api', 'portal', 'route.ts')

interface CitaSintetica {
  id: string; fechaHora: string; duracion: number; tipo: string; motivo?: string
  estado: string; medicoNombre: string; lugar?: string; confirmadoPaciente: boolean
}

/** Extrae `function gcalLink(...) {...}` del texto, la transpila y la devuelve ejecutable. */
function gcalLinkDeLaPagina(): (c: CitaSintetica, tz: string) => string {
  const m = pagina.match(/function gcalLink\([\s\S]*?\n\}/)
  if (!m) throw new Error('no encontré `function gcalLink` en mi/[token]/page.tsx: adaptar REP-071 a la nueva forma')
  const js = ts.transpileModule(m[0], { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText
  const TIPO_LABEL: Record<string, string> = { seguimiento: 'Seguimiento', 'primera-vez': 'Primera vez' }
  const fabrica = new Function('instanteMX', 'TIPO_LABEL', `${js}\nreturn gcalLink`)
  return fabrica(instanteMX, TIPO_LABEL)
}

const MOTIVO_CLINICO = 'Valoración de VIH sintética y ajuste de metformina'
const CITA: CitaSintetica = {
  id: 'cita-sintetica-po010', fechaHora: '2026-09-10 10:00', duracion: 30, tipo: 'seguimiento',
  motivo: MOTIVO_CLINICO, estado: 'confirmada', medicoNombre: 'Dra. Ficticia Prueba', confirmadoPaciente: false,
}

describe('PO-010 — la URL de Google Calendar no lleva el motivo clínico', () => {
  const gcalLink = gcalLinkDeLaPagina()

  it('control: la función extraída sigue armando un enlace de Google Calendar con fecha y médico', () => {
    const url = gcalLink(CITA, 'America/Mexico_City')
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/)
    expect(url).toMatch(/dates=20260910T160000Z\/20260910T163000Z/)   // 10:00 CDMX = 16:00Z
    expect(decodeURIComponent(url)).toContain('Dra. Ficticia Prueba')
  })

  it('ninguna parte de la URL (ni `details`, ni `text`) contiene el motivo', () => {
    const url = decodeURIComponent(gcalLink(CITA, 'America/Mexico_City'))
    expect(url, 'PHI en parámetro de URL hacia un tercero').not.toContain('VIH')
    expect(url).not.toContain('metformina')
  })

  it('control: sin motivo, `details` cae al tipo de cita, que es dato administrativo', () => {
    const url = decodeURIComponent(gcalLink({ ...CITA, motivo: undefined }, 'America/Mexico_City'))
    expect(url).toMatch(/details=Seguimiento/)
  })
})

describe('PO-010 — la respuesta `session` con alcance `agenda` no devuelve `motivo` (contrato textual, declarado)', () => {
  const listaBlanca = ruta.match(/async function leerCitasPaciente[\s\S]*?\n\}/)?.[0] ?? ''
  const bloqueSession = ruta.match(/case 'session': \{[\s\S]*?\n {6}case '/)?.[0] ?? ''

  it('control: la lista blanca y la acción `session` existen', () => {
    expect(listaBlanca).not.toBe('')
    expect(bloqueSession).not.toBe('')
    expect(bloqueSession).toContain('leerCitasPaciente(')
  })

  it('la lista blanca de la cita o la acción `session` deciden `motivo` según `alcance`', () => {
    const decidePorAlcance = /alcance/.test(listaBlanca) || /alcance/.test(bloqueSession)
    const exponeMotivoSinCondicion = /^\s*motivo:\s*a\.motivo,\s*$/m.test(listaBlanca)
    expect(
      decidePorAlcance && !exponeMotivoSinCondicion,
      'la lista blanca volvió a devolver `motivo: a.motivo` a cualquier alcance',
    ).toBe(true)
  })
})
