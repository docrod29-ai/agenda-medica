#!/usr/bin/env node

import { createWriteStream } from 'node:fs';
import { once } from 'node:events';

function parseArgs(argv) {
  const out = {
    seed: 20260819,
    tenants: 1,
    physiciansPerTenant: 1,
    patientsPerPhysician: 100,
    encountersPerPatient: 3,
    output: '-',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const [key, inline] = arg.slice(2).split('=', 2);
    const value = inline ?? argv[++i];
    if (value == null) throw new Error(`Missing value for --${key}`);
    if (key === 'output') out.output = value;
    else if (key in out) out[key] = Number(value);
    else throw new Error(`Unknown option: --${key}`);
  }
  for (const key of ['seed', 'tenants', 'physiciansPerTenant', 'patientsPerPhysician', 'encountersPerPatient']) {
    if (!Number.isSafeInteger(out[key]) || out[key] < 1) throw new Error(`--${key} must be a positive safe integer`);
  }
  return out;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function syntheticId(prefix, n) {
  return `${prefix}_${String(n).padStart(8, '0')}`;
}

async function writeLine(stream, value) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, 'drain');
}

async function main() {
  const cfg = parseArgs(process.argv);
  const rand = mulberry32(cfg.seed);
  const stream = cfg.output === '-' ? process.stdout : createWriteStream(cfg.output, { encoding: 'utf8' });

  await writeLine(stream, {
    type: 'meta',
    schema: 'ausculta.consultorio.synthetic-load.v1',
    syntheticNonPhi: true,
    ...cfg,
    generatedAt: 'deterministic-from-seed',
  });

  let physicianOrdinal = 0;
  let patientOrdinal = 0;
  let encounterOrdinal = 0;

  for (let t = 1; t <= cfg.tenants; t += 1) {
    const tenantId = syntheticId('tenant', t);
    await writeLine(stream, { type: 'tenant', tenantId, syntheticNonPhi: true });

    for (let p = 1; p <= cfg.physiciansPerTenant; p += 1) {
      physicianOrdinal += 1;
      const physicianId = syntheticId('physician', physicianOrdinal);
      await writeLine(stream, { type: 'physician', tenantId, physicianId, syntheticNonPhi: true });

      for (let x = 1; x <= cfg.patientsPerPhysician; x += 1) {
        patientOrdinal += 1;
        const patientId = syntheticId('patient', patientOrdinal);
        const birthYear = 1940 + Math.floor(rand() * 70);
        await writeLine(stream, {
          type: 'patient', tenantId, physicianId, patientId,
          syntheticNonPhi: true,
          displayName: `Synthetic Patient ${patientOrdinal}`,
          birthYear,
          searchKey: `synthetic-${String(patientOrdinal).padStart(8, '0')}`,
        });

        for (let e = 1; e <= cfg.encountersPerPatient; e += 1) {
          encounterOrdinal += 1;
          await writeLine(stream, {
            type: 'encounter', tenantId, physicianId, patientId,
            encounterId: syntheticId('encounter', encounterOrdinal),
            syntheticNonPhi: true,
            ordinalForPatient: e,
            status: e === cfg.encountersPerPatient ? 'draft' : 'signed',
            noteBytesApprox: 800 + Math.floor(rand() * 5200),
          });
        }
      }
    }
  }

  await writeLine(stream, {
    type: 'summary', syntheticNonPhi: true,
    tenants: cfg.tenants,
    physicians: physicianOrdinal,
    patients: patientOrdinal,
    encounters: encounterOrdinal,
  });

  if (stream !== process.stdout) await new Promise((resolve, reject) => stream.end(err => err ? reject(err) : resolve()));
}

main().catch((error) => {
  console.error(`consultorio-load-fixture: ${error.message}`);
  process.exitCode = 1;
});
