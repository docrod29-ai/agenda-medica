import type { NotaMedica, ValidationResult } from '@/types/expediente'
import { requiereSignosVitales } from './templates'
import { validarAlergiasVsMedicamentos } from './medical-dictionary'
import { validarFormatoCie10 } from '../cie10'
import { desdeSeveridadHeredada, etiquetaDe, detiene } from '@/lib/seguridad/clasificacion'

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
      // Token del alérgeno (primera palabra). Guardamos contra vacío/trivial:
      // sin este piso, `''.split(' ')[0]` = '' y `nombre.includes('')` === true
      // marcaría FALSA alergia en TODO medicamento y bloquearía la firma.
      const token = al.alergeno.toLowerCase().trim().split(/\s+/)[0]
      if (al.tipo === 'medicamento' && token.length >= 3 &&
          med.nombre.toLowerCase().includes(token)) {
        errores.push(`⚠️ Posible alergia: se prescribe "${med.nombre}" y el paciente refiere alergia a "${al.alergeno}"`)
      }
    }
  }
  // Reactividad CRUZADA por familias (betalactámicos, sulfas, AINE, macrólidos…):
  // el matcher inteligente ahora es parte de la COMPUERTA que bloquea la firma,
  // no solo un aviso. Antes esta lógica fuerte no gateaba (seguridad invertida):
  // p. ej. alergia a penicilina + prescripción de cefalexina NO se detectaba con
  // el match por subcadena de arriba, pero sí aquí.
  for (const alerta of validarAlergiasVsMedicamentos(nota.alergias, nota.medicamentos)) {
    /**
     * LA ALERTA DICE QUÉ ES, NO SÓLO QUE ES ROJA.
     *
     * Antes todas las críticas salían igual: un renglón rojo indistinguible.
     * Con `info | advertencia | critica`, «contraindicado», «ajusta la dosis» y
     * «vigila el potasio» eran la misma cosa en pantalla — y cuando todo es
     * crítico, nada lo es.
     *
     * La traducción es CONSERVADORA a propósito (ver `clasificacion.ts`): cada
     * severidad heredada conserva exactamente la conducta que ya tenía. Lo único
     * que cambia hoy es que la alerta se NOMBRA. El detalle fino de qué fármaco
     * es BLOCK y cuál es AVOID lo asigna el médico, no este archivo.
     */
    const clase = desdeSeveridadHeredada(alerta.severidad)
    const nombrada = `[${etiquetaDe(clase)}] ${alerta.mensaje}`
    if (detiene(clase)) {
      // Evita duplicar si el match exacto de arriba ya lo reportó.
      if (!errores.some(e => e.includes(alerta.mensaje))) errores.push(`⚠️ ${nombrada}`)
    } else if (alerta.severidad === 'advertencia') {
      advertencias.push(nombrada)
    }
  }
  // Diagnóstico de infección sin antibiótico (alerta blanda)
  const dxInfeccion = nota.diagnosticos.some(d =>
    /infec|bacter|sepsis|neumon|absceso|celulitis|itu|candidi/i.test(d.descripcion))
  if (dxInfeccion && nota.medicamentos.length === 0 &&
      ['primera_vez', 'ingreso', 'historia_clinica'].includes(nota.tipo)) {
    advertencias.push('Diagnóstico infeccioso sin tratamiento antimicrobiano en el plan')
  }
  // Código CIE-10 con formato inválido = probable alucinación de la IA (el prompt
  // le prohíbe fabricarlos). Advertencia para que el médico lo verifique/corrija.
  for (const dx of nota.diagnosticos) {
    if (dx.codigoCIE10 && dx.codigoCIE10.trim() && !validarFormatoCie10(dx.codigoCIE10)) {
      advertencias.push(`Código CIE-10 con formato inválido: "${dx.codigoCIE10}" en "${dx.descripcion}" — verificar`)
    }
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
