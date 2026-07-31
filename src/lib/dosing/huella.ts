/**
 * Huella del dataset de dosis cargado.
 *
 * Vive en su propio módulo porque la usan tres sitios que no deberían depender
 * entre sí: el motor, la pantalla de validación y el test de integridad. Y
 * porque calcularla en el navegador exigiría leer el JSON entero para sacar un
 * sha256 que ya se conoce en tiempo de compilación.
 *
 * Cuando entre un dataset nuevo, esta constante cambia y TODAS las validaciones
 * del médico pasan a «caducada»: describen unos números que ya no están en
 * pantalla. Es incómodo y es lo correcto.
 */
export const HUELLA_DATASET =
  '0520abd4310e002e960336606c6a3a83c26a15159f9f5080187f5f931a102a9c'
