/**
 * GOLDEN — caída de proveedor, proveedor sin licencia y catálogo (#314 puntos 5, 6, 9).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos cosas distintas:
 *
 *  1. Ante una caída de PubMed, la ruta actual devuelve menos artículos y sigue.
 *     No miente, pero deja al médico sin forma de saber que faltó una fuente.
 *  2. No había forma de representar «UpToDate existe pero no tenemos licencia»
 *     que no fuera omitirlo, y omitirlo es indistinguible de no haberlo pensado.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Punto 9 de #314 leído contra `consultor-evidencia/route.ts`, y punto 5 leído
 * contra `src/types/evidence.ts`, donde UpToDate ya figuraba como
 * LICENSE_UNKNOWN sin nada que dijera qué falta para cambiarlo.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * El retrieval devolvía datos, no un resultado con estado. Un array no puede
 * llevar «por qué está vacío».
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Todo adaptador devuelve un SOBRE y NUNCA lanza. Un proveedor sin licencia
 * devuelve `not_configured` con qué falta y qué decisión humana lo desbloquea;
 * jamás una lista vacía que se lea como «no hay evidencia».
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * NO habla con PubMed real: la función de búsqueda se inyecta. La corrección
 * del retrieval real es de `src/lib/evidencia/pubmed.ts` y sus propias pruebas.
 * NO verifica los términos legales del catálogo: los campos UNVERIFIABLE son
 * preguntas abiertas para el dueño, y esta prueba comprueba que SIGAN
 * declaradas como abiertas, no que sean ciertas.
 */
import { describe, it, expect } from 'vitest'
import { adaptadorPubMed, claseDeFalloDeRed } from '@/lib/evidence-integrations/adaptadores/pubmed'
import { uptodate, openevidence, cochrane, perplexity } from '@/lib/evidence-integrations/adaptadores/no-configurado'
import { adaptadorConocimientoPersonal, validarNota } from '@/lib/evidence-integrations/adaptadores/conocimiento-personal'
import { adaptadorSintetico } from '@/lib/evidence-integrations/adaptadores/sintetico'
import { tieneMaterial, puedeRespaldar } from '@/lib/evidence-integrations/contrato'
import {
  CATALOGO_DE_EVIDENCIA, CAMPOS_DE_LA_MATRIZ, camposSinVerificar,
  decisionesPendientes, entradaDeCatalogo, REVISADO_EN, UNVERIFIABLE,
} from '@/lib/evidence-integrations/catalogo'
import { planDeConsulta, hayRespaldoOperativo, intencionDe } from '@/lib/evidence-integrations/seleccion'

const CTX = { ahora: '2026-08-22T10:00:00.000Z', correlacion: 'corr-adapt-001' }
const CONSULTA = { pregunta: '¿Duración del tratamiento antimicrobiano?', maximo: 5 }

describe('cuando el proveedor se cae, se DICE — no se devuelve una lista vacía', () => {
  it('PubMed caído produce `unavailable` con motivo legible, y no lanza', () => {
    const a = adaptadorPubMed({ buscar: async () => { throw new Error('fetch failed') } })
    return a.recuperar(CONSULTA, CTX).then(s => {
      expect(tieneMaterial(s)).toBe(false)
      if (tieneMaterial(s)) return
      expect(s.estado).toBe('unavailable')
      expect(s.clase).toBe('red')
      // La frase distingue «no se consultó» de «no existe».
      expect(s.motivo).toMatch(/NO incluye literatura indexada; no es que no exista/)
    })
  })

  it('un timeout se clasifica como timeout, no como red', async () => {
    const err = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    const a = adaptadorPubMed({ buscar: async () => { throw err } })
    const s = await a.recuperar(CONSULTA, CTX)
    expect(tieneMaterial(s)).toBe(false)
    if (!tieneMaterial(s)) expect(s.clase).toBe('timeout')
  })

  it('lo que no se reconoce es `desconocido`, no `red`: no se clasifica de más', () => {
    expect(claseDeFalloDeRed(new Error('algo rarísimo'))).toBe('desconocido')
    expect(claseDeFalloDeRed(new Error('429 Too Many Requests'))).toBe('limite_de_tasa')
  })

  it('PubMed sin resultados es `available` con cero fuentes — que NO es lo mismo', async () => {
    const a = adaptadorPubMed({ buscar: async () => [] })
    const s = await a.recuperar(CONSULTA, CTX)
    expect(tieneMaterial(s)).toBe(true)
    if (tieneMaterial(s)) {
      expect(s.estado).toBe('available')
      expect(s.fuentes).toHaveLength(0)
    }
  })

  it('un artículo sin resumen se descarta Y se declara el recorte', async () => {
    // Si se silenciara, el médico creería que se revisó material que se tiró.
    const a = adaptadorPubMed({
      buscar: async () => [
        { pmid: '1', titulo: 'Con resumen', revista: 'R', anio: '2024', resumen: 'Un resumen sintético suficientemente largo para poder anclar pasajes literales.', url: 'u', tipo: 'ECA' },
        { pmid: '2', titulo: 'Sin resumen', revista: 'R', anio: '2024', resumen: '', url: 'u', tipo: 'ECA' },
      ],
    })
    const s = await a.recuperar(CONSULTA, CTX)
    expect(tieneMaterial(s)).toBe(true)
    if (!tieneMaterial(s)) return
    expect(s.estado).toBe('partial')
    expect(s.fuentes).toHaveLength(1)
    expect(s.recorte).toMatch(/SIN_TEXTO_RECUPERADO×1/)
    // Y la cuenta declarada por PubMed se conserva: 2 traídos, 1 citable.
    expect(s.telemetria.totalDeclarado).toBe(2)
  })

  it('una pregunta vacía NO se manda a PubMed', async () => {
    const a = adaptadorPubMed({ buscar: async () => { throw new Error('no debió llamarse') } })
    const s = await a.recuperar({ pregunta: '  ', maximo: 5 }, CTX)
    expect(tieneMaterial(s)).toBe(false)
    if (!tieneMaterial(s)) expect(s.estado).toBe('not_permitted')
  })
})

describe('un proveedor sin licencia se DECLARA, no se omite', () => {
  it.each([
    ['uptodate', uptodate()],
    ['openevidence', openevidence()],
    ['cochrane', cochrane()],
    ['perplexity', perplexity()],
  ])('%s devuelve not_configured con qué falta y qué lo desbloquea', async (nombre, a) => {
    const disp = a.disponibilidad()
    expect(disp.operativo, nombre).toBe(false)
    expect(disp.faltante!.length, nombre).toBeGreaterThan(30)
    expect(disp.desbloqueaCon, nombre).toBeTruthy()

    const s = await a.recuperar(CONSULTA, CTX)
    expect(tieneMaterial(s), nombre).toBe(false)
    if (!tieneMaterial(s)) {
      expect(s.estado, nombre).toBe('not_configured')
      expect(s.motivo, nombre).toMatch(/no se consultó/)
    }
  })

  it('el adaptador de UpToDate no conoce ninguna URL: no hay dónde meter scraping', async () => {
    // Guardián estructural. Si alguien añadiera un fetch a un endpoint no
    // documentado, este archivo dejaría de estar limpio.
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/lib/evidence-integrations/adaptadores/no-configurado.ts', 'utf8')
    expect(src).not.toMatch(/https?:\/\//)
    expect(src).not.toMatch(/\bfetch\s*\(/)
  })

  it('Cochrane dice explícitamente que sus resúmenes indexados NO son la revisión completa', async () => {
    const s = await cochrane().recuperar(CONSULTA, CTX)
    expect(tieneMaterial(s)).toBe(false)
    if (!tieneMaterial(s)) {
      expect(s.motivo).toMatch(/indexados en MEDLINE/)
      expect(s.motivo).toMatch(/no como revisión completa/)
    }
  })
})

describe('el catálogo declara sus huecos en vez de rellenarlos', () => {
  it('toda entrada trae los DOCE campos de la matriz', () => {
    for (const [id, e] of Object.entries(CATALOGO_DE_EVIDENCIA)) {
      for (const campo of CAMPOS_DE_LA_MATRIZ) {
        expect(e.matriz, `${id}.${campo}`).toHaveProperty(campo)
      }
    }
  })

  it('los tres propietarios de #314 tienen `reusoGenerativo` SIN VERIFICAR', () => {
    // Es el campo que puede, por sí solo, hacer ilegal una integración.
    // Si alguien lo diera por bueno sin verificarlo, este caso se pone rojo.
    for (const p of ['uptodate', 'openevidence', 'cochrane'] as const) {
      expect(entradaDeCatalogo(p).matriz.reusoGenerativo, p).toBe(UNVERIFIABLE)
      expect(camposSinVerificar(p), p).toContain('reusoGenerativo')
    }
  })

  it('ningún proveedor está en LICENSED_OK: no se afirma una integración que no existe', () => {
    const conLicencia = Object.values(CATALOGO_DE_EVIDENCIA).filter(e => e.licencia === 'LICENSED_OK')
    expect(conLicencia.map(e => e.id)).toEqual([])
  })

  it('un proveedor sin `proveedorCanonico` NO puede producir un Source citable', () => {
    // Ésta es la compuerta estructural: sin licencia no hay Source, sin Source
    // no hay Passage, sin Passage no hay Claim.
    for (const p of ['uptodate', 'openevidence', 'cochrane', 'perplexity'] as const) {
      expect(entradaDeCatalogo(p).proveedorCanonico, p).toBeUndefined()
    }
  })

  it('Perplexity es descubrimiento y conocimiento personal no es guía', () => {
    expect(entradaDeCatalogo('perplexity').rol).toBe('descubrimiento')
    expect(entradaDeCatalogo('conocimiento_personal').rol).toBe('conocimiento_personal')
  })

  it('toda decisión pendiente dice qué clase de decisión es', () => {
    const pendientes = decisionesPendientes()
    expect(pendientes.length).toBeGreaterThan(0)
    for (const p of pendientes) expect(p.decision.length, p.proveedor).toBeGreaterThan(40)
    // Las de licencia/gasto están marcadas para que el dueño las encuentre.
    const propietarios = pendientes.filter(p => ['uptodate', 'cochrane', 'openevidence'].includes(p.proveedor))
    expect(propietarios).toHaveLength(3)
    for (const p of propietarios) expect(p.decision, p.proveedor).toMatch(/DECISIÓN DEL DUEÑO/)
  })

  it('la revisión del catálogo lleva fecha', () => {
    expect(REVISADO_EN).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('conocimiento personal: sin procedencia no entra, y no cruza consultorios', () => {
  it('una nota sin fecha de autoría se RECHAZA (no se rellena con la de hoy)', () => {
    const r = validarNota({ texto: 'algo', autor: 'Dr. X', origen: 'boveda/nota.md', clinicId: 'c1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('FECHA_DE_AUTORIA_INVALIDA')
  })

  it('una nota sin autor se rechaza: sin autor no se puede atribuir', () => {
    const r = validarNota({ texto: 'algo', origen: 'x', clinicId: 'c1', fechaDeAutoria: '2025-01-01' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_AUTOR')
  })

  it('las notas de OTRO consultorio no se devuelven', async () => {
    const a = adaptadorConocimientoPersonal({
      leer: async () => [
        { id: 'n1', texto: 'mía', autor: 'Dr. X', origen: 'b/1.md', fechaDeAutoria: '2026-01-01', clinicId: 'clinica-1' },
        { id: 'n2', texto: 'ajena', autor: 'Dr. Y', origen: 'b/2.md', fechaDeAutoria: '2026-01-01', clinicId: 'clinica-2' },
      ],
    })
    const r = await a.recuperarNotas(CONSULTA, { ...CTX, clinicId: 'clinica-1' })
    expect(r.notas.map(n => n.id)).toEqual(['n1'])
  })

  it('su sobre NUNCA puede respaldar, aunque traiga notas', async () => {
    const a = adaptadorConocimientoPersonal({
      leer: async () => [{ id: 'n1', texto: 'mi esquema', autor: 'Dr. X', origen: 'b/1.md', fechaDeAutoria: '2026-01-01', clinicId: 'c1' }],
    })
    const r = await a.recuperarNotas(CONSULTA, { ...CTX, clinicId: 'c1' })
    expect(r.notas).toHaveLength(1)
    expect(puedeRespaldar(r.sobre)).toBe(false)
  })

  it('las notas rechazadas se declaran, no se descartan en silencio', async () => {
    const a = adaptadorConocimientoPersonal({
      leer: async () => [{ id: 'n1', texto: 'sin fecha', autor: 'Dr. X', origen: 'b/1.md', clinicId: 'c1' }],
    })
    const r = await a.recuperarNotas(CONSULTA, { ...CTX, clinicId: 'c1' })
    expect(r.rechazadas).toHaveLength(1)
    expect(tieneMaterial(r.sobre) && r.sobre.estado).toBe('partial')
  })

  it('sin bóveda importada, se declara y no se finge', async () => {
    const a = adaptadorConocimientoPersonal()
    expect(a.disponibilidad().operativo).toBe(false)
    const s = await a.recuperar(CONSULTA, CTX)
    expect(tieneMaterial(s)).toBe(false)
  })
})

describe('la selección ordena sin esconder lo que no se consultó', () => {
  const adaptadores = [adaptadorSintetico(), uptodate(), cochrane(), perplexity()]

  it('un proveedor no operativo baja al final pero NO desaparece del plan', () => {
    // Filtrarlo sería violar el punto 9 de #314 sin escribir una mentira.
    const plan = planDeConsulta(adaptadores, CONSULTA)
    expect(plan.aConsultar).toContain('sintetico')
    expect(plan.aDeclarar).toEqual(expect.arrayContaining(['uptodate', 'cochrane', 'perplexity']))
    expect(plan.aConsultar.length + plan.aDeclarar.length).toBe(adaptadores.length)
  })

  it('el orden es estable entre ejecuciones', () => {
    const a = planDeConsulta(adaptadores, CONSULTA)
    const b = planDeConsulta(adaptadores, CONSULTA)
    expect(a.aDeclarar).toEqual(b.aDeclarar)
  })

  it('ante la duda el clasificador dice `general` y consulta de todo', () => {
    expect(intencionDe('¿qué opinas?')).toBe('general')
    expect(intencionDe('¿cuál es la dosis en insuficiencia renal?')).toBe('dosis_o_farmaco')
    expect(intencionDe('¿duración del tratamiento antibiótico?')).toBe('tratamiento')
  })

  it('sin ningún proveedor de respaldo operativo, se sabe — y no es un error', () => {
    // La evidencia es OPCIONAL: su caída no puede bloquear al médico.
    expect(hayRespaldoOperativo([uptodate(), cochrane()])).toBe(false)
    expect(hayRespaldoOperativo(adaptadores)).toBe(true)
  })
})
