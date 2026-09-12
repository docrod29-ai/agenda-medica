/* Suite de unidad sin tráfico TCP, DNS ni UDP. No usar en la aplicación.
 * NODE_OPTIONS=--require=./scripts/testing/sin-red.cjs npx vitest run
 * Los workers heredan NODE_OPTIONS; los dobles de fetch siguen funcionando.
 */
'use strict'
const net = require('node:net')
const dns = require('node:dns')
const dgram = require('node:dgram')
const { syncBuiltinESMExports } = require('node:module')
const denegar = () => { throw new Error('RED_BLOQUEADA_EN_PRUEBAS: use un doble de transporte con datos sintéticos') }
Object.defineProperty(net.Socket.prototype, 'connect', { value: denegar, writable: false, configurable: false })
Object.defineProperty(dgram.Socket.prototype, 'send', { value: denegar, writable: false, configurable: false })
for (const nombre of Object.keys(dns)) {
  if (/^(lookup|resolve|reverse)/.test(nombre) && typeof dns[nombre] === 'function') dns[nombre] = denegar
}
for (const nombre of Object.keys(dns.promises)) {
  if (/^(lookup|resolve|reverse)/.test(nombre) && typeof dns.promises[nombre] === 'function') dns.promises[nombre] = async () => denegar()
}
syncBuiltinESMExports()
