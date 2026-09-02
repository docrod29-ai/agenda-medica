/**
 * LO QUE EL MÉDICO DECIDIÓ EL 2-SEP-2026 — dos políticas que estaban en `null`.
 *
 * QUÉ FALLABA. Dos cosas escritas, probadas y APAGADAS esperando una decisión
 * que nadie le había pedido en una frase contestable:
 *
 *   1. Corregir un signo vital o una administración ya registrada **no estaba
 *      habilitado**: `validarCorreccion` exige la política como parámetro
 *      obligatorio y `POLITICA_CORRECCION` nacía en `null` a propósito.
 *   2. La receta descartaba SIEMPRE `sin_referencia` («no tengo con qué comparar
 *      esta dosis»), también cuando se dosifica por kilo — donde el margen es
 *      estrecho y no ver aviso se lee como «comprobado».
 *
 * CÓMO SE DESCUBRIÓ. Barriendo el inventario de pendientes contra el código de
 * hoy: los dos figuraban como «pendiente de decisión del dueño», que es la
 * etiqueta que nadie vuelve a mirar. Se le preguntaron las dos en una frase cada
 * una y las contestó.
 *
 * CAUSA RAÍZ. No es un defecto de software: es que la pregunta nunca llegó al
 * médico en forma de pregunta. El código estaba bien construido — se negaba a
 * funcionar en vez de inventarse un default, que es lo correcto.
 *
 * LA REGLA QUE LO HACE SEGURO. Ninguno de los dos valores lo eligió un agente.
 * La política de corrección son las palabras del dueño; el predicado de la
 * receta es `porKilo`, un hecho que YA está en el texto de la prescripción, no
 * un punto de corte de edad inventado (regla 1 de seguridad clínica).
 *
 * QUÉ NO CUBRE.
 * - No prueba la RUTA de corrección de punta a punta: prueba la política y el
 *   validador. Que `api/hospital/mutar` la respete es otro guardián.
 * - No prueba que la receta PINTE el aviso, sólo que el motor lo produce y que
 *   el filtro de la pantalla ya no lo tira. Lo que se ve en pantalla se mira en
 *   un navegador, no aquí.
 * - Una dosis pediátrica escrita en mg absolutos («250 mg» a un lactante) sigue
 *   sin aviso: no lleva `mg/kg` en el texto. Declarado, no escondido.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { POLITICA_CORRECCION, validarCorreccion } from '@/lib/hospital/eventos'
import { revisarDosis, esDosisPorKg } from '@/lib/seguridad/dosis'
import { cantidad } from '@/types/clinical-quantity'

const ahora = '2026-09-02T12:00:00.000Z'
const haceHoras = (h: number) => new Date(Date.parse(ahora) - h * 3600_000).toISOString()

const ctx = (over: Partial<Parameters<typeof validarCorreccion>[1]> = {}) => ({
  rol: 'medico', fechaEvento: haceHoras(1), ahora,
  esAdministracion: false, episodioActivo: true, ...over,
})
const borrador = (over: Partial<Parameters<typeof validarCorreccion>[0]> = {}) => ({
  corrigeEventoId: 'ev-1', efecto: 'sustituye' as const, motivo: 'dato mal capturado', ...over,
})

describe('la política de corrección ya no es null', () => {
  it('está decidida — corregir dejó de estar apagado', () => {
    // AL REVÉS: mientras esto fuera `null`, `validarCorreccion` no se podía
    // llamar y corregir un registro clínico era imposible en toda la app.
    expect(POLITICA_CORRECCION).not.toBeNull()
  })

  it('dice exactamente lo que dijo el médico, campo por campo', () => {
    expect(POLITICA_CORRECCION).toEqual({
      rolesQueCorrigen: ['medico', 'enfermeria'],
      rolesQueAnulanAdministracion: ['medico'],
      ventanaHoras: 24,
      permiteEpisodioEgresado: false,
      motivoObligatorio: true,
    })
  })

  it('`admin` NO puede corregir, aunque la matriz lo agrupe con medico', () => {
    // Heredar `isMedico` habría sido cómodo. El dueño dijo «médico y
    // enfermería»: ensanchar una autorización clínica por comodidad, no.
    const r = validarCorreccion(borrador(), ctx({ rol: 'admin' }), POLITICA_CORRECCION!)
    expect(r.ok).toBe(false)
    expect(r.rechazos).toContain('rol_no_autorizado')
  })
})

describe('el validador aplica esa política', () => {
  it('enfermería corrige un signo vital', () => {
    expect(validarCorreccion(borrador(), ctx({ rol: 'enfermeria' }), POLITICA_CORRECCION!).ok).toBe(true)
  })

  it('enfermería NO puede anular una administración de medicamento', () => {
    // Anular borra la constancia de que algo se dio. Es la única acción que el
    // dueño reservó al médico.
    const r = validarCorreccion(
      borrador({ efecto: 'anula' }),
      ctx({ rol: 'enfermeria', esAdministracion: true }),
      POLITICA_CORRECCION!,
    )
    expect(r.ok).toBe(false)
    expect(r.rechazos).toContain('anulacion_no_autorizada')
  })

  it('el médico sí puede anularla', () => {
    expect(validarCorreccion(
      borrador({ efecto: 'anula' }),
      ctx({ rol: 'medico', esAdministracion: true }),
      POLITICA_CORRECCION!,
    ).ok).toBe(true)
  })

  it('a las 23 h se admite y a las 25 h ya no', () => {
    expect(validarCorreccion(borrador(), ctx({ fechaEvento: haceHoras(23) }), POLITICA_CORRECCION!).ok).toBe(true)
    const tarde = validarCorreccion(borrador(), ctx({ fechaEvento: haceHoras(25) }), POLITICA_CORRECCION!)
    expect(tarde.ok).toBe(false)
    expect(tarde.rechazos).toContain('fuera_de_ventana')
  })

  it('un episodio ya egresado no se corrige', () => {
    const r = validarCorreccion(borrador(), ctx({ episodioActivo: false }), POLITICA_CORRECCION!)
    expect(r.ok).toBe(false)
    expect(r.rechazos).toContain('episodio_egresado')
  })

  it('sin motivo escrito no pasa, ni en blanco ni con espacios', () => {
    for (const motivo of [undefined, '', '   ']) {
      const r = validarCorreccion(borrador({ motivo }), ctx(), POLITICA_CORRECCION!)
      expect(r.ok, `motivo ${JSON.stringify(motivo)}`).toBe(false)
      expect(r.rechazos).toContain('motivo_requerido')
    }
  })
})

describe('SAFE-003 · «sin referencia» sobrevive cuando se dosifica por kilo', () => {
  const DESCONOCIDO = 'zzyzxamicina'   // no está en el catálogo, a propósito

  it('el motor lo produce, que es la premisa del arreglo', () => {
    const al = revisarDosis({ farmaco: DESCONOCIDO, dosis: cantidad(50, 'mg/kg/dosis', 'dosis_por_peso') })
    expect(al.map(a => a.codigo)).toContain('sin_referencia')
  })

  it('el texto del aviso dice que ausencia de alerta NO es dosis segura', () => {
    const a = revisarDosis({ farmaco: DESCONOCIDO, dosis: cantidad(50, 'mg/kg/dosis', 'dosis_por_peso') })
      .find(x => x.codigo === 'sin_referencia')
    expect(a?.mensaje).toMatch(/ausencia de alerta/i)
  })

  it('«50 mg/kg» se reconoce como dosis por kilo y «250 mg» no', () => {
    // Es el predicado del filtro: si esto se rompiera, el arreglo se apagaría
    // en silencio y la receta volvería a callarse.
    expect(esDosisPorKg('50 mg/kg cada 8 h')).toBe(true)
    expect(esDosisPorKg('250 mg cada 8 h')).toBe(false)
  })

  it('la receta ya no descarta el aviso cuando la dosis va por kilo', () => {
    // AL REVÉS: con el filtro viejo —`.filter(a => a.codigo !== 'sin_referencia')`—
    // este caso pasa igual, así que se afirma sobre la CONDICIÓN, que es lo que
    // el filtro viejo no tenía.
    const src = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8')
    expect(src).toContain("a.codigo !== 'sin_referencia' || porKilo")
    expect(src).not.toContain("filter(a => a.codigo !== 'sin_referencia')")
  })

  it('el arreglo NO se hizo con un punto de corte de edad inventado', () => {
    // La regla 1 dicha como prueba: si alguien "mejora" esto metiendo un < 18,
    // este caso lo caza.
    const src = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8')
    const bloque = src.slice(src.indexOf('SAFE-003'), src.indexOf('SAFE-003') + 2500)
    expect(bloque).not.toMatch(/edadPaciente\s*[<>]=?\s*\d+/)
  })
})
