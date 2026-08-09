/**
 * SAFE-003 — «Sin referencia de dosis» se descartaba también en niños.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La pantalla de receta filtraba `codigo === 'sin_referencia'` de forma
 * incondicional (`receta/[patientId]/[notaId]/page.tsx`, antes de esta unidad):
 * si un fármaco no estaba en `CATALOGO`, el aviso «Sin referencia de dosis…
 * verifica manualmente» desaparecía de la receta impresa para TODO paciente,
 * niño incluido.
 *
 * ── CÓMO SE ENCONTRÓ ─────────────────────────────────────────────────────────
 *
 * `agent-state/BACKLOG.json` — SAFE-003, de una auditoría de nueve dimensiones
 * anterior (hallazgo G2): el filtro es correcto para un adulto (no saturar la
 * receta con avisos sin acción), pero en pediatría la dosis va por kilo y el
 * margen terapéutico es estrecho. Callar «no hay referencia» ahí se lee como
 * «la dosis está comprobada», y no lo está.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * El filtro no distinguía edad: `.filter(a => a.codigo !== 'sin_referencia')`
 * corría igual para los dos casos, aunque `esPediatrico` ya se calculaba dos
 * líneas arriba para la comprobación mg/kg.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `filtrarParaReceta(alertas, esPediatrico)` en `src/lib/seguridad/dosis.ts`:
 * pura, pequeña, sin fármaco de ejemplo hardcodeado — se prueba con cualquier
 * conjunto de alertas. El umbral de edad (`< 18`) es el mismo que usa el resto
 * del expediente (renal, copiloto, dosis mg/kg): no se inventa uno nuevo aquí.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No cambia el catálogo (`CATALOGO` sigue siendo semilla, por revisar por un
 * médico/farmacéutico) ni añade referencias nuevas: sólo deja de esconder que
 * faltan, y sólo donde el margen es más estrecho. Tampoco toca la severidad
 * (`info`) ni el estilo del panel — sigue siendo un aviso, no un bloqueo.
 */
import { describe, it, expect } from 'vitest'
import { filtrarParaReceta, type AlertaDosis } from '@/lib/seguridad/dosis'

const SIN_REFERENCIA: AlertaDosis = {
  severidad: 'info',
  codigo: 'sin_referencia',
  mensaje: 'Sin referencia de dosis para "fármaco-fuera-de-catálogo" en el catálogo. Verifica manualmente (ausencia de alerta ≠ dosis segura).',
}

const SOBRE_MAXIMO: AlertaDosis = {
  severidad: 'alta',
  codigo: 'sobre_maximo_dosis',
  mensaje: 'Supera el máximo por toma.',
}

describe('SAFE-003 — sin_referencia en pediatría no se calla', () => {
  it('adulto: sin_referencia se filtra — no satura la receta de avisos sin acción', () => {
    expect(filtrarParaReceta([SIN_REFERENCIA], false)).toEqual([])
  })

  it('pediátrico: sin_referencia SE CONSERVA — el margen mg/kg es estrecho', () => {
    expect(filtrarParaReceta([SIN_REFERENCIA], true)).toEqual([SIN_REFERENCIA])
  })

  it('adulto con sin_referencia Y una alerta real: sólo se filtra la informativa', () => {
    expect(filtrarParaReceta([SIN_REFERENCIA, SOBRE_MAXIMO], false)).toEqual([SOBRE_MAXIMO])
  })

  it('pediátrico con las dos: se conservan las dos', () => {
    expect(filtrarParaReceta([SIN_REFERENCIA, SOBRE_MAXIMO], true))
      .toEqual([SIN_REFERENCIA, SOBRE_MAXIMO])
  })

  it('sin alertas, no hay nada que filtrar en ningún caso', () => {
    expect(filtrarParaReceta([], false)).toEqual([])
    expect(filtrarParaReceta([], true)).toEqual([])
  })

  /**
   * PROBADO AL REVÉS (regla de testing-gates.md): el filtro incondicional que
   * causaba SAFE-003 era exactamente `alertas.filter(a => a.codigo !==
   * 'sin_referencia')`, ignorando `esPediatrico`. Con ese código, el segundo
   * caso de arriba («pediátrico: sin_referencia SE CONSERVA») da `[]` en vez
   * de `[SIN_REFERENCIA]` y el test falla — confirmado a mano antes de fijar
   * el arreglo.
   */
  it('el defecto original: un filtro que ignore esPediatrico pierde la alerta', () => {
    const filtroIncondicional = (alertas: AlertaDosis[]) =>
      alertas.filter(a => a.codigo !== 'sin_referencia')
    expect(filtroIncondicional([SIN_REFERENCIA])).toEqual([]) // esto es lo que fallaba en niños
    expect(filtrarParaReceta([SIN_REFERENCIA], true)).not.toEqual(filtroIncondicional([SIN_REFERENCIA]))
  })
})

describe('la pantalla de receta usa el filtro consciente de edad, no uno crudo', () => {
  it('la receta importa y llama a filtrarParaReceta, no un .filter suelto sobre sin_referencia', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const fuente = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8',
    )
    expect(fuente).toContain('filtrarParaReceta')
    expect(fuente).not.toMatch(/\.filter\(a => a\.codigo !== 'sin_referencia'\)/)
  })
})
