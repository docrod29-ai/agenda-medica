/**
 * GOLDEN — el archivo llamado «expediente» tiraba los borradores sin decirlo.
 *
 * ── LO QUE PASABA (parte viva de D1) ─────────────────────────────────────────
 *
 * `exportarPacienteAFhir` recorre `notas.filter(n => n.estado === 'firmada')`.
 * Todo lo demás **desaparecía en silencio**. El titular que ejercía su derecho
 * de portabilidad recibía un archivo con huecos que nadie le señalaba.
 *
 * Y no es un caso raro: una consulta interrumpida, una nota que se está
 * redactando, o el propio pase de UCI antes de firmarse.
 *
 * ── LA PALABRA YA EXISTÍA ────────────────────────────────────────────────────
 *
 * FHIR distingue el borrador del documento con `Composition.status`:
 * `preliminary | final | amended | entered-in-error`. No hace falta inventar
 * nada — sólo usarlo.
 *
 * ── LO QUE UN BORRADOR **NO** LLEVA ──────────────────────────────────────────
 *
 * Sus `Condition` y sus `MedicationRequest`. Un diagnóstico sacado de una nota
 * sin firmar entraría al sistema receptor como un diagnóstico **confirmado**,
 * con el mismo peso que uno firmado — que es exactamente lo que la firma existe
 * para impedir. El texto viaja; la afirmación clínica estructurada, no.
 */
import { describe, it, expect } from 'vitest'
import {
  exportarPacienteAFhir, resumenNotasExportadas, POR_QUE_EL_BORRADOR_NO_LLEVA_DIAGNOSTICOS,
} from '@/lib/fhir-export'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const paciente = {
  id: 'p1', nombre: 'Paciente Sintético', edad: 40, sexo: 'M',
  updatedAt: '2026-08-04T10:00:00.000Z',
} as never

const nota = (id: string, estado: string) => ({
  id, estado, tipo: 'consulta',
  fechaConsulta: '2026-08-04T10:00:00.000Z',
  metadata: { id, fechaCreacion: '2026-08-04T10:00:00.000Z', medicoId: 'm1' },
  secciones: [{ key: 'padecimiento', label: 'Padecimiento actual', value: 'Texto sintético.' }],
  diagnosticos: [{ descripcion: 'Gastritis', tipo: 'presuntivo', estado: 'activo' }],
  medicamentos: [{ nombre: 'Omeprazol', dosis: '20 mg' }],
} as never)

const bundleDe = (notas: unknown[]) =>
  exportarPacienteAFhir({ paciente, notas: notas as never, config: null })

const recursos = (b: ReturnType<typeof bundleDe>, tipo: string) =>
  b.entry.filter(e => e.resource.resourceType === tipo).map(e => e.resource as Record<string, unknown>)

describe('EL BORRADOR YA NO DESAPARECE', () => {
  it('una nota sin firmar sale en el archivo', () => {
    const b = bundleDe([nota('n1', 'borrador')])
    expect(recursos(b, 'Composition')).toHaveLength(1)
  })

  it('y sale marcada como preliminar, no como documento final', () => {
    const c = recursos(bundleDe([nota('n1', 'borrador')]), 'Composition')[0]
    expect(c.status).toBe('preliminary')
    expect(String(c.type && (c.type as { text?: string }).text)).toMatch(/borrador/i)
  })

  it('la firmada sigue saliendo como final', () => {
    // La garantía de que esto no toca lo que ya estaba bien.
    const c = recursos(bundleDe([nota('n1', 'firmada')]), 'Composition')[0]
    expect(c.status).toBe('final')
  })

  it('las dos conviven en el mismo archivo', () => {
    const b = bundleDe([nota('n1', 'firmada'), nota('n2', 'borrador')])
    expect(recursos(b, 'Composition').map(c => c.status).sort()).toEqual(['final', 'preliminary'])
  })
})

describe('PERO UN BORRADOR NO AFIRMA NADA CLÍNICO', () => {
  it('no exporta diagnósticos', () => {
    /**
     * Entrarían al sistema receptor como confirmados, con el mismo peso que
     * uno firmado — justo lo que la firma existe para impedir.
     */
    expect(recursos(bundleDe([nota('n1', 'borrador')]), 'Condition')).toHaveLength(0)
  })

  it('ni recetas', () => {
    expect(recursos(bundleDe([nota('n1', 'borrador')]), 'MedicationRequest')).toHaveLength(0)
  })

  it('la nota FIRMADA sí los exporta', () => {
    const b = bundleDe([nota('n1', 'firmada')])
    expect(recursos(b, 'Condition').length).toBeGreaterThan(0)
    expect(recursos(b, 'MedicationRequest').length).toBeGreaterThan(0)
  })

  it('sin firma no hay atestación: la lista va vacía, no inventada', () => {
    const c = recursos(bundleDe([nota('n1', 'borrador')]), 'Composition')[0]
    expect(c.attester).toEqual([])
  })

  it('pero el TEXTO del borrador sí viaja: es el contenido del expediente', () => {
    const c = recursos(bundleDe([nota('n1', 'borrador')]), 'Composition')[0]
    expect(String((c.text as { div?: string }).div)).toContain('Texto sintético')
  })

  it('está escrito por qué', () => {
    expect(POR_QUE_EL_BORRADOR_NO_LLEVA_DIAGNOSTICOS).toMatch(/lo que la firma existe para impedir/)
  })
})

describe('Y SE DICE ANTES DE DESCARGAR', () => {
  it('el resumen cuenta las dos clases', () => {
    const r = resumenNotasExportadas([{ estado: 'firmada' }, { estado: 'borrador' }, { estado: undefined }])
    expect(r.firmadas).toBe(1)
    expect(r.borradores).toBe(2)
  })

  it('la pantalla lo enseña y lo deja en la bitácora', () => {
    const page = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'expediente', '[patientId]', 'page.tsx'), 'utf8')
    /**
     * P1-12 — el argumento pasó de `notas` (lo que la línea de tiempo tuviera
     * cargado, que ahora se lee por páginas) a `notasExportadas`, que es lo que
     * de verdad entró en el archivo: la historia pedida EXPLÍCITAMENTE con
     * `asegurarHistoriaCompleta()`. La intención del caso no cambia —el aviso
     * cuenta lo que se exportó— y de paso se aprieta: antes podía contar unas
     * notas y exportar otras.
     */
    expect(page).toContain('resumenNotasExportadas(notasExportadas)')
    expect(page).toContain('notas: notasExportadas, config')
    expect(page).toMatch(/marcadas como preliminares/)
    expect(page).toContain('borradores: rn.borradores')
  })
})
