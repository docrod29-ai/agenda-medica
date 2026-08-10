# Architecture Overview

Fuente de verdad viva: `docs/architecture/` y CLAUDE.md (mapa del repo).
Resumen verificable:

- Next.js 16 · React 19 · TypeScript · Firestore · Vercel · PWA.
- Invariante central: UN paciente · UNA identidad · UN expediente longitudinal;
  un modelo por entidad clínica (encuentro, medicamento, orden, resultado,
  tarea); una línea de tiempo; una bitácora de auditoría. La misma entidad se
  pinta distinto según contexto — nunca se duplica su fuente de verdad.
- 96+ rutas API; toda escritura clínica pasa autorización de servidor
  (sesión + pertenencia a consultorio + lista blanca de campos).
- Motores clínicos **deterministas** registrados en
  `src/lib/clinical/registry.ts`; el LLM redacta y extrae, no calcula.
- Aislamiento multi-consultorio: toda colección declarada en `firestore.rules`
  (forma congelada), `matriz-acceso.ts` y el manifiesto de respaldo — con un
  guardián por cada uno.
- Pipeline de voz con orden de política (sesgo → reconocedor → corrector →
  cifras/siglas → guardián → compuerta de ambigüedad); crudo y editado se
  conservan ambos.
- PHI: nunca en logs, URLs ni mensajes de error; IndexedDB se limpia al cerrar
  sesión.

Debilidades conocidas y mitigación: ver `KNOWN_LIMITATIONS.md`.
