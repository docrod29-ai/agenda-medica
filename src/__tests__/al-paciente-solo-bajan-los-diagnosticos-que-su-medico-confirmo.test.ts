/**
 * REP-072 · PC-001 (P-cirugía) — el paciente lee como suyos diagnósticos
 * descartados, diferenciales y propuestos por la IA sin confirmar: el paquete de
 * la visita y la acción `documentos` vuelcan TODOS los diagnósticos de la nota.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 *   · src/lib/paciente/paquete-de-visita.ts:338 —
 *     `encounterSummary: (n.diagnosticos ?? []).map(d => texto(d?.descripcion))…`
 *     sin mirar `tipo` ni `tipoOrigen`. `NotaParaElPaquete.diagnosticos` (:230)
 *     ni siquiera declara `tipo`: el módulo no PUEDE distinguir.
 *   · src/app/api/portal/route.ts:1090 — la acción `documentos` hace lo mismo y
 *     mi/[token]/page.tsx:438 lo baja al .doc «RECETA MÉDICA».
 * `Diagnostico.tipo` admite 'definitivo' | 'presuntivo' | 'descartado' |
 * 'diferencial' (src/types/expediente.ts:70) y `tipoOrigen:'extraccion'`
 * marca lo que propuso el modelo y nadie confirmó (:56-64).
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor P-cirugía, hallazgo PC-001, P1; recorrido del portal, pestaña
 * Documentos: «…Sospecha sintética C, Propuesta de la IA sintética D,
 * Descartada sintética E…». Equipo rojo (R-P-cirugia) confirma: la única puerta
 * que elige (`diagnosticoParaImprimir`, fusionar-diagnosticos.ts:209) tiene dos
 * llamadores y ninguno es el portal; y REG-329 DECLARÓ no cubrir el
 * PaqueteDeVisita (ledger: «No cubre el PaqueteDeVisita»).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La forma exacta de REG-329, un campo más a la derecha: aquella regresión puso
 * `medicamentosDeLaReceta` como única puerta para los MEDICAMENTOS que bajan al
 * paciente, y dejó los DIAGNÓSTICOS bajando en crudo por las mismas dos
 * superficies. Una frontera que existe para una entidad y no para la de al lado.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * patient-facing-ai §1: un dato específico del paciente sólo sale de material
 * aprobado por su médico; el nivel 9 (modelo) «nunca origina» — un dx con
 * `tipoOrigen:'extraccion'` sin confirmar es exactamente eso. patient-facing-ai
 * «por qué esta regla existe aparte»: el paciente no puede detectar que ese dx
 * ya se descartó. Cita REG-329 (misma familia, misma ruta).
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO con el motor real `componerPaquete` (módulo puro; entrada
 * sintética con nota firmada y firma, como REP-001). Más un CONTRATO TEXTUAL
 * declarado sobre route.ts:1090, porque la ruta no se monta sin Firestore.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * NO decide si los `presuntivo` puestos por el MÉDICO salen al portal: es
 * política del dueño (cola de decisiones del auditor) y aquí no se asume. No
 * cubre el nombre del diagnóstico en jerga (material educativo, nivel 9). No
 * cubre la pantalla `EntregarAlPaciente` (que sí enseña `encounterSummary` al
 * médico antes de liberar, rotulado «Motivo»). No hace la petición HTTP real
 * de `documentos`. No cubre `diagnosticoParaImprimir`, que con sólo un
 * descartado también lo imprime (`?? conTexto[0]`): hallazgo hermano, no éste.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { componerPaquete } from '@/lib/paciente/paquete-de-visita'
import type { Diagnostico, Medicamento } from '@/types/expediente'

const raiz = path.resolve(__dirname, '../../../..')

/* ── Entrada sintética: paciente operado, nota firmada, cuatro diagnósticos ─── */
const CONFIRMADO: Diagnostico = {
  descripcion: 'Colecistitis crónica litiásica sintética', codigoCIE10: 'K80.1',
  tipo: 'definitivo', estado: 'activo', tipoOrigen: 'medico',
}
const DESCARTADO: Diagnostico = {
  descripcion: 'Neoplasia maligna sintética DESCARTADA', tipo: 'descartado', estado: 'resuelto', tipoOrigen: 'medico',
}
const DIFERENCIAL: Diagnostico = {
  descripcion: 'Pancreatitis sintética (diferencial)', tipo: 'diferencial', estado: 'activo', tipoOrigen: 'medico',
}
const PROPUESTO_POR_IA: Diagnostico = {
  descripcion: 'Sospecha sintética propuesta por el modelo', tipo: 'presuntivo', estado: 'activo', tipoOrigen: 'extraccion',
}
const MEDICAMENTO: Medicamento = {
  nombre: 'Paracetamol', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '3 días',
  procedenciaClinica: 'se_prescribe_hoy',
}

function entradaCon(diagnosticos: readonly Diagnostico[]) {
  return {
    nota: {
      id: 'nota-sintetica-pc001',
      estado: 'firmada',
      fechaConsulta: '2026-09-06',
      medicamentos: [MEDICAMENTO],
      diagnosticos,
      firma: { nombreMedico: 'Dr. Ficticio Prueba', cedulaProfesional: '00000000', especialidad: 'Cirugía general' },
    },
    medicacionPrevia: [] as string[],
    alergias: null,
  }
}

function resumenDelPaquete(diagnosticos: readonly Diagnostico[]): string {
  const c = componerPaquete(entradaCon(diagnosticos))
  expect(c.ok).toBe(true)
  return c.ok ? c.paquete.encounterSummary : ''
}

describe('REP-072 · PC-001 — el paquete del paciente no lleva diagnósticos que el médico no le atribuyó', () => {
  it('control (PASA HOY): con sólo el diagnóstico confirmado, el paquete lo lleva tal cual', () => {
    // Para que el arreglo no señale de más: el confirmado tiene que seguir bajando.
    expect(resumenDelPaquete([CONFIRMADO])).toContain('Colecistitis crónica litiásica sintética')
  })

  it('FALLA HOY · un diagnóstico DESCARTADO no baja al paciente', () => {
    const resumen = resumenDelPaquete([CONFIRMADO, DESCARTADO])
    expect(resumen).toContain('Colecistitis crónica litiásica sintética')
    expect(resumen, 'el paciente leería como suyo un dx que su cirujano descartó').not.toContain('DESCARTADA')
  })

  it('FALLA HOY · un diagnóstico DIFERENCIAL (lista de posibilidades, no un dx) no baja al paciente', () => {
    const resumen = resumenDelPaquete([CONFIRMADO, DIFERENCIAL])
    expect(resumen).not.toContain('Pancreatitis sintética')
  })

  it('FALLA HOY · un dx propuesto por el modelo (`tipoOrigen: extraccion`) y no confirmado no baja al paciente', () => {
    // patient-facing-ai §1: el nivel 9 nunca origina un dato del paciente.
    const resumen = resumenDelPaquete([CONFIRMADO, PROPUESTO_POR_IA])
    expect(resumen).not.toContain('propuesta por el modelo')
  })

  it('FALLA HOY · con los cuatro juntos, al paciente le llega SÓLO el confirmado', () => {
    expect(resumenDelPaquete([CONFIRMADO, DESCARTADO, DIFERENCIAL, PROPUESTO_POR_IA]))
      .toBe('Colecistitis crónica litiásica sintética')
  })
})

describe('REP-072 · PC-001 — la acción `documentos` del portal no vuelca los diagnósticos en crudo (contrato textual, declarado)', () => {
  const ruta = readFileSync(path.join(raiz, 'src', 'app', 'api', 'portal', 'route.ts'), 'utf8')
  const bloqueDocumentos = ruta.match(/case 'documentos': \{[\s\S]*?\n {6}(?:case '|default:)/)?.[0] ?? ''

  it('control: la acción existe y ya cruza la puerta de los MEDICAMENTOS (REG-329)', () => {
    expect(bloqueDocumentos).not.toBe('')
    expect(bloqueDocumentos).toContain('medicamentosDeLaReceta(')
  })

  it('FALLA HOY · `diagnostico:` no se arma mapeando `n.diagnosticos` entero sin filtrar por tipo', () => {
    const enCrudo = /diagnostico:\s*\(n\.diagnosticos\s*\?\?\s*\[\]\)\s*\.map\(\s*\w+\s*=>\s*\w+\.descripcion\s*\)/.test(bloqueDocumentos)
    expect(enCrudo, 'route.ts:1090 vuelca todos los diagnósticos de la nota al .doc del paciente').toBe(false)
  })
})
