/**
 * LA LISTA DE SUBENCARGADOS — una sola, completa, y derivada de lo que el
 * sistema USA de verdad.
 *
 * ── LO QUE ENCONTRÉ ──────────────────────────────────────────────────────────
 *
 * El contrato de encargo promete «una lista pública y actualizada de dichos
 * subencargados». Esa lista **sí existía** —la tabla de `/seguridad`, con su
 * región y su acuerdo de tratamiento— pero estaba **incompleta**: declaraba seis
 * proveedores y el código usa nueve.
 *
 * Los tres que faltaban no eran menores:
 *
 *  · **AssemblyAI** recibe el AUDIO de la consulta para separar las voces;
 *  · **Daily** transporta la videoconsulta;
 *  · **Twilio** manda mensajes al paciente cuando WhatsApp no está disponible.
 *
 * O sea que la lista pública de quién recibe datos del paciente **omitía a dos
 * proveedores que reciben datos del paciente**. Y el aviso de privacidad y el
 * contrato, por su parte, sólo hablaban de «categorías» en prosa, cada uno con
 * su propia redacción: tres textos legales diciendo lo mismo de tres formas.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * De lo que el código integra: la clave de entorno que consume cada ruta. No es
 * una redacción comercial, es un inventario verificable — y hay una prueba que
 * falla si aparece en el código una clave de proveedor que no esté declarada
 * aquí. Es lo que impide que la lista vuelva a quedarse corta en silencio.
 *
 * ── LO QUE ESTA LISTA NO DECIDE ──────────────────────────────────────────────
 *
 * La `region` es la de procesamiento por defecto del proveedor, no una
 * verificación contra su acuerdo firmado; y la figura jurídica de cada uno la
 * confirma el Dr. con su abogado. Lo que sí hace es que los documentos digan la
 * verdad sobre a quién se le entregan datos hoy.
 *
 * Módulo PURO.
 */

export type CategoriaSubencargado =
  | 'nube'
  | 'mensajeria'
  | 'pagos'
  | 'inteligencia-artificial'
  | 'telesalud'

export interface Subencargado {
  nombre: string
  categoria: CategoriaSubencargado
  /** Para qué se usa, en una línea que entienda un paciente. */
  uso: string
  /** Región de procesamiento por defecto del proveedor. */
  region: string
  /** Su acuerdo de tratamiento de datos o su política de privacidad. */
  pol: string
  /**
   * Si por su función puede llegar a tratar datos de salud.
   *
   * Es la distinción que le importa al titular: no es lo mismo quien procesa un
   * cobro que quien recibe el audio de una consulta.
   */
  tocaDatosDeSalud: boolean
  /** La variable de entorno que lo delata en el código. Ata la lista a la realidad. */
  huella: string
}

/** Los proveedores que el sistema usa hoy. Primero los que tocan datos de salud. */
export const SUBENCARGADOS: readonly Subencargado[] = [
  {
    nombre: 'Google Cloud / Firebase',
    categoria: 'nube',
    uso: 'Base de datos, almacenamiento y autenticación',
    region: 'Estados Unidos',
    pol: 'https://cloud.google.com/terms/data-processing-addendum',
    tocaDatosDeSalud: true,
    huella: 'FIREBASE_ADMIN_PRIVATE_KEY',
  },
  {
    nombre: 'Vercel',
    categoria: 'nube',
    uso: 'Hospedaje de la aplicación web',
    region: 'Estados Unidos',
    pol: 'https://vercel.com/legal/privacy-policy',
    tocaDatosDeSalud: true,
    huella: 'VERCEL_URL',
  },
  {
    nombre: 'Anthropic (Claude)',
    categoria: 'inteligencia-artificial',
    uso: 'Redacción y revisión clínica asistida por IA',
    region: 'Estados Unidos',
    pol: 'https://www.anthropic.com/legal/privacy',
    tocaDatosDeSalud: true,
    huella: 'ANTHROPIC_API_KEY',
  },
  {
    nombre: 'OpenAI',
    categoria: 'inteligencia-artificial',
    uso: 'Transcripción de voz y apoyo de IA',
    region: 'Estados Unidos',
    pol: 'https://openai.com/policies/privacy-policy',
    tocaDatosDeSalud: true,
    huella: 'OPENAI_API_KEY',
  },
  {
    // FALTABA. Recibe el audio de la consulta para separar las voces.
    nombre: 'AssemblyAI',
    categoria: 'inteligencia-artificial',
    uso: 'Separación de voces del dictado (médico y paciente), cuando está activada',
    region: 'Estados Unidos',
    pol: 'https://www.assemblyai.com/legal/privacy-policy',
    tocaDatosDeSalud: true,
    huella: 'ASSEMBLYAI_API_KEY',
  },
  {
    // FALTABA. Transporta la videoconsulta.
    nombre: 'Daily',
    categoria: 'telesalud',
    uso: 'Sala de videoconsulta',
    region: 'Estados Unidos',
    pol: 'https://www.daily.co/legal/privacy-policy/',
    tocaDatosDeSalud: true,
    huella: 'DAILY_API_KEY',
  },
  {
    /**
     * FALTABA, y lo encontró el propio guardián al escribirlo.
     *
     * 360dialog no es Meta: es el proveedor autorizado por el que pasan los
     * mensajes antes de llegar a WhatsApp. Nombrarlo entre paréntesis dentro de
     * la fila de Meta lo dejaba fuera de la lista como empresa, que es lo que
     * importa cuando se firma un acuerdo de tratamiento con cada uno.
     */
    nombre: '360dialog',
    categoria: 'mensajeria',
    uso: 'Proveedor autorizado por el que pasan los mensajes de WhatsApp',
    region: 'Alemania / Unión Europea',
    pol: 'https://www.360dialog.com/privacy-policy',
    tocaDatosDeSalud: false,
    huella: 'DIALOG360_PARTNER_TOKEN',
  },
  {
    nombre: 'Meta / WhatsApp',
    categoria: 'mensajeria',
    uso: 'Mensajes y recordatorios al paciente',
    region: 'Estados Unidos',
    pol: 'https://www.whatsapp.com/legal/business-data-transfer-addendum',
    // Los mensajes llevan fecha, hora y nombre; el contenido clínico no viaja
    // por aquí — es una decisión de diseño que las pruebas del portal fijan.
    tocaDatosDeSalud: false,
    huella: 'WHATSAPP_API_TOKEN',
  },
  {
    // FALTABA.
    nombre: 'Twilio',
    categoria: 'mensajeria',
    uso: 'Mensajes de texto al paciente cuando WhatsApp no está disponible',
    region: 'Estados Unidos',
    pol: 'https://www.twilio.com/legal/privacy',
    tocaDatosDeSalud: false,
    huella: 'TWILIO_AUTH_TOKEN',
  },
  {
    nombre: 'Stripe',
    categoria: 'pagos',
    uso: 'Procesamiento de pagos de la suscripción',
    region: 'Estados Unidos',
    pol: 'https://stripe.com/privacy',
    tocaDatosDeSalud: false,
    huella: 'STRIPE_SECRET_KEY',
  },
]

export const CATEGORIA_LABEL: Record<CategoriaSubencargado, string> = {
  nube: 'infraestructura en la nube',
  mensajeria: 'mensajería',
  pagos: 'procesamiento de pagos',
  'inteligencia-artificial': 'inteligencia artificial',
  telesalud: 'videoconsulta',
}

/** Las categorías presentes, en el orden en que aparecen. */
export function categoriasEnUso(): CategoriaSubencargado[] {
  const vistas: CategoriaSubencargado[] = []
  for (const s of SUBENCARGADOS) if (!vistas.includes(s.categoria)) vistas.push(s.categoria)
  return vistas
}

/** «infraestructura en la nube, inteligencia artificial y …» para un párrafo. */
export function frasesDeCategorias(): string {
  const l = categoriasEnUso().map(c => CATEGORIA_LABEL[c])
  if (l.length <= 1) return l[0] ?? ''
  return `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`
}

/** La lista en texto plano, para el aviso y el contrato (que son texto, no JSX). */
export function listaEnTexto(): string {
  return SUBENCARGADOS
    .map(s => ` • ${s.nombre} (${s.region}) — ${s.uso}.` +
      (s.tocaDatosDeSalud ? ' Puede tratar datos de salud.' : ' No trata datos de salud.'))
    .join('\n')
}

export const POR_QUE_UNA_SOLA_LISTA =
  'Porque la lista pública que el contrato promete existía pero declaraba seis ' +
  'proveedores mientras el código usaba nueve, y dos de los que faltaban —el que ' +
  'separa las voces del dictado y el que transporta la videoconsulta— reciben ' +
  'datos del paciente. Una lista de quién recibe datos que omite a quien recibe ' +
  'datos es peor que no tenerla: parece completa.'
