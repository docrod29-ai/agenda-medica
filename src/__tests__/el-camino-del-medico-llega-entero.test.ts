/**
 * EL CAMINO DEL MÉDICO LLEGA ENTERO.
 *
 * Trinquete de alcance desde src/app. No prueba comportamiento; prueba cableado.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { alcanzableDesdeLaApp } from '@/lib/arquitectura/grafo-de-dependencias'

const RAIZ = process.cwd()
const DOC = join(RAIZ, 'docs/product/EL-CAMINO-DEL-MEDICO.md')

const EL_CAMINO: ReadonlyArray<{ paso: string; hace: string; modulos: readonly string[] }> = [
  { paso: '1 · Escuchar', hace: 'El médico habla y el paciente contesta; el audio se transcribe y se separa por hablante.', modulos: ['src/lib/expediente/confianza-audio.ts','src/lib/expediente/motivo-sin-diarizacion.ts','src/lib/asr/especialidad-del-medico.ts'] },
  { paso: '2 · Entender lo dicho', hace: 'Distinguir lo que se niega de lo que se afirma, y lo que pasó de lo que pasa hoy.', modulos: ['src/lib/expediente/negaciones.ts','src/lib/expediente/temporalidad.ts','src/lib/expediente/hueco-textual.ts'] },
  { paso: '3 · Extraer sin inventar', hace: 'Convertir la conversación en datos, dejando vacío lo que nadie dijo.', modulos: ['src/lib/expediente/medical-ner.ts','src/lib/expediente/procedencia.ts','src/lib/expediente/via-asumida.ts'] },
  { paso: '4 · Ver al paciente entero', hace: 'Los motores reciben el cuadro completo, no sólo lo de hoy (REG-188).', modulos: ['src/lib/expediente/cuadro-completo.ts','src/lib/expediente/problemas-activos.ts'] },
  { paso: '5 · Avisar antes de firmar', hace: 'Una sola barra, tres niveles, y lo que no se pliega no se pliega.', modulos: ['src/lib/expediente/avisos-consulta.ts','src/lib/seguridad/dosis-de-la-lista.ts','src/components/AntesDeFirmar.tsx'] },
  { paso: '6 · Poder corregir', hace: 'Quitar de la nota tiene que quitar de la nota (REG-198).', modulos: ['src/lib/expediente/quitar-de-la-nota.ts','src/components/RevisionPanel.tsx'] },
  { paso: '7 · Firmar, o saber por qué no', hace: 'El botón apagado dice su motivo; la firma sella lo firmado.', modulos: ['src/lib/expediente/por-que-no-se-firma.ts','src/lib/expediente/nom004.ts','src/lib/expediente/integrity.ts'] },
]

// Baseline V15 = 29. Product cores are intentionally built/tested before their
// UI/provider integration. They are explicit, temporary islands for active slices
// rather than silently raising the guard without a named reason.
const FUERA_DEL_CAMINO_HOY = 32
const ISLAS_DE_DOS: Readonly<Record<string, string>> = {
  'src/lib/clinica/simulacro.ts': 'simulacro de restauración; lo usa material que tampoco corre en producción',
  'src/lib/compliance/country-profiles.ts': 'lo importa compliance/policy.ts, que ya está declarado huérfano',
  'src/lib/uci/benchmark-metricas.ts': 'lo importa uci/benchmark.ts, que ya está declarado huérfano',
  'src/lib/clinical-truth/index.ts': 'DOCUMENTATION ENGINE: núcleo Clinical Truth probado antes de conectarlo al renderer/flujo; debe salir de esta lista al integrar el slice.',
  'src/lib/voice-engine/index.ts': 'VOICE ENGINE: contrato provider-neutral probado antes de conectar captura/proveedor/UI; debe salir de esta lista al integrar el slice.',
  'src/lib/clinical-reasoning/index.ts': 'CLINICAL REASONING + EVIDENCE + SAFETY: envelope canónico probado antes de conectarlo a la UI/Copilot; debe salir de esta lista al integrar el slice.',
}

describe('el camino del médico llega entero', () => {
  const alcanzables = alcanzableDesdeLaApp()
  it('el lector funciona (si no, todo lo de abajo pasaría por vacío)', () => { expect(alcanzables.size).toBeGreaterThan(300); expect(alcanzables.has('src/lib/expediente/firestore.ts')).toBe(true) })
  it('el pipeline de voz diferido sigue EN el camino (p ??= import)', () => { expect(alcanzables.has('src/lib/asr/pipeline.ts')).toBe(true) })
  it('el documento del camino existe', () => { expect(existsSync(DOC)).toBe(true) })
  it('son siete pasos y ninguno está vacío', () => { expect(EL_CAMINO).toHaveLength(7); for (const p of EL_CAMINO) { expect(p.modulos.length).toBeGreaterThan(0); expect(p.hace.length).toBeGreaterThan(30) } })
  it.each(EL_CAMINO)('$paso — sus módulos existen', ({ modulos }) => { expect(modulos.filter(m => !existsSync(join(RAIZ,m)))).toEqual([]) })
  it.each(EL_CAMINO)('$paso — se llega desde la app', ({ paso, modulos }) => { const desconectados=modulos.filter(m=>!alcanzables.has(m)); expect(desconectados,`${paso}: fuera del camino → ${desconectados.join(', ')}`).toEqual([]) })
  it('el documento nombra los siete pasos', () => { const t=readFileSync(DOC,'utf8'); for(const p of EL_CAMINO) expect(t).toContain(p.paso) })
  it('los módulos fuera del camino no aumentan', () => { const libs:string[]=[]; const anda=(d:string)=>{ for(const e of readdirSync(join(RAIZ,d))){ if(e==='__tests__') continue; const rel=`${d}/${e}`; if(statSync(join(RAIZ,rel)).isDirectory()) anda(rel); else if(/\.tsx?$/.test(e)) libs.push(rel) } }; anda('src/lib'); anda('src/components'); const fuera=libs.filter(f=>!alcanzables.has(f)); expect(fuera.length,`subió a ${fuera.length}. Los nuevos:\n  ${fuera.filter(f=>!ISLAS_DE_DOS[f]).slice(0,12).join('\n  ')}`).toBeLessThanOrEqual(FUERA_DEL_CAMINO_HOY); expect(fuera.filter(f=>!ISLAS_DE_DOS[f]).length, 'toda isla nueva debe declararse con motivo').toBeLessThanOrEqual(FUERA_DEL_CAMINO_HOY - Object.keys(ISLAS_DE_DOS).length) })
  it('las islas declaradas siguen existiendo', () => { for(const f of Object.keys(ISLAS_DE_DOS)) expect(existsSync(join(RAIZ,f)),`${f} ya no existe: quítalo de la lista`).toBe(true) })
  it('el documento dice qué NO prueba esto', () => { const t=readFileSync(DOC,'utf8'); expect(t).toContain('que el cable existe'); expect(t).toContain('llegaban tarde') })
})
