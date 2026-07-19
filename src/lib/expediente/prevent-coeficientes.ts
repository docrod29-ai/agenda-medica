/**
 * ECUACIONES PREVENT — riesgo de ASCVD a 10 y 30 años (AHA).
 *
 * GENERADO A PARTIR DE LOS COEFICIENTES PUBLICADOS. No editar a mano.
 *
 * Origen: Khan SS, et al. Development and Validation of the American Heart
 * Association's PREVENT Equations. Circulation. 2024;149:430-449. Los
 * coeficientes se extrajeron del paquete de referencia `preventr` (Mayer M.),
 * que los transcribe del artículo, y se leyeron con un script — ningún número
 * pasó por una persona ni por un modelo.
 *
 * VALIDADO contra los cuatro valores publicados en el arnés de pruebas de ese
 * paquete, con los mismos insumos (50 años, TAS 160 con antihipertensivo,
 * colesterol total 200, HDL 45, sin estatina, con diabetes, no fumador, TFG 90):
 *
 *   mujer  a 10 años  9.2%   ·  mujer  a 30 años  35.4%
 *   hombre a 10 años 10.2%   ·  hombre a 30 años  34.9%
 *
 * Los cuatro coinciden al milésimo. Los tests fijan esos casos: si alguien
 * altera un coeficiente o el centrado, fallan.
 *
 * La guía ACC/AHA 2026 de dislipidemia pide expresamente PREVENT-ASCVD (no el
 * de enfermedad cardiovascular total) para decidir tratamiento hipolipemiante.
 */

export interface Coeficientes {
  edad: number
  edadCuadrado?: number
  noHDL: number
  hdl: number
  tasBaja: number
  tasAlta: number
  diabetes: number
  fuma: number
  imcBajo: number
  imcAlto: number
  tfgBaja: number
  tfgAlta: number
  antihipertensivo: number
  estatina: number
  tasTratada: number
  noHDLTratado: number
  edadXnoHDL: number
  edadXhdl: number
  edadXtasAlta: number
  edadXdiabetes: number
  edadXfuma: number
  edadXimcAlto: number
  edadXtfgBaja: number
  constante: number
}

export const ASCVD_10_MUJER: Coeficientes = {
  edad: 0.719883,
  noHDL: 0.1176967,
  hdl: -0.151185,
  tasBaja: -0.0835358,
  tasAlta: 0.3592852,
  diabetes: 0.8348585,
  fuma: 0.4831078,
  imcBajo: 0.0,
  imcAlto: 0.0,
  tfgBaja: 0.4864619,
  tfgAlta: 0.0397779,
  antihipertensivo: 0.2265309,
  estatina: -0.0592374,
  tasTratada: -0.0395762,
  noHDLTratado: 0.0844423,
  edadXnoHDL: -0.0567839,
  edadXhdl: 0.0325692,
  edadXtasAlta: -0.1035985,
  edadXdiabetes: -0.2417542,
  edadXfuma: -0.0791142,
  edadXimcAlto: 0.0,
  edadXtfgBaja: -0.1671492,
  constante: -3.819975,
}

export const ASCVD_10_HOMBRE: Coeficientes = {
  edad: 0.7099847,
  noHDL: 0.1658663,
  hdl: -0.1144285,
  tasBaja: -0.2837212,
  tasAlta: 0.3239977,
  diabetes: 0.7189597,
  fuma: 0.3956973,
  imcBajo: 0.0,
  imcAlto: 0.0,
  tfgBaja: 0.3690075,
  tfgAlta: 0.0203619,
  antihipertensivo: 0.2036522,
  estatina: -0.0865581,
  tasTratada: -0.0322916,
  noHDLTratado: 0.114563,
  edadXnoHDL: -0.0300005,
  edadXhdl: 0.0232747,
  edadXtasAlta: -0.0927024,
  edadXdiabetes: -0.2018525,
  edadXfuma: -0.0970527,
  edadXimcAlto: 0.0,
  edadXtfgBaja: -0.1217081,
  constante: -3.500655,
}

export const ASCVD_30_MUJER: Coeficientes = {
  edad: 0.4669202,
  edadCuadrado: -0.0893118,
  noHDL: 0.1256901,
  hdl: -0.1542255,
  tasBaja: -0.0018093,
  tasAlta: 0.322949,
  diabetes: 0.6296707,
  fuma: 0.268292,
  imcBajo: 0.0,
  imcAlto: 0.0,
  tfgBaja: 0.100106,
  tfgAlta: 0.0499663,
  antihipertensivo: 0.1875292,
  estatina: 0.0152476,
  tasTratada: -0.0276123,
  noHDLTratado: 0.0736147,
  edadXnoHDL: -0.0521962,
  edadXhdl: 0.0316918,
  edadXtasAlta: -0.1046101,
  edadXdiabetes: -0.2727793,
  edadXfuma: -0.1530907,
  edadXimcAlto: 0.0,
  edadXtfgBaja: -0.1299149,
  constante: -1.974074,
}

export const ASCVD_30_HOMBRE: Coeficientes = {
  edad: 0.3994099,
  edadCuadrado: -0.0937484,
  noHDL: 0.1744643,
  hdl: -0.120203,
  tasBaja: -0.0665117,
  tasAlta: 0.2753037,
  diabetes: 0.4790257,
  fuma: 0.1782635,
  imcBajo: 0.0,
  imcAlto: 0.0,
  tfgBaja: -0.0218789,
  tfgAlta: 0.0602553,
  antihipertensivo: 0.1421182,
  estatina: 0.0135996,
  tasTratada: -0.0218265,
  noHDLTratado: 0.1013148,
  edadXnoHDL: -0.0312619,
  edadXhdl: 0.020673,
  edadXtasAlta: -0.0920935,
  edadXdiabetes: -0.2159947,
  edadXfuma: -0.1548811,
  edadXimcAlto: 0.0,
  edadXtfgBaja: -0.0712547,
  constante: -1.736444,
}
