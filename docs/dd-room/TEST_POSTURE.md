# Test Posture

Compuertas obligatorias del repo (toda cifra de aquí sale de una corrida con
commit, nunca de memoria):

| Compuerta | Qué cubre | Última corrida verificada |
|---|---|---|
| `npx vitest run` | suite completa | ver commit de instalación V14 (esta rama) |
| `node scripts/lint-trinquete.mjs` | techo de deuda ESLint — **sólo baja** | 96 = techo (corrida de instalación V14, 10-ago-2026) |
| `npm run build` | tsc + Next — caza lo que vitest no ve | ver commit de instalación V14 |
| trinquete de diseño | hex/tamaños/radios sueltos — sólo baja | 557/2008/637/23 sellado (commit b6a8c343) |
| axe (arnés) | accesibilidad del golden flow | 0 critical (commit a63fefe7) |

Disciplina que un comprador debe conocer:

- **Una prueba que no puede fallar no es una prueba**: todo guardián se prueba
  al revés (se siembra el defecto y se comprueba que falla).
- Los golden explican qué fallaba, cómo se descubrió, la causa raíz y **qué NO
  cubren**.
- 308 regresiones documentadas con causa raíz y prueba en
  `docs/audit/regression-ledger.md`; selladas con conteo mínimo de casos en
  `src/lib/clinical/invariantes-clinicos.json`.
- Familias de defecto catalogadas (`docs/quality/FAMILIAS-DE-DEFECTO.md`),
  incluida la más peligrosa: «escrito, probado y sin conectar» — con
  instrumento propio desde REG-255.

Límite honesto: la suite corre en Node — `MediaRecorder`/IndexedDB no existen
ahí; el ciclo de audio real sólo se verifica en navegador (arnés).
