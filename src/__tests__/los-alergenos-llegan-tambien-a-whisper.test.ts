import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CLAVES_DE_SESGO_DEL_PACIENTE,
  anexarSesgoDelPaciente,
  sesgoDelPacienteComoJson,
} from '@/hooks/useGrabacionAudio'

/**
 * LOS ALÉRGENOS LLEGAN TAMBIÉN A WHISPER — REG-516.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-232 cerró «los alérgenos se tiraban en el último metro»: la ruta de
 * Whisper no leía `alergias` del formulario. Se arregló la ruta — las dos, la
 * final y la de trozos — y desde entonces leen `alergias` y lo meten al léxico
 * ANTES que los fármacos, porque un alérgeno mal oído es un cruce
 * alergia↔fármaco que nunca salta.
 *
 * Y recibían `[]` siempre. El grabador mandaba `alergias` SÓLO por los dos
 * caminos de AssemblyAI; `anexarContexto` (transcripción final de Whisper) y
 * `flushChunks` (trozos en vivo) llevaban cada uno su lista de cuatro claves,
 * sin `alergias`. Cuatro puntos de envío, cuatro listas escritas a mano, y dos
 * de ellas cortas.
 *
 * Dónde se notaba: en todo dictado que va DIRECTO a Whisper —evolución
 * hospitalaria, pase de UCI (`modoDeHabla: 'dictado'`)— y en toda consulta
 * donde la diarización se cae al repuesto, que es justo el caso para el que el
 * repuesto existe. «Alergia a penicilina» dictado sin la penicilina en el
 * prompt de 224 tokens.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría read-only del pipeline de voz, 5-sep-2026, con la tabla que la
 * regla `voice-asr.md` pide y nadie había dibujado: parámetro de sesgo × motor
 * × camino. Dos celdas vacías. Ésta es la que importa clínicamente.
 *
 * El guardián de REG-232 estaba verde: `expect(h).toContain("['alergias',
 * ctx.alergias]")` — y ese literal aparecía UNA vez en el archivo, en la rama
 * de AssemblyAI. La prueba comprobaba que el código DIJERA alergias y lo
 * encontró dicho en otra función. Familia de REG-506.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * UNA lista (`CLAVES_DE_SESGO_DEL_PACIENTE`) y dos ayudantes exportados que
 * la recorren; los cuatro puntos de envío pasan por ellos. Añadir una clave la
 * lleva a los cuatro, y el guardián de abajo exige que las tres rutas la LEAN.
 * La paridad deja de ser una promesa de comentario y pasa a ser construcción.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con el árbol anterior este archivo no compila (no existía la lista). Para
 * medir el defecto en su forma original se reprodujo la lista de cuatro claves
 * de `anexarContexto` y `flushChunks` sobre un `FormData` real: `alergias`
 * ausente. Con el ayudante compartido: presente, y en las dos rutas de Whisper
 * `leerLista('alergias')` lo recibe.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - `contexto` (el módulo) sigue llegando SÓLO a Whisper; la diarización no lo
 *   lee (`transcribir-diarizado` no tiene el campo). Es la otra celda vacía de
 *   la tabla, declarada aquí y en el ledger, no cerrada.
 * - No mide lo que el motor OYE: eso exige el corpus del dueño (B-01/B-11).
 *   Aquí se mide que el dato SALGA del navegador por los cuatro sitios y que
 *   las rutas lo LEAN.
 * - El guardián de rutas es de fuente (con comentarios quitados). Que
 *   `construirLexicon` lo meta al prompt lo cubre `los-alergenos-llegan-al-
 *   reconocedor`.
 */

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Datos sintéticos. */
const CTX = { alergias: ['penicilina', 'sulfas'], medicamentos: ['metformina'], problemas: [], aprendidas: ['ceftriaxona'] }

describe('REG-516 · una lista para los cuatro puntos de envío', () => {
  it('la lista incluye los alérgenos', () => {
    expect(CLAVES_DE_SESGO_DEL_PACIENTE).toContain('alergias')
  })

  it('EL CASO: el formulario que va a Whisper lleva los alérgenos del expediente', () => {
    const fd = new FormData()
    anexarSesgoDelPaciente(fd, CTX)
    expect(JSON.parse(String(fd.get('alergias')))).toEqual(['penicilina', 'sulfas'])
    expect(JSON.parse(String(fd.get('medicamentos')))).toEqual(['metformina'])
    expect(JSON.parse(String(fd.get('aprendidas')))).toEqual(['ceftriaxona'])
  })

  it('AL REVÉS: la lista de cuatro claves que tenían anexarContexto y flushChunks los perdía', () => {
    // Reproducción literal del defecto, para que el caso de arriba no sea
    // tautológico: el mismo FormData, la lista vieja, y `alergias` no está.
    const fd = new FormData()
    for (const [k, v] of [['aprendidas', CTX.aprendidas], ['especialidades', undefined], ['medicamentos', CTX.medicamentos], ['problemas', CTX.problemas]] as const) {
      if (v && v.length > 0) fd.append(k, JSON.stringify([...v]))
    }
    expect(fd.get('alergias')).toBeNull()
  })

  it('una lista vacía o ausente no se manda (el servidor lee `[]` por omisión y el prompt no gasta tokens en nada)', () => {
    const fd = new FormData()
    anexarSesgoDelPaciente(fd, { problemas: [], medicamentos: undefined })
    expect(fd.get('problemas')).toBeNull()
    expect(fd.get('medicamentos')).toBeNull()
  })

  it('el cuerpo JSON del camino largo lleva las mismas claves, con `undefined` donde no hay nada', () => {
    const j = sesgoDelPacienteComoJson({ alergias: ['penicilina'] })
    expect(Object.keys(j).sort()).toEqual([...CLAVES_DE_SESGO_DEL_PACIENTE].sort())
    expect(j.alergias).toEqual(['penicilina'])
    expect(j.medicamentos).toBeUndefined()
    // Y `JSON.stringify` omite los undefined: el proveedor no recibe `null`.
    expect(JSON.parse(JSON.stringify({ audioUrl: 'x', ...j }))).toEqual({ audioUrl: 'x', alergias: ['penicilina'] })
  })
})

describe('REG-516 · guardián: los cuatro puntos de envío pasan por la lista, y las tres rutas la leen', () => {
  const hook = sinComentarios(leer('src', 'hooks', 'useGrabacionAudio.ts'))

  it('no queda ninguna lista de claves escrita a mano en el grabador', () => {
    // La forma del defecto era un `fd.append(k, JSON.stringify([...v]))` dentro
    // de un bucle con su propia lista. Sólo puede quedar UNO: el del ayudante.
    const apendices = hook.match(/fd\.append\(k, JSON\.stringify\(\[\.\.\.v\]\)\)/g) ?? []
    expect(apendices).toHaveLength(1)
    // Y ninguna lista literal de claves de sesgo fuera de la constante.
    const listasInline = hook.match(/\[\s*'(?:aprendidas|medicamentos|problemas|alergias|especialidades)'\s*,\s*(?:ctx|c|contextoRef\.current)\./g) ?? []
    expect(listasInline).toEqual([])
  })

  it('los tres puntos multipart y el JSON largo usan los ayudantes', () => {
    const multipart = hook.match(/anexarSesgoDelPaciente\(fd, /g) ?? []
    // anexarContexto (Whisper final) · flushChunks (Whisper trozos) · intentarDiarizar (AAI corto)
    expect(multipart.length).toBeGreaterThanOrEqual(3)
    expect(hook).toMatch(/\.\.\.sesgoDelPacienteComoJson\(ctx\)/)
  })

  it('cada clave de la lista la LEE la ruta de Whisper final, la de trozos y la de diarización (por los dos caminos)', () => {
    const whisper = sinComentarios(leer('src', 'app', 'api', 'expediente', 'transcribir', 'route.ts'))
    const trozos = sinComentarios(leer('src', 'app', 'api', 'expediente', 'transcribir-chunk', 'route.ts'))
    const diarizado = sinComentarios(leer('src', 'app', 'api', 'expediente', 'transcribir-diarizado', 'route.ts'))
    const faltan: string[] = []
    for (const k of CLAVES_DE_SESGO_DEL_PACIENTE) {
      if (!whisper.includes(`leerLista('${k}')`)) faltan.push(`transcribir: ${k}`)
      if (!trozos.includes(`leerLista('${k}')`)) faltan.push(`transcribir-chunk: ${k}`)
      if (!diarizado.includes(`formData.get('${k}')`)) faltan.push(`transcribir-diarizado (multipart): ${k}`)
      if (!diarizado.includes(`body?.${k}`)) faltan.push(`transcribir-diarizado (json): ${k}`)
    }
    expect(faltan, 'una clave que el grabador manda y una ruta no lee se tira en el último metro').toEqual([])
  })
})
