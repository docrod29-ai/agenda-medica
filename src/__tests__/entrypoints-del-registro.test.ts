/**
 * GUARDIÁN — el registro clínico nombraba puertas de entrada que no existían.
 *
 * ── QUÉ ES EL REGISTRO, Y POR QUÉ IMPORTA QUE NO MIENTA ──────────────────────
 *
 * `CLINICAL_ENGINE_REGISTRY` es el documento que dice **qué motores clínicos
 * tiene Ausculta y cómo se llega a ellos**: por cada motor, sus archivos, sus
 * `entryPoints`, su ADR y sus golden. Es lo que lee un auditor, y lo que se
 * enseña cuando alguien pregunta «¿esto qué calcula y dónde?».
 *
 * Un registro con una puerta de entrada que no existe no falla: **certifica**.
 * Nadie lo ejecuta, así que un nombre mal escrito, una función renombrada o un
 * motor partido en dos archivos se quedan ahí años, y el documento sigue
 * pareciendo exacto.
 *
 * ── LO QUE SE ENCONTRÓ AL ESCRIBIRLO ─────────────────────────────────────────
 *
 * De **279** `entryPoints` declarados, **cinco** no estaban en ningún archivo de
 * su motor:
 *
 * · `asr-guardian-sustituciones` → `corregirVigilado` (vive en `corrector-vigilado.ts`)
 * · `dosing-motor` → `buscarFarmaco`, `nombresFarmacos` (viven en `dataset.ts`)
 * · `antimicrobianos-v4` → `resolveDoseRule` (en `resolver.ts`), `buscarFarmaco`
 *   (en `catalogo.ts`)
 *
 * Ninguna estaba perdida: **todas existen**, en un archivo hermano que el motor
 * no declaraba. Se corrigió declarando esos archivos, que es la verdad, en vez de
 * quitar las puertas del registro — quitarlas habría hecho el documento más
 * pequeño y menos cierto.
 *
 * ── LO QUE ESTE GUARDIÁN NO COMPRUEBA ────────────────────────────────────────
 *
 * Si alguien **llama** a esa puerta. Eso es trabajo de `modulos-sin-conectar`,
 * que además acaba de aprender que un `import type` no conecta nada. Aquí sólo
 * se responde una pregunta, la más barata y la que nadie hacía: **¿existe lo que
 * el registro dice que existe?**
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { CLINICAL_ENGINE_REGISTRY, archivosDelMotor } from '@/lib/clinical/registry'

/** ¿Este archivo exporta este símbolo? Cubre las formas que usa el repositorio. */
function exporta(fuente: string, simbolo: string): boolean {
  const decl = new RegExp(`export\\s+(async\\s+)?(function|const|class|interface|type)\\s+${simbolo}\\b`)
  const lista = new RegExp(`export\\s*\\{[^}]*\\b${simbolo}\\b`)
  return decl.test(fuente) || lista.test(fuente)
}

const motores = CLINICAL_ENGINE_REGISTRY.filter(m => (m.entryPoints ?? []).length > 0)

describe('EL REGISTRO NO PUEDE NOMBRAR LO QUE NO EXISTE', () => {
  it('hay motores con puertas declaradas (si no, el guardián sería vacuo)', () => {
    // Un gate que no mira nada pasa siempre y da falsa sensación de cobertura.
    expect(motores.length).toBeGreaterThanOrEqual(20)
  })

  it('todos los archivos declarados por un motor existen en disco', () => {
    const fantasmas: string[] = []
    for (const m of CLINICAL_ENGINE_REGISTRY) {
      for (const f of archivosDelMotor(m)) if (f && !existsSync(f)) fantasmas.push(`${m.id} → ${f}`)
    }
    expect(fantasmas, 'archivos declarados que ya no están').toEqual([])
  })

  for (const m of motores) {
    it(`${m.id} — sus ${(m.entryPoints ?? []).length} puertas existen`, () => {
      const fuentes = archivosDelMotor(m)
        .filter(f => f && existsSync(f))
        .map(f => readFileSync(f, 'utf8'))
      const rotas = (m.entryPoints ?? []).filter(ep => !fuentes.some(src => exporta(src, ep)))
      expect(
        rotas,
        rotas.length
          ? `«${m.id}» declara puertas de entrada que NO exporta ningún archivo suyo: ${rotas.join(', ')}.\n`
            + `Archivos declarados: ${archivosDelMotor(m).join(', ')}.\n`
            + 'Si la función se movió, declara su archivo en `archivos`. Si se '
            + 'renombró, corrige el nombre. Un registro que nombra lo que no '
            + 'existe no falla: CERTIFICA.'
          : '',
      ).toEqual([])
    })
  }
})

describe('EL LECTOR DE EXPORTS', () => {
  it('reconoce función, const, clase, tipo e interfaz', () => {
    for (const [src, s] of [
      ['export function evaluar() {}', 'evaluar'],
      ['export async function resolver() {}', 'resolver'],
      ['export const buscar = () => 1', 'buscar'],
      ['export class Motor {}', 'Motor'],
      ['export interface Regla {}', 'Regla'],
      ['export type Pauta = string', 'Pauta'],
    ] as [string, string][]) {
      expect(exporta(src, s), src).toBe(true)
    }
  })

  it('reconoce la re-exportación en lista', () => {
    // `export { x } from './y'` es como el repositorio expone varios motores.
    expect(exporta("export { recomendar, buscarFarmaco } from './dataset'", 'buscarFarmaco')).toBe(true)
  })

  it('no da por exportado un nombre que sólo se menciona', () => {
    /**
     * Es el falso negativo que haría inútil el guardián: si bastara con que el
     * nombre apareciera, un comentario que lo cita lo daría por bueno — que es
     * exactamente el fallo que ya se pagó en el guardián de huérfanos.
     */
    expect(exporta('// evaluar() se llama desde la pantalla', 'evaluar')).toBe(false)
    expect(exporta('const interno = evaluar()', 'evaluar')).toBe(false)
  })

  it('no confunde un nombre que empieza igual', () => {
    expect(exporta('export function evaluarPanel() {}', 'evaluar')).toBe(false)
  })
})
