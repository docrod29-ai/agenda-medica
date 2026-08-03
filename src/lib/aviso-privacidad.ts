/**
 * Generador de aviso de privacidad LFPDPPP — versión integral conforme a:
 * - Ley Federal de Protección de Datos Personales en Posesión de los Particulares
 * - Reglamento (Art. 26-29)
 * - Lineamientos del INAI 2024
 *
 * Se genera dinámicamente con los datos de la clínica del médico.
 */

import type { ClinicConfig } from '@/types'
import { listaEnTexto } from '@/lib/legal/subencargados'

export const VERSION_AVISO = '2026-06'

export interface AvisoPrivacidadData {
  responsable: string                  // Nombre del médico o clínica
  domicilio: string
  contacto: string                     // Email o teléfono
  version: string
}

/** Genera el TEXTO completo del aviso de privacidad para una clínica específica. */
export function generarAvisoPrivacidad(config: ClinicConfig | null): string {
  const responsable = config?.razonSocial || config?.nombreClinica || config?.nombreMedico || '[Nombre o razón social del responsable]'
  // PROTECCIÓN: el aviso es un documento público (se entrega al paciente). Usa el
  // domicilio del CONSULTORIO, nunca el domicilio fiscal, y NO incluye el RFC —
  // ese dato solo aparece en el contrato de encargo (privado, detrás del login).
  const domicilio = config?.direccion || '[Domicilio del consultorio]'
  const contacto = config?.correoArco || config?.telefonoAdmin || config?.whatsappConsultorio || '[Contacto]'
  const respPriv = config?.responsablePrivacidad

  return `AVISO DE PRIVACIDAD INTEGRAL — ${responsable}

Versión: ${VERSION_AVISO}

1. IDENTIDAD Y DOMICILIO DEL RESPONSABLE
${responsable}, con domicilio en ${domicilio}, es el responsable del tratamiento de sus datos personales.${respPriv ? `\nResponsable de privacidad: ${respPriv}.` : ''}
El responsable se apoya en NexusMED como encargado del tratamiento (proveedor de software) y en los siguientes subencargados tecnológicos, cada uno bajo su propio acuerdo de tratamiento de datos:
${listaEnTexto()}
La lista vigente y actualizada se publica en la página de seguridad de NexusMED.

2. DATOS PERSONALES QUE SE RECABAN
Recabamos los siguientes datos personales:
 • Identificación: nombre completo, CURP, fecha de nacimiento, sexo, edad
 • Contacto: teléfono, WhatsApp, correo electrónico, domicilio
 • Datos de salud (sensibles): historia clínica, antecedentes, padecimiento actual,
   exploración física, signos vitales, alergias, diagnósticos, tratamientos,
   medicamentos, estudios de laboratorio y gabinete, fotografías clínicas
 • Datos administrativos: seguro médico, datos de facturación

3. FINALIDADES DEL TRATAMIENTO
Sus datos personales serán utilizados para las siguientes finalidades:
 a) Prestar servicios médicos de consulta, diagnóstico, tratamiento y seguimiento
 b) Integrar y mantener su expediente clínico conforme a NOM-004-SSA3-2012
 c) Emisión de recetas, órdenes médicas, cartas de referencia
 d) Agendar y recordar citas (por teléfono, SMS o WhatsApp)
 e) Comunicación sobre resultados de estudios
 f) Cobro y facturación de servicios
 g) Cumplimiento de obligaciones legales (NOM, COFEPRIS, SAT)

Finalidades secundarias (puede oponerse marcando NO al pie del aviso):
 h) Envío de recordatorios de salud preventiva y campañas educativas
 i) Estadísticas internas anónimas para mejora del servicio
 j) Solicitud de retroalimentación o reseñas

4. TRANSFERENCIAS DE DATOS
Sus datos pueden ser transferidos, sin requerir su consentimiento adicional, a:
 • Autoridades sanitarias (Secretaría de Salud, COFEPRIS, IMSS, ISSSTE) cuando sea
   legalmente requerido
 • Médicos especialistas referidos para continuidad de la atención
 • Laboratorios y servicios de imagen indicados en su tratamiento
 • Compañías aseguradoras (solo si usted las indica)
 • Autoridades judiciales cuando exista mandamiento legal

5. FUNDAMENTO LEGAL
El tratamiento se basa en:
 • Ley Federal de Protección de Datos Personales en Posesión de los Particulares
 • Ley General de Salud (Art. 50, 134, 136)
 • NOM-004-SSA3-2012 (expediente clínico)
 • NOM-024-SSA3-2012 (sistemas de información para registro electrónico)

6. DERECHOS ARCO
Usted tiene derecho a:
 • ACCEDER a sus datos
 • RECTIFICAR datos inexactos o incompletos
 • CANCELAR los datos cuando no sean necesarios
 • OPONERSE al tratamiento para fines específicos
 • REVOCAR el consentimiento otorgado

Para ejercerlos, puede dirigir su solicitud${respPriv ? ` al responsable de privacidad (${respPriv})` : ''} en: ${contacto}
Plazo de respuesta: 20 días hábiles conforme a Art. 32 LFPDPPP.

7. CONSERVACIÓN, BLOQUEO Y ELIMINACIÓN
Su expediente clínico se conservará por un mínimo de 5 años desde la última anotación,
conforme al numeral 5.7 de la NOM-004-SSA3-2012. Concluido el periodo de conservación y
las finalidades del tratamiento, los datos se bloquean (se conservan solo para atender
posibles responsabilidades) y posteriormente se eliminan de forma segura.

8. MEDIDAS DE SEGURIDAD
Sus datos se protegen mediante:
 • Cifrado en tránsito (HTTPS/TLS 1.3)
 • Cifrado en reposo (Google Firestore, AES-256)
 • Control de acceso por rol (el personal administrativo no accede a sus notas clínicas)
 • Aislamiento por consultorio
 • Registro de accesos a su expediente
 • Cierre automático de sesión por inactividad
 • Firmas electrónicas con SHA-256 (NOM-024)
 • Inmutabilidad de notas firmadas

En caso de una vulneración de seguridad que afecte de forma significativa sus derechos
patrimoniales o morales, se le informará sin demora para que pueda tomar medidas.

9. CAMBIOS AL AVISO
Cualquier modificación a este aviso será publicada y notificada a usted con
30 días de anticipación${contacto && contacto[0] !== '[' ? ` a través de ${contacto}` : ''}.

10. CONSENTIMIENTO
Al firmar este documento (o aceptar electrónicamente), usted manifiesta:
 a) Haber leído y comprendido el presente aviso
 b) Otorgar su consentimiento expreso para el tratamiento de sus datos de salud
    (dato sensible que requiere consentimiento explícito por Art. 9 LFPDPPP)
 c) Conocer sus derechos ARCO y cómo ejercerlos

___________________________________________
Firma del paciente o representante legal
Fecha: _____________________________________
`
}

/** Versión resumida del aviso (para mostrar en modal con scroll). */
export function generarAvisoResumido(config: ClinicConfig | null): string {
  const responsable = config?.nombreClinica || config?.nombreMedico || 'el responsable'
  return `Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), te informamos que ${responsable} es el responsable del tratamiento de tus datos personales, incluyendo datos sensibles de salud, con el fin de prestar servicios médicos, integrar tu expediente clínico (NOM-004), agendar tus citas y darte seguimiento.

Tus datos se conservan mínimo 5 años desde la última anotación. Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte (derechos ARCO) en cualquier momento.

Tus datos NUNCA se comparten con terceros sin autorización, excepto cuando lo ordene la ley o sea necesario para tu atención médica.`
}
