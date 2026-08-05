/**
 * GOLDEN — el vigilante tenía un punto ciego: él mismo.
 *
 * ── EL HUECO, QUE EL PROPIO CÓDIGO DECLARABA ─────────────────────────────────
 *
 * `cron/vigilante` lee los latidos de los demás trabajos y avisa cuando alguno
 * deja de correr. Su propio comentario lo decía: «si se cae ÉL, el propio
 * diagnóstico lo enseña la próxima vez que alguien mire».
 *
 * Pero **nadie más miraba**. El único lector de los latidos era el vigilante, y
 * un vigilante caído no se lee a sí mismo. Además no figuraba en `PERIODO_MIN`,
 * así que ni siquiera había con qué comparar su latido: «lleva tres días sin
 * correr» era indistinguible de «acaba de correr».
 *
 * Y el buzón de operación (`OPS_ALERTA_WEBHOOK`) sigue sin configurar, así que
 * hoy ni el camino normal avisa a nadie.
 *
 * ── LA REPARACIÓN, SIN INFRAESTRUCTURA NUEVA ─────────────────────────────────
 *
 * Los latidos ya se guardan y la franja del dueño ya se pinta cada vez que él
 * abre la aplicación. Se leen ahí. El lector deja de ser el propio vigilante, que
 * es lo único que faltaba.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PERIODO_MIN, diagnosticar } from '@/lib/ops/latido'

const franja = readFileSync(join(process.cwd(), 'src/app/api/superadmin/incidentes/route.ts'), 'utf8')

describe('EL VIGILANTE ENTRA EN LA LISTA DE VIGILADOS', () => {
  it('tiene periodo declarado', () => {
    expect(PERIODO_MIN).toHaveProperty('vigilante')
  })

  it('y coincide con lo que dice vercel.json', () => {
    /**
     * Sin esto, el periodo declarado y el real se separan en silencio y el
     * diagnóstico mide contra un número inventado.
     */
    const vercel = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons?: { path: string; schedule: string }[]
    }
    const cron = vercel.crons?.find(c => c.path.endsWith('/vigilante'))
    expect(cron?.schedule).toBe('*/15 * * * *')
    expect(PERIODO_MIN.vigilante).toBe(15)
  })

  it('un vigilante mudo se diagnostica como caído', () => {
    const hace3Horas = new Date(Date.now() - 3 * 3600_000).toISOString()
    const d = diagnosticar('vigilante', {
      job: 'vigilante', ok: true, ultimaEjecucion: hace3Horas,
    } as never, Date.now())
    expect(d.estado).toBe('tarde')
  })

  it('y uno que acaba de correr, no', () => {
    // Un guardián que grita siempre enseña a ignorarlo.
    const d = diagnosticar('vigilante', {
      job: 'vigilante', ok: true, ultimaEjecucion: new Date().toISOString(),
    } as never, Date.now())
    expect(d.estado).toBe('vivo')
  })
})

describe('LO LEE ALGUIEN QUE NO ES ÉL', () => {
  it('la franja del dueño lee los latidos', () => {
    expect(franja).toContain('leerLatidos()')
    expect(franja).toContain('diagnosticar(')
  })

  it('sobre TODOS los trabajos con periodo, no una lista aparte', () => {
    /**
     * Una segunda lista se desincroniza: un cron nuevo entraría en `PERIODO_MIN`
     * y nadie lo vigilaría desde aquí.
     */
    expect(franja).toContain('Object.keys(PERIODO_MIN)')
  })

  it('sólo avisa de los que dejaron de correr', () => {
    /**
     * Un trabajo que corrió y falló ya se reporta por sus propios medios. Lo que
     * nadie más puede contar es el que dejó de correr, porque un trabajo muerto
     * no levanta la mano.
     */
    expect(franja).toContain("d.estado === 'nunca' || d.estado === 'tarde'")
  })

  it('y van primero, por delante de lo demás', () => {
    // Si los trabajos automáticos no corren, nada de lo demás corre tampoco.
    expect(franja).toContain('[...problemasDeCron, ...porTitulo.values()]')
  })
})

describe('NO PUEDE CONVERTIRSE EN UN PROBLEMA ENCIMA DEL QUE YA HAYA', () => {
  it('si los latidos no se pueden leer, no se inventa nada', () => {
    const i = franja.indexOf('const problemasDeCron')
    const bloque = franja.slice(i, i + 1800)
    expect(bloque).toContain('try {')
    expect(bloque).toContain('} catch {')
  })

  it('y no se calla un problema real por un fallo de lectura', () => {
    // El catch no marca «todo bien»: deja la lista vacía y lo dice en el comentario.
    expect(franja).toMatch(/no se inventa un problema NI se calla uno/)
  })
})
