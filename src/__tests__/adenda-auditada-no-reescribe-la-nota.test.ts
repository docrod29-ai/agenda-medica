/**
 * GOLDEN PATH 10 — una nota firmada no se reescribe; sólo admite una adenda
 * separada, atribuida a la sesión y auditada.
 *
 * Esta prueba es deliberadamente estructural: protege las dos fronteras que
 * tienen que coincidir para que una enmienda no se convierta en un bypass de la
 * firma. Las reglas mantienen inmutable el documento firmado y la subcolección
 * de adendas; el helper productivo vuelve a comprobar que el padre está firmado,
 * exige motivo y emite la bitácora sin copiar texto clínico al metadata.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const firestore = readFileSync(join(process.cwd(), 'src/lib/expediente/firestore.ts'), 'utf8')
const reglas = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8')
const eventos = readFileSync(join(process.cwd(), 'src/lib/expediente/audit-eventos.ts'), 'utf8')

function cuerpoAgregarAdenda(): string {
  const inicio = firestore.indexOf('export async function agregarAdenda(')
  const fin = firestore.indexOf('/** Lee las adendas', inicio)
  expect(inicio).toBeGreaterThan(-1)
  expect(fin).toBeGreaterThan(inicio)
  return firestore.slice(inicio, fin)
}

describe('GP10 — el documento firmado sigue siendo la verdad inmutable', () => {
  it('Firestore continúa rechazando la edición directa de una nota firmada', () => {
    expect(reglas).toContain("allow update: if isMedico(clinicId) && resource.data.estado != 'firmada'")
  })

  it('una adenda tampoco puede editarse ni borrarse después de creada', () => {
    const bloque = reglas.slice(reglas.indexOf('match /adendas/{adendaId}'))
    expect(bloque).toContain('allow update, delete: if false')
  })
})

describe('GP10 — la única vía de corrección falla cerrada', () => {
  const cuerpo = cuerpoAgregarAdenda()

  it('comprueba el padre y rechaza una adenda sobre borrador o nota inexistente', () => {
    expect(cuerpo).toContain('const notaSnap = await getDoc(notaRef)')
    expect(cuerpo).toContain("if (!notaSnap.exists()) throw new Error('No existe la nota que se quiere enmendar.')")
    expect(cuerpo).toContain("if (notaSnap.data().estado !== 'firmada')")
  })

  it('el autor sale de la sesión autenticada, no del formulario', () => {
    expect(cuerpo).toContain("const autorUid = auth.currentUser?.uid ?? ''")
    expect(cuerpo).toContain("if (!autorUid) throw new Error('Debes iniciar sesión para agregar una adenda.')")
    expect(cuerpo).toContain('const completo = { ...data, texto, motivo, autorUid, createdAt }')
  })

  it('exige texto y un motivo compatible con el contrato ya vigente', () => {
    expect(cuerpo).toContain("const texto = data.texto?.trim() ?? ''")
    expect(cuerpo).toContain("const motivo = data.motivo?.trim() ?? ''")
    expect(cuerpo).toContain('if (!texto)')
    expect(cuerpo).toContain('if (motivo.length < 5 || motivo.length > 500)')
  })

  it('crea un hijo separado; nunca actualiza el documento firmado', () => {
    expect(cuerpo).toContain("collection(notaRef, 'adendas')")
    expect(cuerpo).not.toContain('updateDoc(')
  })
})

describe('GP10 — toda enmienda deja rastro sin duplicar PHI en la bitácora', () => {
  const cuerpo = cuerpoAgregarAdenda()

  it('el catálogo de auditoría reconoce nota_adenda', () => {
    expect(eventos).toContain("'nota_adenda'")
  })

  it('la creación exitosa emite nota_adenda ligada a paciente, nota y adenda', () => {
    expect(cuerpo).toContain("evento: 'nota_adenda'")
    expect(cuerpo).toContain('patientId,')
    expect(cuerpo).toContain('notaId,')
    expect(cuerpo).toContain('meta: { adendaId: ref.id }')
  })

  it('el audit metadata no copia texto ni motivo clínico', () => {
    const audit = cuerpo.slice(cuerpo.indexOf('void logAudit({'), cuerpo.indexOf('return { ...completo', cuerpo.indexOf('void logAudit({')))
    expect(audit).not.toContain('texto')
    expect(audit).not.toContain('motivo')
  })
})
