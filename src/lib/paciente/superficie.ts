/**
 * LA SUPERFICIE DEL PACIENTE, DECLARADA EN UN SOLO SITIO — V9.
 *
 * Las nueve rutas que ve un paciente están enumeradas en tres documentos y en
 * ninguna parte del código. Cada vez que aparece una décima, alguien tiene que
 * acordarse de añadirla a los tres — y la familia `depende_de_recordar` de
 * `lib/calidad/familias-de-defecto.ts` dice cómo acaba eso.
 *
 * Aquí viven una vez. Quien quiera auditar la superficie del paciente
 * —accesibilidad, idioma, contraste— la lee de aquí, y un guardián comprueba
 * que cada archivo declarado exista de verdad en disco: una lista que nombra un
 * archivo borrado audita el vacío y sale verde.
 *
 * **No incluye** el panel del médico: eso es otra superficie, con otro lector y
 * otras defensas. La regla `patient-facing-ai.md` explica por qué las defensas
 * del lado del médico no se heredan.
 */

export interface PantallaDelPaciente {
  /** Ruta pública, tal como la abre el paciente. */
  ruta: string
  /** Archivo que la pinta, relativo a la raíz del repositorio. */
  archivo: string
  /** Qué puede hacer ahí. Una frase. */
  proposito: string
  /** ¿Muestra o recoge datos de salud identificables? */
  conPHI: boolean
}

export const SUPERFICIE_DEL_PACIENTE: readonly PantallaDelPaciente[] = [
  {
    ruta: '/mi/[token]',
    archivo: 'src/app/mi/[token]/page.tsx',
    proposito: 'El portal: citas, confirmar, reagendar, cancelar, pagar, formulario previo y recetas.',
    conPHI: true,
  },
  {
    ruta: '/reservar/[clinicId]',
    archivo: 'src/app/reservar/[clinicId]/page.tsx',
    proposito: 'Autoagenda pública: tipo, fecha, hora, datos y consentimientos.',
    conPHI: false,
  },
  {
    ruta: '/resena/[token]',
    archivo: 'src/app/resena/[token]/page.tsx',
    proposito: 'Calificar la consulta de 1 a 5 y dejar un comentario.',
    conPHI: true,
  },
  {
    ruta: '/verificar/[token]',
    archivo: 'src/app/verificar/[token]/page.tsx',
    proposito: 'Verificar por QR una receta impresa: folio, médico, cédula y huella.',
    conPHI: true,
  },
  {
    ruta: '/teleconsulta/[citaId]',
    archivo: 'src/app/teleconsulta/[citaId]/page.tsx',
    proposito: 'Entrar a la sala de la videoconsulta.',
    conPHI: true,
  },
  {
    ruta: '/privacidad/[clinicId]',
    archivo: 'src/app/privacidad/[clinicId]/page.tsx',
    proposito: 'Ejercer derechos ARCO sin cuenta, con folio y plazo declarado.',
    conPHI: false,
  },
  {
    ruta: '/dr/[clinicId]',
    archivo: 'src/app/dr/[clinicId]/page.tsx',
    proposito: 'Perfil público del médico, indexable.',
    conPHI: false,
  },
  {
    ruta: '/pago/exito',
    archivo: 'src/app/pago/exito/page.tsx',
    proposito: 'Vuelta de Stripe tras pagar el anticipo.',
    conPHI: false,
  },
  {
    ruta: '/pago/cancelado',
    archivo: 'src/app/pago/cancelado/page.tsx',
    proposito: 'Vuelta de Stripe cuando el paciente no completó el pago.',
    conPHI: false,
  },
] as const

/** Los archivos, que es lo que audita un guardián de código fuente. */
export const ARCHIVOS_DEL_PACIENTE: readonly string[] =
  SUPERFICIE_DEL_PACIENTE.map(p => p.archivo)

export const POR_QUE_VIVE_AQUI =
  'Porque estaba en tres documentos y en ninguna parte del código: cada pantalla ' +
  'nueva dependía de que alguien se acordara de añadirla a los tres. Un tablero ' +
  'que depende de que alguien se acuerde, miente.'
