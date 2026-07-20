# Cobertura de la auditoría

Qué superficie de NexusMED ha pasado por el panel de agentes y cuál no. Sirve para dos
cosas: no repetir trabajo, y no confundir "no encontramos nada" con "no lo miramos".

Estados: **CERRADO** · **EN CURSO** · **PENDIENTE**

| # | Módulo | Estado | Agentes que corrieron |
|---|---|---|---|
| 0 | Núcleo (layout, contextos, sesión, reglas, alta de consultorio) | **CERRADO** v460–v465 | Bugs, Seguridad, Rendimiento, Normativa, Integridad |
| 1 | Consulta y Expediente Clínico (dictado, IA, firma, adendas) | **CERRADO** v466–v468 | IA clínica, Bugs, Seguridad, Integridad |
| 2 | Agenda y citas | PENDIENTE | — |
| 3 | Recetas, órdenes y referencias (impresión, formatos) | PENDIENTE | — |
| 4 | Hospitalización (censo, episodio, MAR, signos) | PENDIENTE | — |
| 5 | Antibiograma y motor PROA | PENDIENTE | — |
| 6 | Módulos cardiometabólicos (obesidad, dislipidemia, MASLD, PREVENT) | PENDIENTE | — |
| 7 | Portal del paciente y perfil público | PENDIENTE | — |
| 8 | WhatsApp y mensajería | PENDIENTE | — |
| 9 | Pagos, suscripción y superadmin | Parcial (v460) | Seguridad (solo redirects) |
| 10 | Laboratorio e interoperabilidad HL7/FHIR | PENDIENTE | — |
| 11 | Farmacia | PENDIENTE | — |
| 12 | Finanzas, corte de caja y CFDI | PENDIENTE | — |
| 13 | Analítica, reportes y exportación | Parcial | Auditoría de datos previa (2026-07) |
| 14 | Configuración e impresión por médico | Parcial (v461, v462) | Seguridad, Bugs |
| 15 | Landing, marketing y onboarding público | PENDIENTE | — |

## Cobertura de tests

Se añadió el bloque de `coverage` a `vitest.config.ts` — **nunca había existido**, así que
la cobertura jamás se había medido. Se corre con `npm run test:cobertura`. Sin umbrales que
rompan el build: el objetivo por ahora es poder mirar el número y notar si baja.

Punto de partida sobre `src/lib/**`, medido el 2026-07-19: **61,55 % de sentencias**.

Las tres superficies que estaban al 0 % —`auth-server.ts`, `superadmin.ts`,
`rate-limit.ts`— ya tienen 33 tests. Eran justo aquellas donde un fallo es un incidente de
seguridad y no un bug de pantalla.

## Lo que ningún agente puede cubrir

- **Prueba en dispositivo real con sesión del médico.** Nadie ha abierto un paciente,
  dictado una consulta ni impreso una receta como parte de este loop.
- **Validación médica del contenido clínico.** Los módulos nuevos (cardiometabólico,
  antibiograma) necesitan la firma del médico antes de uso en producción.
- **Pen-test externo, certificación e infraestructura** (respaldos, PITR, App Check en
  modo enforce). Están declarados como pendientes externos, no como implementados.
