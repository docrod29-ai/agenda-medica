/** Prueba REAL optativa, sólo con un texto fijo inventado. No acepta pacientes. */
import { configuracionPrivada } from '../../src/lib/ia/configuracion-privada'
import { fetchIAConTimeout } from '../../src/lib/ia/salida-privada'
import { cuerpoPropio, leerPropio } from '../../src/lib/ia/protocolo'
import { validarNotaPropia } from '../../src/lib/ia/nota-propia'

async function main() {
  const config = configuracionPrivada()
  if (!config.ok) throw new Error(config.motivo)
  const { endpoint, modelo, clave } = config.valor
  const t0 = Date.now()
  const res = await fetchIAConTimeout(endpoint, {
    method: 'POST', headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpoPropio({ modelo, maxTokens: 512, json: true,
      system: 'Devuelve sólo JSON con resumenEjecutivo y secciones, ambos en español. No añadas hechos ni decisiones clínicas.',
      user: 'CASO COMPLETAMENTE INVENTADO PARA PROBAR SOFTWARE. El texto dice: se verificó la conexión del sistema. Organiza sólo ese texto, sin pacientes ni diagnósticos.' })),
  }, 60_000)
  if (!res.ok) throw new Error(`El servidor respondió HTTP ${res.status}.`)
  const datos = await res.json().catch(() => { throw new Error('El servidor no devolvió JSON válido.') })
  const resultado = leerPropio(datos, modelo)
  if (!resultado.ok) throw new Error(resultado.motivo)
  if (resultado.truncado || !validarNotaPropia(resultado.texto)) throw new Error('La salida no cumple el contrato de nota.')
  process.stdout.write(JSON.stringify({ ok: true, prueba: 'inferencia-sintetica-real', modelo,
    latenciaMs: Date.now() - t0, validacionClinica: false }) + '\n')
}
main().catch(e => {
  // Mensajes propios, nunca cuerpo de respuesta, URL ni credencial del servidor.
  const mensaje = e instanceof Error ? e.message : 'No se completó la comprobación.'
  process.stderr.write(`No se verificó la inferencia propia: ${mensaje}\n`)
  process.exitCode = 1
})
