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
  /**
   * Los dos de abajo nacieron de REG-225: el `catch` decía «tiempo agotado»
   * pasara lo que pasara, y lo que pasaba era un permiso denegado de Storage
   * en el primer segundo. El médico leía «se agotó el tiempo» y buscaba el
   * problema en su internet.
   */
  sin_permiso_de_lectura: 'El audio se guardó pero no se pudo leer para separarlo por voces (permiso del almacenamiento). Avisa a soporte: no es tu conexión.',
  no_se_pudo_subir: 'No se pudo subir el audio para separarlo por voces; se transcribió por partes.',
}
