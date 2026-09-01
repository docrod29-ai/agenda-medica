#!/usr/bin/env node
/**
 * UNA HISTORIA LARGA, PARA PODER JUZGAR LA LÍNEA DE TIEMPO.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * `scripts/design/sembrar-emulador.mjs` siembra UN encuentro. Con eso se puede
 * comprobar que el expediente PINTA — y no se puede juzgar nada de lo que la
 * línea de tiempo existe para responder: qué pasó, cuándo, qué cambió, qué
 * continúa, qué terminó, qué falta. Con una muestra de uno, decir «cuenta una
 * historia» sería opinar.
 *
 * Esto añade a `pac-001` **once encuentros repartidos en tres años**, con las
 * cosas que hacen difícil una línea de tiempo de verdad:
 *
 *   · un problema que empieza, se controla y se resuelve
 *   · un problema crónico que sigue abierto los tres años
 *   · un medicamento que se inicia, se ajusta y se suspende
 *   · una alergia descubierta a mitad de la historia
 *   · dos consultas el mismo día (una de ellas, una interconsulta)
 *   · un hueco de catorce meses sin visitas
 *   · una nota en BORRADOR entre firmadas — el estado que no debe verse igual
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No inventa una sola cifra clínica: ni dosis, ni umbral, ni resultado de
 * laboratorio. `clinical-safety.md` §1 — un número plausible en un fixture
 * acaba citándose como si fuera algo, y aquí lo que se mide es si la PANTALLA
 * deja leer una historia, no lo que la historia dice. Los medicamentos son
 * sintéticos y se llaman así.
 *
 * Cero pacientes reales, como todo lo que toca este emulador.
 *
 *     node scripts/ausculta-transformacion/sembrar-historia-larga.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
const PROYECTO = 'demo-nexusmed-v10'
const CLINICA = 'consultorio-demo-v10'
const PACIENTE = 'pac-001'

initializeApp({ projectId: PROYECTO })
const db = getFirestore()

const hoy = new Date()
/** Una fecha a N meses hacia atrás, con hora fija para que sea reproducible. */
const haceMeses = (n, dia = 15) => {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - n, dia, 10, 0, 0)
  return d
}
const iso = d => d.toISOString()
const soloFecha = d => iso(d).slice(0, 10)

/**
 * Los once encuentros. `mes` es cuántos meses atrás; el hueco entre el 26 y el
 * 12 es deliberado: catorce meses sin venir es lo que de verdad complica leer
 * una historia, y ninguna captura con un solo encuentro lo enseña.
 */
const HISTORIA = [
  { mes: 34, tipo: 'primera_vez', titulo: 'Primera vez',
    resumen: 'Motivo sintético de medición. Se abre el expediente.' },
  { mes: 32, tipo: 'seguimiento', titulo: 'Seguimiento',
    resumen: 'Continúa en control. Se inicia Medicamento sintético A.' },
  { mes: 26, tipo: 'seguimiento', titulo: 'Seguimiento',
    resumen: 'Sin cambios. Se pide estudio de control.' },
  /* El hueco: de 26 a 12 no viene. Catorce meses. */
  { mes: 12, tipo: 'seguimiento', titulo: 'Regresa tras un año sin consulta',
    resumen: 'Vuelve después de catorce meses. Se revisa lo que quedó abierto.' },
  { mes: 11, tipo: 'seguimiento', titulo: 'Seguimiento',
    resumen: 'Se ajusta Medicamento sintético A.' },
  { mes: 8, tipo: 'seguimiento', titulo: 'Aparece una alergia',
    resumen: 'Reacción a Medicamento sintético C. Queda registrada como alergia.' },
  { mes: 6, tipo: 'seguimiento', titulo: 'Seguimiento',
    resumen: 'Se suspende Medicamento sintético A. Se cierra el problema agudo.' },
  { mes: 3, tipo: 'interconsulta', titulo: 'Interconsulta',
    resumen: 'Valoración por otra especialidad, el mismo día que la consulta.', dia: 12 },
  { mes: 3, tipo: 'seguimiento', titulo: 'Seguimiento',
    resumen: 'Dos encuentros el mismo día: la línea de tiempo tiene que separarlos.', dia: 12 },
  { mes: 1, tipo: 'seguimiento', titulo: 'Seguimiento',
    resumen: 'Control del problema crónico, que sigue abierto.' },
  /* El borrador: entre firmadas, y NO puede verse igual que ellas. */
  { mes: 0, tipo: 'seguimiento', titulo: 'Consulta de hoy, sin firmar',
    resumen: 'Borrador en curso. No es un documento todavía.', borrador: true, dia: hoy.getDate() },
]

const MEDICO = 'Dra. Ximena Alcántara Robledo (sintética)'

async function sembrar() {
  let n = 0
  for (const [i, e] of HISTORIA.entries()) {
    const f = haceMeses(e.mes, e.dia ?? 15)
    const id = `hist-${String(i + 1).padStart(2, '0')}`
    const firmada = !e.borrador
    /*
     * Se siembra contra el TIPO `NotaMedica`, no contra el lector que se tenga
     * a mano: `metadata` y `secciones` son obligatorios y el visor medicolegal
     * los lee sin guarda. Es la lección que ya está escrita en el sembrador
     * principal, y que aquí se hereda en vez de volver a aprenderse.
     */
    await db.doc(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${id}`).set({
      id,
      clinicId: CLINICA,
      pacienteId: PACIENTE,
      tipo: e.tipo,
      estado: firmada ? 'firmada' : 'borrador',
      fechaConsulta: soloFecha(f),
      ...(firmada ? { firmadaEn: iso(f) } : {}),
      medicoNombre: MEDICO,
      /* `resumenEjecutivo`, no `resumen`: es el campo que lee la línea de
         tiempo del expediente. Sembrar contra el nombre que uno recuerda es
         cómo se acaba mirando doce filas que dicen «Sin resumen» y creyendo
         que el defecto está en la pantalla. */
      resumenEjecutivo: e.resumen,
      metadata: {
        id,
        tipoNota: e.tipo,
        clinicId: CLINICA,
        pacienteId: PACIENTE,
        cedulaProfesional: 'CED-SINTETICA-0000',
        especialidad: 'Medicina Interna (sintética)',
        establecimiento: 'Consultorio sintético de medición',
        fechaCreacion: iso(f),
        fechaModificacion: iso(f),
        /* Sello vacío a propósito: inventar un SHA-256 pintaría la nota de
           «pudo haber sido alterada» y el arnés mediría una alarma falsa. */
        hashIntegridad: '',
        version: 1,
        estado: firmada ? 'firmada' : 'borrador',
        fuenteGeneracion: 'manual',
      },
      ...(firmada ? {
        firma: {
          nombreMedico: MEDICO,
          cedulaProfesional: 'CED-SINTETICA-0000',
          especialidad: 'Medicina Interna (sintética)',
          timestamp: iso(f),
          hashFirma: '',
        },
      } : {}),
      secciones: [
        { key: 'subjetivo', label: 'Subjetivo', value: e.resumen },
        { key: 'objetivo', label: 'Objetivo', value: 'Contenido sintético de medición.' },
        { key: 'analisis', label: 'Análisis', value: 'Contenido sintético de medición.' },
        { key: 'plan', label: 'Plan', value: 'Contenido sintético de medición.' },
      ],
      medicamentos: [],
    })
    n++
  }

  console.log(`\n  ✓ ${n} encuentros sembrados en ${PACIENTE}`)
  console.log(`\n    tres años  ${soloFecha(haceMeses(34))} → ${soloFecha(hoy)}`)
  console.log('    con        un hueco de 14 meses · dos consultas el mismo día')
  console.log('               una alergia a mitad · un borrador entre firmadas')
  console.log('\n  Cero pacientes reales. Cero cifras clínicas inventadas.\n')
}

sembrar().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
