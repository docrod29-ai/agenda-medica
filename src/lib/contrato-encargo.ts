/**
 * Generador del Contrato de Encargo de Tratamiento de Datos Personales
 * (Art. 49-55 del Reglamento de la LFPDPPP): entre el CONSULTORIO (Responsable)
 * y NexusMED (Encargado). Plantilla parametrizada con los datos del consultorio.
 *
 * IMPORTANTE: es un BORRADOR base. Debe revisarse por un abogado antes de firmarse.
 */

import type { ClinicConfig } from '@/types'

export const VERSION_CONTRATO = '2026-07'

export function generarContratoEncargo(config: ClinicConfig | null): string {
  const responsable = config?.razonSocial || config?.nombreClinica || config?.nombreMedico || '[Nombre o razón social del Responsable]'
  const rfc = config?.rfc || '[RFC del Responsable]'
  const domicilio = config?.domicilioFiscal || config?.direccion || '[Domicilio del Responsable]'

  return `CONTRATO DE ENCARGO DE TRATAMIENTO DE DATOS PERSONALES

Versión: ${VERSION_CONTRATO}

Entre "${responsable}" (RFC ${rfc}), con domicilio en ${domicilio}, en adelante el
"RESPONSABLE", y NexusMED, en adelante el "ENCARGADO", se celebra el presente contrato
de prestación de servicios de tratamiento de datos personales, conforme a los artículos
49 a 55 del Reglamento de la Ley Federal de Protección de Datos Personales en Posesión de
los Particulares (LFPDPPP).

DECLARACIONES
El RESPONSABLE es un profesional o establecimiento de la salud que determina las
finalidades y medios del tratamiento del expediente clínico y de los datos de sus
pacientes. El ENCARGADO provee una plataforma de software (agenda, expediente clínico
electrónico, recetas y funciones asistidas por inteligencia artificial) mediante la cual
trata datos personales por cuenta y bajo instrucciones del RESPONSABLE.

CLÁUSULAS

PRIMERA. Objeto.
El ENCARGADO tratará los datos personales únicamente para prestar los servicios de la
plataforma al RESPONSABLE, conforme a sus instrucciones documentadas y a lo pactado en
los Términos del servicio.

SEGUNDA. Instrucciones y finalidad.
El ENCARGADO no usará los datos para finalidades propias distintas a la prestación del
servicio. En particular, NO utiliza las consultas ni los expedientes de los pacientes
para entrenar modelos de inteligencia artificial.

TERCERA. Confidencialidad.
El ENCARGADO y su personal guardarán confidencialidad respecto de los datos personales,
obligación que subsiste aun después de terminada la relación.

CUARTA. Medidas de seguridad.
El ENCARGADO mantiene medidas de seguridad administrativas, técnicas y físicas razonables:
cifrado en tránsito y en reposo, control de acceso por roles, aislamiento por consultorio,
registro de accesos y respaldos. El detalle y su estado se publican en la página de
Seguridad del servicio.

QUINTA. Subencargados.
El RESPONSABLE autoriza al ENCARGADO a apoyarse en subencargados (proveedores de nube,
mensajería, procesamiento de pagos e inteligencia artificial) para operar el servicio.
El ENCARGADO mantiene una lista pública y actualizada de dichos subencargados y les
impone obligaciones de protección equivalentes a las de este contrato.

SEXTA. Vulneraciones de seguridad.
El ENCARGADO notificará al RESPONSABLE, sin demora indebida, cualquier vulneración de
seguridad que afecte de forma significativa los datos personales tratados, con la
información necesaria para que el RESPONSABLE cumpla sus deberes de notificación.

SÉPTIMA. Derechos ARCO.
El ENCARGADO prestará asistencia razonable al RESPONSABLE para atender las solicitudes de
acceso, rectificación, cancelación y oposición (ARCO) de los titulares, así como para
poner los datos a disposición del RESPONSABLE.

OCTAVA. Devolución y supresión.
A la terminación del servicio, el ENCARGADO pondrá a disposición del RESPONSABLE una
exportación de los datos y, salvo obligación legal de conservación, procederá a su
supresión segura en un plazo razonable.

NOVENA. Responsabilidad.
El RESPONSABLE es el responsable del tratamiento frente a los titulares y las autoridades.
El ENCARGADO responde por el incumplimiento de las obligaciones que este contrato le
impone como encargado.

DÉCIMA. Vigencia y ley aplicable.
Este contrato tiene vigencia mientras subsista la relación de servicio. Se rige por la
legislación mexicana aplicable en materia de protección de datos personales.

___________________________________        ___________________________________
Por el RESPONSABLE                          Por el ENCARGADO (NexusMED)
${responsable}
Fecha: ____________________                 Fecha: ____________________

— Este documento es un borrador base y debe ser revisado por un asesor legal antes de su
firma. No constituye asesoría jurídica.
`
}
