/**
 * GOLDEN — REG-323: corregir un teléfono borraba las alergias del paciente.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El editor de `/pacientes` mandaba SIEMPRE el formulario entero a
 * `updatePatient`, incluidos dos campos que esa pantalla casi nunca enseña:
 * `alergias` —oculto tras `{mode === 'medico' && …}`— y `notas`, que no tiene
 * input en ninguna parte del producto. Como `updateDoc` sobrescribe campo por
 * campo, guardar un teléfono desde modo secretaria escribía `alergias: ''`
 * encima de lo que hubiera.
 *
 * Silencioso y permanente: en `audit_log` sólo constaba `campos: [...]` —los
 * nombres, sin los valores—, así que el dato perdido no se podía reconstruir, y
 * el campo vacío se lee después como «no se ha preguntado», no como «alguien lo
 * borró».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría de identidad del paciente (H-18), leyendo el payload de `handleSave`
 * contra la lista de inputs que el modal monta de verdad. La pista fue `notas`:
 * `grep "f\.notas"` devolvía UN solo uso en toda la pantalla —el del payload—,
 * o sea un campo que sólo existe para escribirse.
 *
 * ── CAUSA RAÍZ: TRES PIEZAS, Y SÓLO JUNTAS BORRAN ────────────────────────────
 *
 *  1. El formulario manda más campos de los que enseña (el payload de
 *     `handleSave`).
 *  2. La semilla puede estar vieja: `openEdit(p)` toma `p` del array en memoria,
 *     cargado una vez por montaje sobre el memo de 30 s de `getPatients`, que
 *     sólo invalida la pestaña que escribió. Nunca se relee el documento. Así,
 *     lo que el médico acaba de escribir en `/consulta` no está en la copia que
 *     la asistente tiene delante.
 *  3. `sinUndefined` (src/lib/firestore.ts) descarta `undefined` y deja pasar
 *     `''`, así que la cadena vacía llega a Firestore y borra.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * **No se escribe lo que no se pudo leer.** Un campo que el formulario no mostró
 * no viaja en el payload: su ausencia deja el valor guardado intacto, en vez de
 * pisarlo con el eco de una copia vieja. Es la regla 4 de seguridad clínica
 * («ausencia de dato no es dato de ausencia») dicha en lenguaje de escritura.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 *  - **No cubre el camino de `/consulta`.** Allí las alergias tienen su propio
 *    input, su propio guardado y su propia bitácora `paciente_modificado` con
 *    `antes`/`despues`/`vaciado`. Borrar el campo desde ahí sigue siendo posible
 *    —y debe serlo: es un acto deliberado con el campo delante.
 *  - **No cubre la falta de control de concurrencia en `updatePatient`.** Dos
 *    editores simultáneos sobre los MISMOS campos siguen ganando por orden de
 *    llegada; esta reparación sólo impide que un campo NO editado participe en
 *    esa carrera. La comprobación de `updatedAt` va aparte.
 *  - **No cubre la caché de 30 s de `getPatients`.** La semilla vieja sigue
 *    siendo vieja: lo que se corrige es que una semilla vieja ya no pueda vaciar
 *    un campo clínico.
 *  - **No cubre `alergiasEstructuradas`**, que esta pantalla nunca ha tocado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { construirGuardadoDePaciente, type FormularioDePaciente } from '@/lib/pacientes/campos-que-se-guardan'

const AHORA = '2026-08-27T10:00:00.000Z'

const formulario = (over: Partial<FormularioDePaciente> = {}): FormularioDePaciente => ({
  nombre: 'Prueba Sintética, Paciente',
  telefono: '6641234567',
  whatsapp: '',
  email: '',
  fechaNacimiento: '1980-05-04',
  edad: '46',
  sexo: 'Femenino',
  curp: '',
  seguroMedico: 'IMSS',
  alergias: '',
  notas: '',
  ...over,
})

/** Paciente sintético. Cero pacientes reales — `.claude/rules/data-privacy.md`. */
const previo = {
  id: 'pac-sintetico-1',
  nombre: 'Prueba Sintética, Paciente',
  telefono: '6641234567',
  alergias: 'Penicilina',
  notas: 'Nota vieja que ninguna pantalla enseña',
  noShowCount: 2,
  cancelacionCount: 1,
  creadoPor: 'asistente@ejemplo.test',
  createdAt: '2026-01-02T00:00:00.000Z',
}

describe('EL EDITOR NO ESCRIBE UN CAMPO QUE NO ENSEÑÓ', () => {
  it('en modo secretaria el objeto NO lleva la clave alergias', () => {
    /**
     * El caso del defecto, exacto: la asistente corrige el teléfono sobre una
     * copia cargada ANTES de que el médico escribiera «Penicilina». Si la clave
     * viaja, `updateDoc` la sobrescribe con '' y el alérgeno desaparece.
     */
    const salida = construirGuardadoDePaciente(
      formulario({ telefono: '6649999999' }),
      { modo: 'secretaria', previo, autor: 'asistente@ejemplo.test', ahora: AHORA },
    )
    expect(Object.keys(salida)).not.toContain('alergias')
    expect(salida.telefono).toBe('6649999999')
  })

  it('ningún modo escribe notas — no hay input de notas en ninguna parte', () => {
    for (const modo of ['medico', 'secretaria'] as const) {
      const salida = construirGuardadoDePaciente(
        formulario({ notas: 'lo que quedó del estado inicial' }),
        { modo, previo, autor: 'medico@ejemplo.test', ahora: AHORA },
      )
      expect(Object.keys(salida)).not.toContain('notas')
    }
  })

  it('en modo médico, con el campo editado, SÍ escribe el valor nuevo', () => {
    // El input está delante: escribir un alérgeno tiene que guardarlo.
    const salida = construirGuardadoDePaciente(
      formulario({ alergias: 'Penicilina, AINES' }),
      { modo: 'medico', previo, autor: 'medico@ejemplo.test', ahora: AHORA },
    )
    expect(salida.alergias).toBe('Penicilina, AINES')
  })

  it('en modo médico, borrarlo a propósito SÍ lo borra', () => {
    /**
     * Regresión negativa a la inversa: la reparación no puede convertirse en un
     * campo que ya no se pueda vaciar. Con el input delante, vaciarlo es una
     * decisión del médico —«no tiene alergias»— y debe llegar.
     */
    const salida = construirGuardadoDePaciente(
      formulario({ alergias: '' }),
      { modo: 'medico', previo, autor: 'medico@ejemplo.test', ahora: AHORA },
    )
    expect(Object.keys(salida)).toContain('alergias')
    expect(salida.alergias).toBe('')
  })

  it('en modo médico, con el campo intacto, sale idéntico al del paciente previo', () => {
    const salida = construirGuardadoDePaciente(
      formulario({ alergias: previo.alergias }),
      { modo: 'medico', previo, autor: 'medico@ejemplo.test', ahora: AHORA },
    )
    expect(salida.alergias).toBe(previo.alergias)
  })
})

describe('LO QUE SEGUÍA FUNCIONANDO SIGUE FUNCIONANDO', () => {
  it('el alta captura teléfono, WhatsApp derivado, edad, sexo, CURP y seguro', () => {
    const salida = construirGuardadoDePaciente(
      formulario({ telefono: '(664) 123-4567', curp: 'aaaa800504mbcxyz01' }),
      { modo: 'medico', previo: null, autor: 'medico@ejemplo.test', ahora: AHORA },
    )
    expect(salida.telefono).toBe('6641234567')
    expect(salida.whatsapp).toBe('6641234567')   // derivado del teléfono si falta
    expect(salida.edad).toBe(46)
    expect(salida.sexo).toBe('Femenino')
    expect(salida.curp).toBe('AAAA800504MBCXYZ01')
    expect(salida.seguroMedico).toBe('IMSS')
    expect(salida.createdAt).toBe(AHORA)
  })

  it('el alta en modo médico SÍ puede capturar alergias', () => {
    const salida = construirGuardadoDePaciente(
      formulario({ alergias: 'Sulfas' }),
      { modo: 'medico', previo: null, autor: 'medico@ejemplo.test', ahora: AHORA },
    )
    expect(salida.alergias).toBe('Sulfas')
  })

  it('el whatsapp ya guardado se conserva y no lo pisa el teléfono', () => {
    const salida = construirGuardadoDePaciente(
      formulario({ whatsapp: '6640000000', telefono: '6641234567' }),
      { modo: 'medico', previo, autor: 'medico@ejemplo.test', ahora: AHORA },
    )
    expect(salida.whatsapp).toBe('6640000000')
  })

  it('noShowCount, cancelacionCount, creadoPor y createdAt se preservan', () => {
    const salida = construirGuardadoDePaciente(
      formulario(),
      { modo: 'secretaria', previo, autor: 'otra@ejemplo.test', ahora: AHORA },
    )
    expect(salida.noShowCount).toBe(2)
    expect(salida.cancelacionCount).toBe(1)
    expect(salida.creadoPor).toBe('asistente@ejemplo.test')
    expect(salida.createdAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('es determinista: el instante entra por parámetro, no por el reloj', () => {
    const a = construirGuardadoDePaciente(formulario(), { modo: 'medico', previo, autor: 'x@ejemplo.test', ahora: AHORA })
    const b = construirGuardadoDePaciente(formulario(), { modo: 'medico', previo, autor: 'x@ejemplo.test', ahora: AHORA })
    expect(a).toEqual(b)
    expect(a.updatedAt).toBe(AHORA)
  })
})

/**
 * REACHABILITY — «el dato tiene que LLEGAR».
 *
 * Una función pura que nadie llama es REG-170 otra vez: el arreglo escrito,
 * probado y sin conectar. `vitest.config` corre en `node` y sólo admite `.ts`,
 * así que el componente no se puede renderizar aquí; se lee el fuente, que es el
 * precedente de esta casa (`lo-aprendido-llega-al-motor-que-transcribe`).
 */
describe('LA PANTALLA USA DE VERDAD LA FUNCIÓN EXTRAÍDA', () => {
  const pagina = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'pacientes', 'page.tsx'), 'utf8')

  it('importa el módulo', () => {
    expect(pagina).toMatch(/import\s*\{[^}]*construirGuardadoDePaciente[^}]*\}\s*from\s*'@\/lib\/pacientes\/campos-que-se-guardan'/)
  })

  it('lo llama', () => {
    expect(pagina).toMatch(/construirGuardadoDePaciente\(/)
  })

  it('y ya NO construye el payload a mano con los campos que no enseña', () => {
    expect(pagina).not.toMatch(/alergias:\s*f\.alergias/)
    expect(pagina).not.toMatch(/notas:\s*f\.notas/)
  })
})
