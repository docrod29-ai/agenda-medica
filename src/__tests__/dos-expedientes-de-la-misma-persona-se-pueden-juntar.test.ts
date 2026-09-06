/**
 * ASE-009 (Panel de Lujo 2026-09, auditor AS-expedientes) — fundir dos
 * expedientes repetidos era imposible desde la app.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El barrido de `/pacientes` encontraba las parejas, el diálogo decía «Nada se
 * junta ni se borra solo», y ahí terminaba el producto. `firestore.rules` cierra
 * el borrado de pacientes desde el navegador (`allow delete: if false`, con
 * razón: la salvaguarda NOM-004 vivía en código muerto y la puerta abierta en
 * las reglas) y el único borrado real vive en `/api/arco/cancelar`, tras la
 * capacidad `administrar`. Grep confirmado por el equipo rojo: **no existía
 * ninguna función de fusión en `src/`**.
 *
 * Así que el único camino para deshacer un duplicado era **fingir una solicitud
 * ARCO de cancelación** de un paciente que nunca la pidió: falsificar un
 * registro legal para arreglar un problema de datos. Y mientras tanto el
 * historial sigue partido, que es el daño de verdad — las alergias en un
 * expediente y las notas recientes en el otro.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-expedientes recorriendo el flujo completo; el equipo rojo confirmó
 * el hecho y corrigió una cita desplazada de las reglas (`allow delete` está en
 * :193, no en :186). Veredicto: «no hay pérdida de dato, hay ausencia de
 * remedio».
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Se construyó el DETECTOR y no el REMEDIO. Un aviso sobre algo que no se puede
 * arreglar se aprende a ignorar en dos semanas, y entonces tampoco se ve el día
 * que importa.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * CLAUDE.md: UN PACIENTE · UNA IDENTIDAD · UN EXPEDIENTE LONGITUDINAL. Y
 * clinical-safety §3: nada cambia en silencio — lo que la fusión NO puede juntar
 * se enseña antes y se guarda en la bitácora, en vez de tirarse.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `planDeFusion`, que es donde vive la decisión, más
 * CONTRATO TEXTUAL sobre la ruta y la pantalla. Se prueba AL REVÉS: la mitad de
 * los casos fija lo que la fusión NO debe hacer (pisar un dato, juntar dos CURP
 * distintos, fundir con la ya fundida, borrar el absorbido).
 *
 * El plan es una función PURA a propósito: «qué va a pasar» tiene que poder
 * enseñarse antes de que pase y probarse sin base de datos.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No ejecuta la escritura: la mudanza de subcolecciones necesita el SDK admin y
 * esta suite no tiene emulador (hay una configuración aparte,
 * `vitest.emulator.config.ts`, y una prueba de ida y vuelta ahí queda anotada en
 * `handoff-EXPEDIENTES.md`). No cubre deshacer una fusión: no se puede, y eso
 * está dicho en la pantalla antes de pulsar. No cubre que las listas y la
 * búsqueda escondan al absorbido (`fusionadoEn` se escribe; filtrarlo en
 * `listarPacientesCompat` y en `buscarPacientes` es `lib/firestore.ts`, de otra
 * rebanada — va en el handoff).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { planDeFusion, loQueSePierde } from '@/lib/pacientes/fusion'
import type { Patient } from '@/types'

const px = (o: Partial<Patient>): Patient => ({
  id: o.id ?? 'x', nombre: o.nombre ?? 'Ernestina Quiroga Balbuena', telefono: o.telefono ?? '',
  noShowCount: 0, cancelacionCount: 0, createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '', creadoPor: '', ...o,
})

const ruta = readFileSync(resolve(process.cwd(), 'src/app/api/pacientes/fundir/route.ts'), 'utf8')
const pantalla = readFileSync(resolve(process.cwd(), 'src/app/(dashboard)/pacientes/page.tsx'), 'utf8')

describe('ASE-009 · quién absorbe a quién', () => {
  it('sobrevive el que tiene más notas: mueve menos documentos firmados', () => {
    const plan = planDeFusion(
      px({ id: 'a' }), { notas: 2 },
      px({ id: 'b' }), { notas: 9 },
    )
    expect(plan.sobreviveId).toBe('b')
    expect(plan.absorbidoId).toBe('a')
    expect(plan.porQueSobreviveEse).toMatch(/más notas/)
  })

  it('empatados, sobrevive el más antiguo: es al que apuntan citas y cobros', () => {
    const plan = planDeFusion(
      px({ id: 'nuevo', createdAt: '2026-05-01T00:00:00.000Z' }), { notas: 3 },
      px({ id: 'viejo', createdAt: '2024-02-01T00:00:00.000Z' }), { notas: 3 },
    )
    expect(plan.sobreviveId).toBe('viejo')
    expect(plan.porQueSobreviveEse).toMatch(/más antiguo/)
  })
})

describe('ASE-009 · el superviviente no pierde lo suyo', () => {
  it('los campos del absorbido rellenan HUECOS, nunca pisan', () => {
    const plan = planDeFusion(
      px({ id: 'a', telefono: '5550101010', alergias: 'Penicilina' }), { notas: 5 },
      px({ id: 'b', telefono: '', email: 'e@ejemplo.mx', fechaNacimiento: '1980-03-15' }), { notas: 1 },
    )
    expect(plan.sobreviveId).toBe('a')
    expect(plan.rellena).toEqual({ email: 'e@ejemplo.mx', fechaNacimiento: '1980-03-15' })
    // Lo que ya tenía no aparece en `rellena`: no se toca.
    expect(plan.rellena.telefono).toBeUndefined()
    expect(plan.rellena.alergias).toBeUndefined()
  })

  it('lo que NO se puede juntar se declara, no se tira en silencio', () => {
    const plan = planDeFusion(
      px({ id: 'a', telefono: '5550101010' }), { notas: 5 },
      px({ id: 'b', telefono: '5559990000' }), { notas: 1 },
    )
    expect(plan.conflictos).toEqual([
      { campo: 'telefono', seQueda: '5550101010', noSeCopia: '5559990000' },
    ])
    const perdidas = loQueSePierde(plan)
    expect(perdidas.some(l => l.includes('5559990000'))).toBe(true)
    expect(perdidas.some(l => /no se borra/i.test(l))).toBe(true)
  })
})

describe('ASE-009 · probada al revés: lo que la fusión SE NIEGA a hacer', () => {
  it('dos CURP distintos son dos personas, se llamen como se llamen', () => {
    const plan = planDeFusion(
      px({ id: 'a', curp: 'QUBE800315MDFRLR07' }), { notas: 1 },
      px({ id: 'b', curp: 'QUBE800315HDFRLR08' }), { notas: 1 },
    )
    expect(plan.impedimento).toMatch(/CURP distintos/)
  })

  it('no se funde un expediente consigo mismo ni uno ya fundido', () => {
    expect(planDeFusion(px({ id: 'a' }), { notas: 1 }, px({ id: 'a' }), { notas: 1 }).impedimento)
      .toMatch(/mismo expediente/)
    expect(planDeFusion(
      px({ id: 'a', ...({ fusionadoEn: 'z' } as Partial<Patient>) }), { notas: 1 },
      px({ id: 'b' }), { notas: 1 },
    ).impedimento).toMatch(/ya se fundió/)
  })

  it('control: dos expedientes normales SÍ se pueden fundir', () => {
    expect(planDeFusion(px({ id: 'a' }), { notas: 1 }, px({ id: 'b' }), { notas: 2 }).impedimento).toBeNull()
    // El mismo CURP en los dos no impide nada: es la señal más fuerte de que
    // son la misma persona.
    expect(planDeFusion(
      px({ id: 'a', curp: 'QUBE800315MDFRLR07' }), { notas: 1 },
      px({ id: 'b', curp: 'QUBE800315MDFRLR07' }), { notas: 2 },
    ).impedimento).toBeNull()
  })
})

describe('ASE-009 · la ruta que ejecuta, y lo que no se le concede al navegador', () => {
  it('la decisión se recalcula en el SERVIDOR con los documentos reales', () => {
    // Si el plan viajara desde la pantalla, quien controle el navegador
    // elegiría quién absorbe a quién y qué campos se pisan.
    expect(ruta).toMatch(/const plan = planDeFusion\(a, \{ notas: notasA/)
    expect(ruta).not.toMatch(/body\.plan/)
  })

  it('pide `administrar`: juntar dos historias no es trabajo del mostrador', () => {
    expect(ruta).toMatch(/verificarCapacidad\(req, clinicId, 'administrar'\)/)
  })

  it('la nota firmada se copia VERBATIM: si se le tocara un campo, se rompe su hash', () => {
    expect(ruta).toMatch(/destinoDoc\.set\(doc\.data\(\)\)/)
  })

  it('el absorbido se MARCA, no se borra', () => {
    expect(ruta).toMatch(/fusionadoEn: plan\.sobreviveId/)
    expect(ruta).not.toMatch(/recursiveDelete|absorbidoRef\.delete\(/)
  })

  it('el asiento lleva los dos ids y lo que no se copió', () => {
    expect(ruta).toMatch(/accion: 'fusion-de-expedientes'/)
    expect(ruta).toMatch(/absorbido: plan\.absorbidoId/)
    expect(ruta).toMatch(/noSeCopiaron: plan\.conflictos/)
  })
})

describe('ASE-009 · la pantalla enseña el plan ANTES de fundir', () => {
  it('el diálogo de duplicados ofrece la salida que faltaba', () => {
    expect(pantalla).toMatch(/Son la misma persona…/)
    expect(pantalla).toMatch(/pedirPlanDeFusion/)
  })

  it('se pide el plan en modo simulación primero', () => {
    expect(pantalla).toMatch(/simular: true/)
  })

  it('se enseña qué se pierde, con nombre y valor', () => {
    expect(pantalla).toMatch(/loQueSePierde\(porFundir\.plan\)/)
    expect(pantalla).toMatch(/Lo que se pierde/)
  })

  it('el texto del diálogo ya no promete que nada se junta', () => {
    expect(pantalla).not.toMatch(/Nada se junta ni se borra solo/)
  })
})
