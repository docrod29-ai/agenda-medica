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
const FUERA_DEL_CAMINO_HOY = 33
const ISLAS_DE_DOS: Readonly<Record<string, string>> = {
  'src/lib/clinica/simulacro.ts': 'simulacro de restauración; lo usa material que tampoco corre en producción',
  'src/lib/compliance/country-profiles.ts': 'lo importa compliance/policy.ts, que ya está declarado huérfano',
  'src/lib/uci/benchmark-metricas.ts': 'lo importa uci/benchmark.ts, que ya está declarado huérfano',
  /**
   * `clinical-truth/index.ts` SALIÓ de esta lista, y ésa era su instrucción: su
   * propia entrada decía «debe salir al integrar el slice». Ya se integró — el
   * grafo lo alcanza desde la app— así que dejarlo aquí declararía isla algo que
   * ya está en el camino, y el conteo de este trinquete dejaría de significar lo
   * que dice.
   */
  'src/lib/voice-engine/index.ts': 'VOICE ENGINE: contrato provider-neutral probado antes de conectar captura/proveedor/UI; debe salir de esta lista al integrar el slice.',
  /**
   * REG-390. No es código que corra en el camino del médico: es la POLÍTICA de
   * qué operación puede diferirse y cuál no, escrita para que su guardián la
   * vigile. Su consumidor es ese guardián, y vive en el CI por definición —
   * exactamente como el censo del programa (REG-382).
   */
  'src/lib/ops/lo-sincrono-y-lo-encolado.ts': 'POLÍTICA de desacoplamiento: la consume su guardián en el CI, no una pantalla. Pintarla no la conectaría a nada.',
  /**
   * REG-382. El censo del programa: su lector es el guardián que lo sella. Igual
   * que la política de arriba, vive en el CI por definición — y por la misma
   * razón, que es la que lo hizo existir: lo que sólo se mira en una pantalla se
   * deja de mirar.
   */
  'src/lib/programa/requisitos.ts': 'CENSO del programa: lo consume el guardián que lo sella, en el CI. Una pantalla que lo pintara sería una pantalla que alguien deja de mirar.',
  /**
   * TR-VOZ. Mide una transcripción CONTRA SU GOLD, y en una consulta de verdad
   * no hay gold: si lo hubiera, no haría falta transcribir. Es evaluación, y la
   * evaluación no corre en el camino del médico por definición — la misma razón
   * por la que `uci/benchmark-metricas.ts` está tres líneas más arriba.
   *
   * Su consumidor real es `scripts/medir-wer-limpio.ts`, que necesita el corpus
   * de 6 000 audios y por eso no vive en el CI.
   */
  'src/lib/asr/lo-que-pesa-de-un-error.ts': 'EVALUACIÓN de voz: compara contra un gold, y en consulta no hay gold. Lo consume scripts/medir-wer-limpio.ts, que necesita el corpus del dueño.',
}

describe('el camino del médico llega entero', () => {
  const alcanzables = alcanzableDesdeLaApp()
  it('el lector funciona (si no, todo lo de abajo pasaría por vacío)', () => { expect(alcanzables.size).toBeGreaterThan(300); expect(alcanzables.has('src/lib/expediente/firestore.ts')).toBe(true) })
  it('el pipeline de voz diferido sigue EN el camino (p ??= import)', () => { expect(alcanzables.has('src/lib/asr/pipeline.ts')).toBe(true) })
  it('Clinical Reasoning ya no es una isla: la ruta real de consulta alcanza el bridge y el envelope', () => {
    expect(alcanzables.has('src/lib/expediente/reasoning-workflow.ts')).toBe(true)
    expect(alcanzables.has('src/lib/clinical-reasoning/index.ts')).toBe(true)
  })
  it('el documento del camino existe', () => { expect(existsSync(DOC)).toBe(true) })
  it('son siete pasos y ninguno está vacío', () => { expect(EL_CAMINO).toHaveLength(7); for(const p of EL_CAMINO){ expect(p.modulos.length).toBeGreaterThan(0); expect(p.hace.length).toBeGreaterThan(30) } })
  it.each(EL_CAMINO)('$paso — sus módulos existen', ({ modulos }) => { expect(modulos.filter(m => !existsSync(join(RAIZ,m)))).toEqual([]) })
  it.each(EL_CAMINO)('$paso — se llega desde la app', ({ paso, modulos }) => { const desconectados=modulos.filter(m=>!alcanzables.has(m)); expect(desconectados,`${paso}: fuera del camino → ${desconectados.join(', ')}`).toEqual([]) })
  it('el documento nombra los siete pasos', () => { const t=readFileSync(DOC,'utf8'); for(const p of EL_CAMINO) expect(t).toContain(p.paso) })
  it('los módulos fuera del camino no aumentan', () => { const libs:string[]=[]; const anda=(d:string)=>{ for(const e of readdirSync(join(RAIZ,d))){ if(e==='__tests__') continue; const rel=`${d}/${e}`; if(statSync(join(RAIZ,rel)).isDirectory()) anda(rel); else if(/\.tsx?$/.test(e)) libs.push(rel) } }; anda('src/lib'); anda('src/components'); const fuera=libs.filter(f=>!alcanzables.has(f)); expect(fuera.length,`subió a ${fuera.length}. Los nuevos:\n  ${fuera.filter(f=>!ISLAS_DE_DOS[f]).slice(0,12).join('\n  ')}`).toBeLessThanOrEqual(FUERA_DEL_CAMINO_HOY); expect(fuera.filter(f=>!ISLAS_DE_DOS[f]).length, 'toda isla nueva debe declararse con motivo').toBeLessThanOrEqual(FUERA_DEL_CAMINO_HOY - Object.keys(ISLAS_DE_DOS).length) })
  it('las islas declaradas siguen existiendo', () => { for(const f of Object.keys(ISLAS_DE_DOS)) expect(existsSync(join(RAIZ,f)),`${f} ya no existe: quítalo de la lista`).toBe(true) })
  it('el documento dice qué NO prueba esto', () => { const t=readFileSync(DOC,'utf8'); expect(t).toContain('que el cable existe'); expect(t).toContain('llegaban tarde') })
})
