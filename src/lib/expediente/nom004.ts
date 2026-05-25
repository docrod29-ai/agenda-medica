import type { NotaMedica, ValidationResult } from '@/types/expediente'
import { requiereSignosVitales } from './templates'

/**
 * Validación NOM-004-SSA3-2012.
 * Se ejecuta antes de permitir firmar una nota.
 * Los campos obligatorios (*) no pueden quedar vacíos.
 */
export function validarNOM004(nota: NotaMedica): ValidationResult {
  const errores: string[] = []
  const advertencias: string[] = []

  // ── Campos universales ───────────────────────────────────────
  if (!nota.metadata.medicoId) errores.push('Falta identificación del médico')
  if (!nota.metadata.cedulaProfesional) errores.push('Falta cédula profesional del médico')
  if (!nota.fechaConsulta) errores.push('Falta fecha y hora de la nota')

  // ── Secciones obligatorias del tipo de nota ──────────────────
  for (const s of nota.secciones) {
    if (s.obligatorio && !s.value.trim()) {
      errores.push(`Falta: ${s.label}`)
    }
  }

  // ── Diagnóstico obligatorio (excepto evolución que puede heredar) ──
  const requiereDx = ['historia_clinica', 'primera_vez', 'ingreso', 'egreso'].includes(nota.tipo)
  if (requiereDx && nota.diagnosticos.length === 0) {
    errores.push('Falta al menos un diagnóstico')
  }

  // ── Signos vitales ───────────────────────────────────────────
  if (requiereSignosVitales(nota.tipo)) {
    const sv = nota.signosVitales
    const tieneAlgo = sv && (sv.fc || sv.fr || sv.ta || sv.temperatura)
    if (!tieneAlgo) {
      advertencias.push('No se registraron signos vitales')
    }
  }

  // ── Alergias documentadas (puede ser "sin alergias" pero debe constar) ──
  if (nota.alergias.length === 0) {
    advertencias.push('Las alergias no están documentadas (registre "Niega alergias" si aplica)')
  }

  // ── Detector de inconsistencias clínicas ─────────────────────
  // Medicamento al que el paciente es alérgico
  for (const med of nota.medicamentos) {
    for (const al of nota.alergias) {
      if (al.tipo === 'medicamento' &&
          med.nombre.toLowerCase().includes(al.alergeno.toLowerCase().split(' ')[0])) {
        errores.push(`⚠️ Posible alergia: se prescribe "${med.nombre}" y el paciente refiere alergia a "${al.alergeno}"`)
      }
    }
  }
  // Diagnóstico de infección sin antibiótico (alerta blanda)
  const dxInfeccion = nota.diagnosticos.some(d =>
    /infec|bacter|sepsis|neumon|absceso|celulitis|itu|candidi/i.test(d.descripcion))
  if (dxInfeccion && nota.medicamentos.length === 0 &&
      ['primera_vez', 'ingreso', 'historia_clinica'].includes(nota.tipo)) {
    advertencias.push('Diagnóstico infeccioso sin tratamiento antimicrobiano en el plan')
  }

  return {
    valida: errores.length === 0,
    errores,
    advertencias,
    puntajeCompletitud: calcularCompletitud(nota),
  }
}

function calcularCompletitud(nota: NotaMedica): number {
  let total = 0
  let lleno = 0
  for (const s of nota.secciones) {
    total++
    if (s.value.trim()) lleno++
  }
  // bonus por estructurados
  total += 3
  if (nota.diagnosticos.length) lleno++
  if (nota.medicamentos.length || nota.tipo === 'seguimiento') lleno++
  if (nota.signosVitales && Object.values(nota.signosVitales).some(Boolean)) lleno++
  return total === 0 ? 0 : Math.round((lleno / total) * 100)
}
