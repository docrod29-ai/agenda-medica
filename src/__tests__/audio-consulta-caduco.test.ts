/**
 * GOLDEN — el audio de la consulta ya no se queda en Storage para siempre.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * Para diarizar una consulta larga, el audio —la conversación entera entre el
 * médico y el paciente, PHI en crudo— se sube a `consultas-audio/{uid}/…`, se le
 * pasa la URL a AssemblyAI y se borra en el `finally` del hook.
 *
 * Ese `finally` **sólo corre si el navegador sigue vivo**, y la espera es de
 * hasta seis minutos de sondeo. Cerrar la pestaña, quedarse sin batería, perder
 * la red o irse a otra pantalla dejaba el archivo en el bucket para siempre.
 *
 * ── Y LA PROMESA QUE NADIE CUMPLÍA ───────────────────────────────────────────
 *
 * Cuando el borrado fallaba, el código lo decía así:
 *
 *     catch { /* lifecycle rule lo limpia *\/ }
 *
 * Una regla de ciclo de vida es **configuración del bucket**, no código. Nada en
 * este repositorio la declara y nadie la había creado: el comentario la daba por
 * hecha.
 *
 * Es el patrón más caro de todos —una regla escrita en un comentario que el
 * código de al lado no cumple— y aquí la promesa incumplida era «no dejamos
 * PHI».
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  esAudioDeConsulta, fechaEnNombre, veredicto, PREFIJO_AUDIO, HORAS_DE_VIDA,
  POR_QUE_NO_BASTA_EL_FINALLY,
} from '@/lib/expediente/audio-caduco'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const AHORA = Date.parse('2026-08-03T12:00:00.000Z')
const hace = (h: number) => new Date(AHORA - h * 3_600_000).toISOString()

describe('qué se considera audio de consulta', () => {
  it('lo que cuelga del prefijo', () => {
    expect(esAudioDeConsulta(`${PREFIJO_AUDIO}uid123/clave-1754200000000.webm`)).toBe(true)
  })

  it('y NADA más del bucket', () => {
    // La firma y el membrete del médico viven en `receta-diseno/` y no caducan.
    expect(esAudioDeConsulta('receta-diseno/uid123/firma.png')).toBe(false)
    expect(esAudioDeConsulta('consultas-audio')).toBe(false)
    // Sin la barra final, un prefijo parecido entraría en el barrido.
    expect(esAudioDeConsulta('consultas-audio-viejo/uid/x.webm')).toBe(false)
  })
})

describe('fechar por el nombre, cuando no hay metadato', () => {
  it('lee la marca que el hook mete al final', () => {
    expect(fechaEnNombre('consultas-audio/u/clave-1754200000000.webm')).toBe(1754200000000)
  })

  it('descarta números que no son un instante razonable', () => {
    // Adivinar mal aquí significa borrar algo recién subido.
    expect(fechaEnNombre('consultas-audio/u/x-1111111111111.webm')).toBeNull()
    expect(fechaEnNombre('consultas-audio/u/x-9999999999999.webm')).toBeNull()
    expect(fechaEnNombre('consultas-audio/u/sin-marca.webm')).toBeNull()
  })
})

describe('EL CASO QUE SE ROMPÍA: el audio abandonado', () => {
  it('lo que lleva más de 24 h se borra', () => {
    const v = veredicto({ nombre: `${PREFIJO_AUDIO}u/x.webm`, creadoEn: hace(30) }, AHORA)
    expect(v.borrar).toBe(true)
  })

  it('y lo de hace un rato NO', () => {
    // Podría estar transcribiéndose ahora mismo.
    const v = veredicto({ nombre: `${PREFIJO_AUDIO}u/x.webm`, creadoEn: hace(0.2) }, AHORA)
    expect(v.borrar).toBe(false)
    expect(v.porQue).toContain('el corte son 24 h')
  })

  it('el corte es de 24 h, con margen de sobra sobre los 6 min del sondeo', () => {
    expect(HORAS_DE_VIDA).toBe(24)
  })
})

describe('lo que NO se puede fechar, no se borra', () => {
  it('sin metadato ni marca en el nombre', () => {
    /**
     * Borrar ante la duda puede llevarse el audio de una consulta que se está
     * transcribiendo AHORA, y el médico vería su dictado fallar sin explicación.
     * Esperar un ciclo no cuesta nada.
     */
    const v = veredicto({ nombre: `${PREFIJO_AUDIO}u/sin-fecha.webm`, creadoEn: null }, AHORA)
    expect(v.borrar).toBe(false)
    expect(v.porQue).toMatch(/ante la duda no se borra/i)
  })

  it('con un metadato ilegible se cae al nombre, no al vacío', () => {
    const v = veredicto(
      { nombre: `${PREFIJO_AUDIO}u/x-1754200000000.webm`, creadoEn: 'no es una fecha' }, AHORA)
    expect(v.borrar).toBe(true)
  })

  it('una fecha en el FUTURO no cuenta como caducada', () => {
    // Reloj desajustado: restar daría negativo, y eso no es «viejo», es «no sé».
    const v = veredicto({ nombre: `${PREFIJO_AUDIO}u/x.webm`, creadoEn: hace(-5) }, AHORA)
    expect(v.borrar).toBe(false)
    expect(v.porQue).toMatch(/futuro/i)
  })

  it('y nunca toca otro prefijo, por viejo que sea', () => {
    const v = veredicto({ nombre: 'receta-diseno/u/firma.png', creadoEn: hace(9000) }, AHORA)
    expect(v.borrar).toBe(false)
  })
})

describe('el barrido existe de verdad y está enganchado', () => {
  const ruta = leer('src', 'app', 'api', 'cron', 'limpiar-audio', 'route.ts')
  const vercel = JSON.parse(leer('vercel.json'))

  it('el cron está registrado en Vercel', () => {
    // Una ruta de cron sin entrada en vercel.json no la dispara nadie: sería
    // otro módulo escrito y sin conectar.
    const paths = (vercel.crons ?? []).map((c: { path: string }) => c.path)
    expect(paths).toContain('/api/cron/limpiar-audio')
  })

  it('con el mismo candado fail-closed que el otro cron', () => {
    // Un endpoint que BORRA no puede quedar abierto si falta el secreto.
    expect(ruta).toContain("if (!CRON_SECRET)")
    expect(ruta).toContain("CRON_SECRET no configurado (fail-closed)")
    expect(ruta).toContain('`Bearer ${CRON_SECRET}`')
  })

  it('sólo mira el prefijo del audio', () => {
    expect(ruta).toContain('getFiles({ prefix: PREFIJO_AUDIO')
  })

  it('«no pude mirar» no se responde como «no había nada»', () => {
    // Los dos se leen igual desde fuera, y sólo uno significa que hay PHI
    // esperando.
    expect(ruta).toContain('no configurado: el barrido no puede mirar el bucket')
    expect(ruta).toContain('status: 503')
  })

  it('y declara cuando quedó trabajo para el siguiente barrido', () => {
    expect(ruta).toContain('hayMas')
  })

  it('no mete el nombre del objeto en el registro', () => {
    // `consultas-audio/{uid}/{clave}`: la clave de recuperación identifica una
    // consulta.
    const i = ruta.indexOf('no se pudo borrar un objeto caducado')
    expect(ruta.slice(i - 100, i + 100)).not.toContain('o.name')
  })
})

describe('la promesa del comentario ya no está sola', () => {
  const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')

  it('el `finally` sigue siendo lo primero, y se explica por qué no basta', () => {
    expect(hook).toContain('await deleteObject(objRef)')
    expect(hook).toContain('sólo corre si la pestaña sigue abierta')
  })

  it('ya no dice que una regla de ciclo de vida lo limpia', () => {
    // Nadie la había creado. Ahora apunta al barrido, que sí existe en el repo.
    const codigo = hook.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(codigo).not.toContain('lifecycle rule lo limpia')
    expect(hook).toContain('api/cron/limpiar-audio')
  })

  it('está escrito por qué el `finally` no bastaba', () => {
    expect(POR_QUE_NO_BASTA_EL_FINALLY).toMatch(/pestaña sigue abierta/i)
    expect(POR_QUE_NO_BASTA_EL_FINALLY).toMatch(/nadie había creado/i)
  })
})
