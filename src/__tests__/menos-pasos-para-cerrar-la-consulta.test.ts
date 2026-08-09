/**
 * MENOS PASOS PARA CERRAR LA CONSULTA — REG-231 · I-7 del loop.
 *
 * ── LO QUE EL MÉDICO PIDIÓ ──────────────────────────────────────────────────
 *
 * «que sea más fácil, **con menos pasos**» · «que no tenga tantas maneras de
 * confundirse». Y en las doce preguntas: consentimiento **una vez por
 * paciente**, y firma **con el paciente enfrente**.
 *
 * ── DOS PASOS QUE DESAPARECEN ───────────────────────────────────────────────
 *
 * **1. El consentimiento dejaba de existir al cerrar la pantalla.** Vivía en un
 * `useState`, así que el modal salía en CADA consulta del mismo paciente. Un
 * paso repetido cien veces al mes — y sin nada que exhibir ante una queja salvo
 * el registro de auditoría. Ahora queda **en el expediente**, que es donde un
 * consentimiento tiene sentido, y no se vuelve a pedir.
 *
 * **2. Los avisos rojos ya no tapan la nota desde el minuto uno.** La barra se
 * pintaba por ENCIMA de los signos vitales, las secciones, los diagnósticos y
 * los medicamentos: lo primero que veía al abrir era la lista de lo que está mal
 * en una nota que todavía no había dictado.
 *
 * ── PERO NO SE MUEVE ENTERA, Y ESO ES LO IMPORTANTE ─────────────────────────
 *
 * Cinco de esos avisos son de PRESCRIPCIÓN —alergia ↔ fármaco, sobredosis,
 * dosis incompleta, interacción, vía asumida— y tienen que llegar **mientras
 * receta**: después de firmar, la receta ya se imprimió.
 *
 * Llevarlos al final es exactamente el defecto que este repositorio ya reparó
 * **dos veces** (REG-173 y REG-190, familia «llega tarde para servir»), y no se
 * reintroduce por comodidad visual.
 *
 * Los de REVISIÓN DEL TEXTO —contradicción, dato incierto, antecedente del
 * familiar, requisito NOM— no cambian lo que se le da al paciente: cambian lo
 * que se lee antes de firmar. Ése es su momento.
 *
 * ── SIN INVENTAR UNA CLASIFICACIÓN NUEVA ────────────────────────────────────
 *
 * Cada aviso ya traía `ancla.seccion` para saber a dónde lleva su botón. Ese
 * campo ya distinguía lo que hacía falta; nadie lo usaba para decidir *cuándo*.
 * No hay lista nueva que mantener.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  esDePrescripcion, mientrasReceta, alFirmar, comoSeDicenAlFirmar,
} from '@/lib/expediente/cuando-avisar'
import type { AvisoConsulta } from '@/lib/expediente/avisos-consulta'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const aviso = (id: string, seccion?: 'medicamentos' | 'diagnosticos' | 'nota'): AvisoConsulta =>
  ({ id, origen: 'dato_incierto', nivel: 'revisa', texto: id, ...(seccion ? { ancla: { seccion } } : {}) } as AvisoConsulta)

describe('qué llega mientras receta y qué espera a la firma', () => {
  it('lo anclado a MEDICAMENTOS llega durante la consulta', () => {
    expect(esDePrescripcion(aviso('alergia', 'medicamentos'))).toBe(true)
  })

  it('lo anclado a la NOTA espera al momento de firmar', () => {
    expect(esDePrescripcion(aviso('contradiccion', 'nota'))).toBe(false)
  })

  it('lo anclado a DIAGNÓSTICOS también espera', () => {
    expect(esDePrescripcion(aviso('dx', 'diagnosticos'))).toBe(false)
  })

  it('ANTE LA DUDA, durante la consulta: sin ancla se trata como de receta', () => {
    /**
     * Un aviso que llega pronto de más estorba; uno que llega tarde no protege.
     * Las dos molestias no cuestan lo mismo.
     */
    expect(esDePrescripcion(aviso('sin ancla'))).toBe(true)
  })

  it('los dos filtros reparten TODOS los avisos, sin perder ni duplicar', () => {
    const todos = [
      aviso('a', 'medicamentos'), aviso('b', 'nota'),
      aviso('c', 'diagnosticos'), aviso('d'),
    ]
    const ahora = mientrasReceta(todos)
    const luego = alFirmar(todos)
    expect(ahora.length + luego.length).toBe(todos.length)
    expect(new Set([...ahora, ...luego].map(x => x.id)).size).toBe(todos.length)
  })

  it('sin avisos, ninguno de los dos revienta', () => {
    expect(mientrasReceta([])).toEqual([])
    expect(alFirmar([])).toEqual([])
  })
})

describe('lo que se le dice al firmar', () => {
  it('cuenta y enumera, sin juzgar', () => {
    const t = comoSeDicenAlFirmar([aviso('uno', 'nota'), aviso('dos', 'nota')])
    expect(t).toContain('2 cosas por revisar')
    expect(t).toContain('· uno')
    expect(t).toContain('· dos')
  })

  it('en singular cuando es uno', () => {
    expect(comoSeDicenAlFirmar([aviso('uno', 'nota')])).toContain('1 cosa por revisar')
  })

  it('con muchos, no vuelca una pared de texto', () => {
    const muchos = Array.from({ length: 20 }, (_, i) => aviso(`n${i}`, 'nota'))
    const t = comoSeDicenAlFirmar(muchos)
    expect(t).toContain('…y 12 más.')
  })
})

describe('está conectado de verdad', () => {
  const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

  it('la barra sólo lleva lo de prescripción', () => {
    expect(page).toMatch(/<AntesDeFirmar\s+avisos=\{mientrasReceta\(avisos\)\}/)
    // Y NO la lista entera, que era lo que tapaba la nota.
    expect(page).not.toMatch(/<AntesDeFirmar\s+avisos=\{avisos\}/)
  })

  it('el resto aparece al firmar', () => {
    const firmar = page.slice(page.indexOf('const firmar = useCallback'))
    expect(firmar).toContain('if (avisosParaFirmar.length > 0)')
    expect(firmar).toContain('comoSeDicenAlFirmar(avisosParaFirmar)')
  })

  it('y ninguno de ésos bloquea por sí solo — se dice explícitamente', () => {
    const firmar = page.slice(page.indexOf('const firmar = useCallback'))
    expect(firmar).toMatch(/Ninguno impide firmar por sí solo/)
  })

  it('sigue habiendo UN solo panel montado', () => {
    // Partir la barra no podía convertirse en dos paneles: la nota se llenaría
    // de recuadros, que es el defecto que la barra vino a cerrar.
    expect((page.match(/<AntesDeFirmar/g) ?? []).length).toBe(1)
  })
})

describe('el consentimiento se pide una vez por paciente', () => {
  const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
  const tipos = leer('src/types/index.ts')

  it('el expediente lo guarda', () => {
    expect(tipos).toContain('consentimientoGrabacion?: {')
    expect(tipos).toContain('fecha: string')
  })

  it('la pantalla mira el expediente, no sólo la sesión', () => {
    expect(page).toMatch(/const yaConsintio = consentimiento \|\| !!patient\?\.consentimientoGrabacion\?\.fecha/)
    expect(page).toMatch(/if \(yaConsintio\) \{ arrancarSegunModo\(\); return \}/)
  })

  it('y lo escribe al otorgarlo, con quién y cuándo', () => {
    expect(page).toMatch(/consentimientoGrabacion: \{ fecha: new Date\(\)\.toISOString\(\), medicoId: auth\.currentUser\?\.uid \}/)
  })

  it('si el guardado falla, la grabación NO se cae', () => {
    /** Se volverá a pedir la próxima vez, que es el lado seguro del error. */
    expect(page).toMatch(/\.catch\(\(\) => \{ \/\* se volverá a pedir: es el lado seguro \*\/ \}\)/)
  })

  it('sigue quedando en la bitácora, además del expediente', () => {
    // El expediente es para consultarlo; la bitácora es para auditarlo. No se
    // sustituye una cosa por la otra.
    expect(page).toContain("evento: 'consentimiento_grabacion'")
  })

  it('NUNCA se da por otorgado por omisión', () => {
    // Ausente = nunca se pidió. La comprobación es sobre `fecha`, no sobre la
    // existencia del objeto.
    expect(page).toContain('patient?.consentimientoGrabacion?.fecha')
  })
})
