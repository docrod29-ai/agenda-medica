/**
 * TRINQUETE DE LA BITÁCORA — ningún evento se queda sin nombre.
 *
 * ── QUÉ ROMPÍA ───────────────────────────────────────────────────────────────
 *
 * La pantalla de cumplimiento es la que se le pone delante a un auditor: es la
 * trazabilidad de NOM-024 hecha visible. Y su lista de etiquetas vivía suelta
 * dentro del propio `page.tsx`, así que la bitácora podía crecer sin que nadie
 * se enterara de que a la pantalla le faltaban nombres.
 *
 * Cuando lo revisé, **doce eventos salían con su nombre interno**:
 * `hosp_administracion` en vez de «Administró medicamento», `cita_borrada`,
 * `cobro_exento`, `foto_clinica_borrada`… Media bitácora en jerga de base de
 * datos no es trazabilidad, es un volcado.
 *
 * Y cinco de ellos —los del portal y el bot— se escribían directo con el Admin
 * SDK sin pasar por `logAudit`, así que ni siquiera estaban en el TIPO. Nadie
 * podía notarlo desde el compilador.
 *
 * ── LO QUE ESTE GUARDIÁN EXIGE ───────────────────────────────────────────────
 *
 *  1. cada evento del tipo tiene su etiqueta;
 *  2. cada `evento: '...'` que se escribe en el repositorio está en el tipo.
 *
 * Es el mismo trato que el trinquete de lint: lo que importa no es corregirlo
 * hoy, es que no se vuelva a descolgar mañana.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { EVENTO_LABEL, etiquetaEvento } from '@/lib/expediente/audit-log'

function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== '__tests__') fuentes(p, out); continue }
    if (e.endsWith('.ts') || e.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** Todos los `evento: 'x'` que de verdad se escriben. */
function eventosEscritos(): Set<string> {
  const s = new Set<string>()
  for (const f of fuentes('src')) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\bevento:\s*'([a-z0-9_]+)'/g)) s.add(m[1])
  }
  return s
}

describe('trinquete de la bitácora', () => {
  it('cada evento del tipo tiene una etiqueta legible', () => {
    // El tipo y el mapa están declarados como Record<AuditEvento, string>, así que
    // el compilador ya lo exige; esto lo fija también en tiempo de ejecución y
    // sirve de aviso al leer el fallo.
    for (const [clave, texto] of Object.entries(EVENTO_LABEL)) {
      expect(texto.trim(), clave).not.toBe('')
      // Una etiqueta que repite el nombre interno no es una etiqueta.
      expect(texto, clave).not.toBe(clave)
    }
  })

  it('todo evento que se ESCRIBE está en el tipo', () => {
    const sinDeclarar = [...eventosEscritos()].filter(e => !(e in EVENTO_LABEL)).sort()
    expect(
      sinDeclarar,
      `Estos eventos se escriben en la bitácora y no están en AuditEvento/EVENTO_LABEL, ` +
      `así que la pantalla de cumplimiento los enseña con su nombre interno: ${sinDeclarar.join(', ')}`,
    ).toEqual([])
  })

  it('los del paciente dicen QUE FUE ÉL', () => {
    // En una revisión, «canceló» sin sujeto se lee como que lo hizo el
    // consultorio — y es justo lo contrario de lo que pasó.
    for (const e of ['cita_cancelada_portal', 'cita_reagendada_portal', 'cita_cancelada_whatsapp', 'cita_solicitada_portal']) {
      expect(EVENTO_LABEL[e as keyof typeof EVENTO_LABEL], e).toMatch(/^El paciente /)
    }
  })

  it('un evento desconocido no revienta la pantalla', () => {
    // Un documento viejo o de otra versión se enseña como venga, no en blanco.
    expect(etiquetaEvento('lo_que_sea')).toBe('lo_que_sea')
  })
})

describe('la pantalla usa el mapa compartido', () => {
  it('ya no lleva su propia copia', () => {
    const s = readFileSync(join('src', 'app', '(dashboard)', 'cumplimiento', 'page.tsx'), 'utf8')
    expect(s).toContain('etiquetaEvento(e.evento)')
    expect(s).not.toContain('const EVENTO_LABEL')
  })
})
