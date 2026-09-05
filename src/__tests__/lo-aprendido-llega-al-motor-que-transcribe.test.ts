/**
 * GOLDEN — lo aprendido llegaba a los motores de repuesto y NO al que transcribe.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * LEARN (v1023) metió las palabras que el médico corrige en el léxico de las
 * rutas de Whisper. Pero en una consulta grabada **la diarización se intenta
 * primero**, y Whisper es el repuesto: el archivo de la ruta lo dice desde la
 * v981, cuando este mismo fallo se reparó para los fármacos del paciente.
 *
 * Así que el trabajo de dos versiones —lo único del vocabulario ganado con
 * evidencia sobre ESTE médico— llegaba al motor que casi nunca corre. Lo mismo
 * con `especialidades` (v1022): la ruta ni siquiera leía el campo, aunque
 * `ContextoSesgo.especialidad` estaba declarado y `componerSesgo` lo ordenaba.
 *
 * Es la misma clase de fallo que este repositorio lleva persiguiendo todo el
 * año: **escrito, probado y sin conectar**. No falla, no rompe ninguna prueba y
 * no se nota — sale una transcripción normal con la palabra de siempre mal
 * escrita.
 *
 * ── POR QUÉ IMPORTA MÁS AQUÍ QUE EN NINGÚN OTRO SITIO ────────────────────────
 *
 * El sesgo es lo ÚNICO que cambia lo que el motor OYE. El corrector, el guardián
 * y las marcas de confianza trabajan sobre lo ya oído: ninguno puede recuperar
 * una palabra que nunca llegó.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLAVES_DE_SESGO_DEL_PACIENTE } from '@/hooks/useGrabacionAudio'
import { componerSesgo } from '@/lib/asr/sesgo-diarizado'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'expediente', 'transcribir-diarizado', 'route.ts')
const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')

describe('EL MOTOR DE SESGO ACEPTA LO APRENDIDO', () => {
  it('una palabra aprendida entra en la lista que se le manda al proveedor', () => {
    const s = componerSesgo({ aprendidas: ['ceftriaxona'] }, [])
    expect(s.terminos).toContain('ceftriaxona')
  })

  it('y va DESPUÉS de lo del paciente, que es la política de este módulo', () => {
    /**
     * No contradice al léxico, donde lo aprendido va primero: allí caben 224
     * tokens y aquí 1 000, así que los dos entran y el orden sólo decide el
     * margen. En ese margen manda lo que el paciente está tomando ahora mismo.
     */
    const s = componerSesgo({ medicamentos: ['meropenem'], aprendidas: ['ceftriaxona'] }, [])
    expect(s.terminos.indexOf('meropenem')).toBeLessThan(s.terminos.indexOf('ceftriaxona'))
  })

  it('y ANTES del catálogo global, que es sólo relleno', () => {
    const s = componerSesgo({ aprendidas: ['ceftriaxona'] }, ['paracetamol'])
    expect(s.terminos.indexOf('ceftriaxona')).toBeLessThan(s.terminos.indexOf('paracetamol'))
  })

  it('lo aprendido NO cuenta como término del paciente', () => {
    // `delPaciente` es la cifra con la que se mide si el expediente está
    // sesgando de verdad. Inflarla con vocabulario del consultorio la volvería
    // una medición falsa de lo que más se presume.
    const s = componerSesgo({ medicamentos: ['meropenem'], aprendidas: ['ceftriaxona'] }, [])
    expect(s.delPaciente).toBe(1)
  })

  it('sin nada aprendido el sesgo es idéntico al de antes', () => {
    // Garantía de que esto sólo puede añadir.
    const a = componerSesgo({ medicamentos: ['meropenem'] }, ['paracetamol'])
    const b = componerSesgo({ medicamentos: ['meropenem'], aprendidas: [] }, ['paracetamol'])
    expect(b.terminos).toEqual(a.terminos)
  })
})

describe('LA RUTA QUE DE VERDAD TRANSCRIBE LO LEE', () => {
  it('en los DOS caminos: el corto (multipart) y el largo (JSON)', () => {
    /**
     * La consulta larga —la que más términos trae— sube el audio a Storage y
     * manda JSON. Cablear sólo uno de los dos dejaría sin sesgo justo a la
     * consulta más difícil, que es lo que ya pasó una vez con los fármacos.
     */
    expect(ruta).toContain('aprendidas: comoLista(body?.aprendidas)')
    expect(ruta).toContain("aprendidas: comoLista(formData.get('aprendidas'))")
  })

  it('y la especialidad, que estaba declarada en el contrato y nadie llenaba', () => {
    expect(ruta).toContain('especialidad: comoLista(body?.especialidades)')
    expect(ruta).toContain("especialidad: comoLista(formData.get('especialidades'))")
  })
})

describe('Y EL HOOK LAS MANDA POR LOS DOS CAMINOS', () => {
  // REG-513: los dos caminos recorren la MISMA lista que los de Whisper.
  it('la lista compartida lleva lo aprendido y la especialidad', () => {
    expect(CLAVES_DE_SESGO_DEL_PACIENTE).toContain('aprendidas')
    expect(CLAVES_DE_SESGO_DEL_PACIENTE).toContain('especialidades')
  })

  it('el camino corto', () => {
    expect(hook).toContain('anexarSesgoDelPaciente(fd, ctx)')
  })

  it('el camino largo', () => {
    expect(hook).toContain('...sesgoDelPacienteComoJson(ctx)')
  })
})

describe('UCI TAMBIÉN, QUE ES DONDE MÁS FÁRMACOS HAY', () => {
  const uci = leer('src', 'app', '(dashboard)', 'uci', 'page.tsx')

  it('lee el vocabulario del consultorio', () => {
    /**
     * Se puede porque desde la v1024 lo aprendido es del CONSULTORIO: en el pase
     * de visita no hay un expediente de consulta del que derivarlo, y con el
     * modelo anterior UCI se habría quedado fuera para siempre.
     */
    expect(uci).toContain('leerAprendido(clinicId)')
    expect(uci).toContain('setAprendidoUci(l.map(a => a.palabra))')
  })

  it('y lo manda en las opciones del dictado, con su dependencia', () => {
    // Sin la dependencia, el memo se congela y lo aprendido no entraría hasta
    // recargar la pantalla.
    expect(uci).toContain('aprendidas: aprendidoUci')
    expect(uci).toMatch(/config\?\.especialidad, aprendidoUci\]/)
  })

  it('y si no se puede leer, el pase sigue igual', () => {
    expect(uci).toMatch(/\.catch\(\(\) => \{\}\)\s*\/\/ es un extra: nunca puede estorbar al pase/)
  })
})
