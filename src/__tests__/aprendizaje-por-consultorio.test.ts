/**
 * GOLDEN — LEARN, segunda iteración: lo aprendido con un paciente sirve con el
 * siguiente, y el médico puede quitárselo.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * La primera iteración derivaba las correcciones de **las notas de ese
 * paciente**. Funcionaba, pero el médico corregía «sefriaxona» en la consulta de
 * don Luis y con la siguiente paciente el motor volvía a equivocarse: lo
 * aprendido no cruzaba de expediente.
 *
 * ── LAS DOS COSAS QUE ESTA VERSIÓN AÑADE ─────────────────────────────────────
 *
 * 1. **Se acumula por consultorio**, que es donde de verdad sirve.
 * 2. **Se puede olvidar.** Un aprendizaje que no se puede deshacer es peor que
 *    no aprender: si el sistema se queda con una palabra torcida, la estaría
 *    empujando en cada consulta sin que nadie pueda pararlo.
 *
 * ── Y LA QUE MÁS IMPORTA: NUNCA EL NOMBRE DEL PACIENTE ───────────────────────
 *
 * Lo aprendido se guarda por consultorio y sirve con **todos** los pacientes. Si
 * un apellido dictado entrara ahí, el nombre de una persona acabaría en un
 * vocabulario compartido que ella nunca autorizó — y encima sesgando el
 * reconocedor en la consulta de otra. El filtro de «una palabra sin cifras» no
 * lo impide: un apellido lo pasa. Se excluye explícitamente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  esAprendible, paresDeUnaNota, partesDelNombre, fusionar, POR_QUE_NUNCA_EL_NOMBRE,
} from '@/lib/asr/aprendizaje'
import { idDePalabra, POR_QUE_SE_ACUMULA_CON_INCREMENT, POR_QUE_FALLA_EN_SILENCIO } from '@/lib/asr/aprendizaje-firestore'
import { MATRIZ_ACCESO } from '@/lib/authz/matriz-acceso'
import { COLECCIONES } from '@/lib/clinica/respaldo'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('NUNCA EL NOMBRE DEL PACIENTE', () => {
  it('un apellido corregido NO se aprende', () => {
    const excluir = partesDelNombre('Luis Ramírez Soto')
    expect(paresDeUnaNota('el paciente ramires refiere tos', 'el paciente Ramírez refiere tos', excluir)).toEqual([])
  })

  it('pero un fármaco en la misma nota SÍ', () => {
    // El filtro es quirúrgico: excluye el nombre, no la consulta entera.
    const excluir = partesDelNombre('Luis Ramírez Soto')
    const r = paresDeUnaNota('le doy sefriaxona hoy', 'le doy ceftriaxona hoy', excluir)
    expect(r).toEqual([{ oido: 'sefriaxona', corregido: 'ceftriaxona' }])
  })

  it('las partículas cortas del nombre no bloquean vocabulario', () => {
    // «de», «la» o «y» no identifican a nadie, y excluirlas dejaría fuera
    // palabras clínicas normales.
    expect(partesDelNombre('María de la Luz')).toEqual(['María', 'Luz'])
  })

  it('sin nombre no se excluye nada', () => {
    expect(partesDelNombre(undefined)).toEqual([])
    expect(esAprendible({ oido: 'sefriaxona', corregido: 'ceftriaxona' }, [])).toBe(true)
  })

  it('está escrito por qué', () => {
    expect(POR_QUE_NUNCA_EL_NOMBRE).toMatch(/nunca autorizó/)
  })
})

describe('LAS DOS LISTAS SE FUSIONAN SIN PERDER LA CUENTA', () => {
  it('la misma palabra suma sus repeticiones', () => {
    const r = fusionar(
      [{ palabra: 'ceftriaxona', veces: 2, oidoComo: ['sefriaxona'] }],
      [{ palabra: 'ceftriaxona', veces: 3, oidoComo: ['seftriaxona'] }],
    )
    expect(r).toHaveLength(1)
    expect(r[0].veces).toBe(5)
    expect(r[0].oidoComo.sort()).toEqual(['sefriaxona', 'seftriaxona'])
  })

  it('la más corregida queda arriba', () => {
    // Si el presupuesto de 224 tokens se queda corto, entra primero lo que el
    // médico corrige más.
    const r = fusionar(
      [{ palabra: 'metformina', veces: 2, oidoComo: [] }],
      [{ palabra: 'ceftriaxona', veces: 9, oidoComo: [] }],
    )
    expect(r[0].palabra).toBe('ceftriaxona')
  })

  it('fusionar listas vacías no rompe nada', () => {
    expect(fusionar([], [])).toEqual([])
  })
})

describe('EL IDENTIFICADOR DEL DOCUMENTO', () => {
  it('«Ceftriaxona» y «ceftriaxona» son la MISMA entrada', () => {
    // Si no, el contador se parte en dos y nunca llega al mínimo: el sistema
    // parecería que aprende y no aprendería nunca.
    expect(idDePalabra('Ceftriaxona')).toBe(idDePalabra('ceftriaxona'))
  })

  it('sin acentos, y sin caracteres que rompan una ruta', () => {
    expect(idDePalabra('Amikacina')).toBe('amikacina')
    expect(idDePalabra('a/b')).not.toContain('/')
  })
})

describe('LA COLECCIÓN ESTÁ DECLARADA DONDE TOCA', () => {
  it('en la matriz de acceso, como clínica y sólo para el médico', () => {
    const e = MATRIZ_ACCESO.find(m => m.ruta.includes('asr_aprendizaje'))
    expect(e, 'sin entrada en la matriz de acceso').toBeTruthy()
    expect(e!.guardaLectura).toBe('isMedico')
    expect(e!.guardaEscritura).toBe('isMedico')
  })

  it('y en el manifiesto del respaldo, para que no se quede fuera', () => {
    /**
     * Una colección que nadie respalda se pierde el día que hace falta, y el
     * archivo llamado «respaldo» seguiría pareciendo completo.
     */
    expect(COLECCIONES.some(c => c.ruta === 'asr_aprendizaje')).toBe(true)
  })

  it('las reglas congelan la forma y permiten borrar', () => {
    const reglas = leer('firestore.rules')
    expect(reglas).toContain('match /asr_aprendizaje/{palabra}')
    expect(reglas).toContain('allow read, delete: if isMedico(clinicId)')
    expect(reglas).toMatch(/hasOnly\(\['palabra', 'veces', 'oidoComo', 'actualizadoEn'\]\)/)
  })
})

describe('EL MÉDICO LO VE Y LO PUEDE QUITAR', () => {
  const cfg = leer('src', 'app', '(dashboard)', 'configuracion', 'page.tsx')

  it('hay una pestaña para ello', () => {
    expect(cfg).toContain("{ key: 'dictado', label: 'Palabras que aprendió el dictado', modoMin: 'medico' }")
    expect(cfg).toContain('DictadoAprendidoTab')
  })

  it('con el botón de olvidar, que no es un adorno', () => {
    expect(cfg).toContain('olvidar(clinicId, p.palabra)')
    expect(cfg).toMatch(/Olvidar/)
  })

  it('y dice lo que NO hace', () => {
    // «No reescribe nada» es la promesa que sostiene todo lo demás.
    expect(cfg).toMatch(/No reescribe nada/)
  })
})

describe('SE ACUMULA AL FIRMAR, Y SÓLO LO DE ESTE PACIENTE', () => {
  const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

  it('al firmar, no al guardar el borrador', () => {
    /**
     * El borrador se guarda solo cada pocos segundos: acumular ahí enseñaría de
     * un trabajo a medio escribir, y varias veces.
     */
    expect(page).toContain('void acumular(clinicId, deEstePaciente, new Date().toISOString())')
  })

  it('sólo lo derivado de este paciente, no lo que ya venía del consultorio', () => {
    // Volver a sumar lo ya contado inflaría el contador con cada consulta hasta
    // que cualquier palabra pareciera una costumbre.
    expect(page).toContain('if (deEstePaciente.length > 0)')
  })

  it('y no puede romper ni retrasar la firma', () => {
    expect(POR_QUE_FALLA_EN_SILENCIO).toMatch(/Nunca puede romper la nota/)
  })

  it('se acumula con increment, no con lectura-y-escritura', () => {
    expect(POR_QUE_SE_ACUMULA_CON_INCREMENT).toMatch(/nunca llegaría al mínimo/)
  })
})
