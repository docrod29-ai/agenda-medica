#!/usr/bin/env node
/**
 * DE «10 000 MÉDICOS» A OPERACIONES POR SEGUNDO.
 *
 * ── POR QUÉ ESTE ARCHIVO EXISTE ──────────────────────────────────────────────
 *
 * «Soportamos 10 000 médicos» no significa nada por sí solo. Diez mil médicos
 * registrados que no están conectados no producen ni una petición. La cifra que
 * decide si el sistema aguanta es OTRA: cuántas consultas hay abiertas a la vez
 * a las 11 de la mañana de un martes, y cuántas escrituras genera cada una.
 *
 * #310 lo dice con todas las letras: «no equiparar el tamaño del fixture con la
 * capacidad» y «picos de consulta concurrentes reales, no sólo cuentas
 * registradas». Este módulo es la traducción, y es determinista: los mismos
 * parámetros dan siempre las mismas tasas, así que dos ejecuciones se pueden
 * comparar.
 *
 * ── DE DÓNDE SALEN LOS PARÁMETROS ────────────────────────────────────────────
 *
 * De comportamiento OBSERVABLE en este repositorio, no de la industria:
 *
 *  · autoguardado cada 30 s → 2 escrituras/min por consulta abierta
 *    (`consulta/[patientId]/page.tsx`, `setInterval(..., 30000)`);
 *  · el respaldo local es cada cambio, pero no toca la red — no cuenta;
 *  · transcripción por fragmentos (`transcribir-chunk`);
 *  · una nota firmada por consulta;
 *  · el resto —consultas por médico y día, fracción simultánea— son PARÁMETROS
 *    DECLARADOS, no medidos. Van marcados como tales en la salida para que
 *    nadie los lea como observación.
 *
 * NO se inventa un número «típico de la industria» y se presenta como dato.
 * Cada parámetro lleva su procedencia: `medido-en-repo` o `supuesto-declarado`.
 */

/**
 * El origen de cada parámetro. La distinción no es burocracia: un resultado
 * calculado sobre supuestos es un MODELO, y llamarlo medición sería justo la
 * clase de afirmación que #310 prohíbe.
 */
export const PROCEDENCIA = {
  MEDIDO: 'medido-en-repo',
  SUPUESTO: 'supuesto-declarado',
}

/** Perfil de comportamiento de una consulta abierta. */
export const PERFIL_CONSULTA = {
  autoguardadosPorMinuto: { valor: 2, procedencia: PROCEDENCIA.MEDIDO, fuente: 'setInterval(30000) en consulta/[patientId]/page.tsx' },
  fragmentosTranscripcionPorMinuto: { valor: 2, procedencia: PROCEDENCIA.SUPUESTO, fuente: 'fragmentos de ~30 s; no medido contra tráfico real' },
  duracionMediaMin: { valor: 20, procedencia: PROCEDENCIA.SUPUESTO, fuente: 'consulta de internista; no medido' },
  trabajosRazonamientoPorConsulta: { valor: 3, procedencia: PROCEDENCIA.SUPUESTO, fuente: 'estructurar + razonar + verificar' },
  trabajosEvidenciaPorConsulta: { valor: 1, procedencia: PROCEDENCIA.SUPUESTO, fuente: 'una búsqueda por encuentro' },
  documentosPorConsulta: { valor: 2, procedencia: PROCEDENCIA.SUPUESTO, fuente: 'nota + receta' },
  aperturasPacientePorConsulta: { valor: 1, procedencia: PROCEDENCIA.MEDIDO, fuente: 'una navegación a /consulta/[patientId]' },
  busquedasPorConsulta: { valor: 1, procedencia: PROCEDENCIA.SUPUESTO, fuente: 'la asistente busca al paciente antes de abrir' },
}

/** Perfil administrativo por médico y día. */
export const PERFIL_AGENDA = {
  consultasPorMedicoPorDia: { valor: 16, procedencia: PROCEDENCIA.SUPUESTO, fuente: 'jornada de consultorio; no medido' },
  escriturasAgendaPorMedicoPorDia: { valor: 24, procedencia: PROCEDENCIA.SUPUESTO, fuente: 'altas + reagendas + cancelaciones' },
  horasPicoPorDia: { valor: 6, procedencia: PROCEDENCIA.SUPUESTO, fuente: 'la jornada real no es de 24 h' },
  fraccionSimultaneaEnPico: { valor: 0.12, procedencia: PROCEDENCIA.SUPUESTO, fuente: 'fracción de médicos con consulta abierta a la vez en el pico' },
}

/**
 * Traduce una cohorte a tasas por segundo, por clase de trabajo.
 *
 * Devuelve TAMBIÉN los supuestos usados: un resultado sin sus supuestos no se
 * puede discutir, y uno que no se puede discutir acaba citado como si fuera un
 * hecho.
 */
export function modelarCarga({
  registeredPhysicians,
  fraccionSimultanea = PERFIL_AGENDA.fraccionSimultaneaEnPico.valor,
  perfilConsulta = PERFIL_CONSULTA,
  perfilAgenda = PERFIL_AGENDA,
}) {
  if (!Number.isInteger(registeredPhysicians) || registeredPhysicians < 1) {
    throw new Error('registeredPhysicians debe ser un entero positivo')
  }
  if (!(fraccionSimultanea > 0 && fraccionSimultanea <= 1)) {
    throw new Error('fraccionSimultanea debe estar en (0, 1]')
  }

  const consultasConcurrentes = Math.max(1, Math.round(registeredPhysicians * fraccionSimultanea))
  const porMin = (n) => n / 60

  // Cada consulta abierta produce escrituras mientras dura. Las que dependen de
  // la duración se reparten sobre ella; las de una-vez-por-consulta se
  // convierten a tasa dividiendo por la duración media.
  const dur = perfilConsulta.duracionMediaMin.valor
  const porConsultaPorMin = (n) => n / dur

  const tasas = {
    'hot:guardar-borrador': porMin(consultasConcurrentes * perfilConsulta.autoguardadosPorMinuto.valor),
    'hot:abrir-paciente': porMin(consultasConcurrentes * porConsultaPorMin(perfilConsulta.aperturasPacientePorConsulta.valor)),
    'hot:abrir-encuentro': porMin(consultasConcurrentes * porConsultaPorMin(1)),
    'hot:buscar-paciente': porMin(consultasConcurrentes * porConsultaPorMin(perfilConsulta.busquedasPorConsulta.valor)),
    'hot:firmar-nota': porMin(consultasConcurrentes * porConsultaPorMin(1)),
    'async:transcripcion': porMin(consultasConcurrentes * perfilConsulta.fragmentosTranscripcionPorMinuto.valor),
    'async:razonamiento': porMin(consultasConcurrentes * porConsultaPorMin(perfilConsulta.trabajosRazonamientoPorConsulta.valor)),
    'async:evidencia': porMin(consultasConcurrentes * porConsultaPorMin(perfilConsulta.trabajosEvidenciaPorConsulta.valor)),
    'async:documento': porMin(consultasConcurrentes * porConsultaPorMin(perfilConsulta.documentosPorConsulta.valor)),
  }

  // La agenda no se mueve al ritmo de las consultas abiertas: se mueve todo el
  // día, y su pico es el mostrador por la mañana. Se reparte sobre las horas
  // pico, que es donde coincide con el pico de consulta.
  const segundosPico = perfilAgenda.horasPicoPorDia.valor * 3600
  tasas['hot:agendar-cita'] =
    (registeredPhysicians * perfilAgenda.escriturasAgendaPorMedicoPorDia.valor) / segundosPico
  tasas['async:notificacion'] = tasas['hot:agendar-cita']
  tasas['async:whatsapp'] = tasas['hot:agendar-cita'] * 0.8

  const total = Object.values(tasas).reduce((a, b) => a + b, 0)
  const calientes = Object.entries(tasas)
    .filter(([k]) => k.startsWith('hot:'))
    .reduce((a, [, v]) => a + v, 0)

  return {
    registeredPhysicians,
    concurrentConsultations: consultasConcurrentes,
    fraccionSimultanea,
    opsPorSegundo: Object.fromEntries(Object.entries(tasas).map(([k, v]) => [k, Number(v.toFixed(4))])),
    totalOpsPorSegundo: Number(total.toFixed(4)),
    caminoCalienteOpsPorSegundo: Number(calientes.toFixed(4)),
    /** Proporción lectura/escritura declarada, para dimensionar índices. */
    distribucionLecturaEscritura: { lectura: 0.6, escritura: 0.4, procedencia: PROCEDENCIA.SUPUESTO },
    supuestos: { perfilConsulta, perfilAgenda },
    advertencia:
      'Estas tasas son un MODELO derivado de parámetros declarados. No son una medición del sistema en ejecución y no constituyen evidencia de capacidad.',
  }
}
