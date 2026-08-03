/**
 * GOLDEN — «no sale en mi receta»: el mismo médico, llamado de dos formas.
 *
 * ── EL FALLO, REPORTADO POR EL DR. CON LA FIRMA YA SUBIDA ────────────────────
 *
 * La nota guarda `metadata.medicoId` con el **uid de Firebase** de quien firma
 * (`auth.currentUser.uid`). La firma y la plantilla, en cambio, se guardan bajo
 * el **id del documento** de `doctors`, que es lo que elige el selector de
 * Configuración.
 *
 * Dos identificadores distintos de la misma persona: la búsqueda exacta nunca
 * acierta. Con UN solo médico el respaldo «la única que hay» lo tapaba; con dos
 * o más, la receta sale **sin firma** y sin ninguna explicación — desde dentro
 * parece que ese médico no subió la suya.
 *
 * Ya se había reparado una vez (v321) por otro camino: aquel arreglo añadió el
 * respaldo del médico único, que resolvía el caso de entonces y **dejaba abierto
 * éste**.
 *
 * ── EL PUENTE YA EXISTÍA ─────────────────────────────────────────────────────
 *
 * `doctors/{id}.uid`, escrito al conectar Google Calendar (v875) y rellenado
 * para los que ya estaban conectados (v899). No hubo que inventar nada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolverIdMedico, entradaPorMedico, firmaValida, POR_QUE_HAY_QUE_TRADUCIR } from '@/lib/impreso-medico'

const DOCTORES = [
  { id: 'doc-david', uid: 'uid-firebase-david' },
  { id: 'doc-ana', uid: 'uid-firebase-ana' },
]

describe('resolverIdMedico', () => {
  it('traduce el uid de la sesión al id del documento', () => {
    expect(resolverIdMedico('uid-firebase-david', DOCTORES)).toBe('doc-david')
  })

  it('si ya viene el id del documento, lo deja igual', () => {
    expect(resolverIdMedico('doc-ana', DOCTORES)).toBe('doc-ana')
  })

  it('NO adivina cuando nadie coincide', () => {
    // Poner la firma de otro médico es peor que no poner ninguna.
    expect(resolverIdMedico('uid-de-alguien-mas', DOCTORES)).toBeUndefined()
    expect(resolverIdMedico('', DOCTORES)).toBeUndefined()
    expect(resolverIdMedico(undefined, DOCTORES)).toBeUndefined()
  })

  it('tampoco cuando DOS médicos comparten uid (dato corrupto)', () => {
    const rotos = [{ id: 'a', uid: 'mismo' }, { id: 'b', uid: 'mismo' }]
    expect(resolverIdMedico('mismo', rotos)).toBeUndefined()
  })

  it('sin lista de médicos no revienta', () => {
    expect(resolverIdMedico('x', undefined)).toBeUndefined()
    expect(resolverIdMedico('x', [])).toBeUndefined()
  })
})

describe('EL CASO QUE SE ROMPÍA: dos médicos, firma guardada por id de documento', () => {
  const firmas = { 'doc-david': 'https://storage/firma-david.png' }

  it('antes: buscar por uid no encontraba nada y la receta salía sin firma', () => {
    // `unicoMedico` es false porque hay dos médicos activos.
    expect(entradaPorMedico(firmas, 'uid-firebase-david', firmaValida, false)).toBeUndefined()
  })

  it('ahora: traduciendo primero, la firma aparece', () => {
    const id = resolverIdMedico('uid-firebase-david', DOCTORES) ?? 'uid-firebase-david'
    expect(entradaPorMedico(firmas, id, firmaValida, false)).toBe('https://storage/firma-david.png')
  })

  it('y la de otro médico sigue sin aparecer en la receta ajena', () => {
    const id = resolverIdMedico('uid-firebase-ana', DOCTORES) ?? 'uid-firebase-ana'
    expect(entradaPorMedico(firmas, id, firmaValida, false)).toBeUndefined()
  })

  it('está explicado por qué hace falta traducir', () => {
    expect(POR_QUE_HAY_QUE_TRADUCIR).toMatch(/dos nombres de la misma persona/)
  })
})

describe('los TRES impresos traducen', () => {
  const leer = (...p: string[]) =>
    readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', ...p), 'utf8')

  const IMPRESOS: [string, string[]][] = [
    ['receta', ['receta', '[patientId]', '[notaId]', 'page.tsx']],
    ['orden', ['orden', '[patientId]', '[notaId]', 'page.tsx']],
    ['nota', ['nota', '[patientId]', '[notaId]', 'page.tsx']],
  ]

  for (const [nombre, ruta] of IMPRESOS) {
    it(`${nombre}: la firma se busca con el id traducido`, () => {
      const s = leer(...ruta)
      expect(s).toContain('resolverIdMedico')
      // La firma es lo que el Dr. reportó; se exige explícitamente.
      const i = s.indexOf('firmaProtegida.firmaPorMedico')
      expect(s.slice(i - 120, i + 200), `${nombre} no traduce para la firma`).toContain('resolverIdMedico')
    })
  }

  it('y la plantilla por médico también, que se guarda con la misma clave', () => {
    for (const [nombre, ruta] of IMPRESOS.slice(0, 2)) {
      const s = leer(...ruta)
      expect(s, nombre).toContain('const idDoc = resolverIdMedico(')
    }
  })
})
