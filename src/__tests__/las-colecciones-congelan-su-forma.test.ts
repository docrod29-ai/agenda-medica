/**
 * S-012 · Panel de Lujo (S-ciberseguridad) — la regla de seguridad dice que
 * toda colección lleva la forma congelada con `hasOnly`; siete de sesenta y
 * ocho la llevaban, y no existía ningún guardián que lo mirara.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `security-tenant.md` §1 exige la forma congelada. `patients`, `appointments`,
 * `memberships`, `membership_plans`, `reviews`, `chat`, `clinic_invitations`,
 * `clinic_members`, `waitlist`, `branches`, `time_blocks`, `learning`,
 * `chat_reads` y `hospital_roles` aceptaban cualquier campo con cualquier
 * valor. Sus cinco hijos graves (S-001, S-002, S-007, S-008, S-009) tienen su
 * propia entrada; esto es el CENSO y el guardián que faltaba.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor S-ciberseguridad, S-012; el equipo rojo corrigió el censo (siete, no
 * ocho; los congelados por campo y por valor cuentan) y sostuvo el vacío de
 * guardián: «no existe ningún test que exija forma congelada».
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * Todo bloque `match` con `create` o `update` abierto al cliente lleva
 * `hasOnly(`, `affectedKeys()` o `hasAny(` (forma congelada o bloqueo por
 * campo), o está en `EXENTAS` con motivo. La lista de exentas es un TRINQUETE:
 * sólo baja. Se prueba al revés: quitarle el hasOnly a `asr_aprendizaje` en
 * una copia lo pone rojo.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Que la lista de campos de cada hasOnly sea la CORRECTA (eso es de cada
 * hallazgo y del emulador). Los documentos clínicos de forma abierta (notas,
 * config, laboratorios…) quedan exentos con motivo: congelarlos es una unidad
 * aparte con riesgo de romper la consulta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = process.cwd()
const reglasCrudas = readFileSync(resolve(RAIZ, 'firestore.rules'), 'utf8')
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

interface Bloque { ruta: string; cuerpo: string }

/** Cada `match` de las reglas con su cuerpo directo (sin los match anidados). */
export function bloques(texto: string): Bloque[] {
  const lineas = sinComentarios(texto).split('\n')
  const pila: { ruta: string; lineas: string[] }[] = []
  const out: Bloque[] = []
  let prof = 0
  const cierres: number[] = []
  for (const l of lineas) {
    const m = l.match(/^\s*match\s+(\S+)\s*\{\s*$/)
    if (m) {
      pila.push({ ruta: m[1], lineas: [] })
      cierres.push(prof)
      prof++
      continue
    }
    const apertura = (l.match(/\{/g) || []).length
    const cierre = (l.match(/\}/g) || []).length
    if (pila.length && !/^\s*(function|match)\b/.test(l)) pila[pila.length - 1].lineas.push(l)
    prof += apertura - cierre
    while (pila.length && prof <= cierres[cierres.length - 1]) {
      const b = pila.pop()!
      cierres.pop()
      // El `match /databases/{database}/documents` de fuera envuelve a todos y
      // no dice nada de la colección. Dejarlo dentro hacía que NINGUNA ruta
      // casara con la lista de exentas ni con las del hallazgo: el guardián
      // pasaba por vacío en la mitad de sus casos y gritaba en la otra mitad.
      const ruta = [...pila.map(p => p.ruta), b.ruta].join('').replace(/^\/databases\/\{database\}\/documents/, '')
      out.push({ ruta, cuerpo: b.lineas.join('\n') })
    }
  }
  return out
}

/** ¿El cliente puede crear o actualizar aquí? (`allow create|update|write` que no sea `if false`). */
function escrituraAbiertaAlCliente(cuerpo: string): boolean {
  const reglas = [...cuerpo.matchAll(/allow ([a-z, ]+):\s*if\s+([\s\S]*?);/g)]
  return reglas.some(([, ops, cond]) =>
    /\b(create|update|write)\b/.test(ops) && !/^\s*false\s*$/.test(cond))
}

function formaCongelada(cuerpo: string): boolean {
  return /hasOnly\(|affectedKeys\(\)|keys\(\)\.hasAny\(/.test(cuerpo)
}

export function sinFormaCongelada(texto: string): string[] {
  return bloques(texto)
    .filter(b => escrituraAbiertaAlCliente(b.cuerpo) && !formaCongelada(b.cuerpo))
    .map(b => b.ruta)
}

/**
 * TRINQUETE: lo que hoy escribe el cliente sin forma congelada, con el motivo
 * por el que no se cerró en esta pasada. Sólo se quita; nunca se añade.
 *
 * Bajó de 27 a 20 el 2026-09-06: siete entradas ya congelaban su forma —por
 * campo (`affectedKeys`) o con `hasOnly`— y sólo seguían en la lista porque el
 * lector de rutas arrastraba el `/databases/{database}/documents` de fuera y
 * ninguna casaba. Corregido el lector, se quitan: `clinics`, los `signos` y las
 * `icu_observations` de internamiento, `hospital_alertas`, `config/{docId}`,
 * `clinic_review_requests` y `clinic_members`.
 */
const EXENTAS: Record<string, string> = {
  '/clinics/{clinicId}/patients/{docId}/notas/{notaId}': 'La nota clínica: documento grande y en evolución (metadata, secciones, procedencia). Congelar su forma es una unidad aparte con riesgo de romper la consulta.',
  '/clinics/{clinicId}/patients/{docId}/notas/{notaId}/versions/{versionId}': 'Instantánea inmutable de la nota: misma forma abierta que la nota.',
  '/clinics/{clinicId}/patients/{docId}/notas/{notaId}/adendas/{adendaId}': 'Autor y motivo exigidos por valor; el texto es libre.',
  '/clinics/{clinicId}/patients/{docId}/laboratorios/{labId}': 'Panel extraído de PDF/foto: pacienteId y clinicId exigidos por valor; los analitos son abiertos.',
  '/clinics/{clinicId}/patients/{docId}/fotos/{fotoId}': 'Fotografía clínica: metadatos abiertos, sólo médico.',
  '/clinics/{clinicId}/patients/{docId}/clinico/{clinicoId}': 'Resumen clínico (E0-06): su forma la fija el tipo ResumenClinicoPaciente; sólo médico.',
  '/clinics/{clinicId}/internamientos/{intId}/handoff_revisiones/{diaId}': 'Revisión de entrega de turno: por y en exigidos por valor.',
  '/clinics/{clinicId}/laboratorio/{ordenId}': 'Órdenes de laboratorio del hospital (D-030 en pausa).',
  '/clinics/{clinicId}/camas/{camaId}': 'Inventario de camas (D-030 en pausa), sólo médico.',
  '/clinics/{clinicId}/unidades/{unidadId}': 'Unidades del hospital (D-030 en pausa), sólo médico.',
  '/clinics/{clinicId}/config/firma': 'Firma y sello del médico: sólo médico, un documento.',
  '/clinics/{clinicId}/dosing_validations/{farmacoId}': 'Firma de validación de dosis: sólo médico.',
  '/clinics/{clinicId}/antimicrobial_limits/{limiteId}': 'Topes antimicrobianos: sólo médico.',
  '/clinics/{clinicId}/doctors/{docId}': 'Catálogo de médicos: sólo médico.',
  '/clinics/{clinicId}/asr_aprendizaje/{palabra}': 'NO está exenta: lleva hasOnly. Figura aquí sólo para que la prueba al revés tenga a quién quitárselo.',
  '/clinics/{clinicId}/arco_requests/{docId}': 'Congelada por campo (lo que declaró el solicitante); el resto lo escribe el consultorio al resolver.',
  '/clinics/{clinicId}/farmacia/{itemId}': 'Inventario de farmacia: cantidad numérica ≥ 0 exigida; forma abierta.',
  '/clinics/{clinicId}/farmacia_movimientos/{movId}': 'Movimientos: autor sellado por valor; inmutables.',
  '/clinics/{clinicId}/tareas_clinicas/{tareaId}': 'Tareas clínicas: modelo en evolución (TareaClinica), sólo médico, sin borrado.',
  '/clinics/{clinicId}/cobros/{cobroId}': 'Congelado por campo: monto, método, concepto, fecha, vínculos, autor y anulación.',
}

describe('S-012 · toda colección que el cliente escribe congela su forma, o está exenta con motivo', () => {
  const abiertas = sinFormaCongelada(reglasCrudas)

  it('el parser ve bloques de verdad', () => {
    const todos = bloques(reglasCrudas).map(b => b.ruta)
    expect(todos).toContain('/clinics/{clinicId}/patients/{docId}')
    expect(todos).toContain('/clinics/{clinicId}/patients/{docId}/notas/{notaId}/adendas/{adendaId}')
    expect(todos.length).toBeGreaterThan(60)
  })

  it('las del hallazgo YA congelan su forma', () => {
    for (const r of [
      '/clinics/{clinicId}/patients/{docId}', '/clinics/{clinicId}/appointments/{docId}',
      '/clinics/{clinicId}/memberships/{membershipId}', '/clinics/{clinicId}/membership_plans/{planId}',
      '/clinics/{clinicId}/reviews/{reviewId}', '/clinics/{clinicId}/chat/{msgId}', '/clinic_invitations/{code}',
      '/clinics/{clinicId}/waitlist/{docId}', '/clinics/{clinicId}/branches/{branchId}',
      '/clinics/{clinicId}/time_blocks/{blockId}', '/clinics/{clinicId}/learning/{uid}',
      '/clinics/{clinicId}/chat_reads/{uid}', '/clinics/{clinicId}/hospital_roles/{uid}',
    ]) {
      expect(abiertas, `${r} sigue sin forma congelada`).not.toContain(r)
    }
  })

  it('lo que sigue abierto está en EXENTAS con motivo (y la lista sólo baja)', () => {
    const sinMotivo = abiertas.filter(r => !EXENTAS[r])
    expect(sinMotivo, `colecciones escribibles sin forma congelada ni exención: ${sinMotivo.join(', ')}`).toEqual([])
    const yaCongeladas = Object.keys(EXENTAS).filter(r => !abiertas.includes(r) && !r.includes('asr_aprendizaje'))
    expect(yaCongeladas, `quitar de EXENTAS (ya congelan su forma): ${yaCongeladas.join(', ')}`).toEqual([])
  })

  it('al revés: quitarle el hasOnly a asr_aprendizaje lo pone rojo', () => {
    const rota = reglasCrudas.replace(/&& request\.resource\.data\.keys\(\)\.hasOnly\(\['palabra', 'veces', 'oidoComo', 'actualizadoEn'\]\)\n/, '')
    expect(rota).not.toBe(reglasCrudas)
    expect(sinFormaCongelada(rota)).toContain('/clinics/{clinicId}/asr_aprendizaje/{palabra}')
    expect(abiertas).not.toContain('/clinics/{clinicId}/asr_aprendizaje/{palabra}')
  })
})
