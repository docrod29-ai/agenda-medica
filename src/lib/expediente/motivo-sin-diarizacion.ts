/**
 * POR QUÉ NO HUBO SEPARACIÓN DE VOCES, EN CASTELLANO.
 *
 * Estaba dentro de la pantalla de consulta, así que el pase de visita de UCI
 * —donde hablan el adscrito, el residente y enfermería— no tenía forma de
 * decírselo al médico. Vive aquí para que las tres pantallas digan lo mismo.
 *
 * Cada causa exige una acción distinta: una es de configuración, otra del
 * proveedor, y la del tiempo se resuelve volviendo a procesar. Un genérico
 * («algo falló») no le sirve a nadie.
 */
export const MOTIVO_SIN_DIARIZACION: Record<string, string> = {
  sin_llave: 'No hay servicio de separación de voces configurado.',
  error_proveedor: 'El servicio de transcripción devolvió un error.',
  tiempo_agotado: 'El servicio tardó más de lo previsto para este audio; puedes volver a procesar.',
  red: 'Se perdió la conexión mientras se transcribía.',
  sin_texto: 'El servicio no devolvió texto (¿audio en silencio?).',
}
