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

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * UN GENERADOR DERIVADO POR PACIENTE — REG-440.
 *
 * La distribución nueva (historia, medicamentos, laboratorios, órdenes) NO puede
 * consumir del `rand()` principal: cada llamada de más desplaza toda la
 * secuencia, y `birthYear` y `noteBytesApprox` de TODOS los pacientes saldrían
 * distintos. Una corrida de carga vale por comparación con las anteriores, así
 * que mover el fixture entero para añadirle campos habría costado la serie.
 *
 * Con un generador derivado de `(semilla, ordinal del paciente)`, lo que ya
 * existía sale byte a byte idéntico. Comprobado con un hash antes y después.
 */
export function generadorDelPaciente(semilla, ordinal) {
  return mulberry32((semilla ^ Math.imul(ordinal, 0x9e3779b1)) >>> 0);
}

/**
 * CUÁNTA HISTORIA TIENE CADA PACIENTE.
 *
 * `encountersPerPatient` daba a TODOS exactamente la misma, y una consulta real
 * no se parece a eso: hay muchos pacientes de una sola visita y unos pocos con
 * años encima. Un fixture uniforme mide un caso que no existe — y, peor, esconde
 * justo el que duele, que es el expediente largo.
 *
 * ── ESTO NO ES EPIDEMIOLOGÍA, Y SE DICE ─────────────────────────────────────
 *
 * Los pesos son una FORMA DE CARGA elegida para que el fixture tenga cola larga,
 * no una afirmación sobre cómo se reparten los pacientes de un consultorio real.
 * Nadie los ha medido contra una práctica de verdad. Escribirlos sin decir esto
 * sería fabricar una cifra con aspecto de dato, que es la regla 1 aplicada a un
 * arnés de carga.
 *
 * `encountersPerPatient` sigue siendo el promedio objetivo: los pesos reparten
 * alrededor de él y el total se conserva aproximadamente.
 */
export const FORMA_DE_LA_HISTORIA = Object.freeze([
  { proporcion: 0.50, factor: 0.34 },   // una sola visita, o casi
  { proporcion: 0.30, factor: 1.0 },    // el promedio
  { proporcion: 0.15, factor: 2.0 },    // seguimiento de años
  { proporcion: 0.05, factor: 4.5 },    // el expediente largo: el que duele
]);

/**
 * LA MEDIA PONDERADA TIENE QUE SER 1, Y SE COMPRUEBA AQUÍ.
 *
 * La primera versión de estos pesos daba 1.178: quien pidiera «50 000 pacientes
 * × 3 encuentros» habría obtenido 177 000 documentos en vez de 150 000, **sin
 * que nada lo dijera** — un arnés que miente sobre su propia carga mide otra
 * cosa y lo llama lo pedido.
 *
 * Se comprueba en el código y no en un comentario: una aritmética escrita en
 * prosa envejece el día que alguien mueve un peso.
 */
export function mediaDeLaForma(forma = FORMA_DE_LA_HISTORIA) {
  return forma.reduce((a, t) => a + t.proporcion * t.factor, 0);
}

export function proporcionDeLaForma(forma = FORMA_DE_LA_HISTORIA) {
  return forma.reduce((a, t) => a + t.proporcion, 0);
}

if (Math.abs(mediaDeLaForma() - 1) > 0.02 || Math.abs(proporcionDeLaForma() - 1) > 1e-9) {
  throw new Error(
    `FORMA_DE_LA_HISTORIA desbalanceada: media ${mediaDeLaForma().toFixed(3)} (debe ser 1±0.02), ` +
    `proporciones ${proporcionDeLaForma()} (deben sumar 1). El arnés generaría una carga distinta de la pedida.`,
  );
}

export function historiaDe(r, promedio) {
  let acc = 0;
  const x = r();
  for (const tramo of FORMA_DE_LA_HISTORIA) {
    acc += tramo.proporcion;
    if (x < acc) return Math.max(1, Math.round(promedio * tramo.factor));
  }
  return Math.max(1, promedio);
}

/**
 * Cuántos medicamentos activos lleva el paciente, cuántos laboratorios trae un
 * encuentro y cuántas órdenes salen de él.
 *
 * Mismo aviso: son cargas, no epidemiología. Lo que importa aquí es que **no
 * sean constantes**: un fixture donde todos los pacientes llevan tres
 * medicamentos no ejercita ni el vacío ni la polifarmacia, que son los dos
 * extremos donde el producto se rompe.
 */
export function cuantosMedicamentos(r) {
  const x = r();
  if (x < 0.30) return 0;
  if (x < 0.70) return 1 + Math.floor(r() * 2);
  if (x < 0.95) return 3 + Math.floor(r() * 3);
  return 6 + Math.floor(r() * 5);            // polifarmacia
}

function syntheticId(prefix, n) {
  return `${prefix}_${String(n).padStart(8, '0')}`;
}

async function writeLine(stream, value) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, 'drain');
}

async function main() {
  const cfg = parseArgs(process.argv);
  const stream = cfg.output === '-' ? process.stdout : createWriteStream(cfg.output, { encoding: 'utf8' });

  await writeLine(stream, {
    type: 'meta',
    schema: 'ausculta.consultorio.synthetic-load.v2',
    syntheticNonPhi: true,
    ...cfg,
    generatedAt: 'deterministic-from-seed',
  });

  let physicianOrdinal = 0;
  let patientOrdinal = 0;
  let encounterOrdinal = 0;
  let medicationOrdinal = 0;
  let labOrdinal = 0;
  let orderOrdinal = 0;

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
        /**
         * REG-440 · todo lo del paciente sale de SU generador.
         *
         * Con `rand()` principal, cada campo nuevo desplazaba la secuencia de
         * todos los pacientes siguientes. Derivándolo de `(semilla, ordinal)`,
         * añadir un campo mañana no mueve a nadie más — que es lo que hace que
         * este arnés se pueda ampliar sin tirar la serie de corridas.
         */
        const rp = generadorDelPaciente(cfg.seed, patientOrdinal);
        const birthYear = 1940 + Math.floor(rp() * 70);
        await writeLine(stream, {
          type: 'patient', tenantId, physicianId, patientId,
          syntheticNonPhi: true,
          displayName: `Synthetic Patient ${patientOrdinal}`,
          birthYear,
          searchKey: `synthetic-${String(patientOrdinal).padStart(8, '0')}`,
        });

        const encuentros = historiaDe(rp, cfg.encountersPerPatient);
        const medicamentos = cuantosMedicamentos(rp);
        for (let m = 1; m <= medicamentos; m += 1) {
          medicationOrdinal += 1;
          await writeLine(stream, {
            type: 'medication', tenantId, physicianId, patientId,
            medicationId: syntheticId('medication', medicationOrdinal),
            syntheticNonPhi: true,
            /* Sin nombre de fármaco: este arnés mide CARGA, y un catálogo de
               medicamentos aquí acabaría leyéndose como una prescripción. */
            ordinalForPatient: m,
            activo: rp() < 0.8,
          });
        }

        for (let e = 1; e <= encuentros; e += 1) {
          encounterOrdinal += 1;
          const encounterId = syntheticId('encounter', encounterOrdinal);
          await writeLine(stream, {
            type: 'encounter', tenantId, physicianId, patientId, encounterId,
            syntheticNonPhi: true,
            ordinalForPatient: e,
            status: e === encuentros ? 'draft' : 'signed',
            noteBytesApprox: 800 + Math.floor(rp() * 5200),
          });
          /* No todos los encuentros piden estudios: uno que siempre pidiera
             mediría una consulta que no existe, y la mitad del coste real de
             navegar un expediente está en los que NO tienen nada. */
          const labs = rp() < 0.45 ? 1 + Math.floor(rp() * 4) : 0;
          for (let l = 1; l <= labs; l += 1) {
            labOrdinal += 1;
            await writeLine(stream, {
              type: 'lab', tenantId, physicianId, patientId, encounterId,
              labId: syntheticId('lab', labOrdinal),
              syntheticNonPhi: true,
              ordinalForEncounter: l,
              /* Ni analito ni valor: una cifra de laboratorio sintética con
                 aspecto de resultado es exactamente lo que la regla 1 prohíbe
                 que exista sin fuente. Aquí sólo se cuenta el documento. */
              revisado: rp() < 0.7,
            });
          }
          const ordenes = rp() < 0.3 ? 1 + Math.floor(rp() * 2) : 0;
          for (let o = 1; o <= ordenes; o += 1) {
            orderOrdinal += 1;
            await writeLine(stream, {
              type: 'order', tenantId, physicianId, patientId, encounterId,
              orderId: syntheticId('order', orderOrdinal),
              syntheticNonPhi: true,
              ordinalForEncounter: o,
              cumplida: rp() < 0.6,
            });
          }
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
    medications: medicationOrdinal,
    labs: labOrdinal,
    orders: orderOrdinal,
  });

  if (stream !== process.stdout) await new Promise((resolve, reject) => stream.end(err => err ? reject(err) : resolve()));
}

/* Sólo como CLI: desde REG-440 este archivo también se IMPORTA para poder
   probar la forma de la carga sin generar un fixture entero. */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`consultorio-load-fixture: ${error.message}`);
    process.exitCode = 1;
  });
}
