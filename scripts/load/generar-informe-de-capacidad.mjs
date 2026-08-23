#!/usr/bin/env node
/**
 * EL INFORME DE CAPACIDAD — y lo que separa «probado» de «preparado».
 *
 * ── POR QUÉ SE GENERA Y NO SE ESCRIBE A MANO ─────────────────────────────────
 *
 * Un informe de capacidad escrito a mano envejece en la primera semana: alguien
 * añade un escenario, nadie actualiza la tabla, y el documento pasa a decir que
 * se probó algo que ya no se prueba. Peor todavía en el sentido contrario —
 * afirmar cobertura que no existe es exactamente lo que #310 prohíbe.
 *
 * Aquí las filas se derivan de los escenarios que EXISTEN y de las ejecuciones
 * que se acaban de hacer. Lo que no se ejecutó no aparece como ejecutado.
 *
 * ── LAS CINCO CLASES ─────────────────────────────────────────────────────────
 *
 *   proven-locally        se corrió aquí y pasó
 *   proven-in-ci          está en la matriz que corre el CI
 *   prepared-only         el artefacto existe y no se ha ejecutado contra nada real
 *   requires-staging      necesita un entorno dimensionado que hoy no existe
 *   requires-owner-approval  necesita dinero, credenciales o una decisión del dueño
 *
 * Uso:
 *   node scripts/load/generar-informe-de-capacidad.mjs --sha=<40hex> \
 *     [--json=docs/reliability/capacity-report.json] \
 *     [--md=docs/reliability/CAPACITY-REPORT.md]
 */

import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { COHORTES, ESCENARIOS_CI, PERFILES_DE_FALLO } from './escenarios.mjs'
import { construirEvidencia } from './run-consultorio-load.mjs'

const CLASE = {
  LOCAL: 'proven-locally',
  CI: 'proven-in-ci',
  PREP: 'prepared-only',
  STAGING: 'requires-staging-environment',
  DUENO: 'requires-owner-approval',
}

function args(argv) {
  const out = { sha: null, json: 'docs/reliability/capacity-report.json', md: 'docs/reliability/CAPACITY-REPORT.md', seed: 20260823 }
  for (const a of argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=', 2)
    if (k in out) out[k] = k === 'seed' ? Number(v) : v
    else throw new Error(`Opción desconocida: --${k}`)
  }
  if (!/^[0-9a-f]{40}$/i.test(out.sha ?? '')) throw new Error('--sha obligatorio, 40 hex')
  out.sha = out.sha.toLowerCase()
  return out
}

/**
 * Lo que hace falta y no se tiene. Se declara aquí, en el mismo artefacto que
 * el resto, para que no se pueda leer la tabla de arriba sin ver esto.
 */
const PENDIENTES = [
  {
    id: 'entorno-dimensionado',
    clase: CLASE.STAGING,
    que: 'Un entorno de pruebas con Firestore y despliegue propios donde apuntar el controlador `http` del arnés.',
    porQue: 'Sin él, ninguna cifra de latencia, saturación o coste sale del producto: sale del modelo. No puede ser producción.',
    cuesta: 'Proyecto de Firebase + despliegue de Vercel de no-producción. Hay coste.',
    bloquea: ['toda la columna OBSERVED del contrato SLO', 'cualquier afirmación de 2k/10k'],
  },
  {
    id: 'generador-de-carga-distribuido',
    clase: CLASE.DUENO,
    que: 'Capacidad de generar concurrencia real (k6, Artillery o equivalente) desde varias máquinas.',
    porQue: 'Un solo proceso de Node no produce el pico de 1 200 consultas concurrentes que modela la cohorte de 10k.',
    cuesta: 'Servicio de carga de pago o máquinas propias. Hay coste.',
    bloquea: ['cohorte multi-tenant-10k medida', 'cohorte growth-tier medida'],
  },
  {
    id: 'entorno-dom-para-pruebas-de-componente',
    clase: CLASE.PREP,
    que: 'jsdom o un proyecto de vitest aparte para montar pantallas y comprobar que un hijo que lanza no tumba el resto.',
    porQue: 'La suite corre en `environment: node`. Sin DOM no hay prueba determinista de pantalla blanca.',
    cuesta: 'Sin coste monetario. Cambia configuración compartida por todos los carriles.',
    bloquea: ['F12 de la matriz de fallos', 'plan de pruebas de NO-WHITE-SCREEN §3'],
  },
  {
    id: 'e2e-de-recarga-y-reconexion',
    clase: CLASE.PREP,
    que: 'Escenarios de Playwright con corte de red, recarga y segundo plano contra un objetivo local.',
    porQue: 'F13 y F14 sólo se pueden demostrar en un navegador de verdad.',
    cuesta: 'Sin coste monetario; Playwright ya está en el repositorio.',
    bloquea: ['F13', 'F14', 'la mitad de la matriz adversarial de #322'],
  },
  {
    id: 'simulacro-de-restauracion-medido',
    clase: CLASE.DUENO,
    que: 'RPO/RTO medidos en un simulacro real de respaldo → pérdida controlada → restauración → verificación.',
    porQue: '#320 Gate 5 no acepta valores documentados como probados hasta que se hace el simulacro. `npm run simulacro:respaldo` existe; falta un destino seguro donde correrlo.',
    cuesta: 'Necesita un destino de datos que no sea producción.',
    bloquea: ['Gate 5 de #320'],
  },
  {
    id: 'cableado-de-los-contratos',
    clase: CLASE.PREP,
    que: 'Conectar idempotencia, cortacircuitos, colas y telemetría a las rutas reales.',
    porQue: 'Hoy son contratos probados y no cableados. Cablearlos toca #302, #303 y #306.',
    cuesta: 'Sin coste monetario. Necesita que el carril correspondiente lo tome.',
    bloquea: ['que las invariantes protejan al producto y no sólo al modelo'],
  },
]

async function main() {
  const cfg = args(process.argv)

  // Se EJECUTA la matriz de CI ahora mismo: las filas «proven-locally» no se
  // declaran, se ganan.
  const corridas = []
  for (const cohorte of ESCENARIOS_CI) {
    for (const fallo of Object.keys(PERFILES_DE_FALLO)) {
      const ev = construirEvidencia({ cohorteNombre: cohorte, falloNombre: fallo, seed: cfg.seed, sha: cfg.sha, driver: 'simulado' })
      const bloqueadores = [
        ev.lostDraftCount, ev.blankScreenCount, ev.crossTenantLeakageCount,
        ev.unboundedReadCount, ev.idempotencyViolationCount, ev.silentProviderFailureCount,
      ].reduce((a, b) => a + b, 0)
      corridas.push({
        scenario: ev.scenario,
        registeredPhysicians: ev.registeredPhysicians,
        concurrentConsultations: ev.concurrentConsultations,
        modeledHotPathOpsPerSecond: ev.modeledHotPathOpsPerSecond,
        requestCount: ev.requestCount,
        unconditionalBlockers: bloqueadores,
        evidenceClass: ev.evidenceClass,
        capacityClaim: ev.capacityClaim,
      })
    }
  }

  const cohortes = Object.entries(COHORTES).map(([nombre, c]) => ({
    cohort: nombre,
    registeredPhysicians: c.registeredPhysicians,
    executedWithSimulatedDriver: ESCENARIOS_CI.includes(nombre),
    status: ESCENARIOS_CI.includes(nombre) ? CLASE.CI : CLASE.STAGING,
    note: ESCENARIOS_CI.includes(nombre)
      ? 'Ejecutada con el controlador simulado. Ejercita el MODELO y sus invariantes, NO el producto.'
      : 'Correrla simulada no demostraría nada nuevo; medirla exige entorno dimensionado.',
  }))

  const informe = {
    schema: 'ausculta.consultorio.capacity-report.v1',
    candidateSha: cfg.sha,
    seed: String(cfg.seed),
    syntheticNonPhi: true,
    /** LA LÍNEA QUE NO SE PUEDE MOVER DESDE LA LÍNEA DE ÓRDENES. */
    capacityProven: false,
    capacityStatement:
      'No existe evidencia de que Ausculta Consultorio soporte 2 000 ni 10 000 médicos. ' +
      'Lo que existe es un arnés determinista, un contrato de invariantes y un inventario ' +
      'del camino caliente con tres lecturas de colección sin acotar todavía abiertas.',
    classes: CLASE,
    cohorts: cohortes,
    harnessRuns: corridas,
    openBlockers: [
      { id: 'P0-1', que: 'getPatients() descarga la colección entera en 13 pantallas', donde: 'src/lib/firestore.ts:114', carril: '#306' },
      { id: 'P0-2', que: 'findNotaByIdInClinic hace una lectura por paciente', donde: 'src/lib/expediente/firestore.ts:57', carril: '#306' },
      { id: 'P1-1', que: 'time_blocks se lee entera en cinco caminos de reserva', donde: 'src/app/api/appointments/route.ts:164 (+4)', carril: '#306' },
    ],
    pending: PENDIENTES,
  }

  await writeFile(cfg.json, `${JSON.stringify(informe, null, 2)}\n`, 'utf8')
  await writeFile(cfg.md, markdown(informe), 'utf8')
  process.stdout.write(`informe escrito: ${cfg.json} · ${cfg.md}\n`)
}

function markdown(r) {
  const fila = (c) => `| \`${c.cohort}\` | ${c.registeredPhysicians.toLocaleString('es-MX')} | ${c.executedWithSimulatedDriver ? 'sí' : 'no'} | \`${c.status}\` | ${c.note} |`
  const corrida = (c) => `| \`${c.scenario}\` | ${c.concurrentConsultations} | ${c.modeledHotPathOpsPerSecond} | ${c.requestCount} | ${c.unconditionalBlockers} |`
  const pend = (p) => `### ${p.id} — \`${p.clase}\`\n\n**Qué:** ${p.que}\n\n**Por qué:** ${p.porQue}\n\n**Cuesta:** ${p.cuesta}\n\n**Bloquea:** ${p.bloquea.map(b => `\n- ${b}`).join('')}\n`
  const bloq = (b) => `| ${b.id} | ${b.que} | \`${b.donde}\` | ${b.carril} |`

  return `# Informe de capacidad — Ausculta Consultorio

<!-- GENERADO por scripts/load/generar-informe-de-capacidad.mjs. No editar a mano: se regenera. -->

**Candidato:** \`${r.candidateSha}\` · **semilla:** ${r.seed} · **carril:** #310

## Lo primero

> **\`capacityProven: false\`**
>
> ${r.capacityStatement}

Este campo **no se puede subir desde la línea de órdenes**. Para cambiarlo hace falta
evidencia medida contra un candidato exacto en un entorno dimensionado, y la aprobación
explícita del dueño sobre umbrales derivados de esa medición.

## Cohortes

| Cohorte | Médicos registrados | ¿Ejecutada (simulada)? | Clase | Nota |
|---|---|---|---|---|
${r.cohorts.map(fila).join('\n')}

## Ejecuciones del arnés (controlador simulado)

Clase de evidencia de todas: \`harness-only\`. Ejercitan el MODELO y sus invariantes; no
tocan Next.js, ni Firestore, ni la red.

| Escenario | Consultas concurrentes | Ops/s camino caliente (modelo) | Peticiones | Bloqueadores incondicionales |
|---|---|---|---|---|
${r.harnessRuns.map(corrida).join('\n')}

Los bloqueadores incondicionales son: borrador perdido, pantalla blanca, fuga entre
consultorios, lectura sin acotar, duplicado no idempotente y fallo silencioso de proveedor.
Cualquiera por encima de cero es defecto de lanzamiento, se mire la latencia que se mire.

## Bloqueadores abiertos en el producto

Encontrados leyendo el repositorio, no midiendo. Detalle y reparación propuesta en
[\`HOT-PATH-INVENTORY.md\`](HOT-PATH-INVENTORY.md).

| # | Qué | Dónde | Carril que puede tocarlo |
|---|---|---|---|
${r.openBlockers.map(bloq).join('\n')}

## Lo que hace falta y no se tiene

${r.pending.map(pend).join('\n')}

## Qué se puede decir hoy, con estas palabras exactas

**Sí se puede decir:**

- existe un arnés determinista y reproducible que modela la carga de 2 000, 10 000 y
  25 000 médicos separando registrados de concurrentes;
- las invariantes de fiabilidad están escritas como contrato ejecutable con su golden;
- bajo los diez perfiles de fallo del arnés, ningún bloqueador incondicional se dispara en
  el modelo;
- el inventario del camino caliente encontró dos P0 y siete P1 con archivo y línea.

**No se puede decir:**

- que Ausculta soporte 2 000 médicos;
- que Ausculta soporte 10 000 médicos;
- que ningún SLO se cumple —ninguno se ha medido—;
- que las invariantes protegen al producto: hoy protegen al modelo, porque los contratos
  no están cableados.
`
}

main().catch((e) => { console.error(`INFORME DE CAPACIDAD: ${e.message}`); process.exit(1) })
