/**
 * Facturación CFDI 4.0 vía Facturama (PAC) — SOLO cuando el cliente pide factura.
 *
 * El EMISOR es el dueño de la plataforma (su RFC + CSD viven en SU cuenta de
 * Facturama). El RECEPTOR es el consultorio que pide la factura. Nuestro código
 * arma el comprobante de un pago de Stripe y lo timbra ante el SAT.
 *
 * Config (el dueño la pone en Vercel, NUNCA en el cliente):
 *   FACTURAMA_USER, FACTURAMA_PASSWORD   → credenciales de la cuenta Facturama
 *   FACTURAMA_CP                         → código postal fiscal del EMISOR (lugar de expedición)
 *   FACTURAMA_SANDBOX = 'false'          → usar producción (por defecto sandbox de pruebas)
 *   FACTURAMA_SERIE (opc)                → serie de folios, ej. 'A'
 *   FACTURAMA_PRODUCT_CODE (opc)         → clave SAT del servicio (default 81112500)
 */
const BASE = process.env.FACTURAMA_SANDBOX === 'false'
  ? 'https://api.facturama.mx'
  : 'https://apisandbox.facturama.mx'

const USER = process.env.FACTURAMA_USER ?? ''
const PASS = process.env.FACTURAMA_PASSWORD ?? ''
const EMISOR_CP = process.env.FACTURAMA_CP ?? ''
const SERIE = process.env.FACTURAMA_SERIE ?? ''
const PRODUCT_CODE = process.env.FACTURAMA_PRODUCT_CODE ?? '81112500' // Servicios de aplicaciones informáticas

export function facturamaConfigurada(): boolean {
  return Boolean(USER && PASS && EMISOR_CP)
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64')
}

async function facturamaFetch(path: string, method: string, body?: unknown): Promise<unknown> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const txt = await r.text()
  let data: unknown
  try { data = JSON.parse(txt) } catch { data = txt }
  if (!r.ok) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data)
    throw new Error(`Facturama ${r.status}: ${msg.slice(0, 300)}`)
  }
  return data
}

export interface DatosReceptor {
  rfc: string
  nombre: string          // razón social EXACTA como en el SAT
  regimenFiscal: string   // ej. '612', '601', '626'
  usoCfdi: string         // ej. 'G03'
  cp: string              // código postal del receptor
  /**
   * Clave del catálogo de formas de pago del SAT ('01' efectivo, '03'
   * transferencia, '04' tarjeta de crédito, '28' débito…).
   *
   * Iba QUEMADA como '04' dentro de `emitirCFDI`, así que TODA factura decía
   * «tarjeta de crédito» aunque el cobro hubiera sido SPEI o débito. Eso
   * descuadra contra el estado de cuenta y es motivo habitual de cancelación.
   * Ahora la elige quien factura, que es quien sabe cómo se le cobró.
   */
  formaPago?: string
}

export interface CfdiEmitido {
  id: string
  uuid: string
  total: number
  fecha: string
}

/**
 * Timbra un CFDI de INGRESO (tipo 'I') por un pago. `montoConIva` es el total
 * pagado (Stripe cobra IVA incluido): se desglosa subtotal + IVA 16%.
 */
export async function emitirCFDI(
  montoConIva: number,
  descripcion: string,
  receptor: DatosReceptor,
  // Sin valor por omisión A PROPÓSITO: un default aquí es una factura que
  // AFIRMA una forma de pago que nadie eligió. Quien llama tiene que decidirla.
  formaPago: string = receptor.formaPago ?? '',
): Promise<CfdiEmitido> {
  if (!String(formaPago).trim()) {
    throw new Error('Falta la forma de pago (catálogo del SAT): no se timbra una factura afirmando una que nadie eligió.')
  }
  const subtotal = Math.round((montoConIva / 1.16) * 100) / 100
  const iva = Math.round((montoConIva - subtotal) * 100) / 100

  const payload = {
    ...(SERIE ? { Serie: SERIE } : {}),
    Currency: 'MXN',
    ExpeditionPlace: EMISOR_CP,
    CfdiType: 'I',
    PaymentForm: formaPago,
    PaymentMethod: 'PUE',           // pago en una sola exhibición
    Receiver: {
      Rfc: receptor.rfc.trim().toUpperCase(),
      Name: receptor.nombre.trim(),
      CfdiUse: receptor.usoCfdi,
      FiscalRegime: receptor.regimenFiscal,
      TaxZipCode: receptor.cp.trim(),
    },
    Items: [{
      ProductCode: PRODUCT_CODE,
      IdentificationNumber: 'NEXUSMED',
      Description: descripcion,
      Unit: 'Unidad de servicio',
      UnitCode: 'E48',
      UnitPrice: subtotal,
      Quantity: 1,
      Subtotal: subtotal,
      TaxObject: '02',              // sí objeto de impuesto
      Taxes: [{ Name: 'IVA', Rate: 0.16, Base: subtotal, Total: iva, IsRetention: false, IsFederalTax: true }],
      Total: montoConIva,
    }],
  }

  const res = await facturamaFetch('/3/cfdis', 'POST', payload) as {
    Id?: string
    Complement?: { TaxStamp?: { Uuid?: string; Date?: string } }
    Date?: string
    Total?: number
  }
  return {
    id: String(res.Id ?? ''),
    uuid: String(res.Complement?.TaxStamp?.Uuid ?? ''),
    total: Number(res.Total ?? montoConIva),
    fecha: String(res.Complement?.TaxStamp?.Date ?? res.Date ?? ''),
  }
}

/** Descarga el PDF o XML de un CFDI ya emitido. Devuelve base64. */
export async function descargarCFDI(id: string, tipo: 'pdf' | 'xml'): Promise<string> {
  const res = await facturamaFetch(`/cfdi/${tipo}/issued/${encodeURIComponent(id)}`, 'GET') as { Content?: string }
  return String(res.Content ?? '')
}
