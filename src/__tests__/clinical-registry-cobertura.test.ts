/**
 * ══════════════════════════════════════════════════════════════════════════
 * GATE DE COBERTURA DEL CLINICAL ENGINE REGISTRY (unidad Nexus OS E0-03)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Criterio de aceptación de la unidad: **un motor nuevo sin registro rompe el CI.**
 *
 * Antes, la integridad del registro se comprobaba con `length >= 15`: un número
 * mágico que daba verde aunque se añadieran diez motores sin declarar. Aquí el
 * conteo se DERIVA del filesystem: se recorren los directorios clínicos y cada
 * archivo debe estar registrado como motor (`registry.ts`) o justificado como
 * no-motor (`cobertura.ts`). Cualquier archivo nuevo sin clasificar falla.
 *
 * El recorrido es RECURSIVO a propósito: `src/lib/expediente` esconde
 * `antibiograma/`, `laboratorio/` y `cardiometabolico/` en subdirectorios, y un
 * `readdir` plano dejaría fuera el motor de antibiograma entero dando un verde
 * falso. Mismo patrón de guardián que log-secrets-guard / firestore-rules-guard.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { resolve, join, relative, sep } from 'node:path'
import {
  CLINICAL_ENGINE_REGISTRY, archivosDelMotor, subMotorIds,
} from '@/lib/clinical/registry'
import {
  DIRECTORIOS_CLINICOS, MODULOS_NO_MOTOR, DOCS_NO_ADR,
  SENAL_DURA_VERSION, SENAL_DURA_EXPORT, SENAL_DEBIL_VERSION,
} from '@/lib/clinical/cobertura'
import { CALCULADORAS } from '@/lib/expediente/calculadoras'

const RAIZ = process.cwd()

/** Ruta relativa a la raíz del repo, siempre con '/' (el registro usa POSIX). */
const rel = (p: string): string => relative(RAIZ, p).split(sep).join('/')

/** Recorre un directorio RECURSIVAMENTE y devuelve sus .ts/.tsx de producción. */
function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { out.push(...walk(p)); continue }
    if (!/\.tsx?$/.test(name)) continue
    if (/\.test\./.test(name) || /\.d\.ts$/.test(name)) continue
    out.push(p)
  }
  return out
}

const ARCHIVOS_CLINICOS = DIRECTORIOS_CLINICOS
  .flatMap(d => walk(resolve(RAIZ, d)))
  .map(rel)
  .sort()

const ARCHIVOS_REGISTRADOS = new Set(CLINICAL_ENGINE_REGISTRY.flatMap(archivosDelMotor))
const ARCHIVOS_NO_MOTOR = new Map(MODULOS_NO_MOTOR.map(m => [m.file, m]))

/** Exports declarados en un archivo (`export const|function|let|class NOMBRE`). */
function exportsDe(file: string): string[] {
  const src = readFileSync(resolve(RAIZ, file), 'utf8')
  return [...src.matchAll(/^export\s+(?:async\s+)?(?:const|function|let|class)\s+([A-Za-z0-9_$]+)/gm)]
    .map(m => m[1])
}

/**
 * Nombres de archivo de TODOS los tests bajo src/__tests__ (incluidos los
 * subdirectorios nucleo/ y evidencia/). No se puede reutilizar `walk`: aquél
 * excluye *.test.* a propósito y aquí interesa justo lo contrario.
 */
function listarTests(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { out.push(...listarTests(p)); continue }
    if (/\.test\.tsx?$/.test(name)) out.push(name)
  }
  return out
}
const NOMBRES_TEST = new Set(listarTests(resolve(RAIZ, 'src/__tests__')))

const DIR_ADR = 'docs/clinical-decisions'

/** Encabezados que todo ADR de motor debe traer (E0-03 §4.6). */
const ENCABEZADOS_ADR = [
  'por qué existe',
  'fuente de verdad única',
  'referencia',
  'unidades',
  'rango válido',
  'redondeo',
  'missing data',
  'golden',
  'estado',
  'fecha',
]

describe('CLINICAL ENGINE REGISTRY · cobertura (gate E0-03)', () => {
  // ── 1. EL GATE ─────────────────────────────────────────────────────────
  it('1 · todo archivo de los directorios clínicos está registrado como motor o justificado como no-motor', () => {
    const huerfanos = ARCHIVOS_CLINICOS.filter(
      f => !ARCHIVOS_REGISTRADOS.has(f) && !ARCHIVOS_NO_MOTOR.has(f),
    )
    expect(
      huerfanos,
      `motor sin registrar:\n${huerfanos.map(f => `  ${f} — regístralo en registry.ts o justifícalo en MODULOS_NO_MOTOR`).join('\n')}`,
    ).toEqual([])
  })

  it('1b · ningún archivo está a la vez registrado como motor y como no-motor', () => {
    const ambos = ARCHIVOS_CLINICOS.filter(f => ARCHIVOS_REGISTRADOS.has(f) && ARCHIVOS_NO_MOTOR.has(f))
    expect(ambos, `clasificación contradictoria: ${ambos.join(', ')}`).toEqual([])
  })

  it('1c · todo módulo no-motor declara un motivo no vacío', () => {
    for (const m of MODULOS_NO_MOTOR) {
      expect(m.motivo.trim(), `${m.file}: motivo vacío`).not.toBe('')
    }
  })

  // ── 2. ANTIFRAUDE de la lista de exclusión ─────────────────────────────
  it('2 · un módulo no-motor no puede esconder señales DURAS de motor', () => {
    const ofensores: string[] = []
    for (const m of MODULOS_NO_MOTOR) {
      if (!existsSync(resolve(RAIZ, m.file))) continue // lo reporta la aserción 4
      for (const e of exportsDe(m.file)) {
        if (SENAL_DURA_VERSION.test(e)) ofensores.push(`${m.file} exporta ${e} (versión de MOTOR)`)
        else if (SENAL_DURA_EXPORT.test(e)) ofensores.push(`${m.file} exporta ${e} (calcula)`)
      }
    }
    expect(
      ofensores,
      `motor disfrazado de no-motor — regístralo en registry.ts:\n${ofensores.join('\n')}`,
    ).toEqual([])
  })

  it('2b · un módulo no-motor versionado exige justificación reforzada escrita', () => {
    const faltan: string[] = []
    const sobran: string[] = []
    for (const m of MODULOS_NO_MOTOR) {
      if (!existsSync(resolve(RAIZ, m.file))) continue
      const versionado = exportsDe(m.file).some(e => SENAL_DEBIL_VERSION.test(e))
      if (versionado && !m.senalRevisada?.trim()) faltan.push(m.file)
      if (!versionado && m.senalRevisada) sobran.push(m.file)
    }
    expect(faltan, `exporta *_VERSION sin senalRevisada: ${faltan.join(', ')}`).toEqual([])
    expect(sobran, `senalRevisada innecesaria (no hay señal que revisar): ${sobran.join(', ')}`).toEqual([])
  })

  // ── 3. Catálogo de calculadoras ────────────────────────────────────────
  it('3 · toda escala de CALCULADORAS está en el registro (como motor o como subMotor)', () => {
    const conocidos = new Set([...CLINICAL_ENGINE_REGISTRY.map(m => m.id), ...subMotorIds()])
    const faltan = CALCULADORAS.map(c => c.id).filter(id => !conocidos.has(id))
    expect(faltan, `escala sin registrar en registry.ts: ${faltan.join(', ')}`).toEqual([])
  })

  // ── 4. Sin punteros rotos ──────────────────────────────────────────────
  it('4 · todo archivo citado por el registro y por la lista de no-motor existe en disco', () => {
    const rotos: string[] = []
    for (const m of CLINICAL_ENGINE_REGISTRY) {
      for (const f of archivosDelMotor(m)) {
        if (!f.startsWith('src/lib/')) rotos.push(`${m.id}: ruta fuera de src/lib → ${f}`)
        else if (!existsSync(resolve(RAIZ, f))) rotos.push(`${m.id}: no existe ${f}`)
      }
    }
    for (const m of MODULOS_NO_MOTOR) {
      if (!existsSync(resolve(RAIZ, m.file))) rotos.push(`MODULOS_NO_MOTOR: no existe ${m.file}`)
    }
    expect(rotos, rotos.join('\n')).toEqual([])
  })

  it('4b · todo golden test declarado existe en src/__tests__ y es un nombre de archivo puro', () => {
    const rotos: string[] = []
    for (const m of CLINICAL_ENGINE_REGISTRY) {
      expect(m.goldenTests.length, `${m.id}: sin golden tests`).toBeGreaterThanOrEqual(1)
      for (const t of m.goldenTests) {
        if (!/^[a-z0-9-]+\.test\.tsx?$/.test(t)) rotos.push(`${m.id}: "${t}" no es un nombre de archivo puro (sin comentarios)`)
        else if (!NOMBRES_TEST.has(t)) rotos.push(`${m.id}: el golden test ${t} NO existe en src/__tests__`)
      }
    }
    expect(rotos, rotos.join('\n')).toEqual([])
  })

  // ── 5. ADRs ────────────────────────────────────────────────────────────
  it('5 · todo motor tiene ADR en disco con los encabezados obligatorios', () => {
    const problemas: string[] = []
    for (const m of CLINICAL_ENGINE_REGISTRY) {
      const p = resolve(RAIZ, m.adr)
      if (!m.adr.startsWith(`${DIR_ADR}/`)) { problemas.push(`${m.id}: adr fuera de ${DIR_ADR}`); continue }
      if (!existsSync(p)) { problemas.push(`${m.id}: falta el ADR ${m.adr}`); continue }
      const txt = readFileSync(p, 'utf8')
      const bajo = txt.toLowerCase()
      for (const h of ENCABEZADOS_ADR) {
        if (!bajo.includes(h)) problemas.push(`${m.adr}: falta el encabezado "${h}"`)
      }
      // Anti-deriva: el ADR debe citar el archivo y la versión que dice el registro.
      if (!txt.includes(m.file)) problemas.push(`${m.adr}: no cita su archivo (${m.file})`)
      if (!txt.includes(m.version)) problemas.push(`${m.adr}: no cita su versión (${m.version})`)
    }
    expect(problemas, problemas.join('\n')).toEqual([])
  })

  it('5b · no hay ADRs huérfanos y el índice del README los lista todos', () => {
    const referenciados = new Set(
      CLINICAL_ENGINE_REGISTRY.flatMap(m => [m.adr, ...(m.adrExtra ?? [])]),
    )
    const enDisco = readdirSync(resolve(RAIZ, DIR_ADR))
      .filter(n => n.endsWith('.md') && !(DOCS_NO_ADR as readonly string[]).includes(n))
      .map(n => `${DIR_ADR}/${n}`)

    const huerfanos = enDisco.filter(p => !referenciados.has(p))
    expect(huerfanos, `ADR sin motor que lo reclame: ${huerfanos.join(', ')}`).toEqual([])

    const readme = readFileSync(resolve(RAIZ, DIR_ADR, 'README.md'), 'utf8')
    const sinIndexar = enDisco
      .map(p => p.slice(DIR_ADR.length + 1))
      .filter(n => !readme.includes(`(${n})`))
    expect(sinIndexar, `ADR no enlazado desde el README: ${sinIndexar.join(', ')}`).toEqual([])
  })

  // ── 6. Rango válido ────────────────────────────────────────────────────
  it('6 · todo motor declara rango válido, o la pregunta pendiente al médico', () => {
    for (const m of CLINICAL_ENGINE_REGISTRY) {
      const r = m.rangoValido
      if (r.fuente === 'pendiente_validacion_clinica') {
        expect(r.preguntaAlMedico.trim(), `${m.id}: pendiente sin pregunta escrita`).not.toBe('')
        expect(r.preguntaAlMedico.length, `${m.id}: la pregunta al médico es demasiado vaga`).toBeGreaterThan(30)
      } else {
        expect(r.entrada.trim(), `${m.id}: rango de entrada vacío`).not.toBe('')
        expect(r.salida.trim(), `${m.id}: rango de salida vacío`).not.toBe('')
        expect(r.ref.trim(), `${m.id}: rango sin referencia`).not.toBe('')
      }
      expect(m.missingData.trim(), `${m.id}: no declara qué hace si falta un dato`).not.toBe('')
      expect(m.porQueExiste.trim(), `${m.id}: no declara por qué existe`).not.toBe('')
    }
  })
})
