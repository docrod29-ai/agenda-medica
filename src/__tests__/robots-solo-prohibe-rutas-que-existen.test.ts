/**
 * C-035 · Panel de Lujo (C-programador) — robots.ts prohibía rutas que no
 * existen (/agenda, /waitlist) y le faltaban rutas privadas que sí existen.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * La lista `disallow` vivía copiada a mano: `/agenda` y `/waitlist` no tienen
 * página (la lista de espera vive en /lista-espera), y faltaban /membresias,
 * /motores, /operaciones, /pendientes, /uci y /antibiograma. El mismo defecto
 * que `RUTAS_PRIVADAS` vino a arreglar para las cabeceras, repetido aquí.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor C-programador, C-035 (P3, innecesario); el equipo rojo confirmó las
 * dos entradas fantasma y añadió las seis que faltaban.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Dos listas para una misma verdad. Cuando hay dos, una se queda vieja.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * `robots.ts` DERIVA el `disallow` de `RUTAS_PRIVADAS` y `RUTAS_PACIENTE_CON_PHI`
 * (fuente única, cruzada contra el árbol por `csp-guard.test.ts`); lo demás
 * que se bloquea va en `RUTAS_BLOQUEADAS_ADEMAS` con motivo. Este guardián
 * exige que TODO lo prohibido exista en `src/app`.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Que un buscador obedezca robots.txt (no es autorización: eso son las
 * cabeceras y la sesión). No verifica el sitemap.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import robots, { rutasNoIndexables, RUTAS_BLOQUEADAS_ADEMAS } from '@/app/robots'
import { RUTAS_PRIVADAS } from '@/lib/security/rutas-privadas'

const RAIZ = process.cwd()

/** ¿Existe una página o carpeta para este primer segmento? */
function existeEnElArbol(segmento: string): boolean {
  return [
    resolve(RAIZ, 'src/app/(dashboard)', segmento),
    resolve(RAIZ, 'src/app', segmento),
  ].some(existsSync)
}

describe('C-035 · robots.txt sólo prohíbe rutas que existen, y prohíbe todas las privadas', () => {
  const disallow = robots().rules
  const lista = Array.isArray(disallow) ? disallow[0].disallow as string[] : [disallow.disallow as string]

  it('cada entrada de disallow (salvo /api/) corresponde a una carpeta real de src/app', () => {
    const fantasmas = lista
      .filter(r => r !== '/api/')
      .map(r => r.replace(/^\//, '').replace(/\/$/, ''))
      .filter(seg => !existeEnElArbol(seg))
    expect(fantasmas, `rutas prohibidas que no existen: ${fantasmas.join(', ')}`).toEqual([])
  })

  it('no vuelven las dos fantasmas del hallazgo', () => {
    expect(lista).not.toContain('/agenda')
    expect(lista).not.toContain('/waitlist')
  })

  it('TODA ruta privada está prohibida (las seis que faltaban, incluidas)', () => {
    for (const r of RUTAS_PRIVADAS) expect(lista, r).toContain(`/${r}`)
    for (const r of ['/membresias', '/motores', '/operaciones', '/pendientes', '/uci', '/antibiograma']) {
      expect(lista).toContain(r)
    }
  })

  it('los enlaces con token del paciente y las rutas extra siguen fuera del índice', () => {
    for (const r of ['/mi/', '/teleconsulta/', '/verificar/', '/resena/']) expect(lista).toContain(r)
    for (const r of RUTAS_BLOQUEADAS_ADEMAS) expect(lista).toContain(r)
    expect(lista).toContain('/api/')
  })

  it('la lista se deriva de la fuente única (no hay una copia a mano en el archivo)', () => {
    const src = readFileSync(resolve(RAIZ, 'src/app/robots.ts'), 'utf8')
    expect(src).toContain("from '@/lib/security/rutas-privadas'")
    expect(src).not.toMatch(/'\/consulta',\s*'\/consultor'/)
    expect(rutasNoIndexables()).toEqual(lista)
  })
})
