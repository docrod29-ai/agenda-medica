# Punto de retomada — 2026-07-28

Todo lo de esta sesión está **commiteado y desplegado**. Nada depende de la
conversación: este archivo y `estado.json` bastan para continuar desde cero.

## Estado del repo

- `git status` limpio · `tsc` en 0 errores · **1885 / 1885 tests en verde** · build OK
- Producción: **SW v692** desplegado y verificado en `agenda-medica-one.vercel.app`
- Último commit: `feat(nexus-os): programa Clinical Intelligence OS con workflow reanudable`

## Desplegado en esta sesión

| Versión | Qué cerró |
|---|---|
| **v691** | REG-035 CDS hospitalario respeta la negación de alergias · REG-036 alertas UCI ya no se pierden con valor censurado (`>500`, `<50`, `≥6.5`) · REG-037 antibiograma-visión cobra el crédito en cuanto Claude responde |
| **v692** | REG-038 números dictados ≥100 en palabras ("ciento veinte") ya no se pierden del Panel UCI · REG-039 agendar sin teléfono ya no funde expedientes de homónimos (PHI) · REG-040 `firmar()` ya no permite firmar una nota inmutable con paciente y alergias vacíos |

Detalle completo en `docs/audit/regression-ledger.md` (REG-001 … REG-040).

## Auditoría: qué queda

**P0: cero pendientes.** De los P1 verificados van ~19 de 36 cerrados.

Lo que **no** se toca sin decisión humana (por diseño, no por falta de tiempo):

1. **Clúster del antibiograma — 14 P1.** Lógica de decisión clínica en motor regulado
   (NOM-045). Especificado y listo en `docs/audit/antibiograma-spec-para-dr.md`:
   grupos A (propagación EUCAST S→R), B ("ausente ≠ resistente"), C (CMI censurada),
   D (reactividad cruzada de carbapenémicos, resistencias intrínsecas).
2. **REG-014 / REG-015 / REG-017** — siguen OPEN en el ledger: firma médica leíble por
   cualquier miembro, `cobros` sin `creadoPor==uid`, nota que puede nacer `firmada`.
   Los tres tocan flujos vivos (impresión, cobranza, firma) → necesitan tu OK.
3. **`integrity.ts`** — el sello NOM-024 no cubre `preop`/`hospital`/`infectologia`.
   Taparlo obliga a subir `hashVersion` a 3, y eso pasaría **todas** las notas firmadas
   históricas de "verificada" a "legado". Es un cambio visible en registros
   medicolegales: requiere decisión, no iniciativa.
4. **`stripe/webhook`** — la marca de idempotencia se escribe antes de procesar; un
   fallo a mitad pierde el evento de pago. Es ruta de dinero y no se puede probar de
   punta a punta sin Stripe: va con tu visto bueno.

## Programa Nexus OS

Recién creado, **0 / 68 unidades**. La primera corrida se detuvo limpiamente antes de
escribir nada (no hay `unidades/*/RESULTADO.json`), así que arranca desde el principio.

Para continuar: relanzar el workflow `nexus-os`. Es idempotente — relanzarlo nunca
repite trabajo ni pierde avance. Parámetros útiles: `{ lote: 3, soloEtapa: "E0" }`.

Siguiente unidad: **E0-01** (receta/QR derivada de datos autoritativos del servidor).

## Pendientes tuyos (consola, no código)

1. **App Check → Enforce.** Firebase Console → `nexomed-agenda` → Build → App Check →
   pestaña **APIs**. Antes de activar, mirar qué % de solicitudes a Cloud Firestore
   aparece como *verificadas* — si no es alto, activarlo dejaría gente fuera.
2. **CSP enforce** tras observar los reportes de `report-only`.
3. **Playwright**: falta `npx playwright install --with-deps`.
4. **Pentest** externo.
