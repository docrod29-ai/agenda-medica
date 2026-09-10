/**
 * WS-02 — EL SEGUNDO OBJETIVO: 100 000 PERSONAS ACTIVAS A LA VEZ.
 *
 * ── POR QUÉ UN ARCHIVO APARTE ───────────────────────────────────────────────
 *
 * `modelo-de-concurrencia.mjs` traduce «N usuarios REGISTRADOS» a sesiones: es
 * un inventario del que se deriva una foto. El dueño confirmó el 9-sep-2026 («Las
 * dos») un objetivo DISTINTO e independiente: **100 000 personas activas al mismo
 * tiempo**, cada una una identidad distinta haciendo cosas en la ventana del
 * ensayo, sin multiplicar por pestañas ni conexiones inactivas.
 *
 * Eso NO se deriva de los registrados: es un dato de entrada. Y trae la pregunta
 * que el modelo anterior no tenía que contestar: **quiénes son esas 100 000
 * personas**. No son 100 000 médicos dictando a la vez — el contrato lo dice
 * explícitamente— y la mezcla decide todo lo demás: caudal, escrituras, IA,
 * documentos residentes. Por eso la mezcla se DECLARA aquí, con su base, y lleva
 * `medidoEn: null` como todos los supuestos del modelo hermano.
 *
 * ── LO QUE NO HACE ─────────────────────────────────────────────────────────
 *
 * No aprueba nada ni fija umbral: `PENDIENTE_DEL_DUENO` sigue en cada casilla.
 * No cabe en el arnés local (400 sesiones) y lo dice con nombre; ofrece un CORTE
 * LOCAL de la misma mezcla, etiquetado como lo que es: un ensayo de humo del
 * generador, **no evidencia del objetivo**.
 */
import {
  PENDIENTE_DEL_DUENO, VERSION_DEL_MODELO, PETICIONES_POR_CONSULTA, SUPUESTOS,
  COTAS_LOCALES, LO_QUE_MIDE_LA_CORRIDA,
} from './modelo-de-concurrencia.mjs'

const S = Object.fromEntries(SUPUESTOS.map(s => [s.id, s.valor]))

/* ── 1 · quiénes son las personas activas ─────────────────────────────────── */
export const MEZCLA_DE_ROLES = Object.freeze([
  {
    rol: 'medico', fraccion: 0.08,
    base: 'Un médico atiende ~18 consultas al día y el consultorio tipo tiene 2 médicos y 1 recepción: por cada persona del consultorio hay muchas más pacientes con motivo para abrir el portal ese día.',
    medidoEn: null,
  },
  {
    rol: 'recepcion', fraccion: 0.04,
    base: 'Una recepción por consultorio de dos médicos (supuesto `medicosPorConsultorio`).',
    medidoEn: null,
  },
  {
    rol: 'paciente', fraccion: 0.88,
    base: 'El portal se abre alrededor de la cita: confirmar, formulario previo, documentos liberados y preguntas. Son la mayoría de las personas distintas activas a la vez.',
    medidoEn: null,
  },
])

/* ── 2 · qué hace cada rol en su ventana ──────────────────────────────────── */
export const ACTIVIDAD_POR_ROL = Object.freeze({
  medico: Object.freeze({
    ventanaSegundos: S.duracionConsultaSegundos,
    lecturas: PETICIONES_POR_CONSULTA.lecturas,
    escrituras: PETICIONES_POR_CONSULTA.escrituras,
    ia: PETICIONES_POR_CONSULTA.ia,
    evidencia: PETICIONES_POR_CONSULTA.evidencia,
    base: 'La consulta completa del modelo hermano (MEZCLA_DE_OPERACIONES).',
  }),
  recepcion: Object.freeze({
    ventanaSegundos: 10 * 60,
    lecturas: 12, escrituras: 3, ia: 0, evidencia: 0,
    base: 'Agenda del día abierta con escucha en vivo, tres o cuatro fichas, una cita creada o movida y una confirmación. Sin IA.',
  }),
  paciente: Object.freeze({
    ventanaSegundos: 8 * 60,
    lecturas: 6, escrituras: 1, ia: 0, evidencia: 0,
    base: 'Sesión del portal: session, citas, documentos, preguntas; una escritura (confirmar, formulario o una pregunta). Sin IA: el nivel 9 sólo reformula lo aprobado y no se llama en cada visita.',
  }),
})

/* ── 3 · el escenario ─────────────────────────────────────────────────────── */
const redondear = (n) => Math.max(1, Math.round(n))

export function escenarioActivos(usuariosActivos) {
  if (!Number.isSafeInteger(usuariosActivos) || usuariosActivos < 1) {
    throw new Error('usuariosActivos debe ser un entero positivo')
  }
  const sumaMezcla = MEZCLA_DE_ROLES.reduce((a, r) => a + r.fraccion, 0)
  if (Math.abs(sumaMezcla - 1) > 1e-9) throw new Error(`la mezcla de roles suma ${sumaMezcla}, no 1`)

  const porRol = Object.fromEntries(MEZCLA_DE_ROLES.map(r => {
    const personas = redondear(usuariosActivos * r.fraccion)
    const a = ACTIVIDAD_POR_ROL[r.rol]
    const peticiones = a.lecturas + a.escrituras + a.ia + a.evidencia
    return [r.rol, Object.freeze({
      personas,
      /* Por contrato: una persona activa = una identidad = una sesión que cuenta. */
      sesiones: personas,
      throughputSostenido: Number(((personas * peticiones) / a.ventanaSegundos).toFixed(3)),
      escriturasPorSegundo: Number(((personas * a.escrituras) / a.ventanaSegundos).toFixed(3)),
      llamadasIaPorSegundo: Number(((personas * a.ia) / a.ventanaSegundos).toFixed(4)),
    })]
  }))
  const total = (campo) => Number(Object.values(porRol).reduce((s, r) => s + r[campo], 0).toFixed(3))
  const sesionesConcurrentes = usuariosActivos
  const throughputSostenido = total('throughputSostenido')
  /* Volumen: cada paciente activo tiene expediente; cada médico activo, su día de notas. */
  const documentosResidentes = porRol.paciente.personas * 6 + porRol.medico.personas * S.consultasPorMedicoDia * 2

  return Object.freeze({
    id: `WS-02.activos-${usuariosActivos}`,
    usuariosActivos,
    version: VERSION_DEL_MODELO,
    noEsElMismoQue: 'WS-02.registrados-*: aquél deriva sesiones de un inventario; éste recibe las sesiones como objetivo y deriva quiénes son.',
    mezcla: Object.freeze(MEZCLA_DE_ROLES.map(r => ({ rol: r.rol, fraccion: r.fraccion }))),
    derivado: Object.freeze({
      porRol: Object.freeze(porRol),
      sesionesConcurrentes,
      concurrenciaSostenida: sesionesConcurrentes,
      concurrenciaEnRafaga: redondear(sesionesConcurrentes * S.factorDeRafaga),
      throughputSostenido,
      throughputEnRafaga: Number((throughputSostenido * S.factorDeRafaga).toFixed(3)),
      escriturasPorSegundo: total('escriturasPorSegundo'),
      llamadasIaPorSegundo: total('llamadasIaPorSegundo'),
      documentosResidentes,
      /* Un ensayo de personas activas exige que existan como cuentas: pacientes con portal y personal con sesión. */
      identidadesSinteticasNecesarias: usuariosActivos,
    }),
    duracion: Object.freeze({ sostenidaMinutos: 60, rafagaMinutos: 5, factorDeRafaga: S.factorDeRafaga }),
    medido: Object.freeze(Object.fromEntries(LO_QUE_MIDE_LA_CORRIDA.map(m => [m.campo, null]))),
    umbrales: PENDIENTE_DEL_DUENO,
    ejecutable: Object.freeze({
      concurrenciaAqui: sesionesConcurrentes <= COTAS_LOCALES.sesiones,
      volumenAqui: documentosResidentes <= COTAS_LOCALES.documentosResidentes,
      faltaFuera: Object.freeze([
        ...(sesionesConcurrentes <= COTAS_LOCALES.sesiones ? [] : [{
          eje: 'concurrencia',
          necesita: `${sesionesConcurrentes.toLocaleString('es-MX')} identidades distintas activas a la vez (cota local: ${COTAS_LOCALES.sesiones})`,
          conQue: 'Generadores de carga en varias máquinas y regiones, cada uno con sus identidades sintéticas (personal por Auth, pacientes por token de portal), contra un proyecto de Firebase de ENSAYO con reglas e índices desplegados y un despliegue de Vercel apuntando a él. Presupuesto autorizado por el dueño.',
        }]),
        ...(documentosResidentes <= COTAS_LOCALES.documentosResidentes ? [] : [{
          eje: 'volumen',
          necesita: `${documentosResidentes.toLocaleString('es-MX')} documentos residentes (cota local: ${COTAS_LOCALES.documentosResidentes.toLocaleString('es-MX')})`,
          conQue: 'Siembra previa en el proyecto de ensayo con el generador sintético; el emulador guarda en memoria y no llega.',
        }]),
        {
          eje: 'proveedores',
          necesita: 'Voz, razonamiento y evidencia de verdad para la fracción de médicos',
          conQue: 'Cuotas de ensayo y presupuesto; sin proveedor los cuatro campos de cola van en null.',
        },
        {
          eje: 'navegador',
          necesita: 'Pantalla en blanco y borrador perdido sólo se ven con navegador',
          conQue: 'Una fracción de las sesiones (a decidir) en navegador real, no sólo protocolo.',
        },
      ]),
    }),
    /* El corte que SÍ cabe aquí, con la misma mezcla. Humo del generador, no evidencia. */
    corteLocal: Object.freeze({
      noEsEvidenciaDelObjetivo: true,
      sesiones: COTAS_LOCALES.sesiones,
      porRol: Object.freeze(Object.fromEntries(MEZCLA_DE_ROLES.map(r => [r.rol, redondear(COTAS_LOCALES.sesiones * r.fraccion)]))),
      paraQue: 'Comprobar que el generador reparte roles, acuña identidades y produce el JSON que el validador lee. Nada más.',
    }),
  })
}

export const USUARIOS_ACTIVOS = Object.freeze([1_000, 10_000, 100_000])
export const ESCENARIOS_DE_ACTIVOS = Object.freeze(USUARIOS_ACTIVOS.map(escenarioActivos))
