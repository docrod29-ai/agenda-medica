/**
 * GOLDEN — la minimización de PHI vive en la puerta, no en cada pantalla.
 *
 * ── DOS REGLAS ESCRITAS EN UN COMENTARIO QUE NADA HACÍA CUMPLIR ──────────────
 *
 * **1. El contexto del paciente.** `api/consultor-evidencia` recibía
 * `contextoPaciente` como **texto libre** del cliente y lo mandaba al proveedor
 * tal cual. Las dos pantallas que lo llaman ya lo minimizaban —una con un
 * comentario que dice, literalmente, «SIN EL NOMBRE… había dos políticas
 * opuestas para el mismo endpoint»—, pero la corrección se aplicó a los
 * **clientes**. Una regla que vive en el cliente sólo la cumplen los clientes
 * que se acuerden: una pantalla nueva, o un cliente modificado, manda lo que
 * quiera.
 *
 * **2. La memoria del médico.** `extraerAprendizajes` le pide a un modelo hechos
 * durables y `aprenderDeMedico` los **persiste**. La cabecera de
 * `memoria-medico.ts` dice «NUNCA datos de pacientes» y lo único que lo
 * respaldaba era una instrucción en el prompt. Un prompt describe una intención;
 * lo que el modelo devolviera se guardaba tal cual, filtrado sólo por longitud.
 *
 * ── LO QUE NO SE PUEDE PROMETER ──────────────────────────────────────────────
 *
 * Nombres propios. «María González» y «monoterapia con vancomicina» son dos
 * cadenas y ninguna regla determinista las distingue sin un diccionario que no
 * existe. Decir que aquí se quitan los nombres cambiaría un riesgo por otro
 * peor: la falsa tranquilidad. Por eso está escrito en el módulo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  redactarIdentificadores, minimizarContextoPaciente, seguroParaMemoria,
  TOPE_CONTEXTO, LO_QUE_NO_DETECTA,
} from '@/lib/ia/minimizar-phi'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('lo que tiene forma propia se quita', () => {
  it('CURP', () => {
    // Sintética: no es de nadie.
    const r = redactarIdentificadores('paciente XEXX010101HNEXXXA4, 40 años')
    expect(r.texto).toContain('[CURP]')
    expect(r.texto).not.toContain('XEXX010101HNEXXXA4')
    expect(r.redactados).toContain('CURP')
  })

  it('correo y teléfono', () => {
    const r = redactarIdentificadores('avisar a prueba@ejemplo.mx o al 55 1234 5678')
    expect(r.texto).toContain('[correo]')
    expect(r.texto).toContain('[teléfono]')
  })

  it('fecha completa — la edad basta para decidir', () => {
    // Una fecha de nacimiento identifica mucho más que «40 años».
    const r = redactarIdentificadores('nacido el 12/03/1985, hipertenso')
    expect(r.texto).toContain('[fecha]')
    expect(r.texto).toContain('hipertenso')
  })

  it('tiras largas de dígitos: folio, expediente, póliza', () => {
    /**
     * Se comprueba que el número DESAPAREZCA, no con qué etiqueta.
     *
     * Un número de diez dígitos es a la vez un teléfono válido y un folio
     * válido: no hay forma de saber cuál es, y no importa — los dos se van. La
     * primera versión de esta prueba exigía la etiqueta `[folio]` y falló
     * porque el patrón de teléfono lo cazó antes: la prueba estaba mal, no el
     * código.
     */
    const diez = redactarIdentificadores('expediente 3049581726, alta ayer')
    expect(diez.texto).not.toContain('3049581726')
    expect(diez.redactados.length).toBeGreaterThan(0)

    // Uno que NO puede confundirse con un teléfono sí sale como folio.
    const largo = redactarIdentificadores('póliza 30495817261234, vigente')
    expect(largo.texto).toContain('[folio]')
  })

  it('y lo CLÍNICO se conserva entero', () => {
    // Redactar de más rompería la respuesta: sin edad, sexo ni alergias el
    // Consultor no puede personalizar nada.
    const r = redactarIdentificadores('68 años, mujer. Alergias: penicilina. ERC KDIGO G4.')
    expect(r.texto).toBe('68 años, mujer. Alergias: penicilina. ERC KDIGO G4.')
    expect(r.redactados).toEqual([])
  })
})

describe('lo que NO se promete', () => {
  it('los nombres propios no se detectan, y está escrito', () => {
    expect(LO_QUE_NO_DETECTA).toMatch(/NO detecta nombres propios/i)
    expect(LO_QUE_NO_DETECTA).toMatch(/falsa tranquilidad/i)
  })

  it('el módulo no finge quitarlos', () => {
    // Si algún día alguien añade una lista de nombres, esta prueba se cae y
    // obliga a revisar la promesa que hace el módulo.
    const r = redactarIdentificadores('María González, 40 años')
    expect(r.texto).toContain('María González')
  })
})

describe('el contexto se minimiza EN LA PUERTA', () => {
  it('la ruta lo aplica sobre lo que llega del cliente', () => {
    const s = leer('src', 'app', 'api', 'consultor-evidencia', 'route.ts')
    expect(s).toContain('minimizarContextoPaciente(body.contextoPaciente)')
    // Ya no se usa el texto crudo del cuerpo.
    expect(s).not.toContain("String(body.contextoPaciente ?? '').trim().slice(0, 1500)")
  })

  it('y deja constancia cuando había identificadores', () => {
    // Un consultorio tiene que poder ver que su equipo está pegando CURPs.
    const s = leer('src', 'app', 'api', 'consultor-evidencia', 'route.ts')
    expect(s).toContain('se redactaron:')
  })

  it('el tope sigue siendo el mismo, y recorta antes de redactar', () => {
    const largo = 'a'.repeat(TOPE_CONTEXTO + 500)
    expect(minimizarContextoPaciente(largo).texto.length).toBe(TOPE_CONTEXTO)
  })

  it('vacío o ausente no revienta', () => {
    expect(minimizarContextoPaciente(undefined).texto).toBe('')
    expect(minimizarContextoPaciente(null).texto).toBe('')
  })
})

describe('la memoria del médico RECHAZA, no redacta', () => {
  it('un hecho sobre la práctica del médico entra', () => {
    expect(seguroParaMemoria('Prefiere esquemas antibióticos cortos')).toBe(true)
  })

  it('un hecho con un identificador dentro NO entra', () => {
    /**
     * Se rechaza en vez de tachar: un hecho al que hay que quitarle un teléfono
     * no era un hecho sobre la práctica del médico, y guardarlo a medias deja
     * una frase rara en la memoria para siempre.
     */
    expect(seguroParaMemoria('El paciente del 55 1234 5678 prefiere consulta vespertina')).toBe(false)
    expect(seguroParaMemoria('Seguimiento del expediente 3049581726')).toBe(false)
  })

  it('se conservan los topes de longitud que ya existían', () => {
    expect(seguroParaMemoria('ok')).toBe(false)
    expect(seguroParaMemoria('x'.repeat(250))).toBe(false)
  })
})

describe('el filtro está en los DOS sitios', () => {
  it('en la ruta, antes de persistir', () => {
    const s = leer('src', 'app', 'api', 'consultor-evidencia', 'route.ts')
    expect(s.match(/f\.filter\(seguroParaMemoria\)/g)?.length).toBe(2)
  })

  it('y en el que escribe, por si mañana lo llama otro', () => {
    // La cabecera de `memoria-medico.ts` promete «NUNCA datos de pacientes»:
    // ahora hay código que lo respalda, no sólo un prompt.
    const s = leer('src', 'lib', 'memoria-medico.ts')
    expect(s).toContain('.filter(seguroParaMemoria)')
  })
})
