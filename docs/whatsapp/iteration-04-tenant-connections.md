# Iteración 4 — TENANT_CONNECTIONS · Reporte

- **Iteration ID:** nexusmed-whatsapp-004 · **Modo:** TENANT_CONNECTIONS · **Entorno:** staging / rama `feat/whatsapp-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PASS — aislamiento multi-tenant verificado y fijado con regla pura + pruebas de acceso cruzado.**

## Foco
El tenant debe resolverse SIEMPRE del activo oficial (phoneNumberId / apiKey), nunca de parámetros del cliente ni de un "primer consultorio" por defecto. Un identificador desconocido en un sistema con varios consultorios NO debe caer a ninguno (cero acceso cruzado).

## Auditoría (resolución de tenant)
Dos rutas de entrada, ambas resuelven por activo:

| Vía | Resolución | Veredicto |
|---|---|---|
| 360dialog (`360dialog-webhook`) | `findClinicByDialog360ApiKey(apiKey)` → índice apiKey→clínica. Llave desconocida → **404**, sin registrar material de la llave. | ✅ correcto (revisado Iter. 1) |
| Meta (`webhook`) | `findClinicByPhoneNumberId`: (1) índice O(1) `whatsapp_channels/{phoneNumberId}`; (2) escaneo por activo (`clinic.whatsapp.phoneNumberId` o config legacy); (3) fallback. | ⚠️ el fallback (3) era el punto a revisar |

### El fallback (línea 191-195, antes)
```ts
const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
if (clinicsSnap.size === 1 && (!envPhoneId || envPhoneId === phoneNumberId)) {
  return clinicsSnap.docs[0].id
}
```
- **Guardado por `size === 1`**: con 2+ consultorios, un `phoneNumberId` desconocido ya devolvía `null`. → **el aislamiento multi-tenant ya era correcto** (no había fuga entre consultorios). Mi alarma inicial ("¿fallback a la primera clínica?") se acotó a un solo caso: instalación de UNA sola clínica, donde todo el tráfico de WhatsApp es de ella (inofensivo).
- Punto débil real: la condición estaba **inline** en una función pesada de Firestore → no testeable, y el `!envPhoneId` era una regla suelta fácil de romper en un refactor.

## Entregado (verificable)
| Pieza | Qué hace |
|---|---|
| `src/lib/whatsapp/tenant.ts` | `permiteFallbackUnicoTenant({numClinicas, phoneNumberId, envPhoneId})` — **función pura** que encapsula la única regla de catch-all permitida: solo `numClinicas === 1` y el env no contradice al entrante. En multi-tenant SIEMPRE `false`. |
| `webhook/route.ts` | La condición inline se reemplaza por la llamada a `permiteFallbackUnicoTenant(...)`. **Comportamiento preservado**, ahora testeable y con la regla en un solo lugar documentado. |
| `whatsapp-tenant.test.ts` | 4 tests que fijan la garantía: 2+ clínicas + id desconocido → `false` (sin fallback, aunque el env coincida); 0 clínicas → `false`; single-tenant sin env o con env coincidente → `true`; single-tenant con env que contradice → `false`. |

**Archivos:** `whatsapp/tenant.ts`, `whatsapp-tenant.test.ts` (nuevos); `webhook/route.ts` (import + cableado). Deps/migraciones: 0.

## Garantía de aislamiento (lo que fijan las pruebas)
1. **Multi-tenant + identificador desconocido → sin tenant** (no cae a ningún consultorio). Cero acceso cruzado.
2. El catch-all queda restringido, explícito y probado a la instalación single-tenant (todo el tráfico es de la única clínica) — nunca "el primer consultorio de la lista" en un sistema con varios.
3. El env `WHATSAPP_PHONE_NUMBER_ID`, si está configurado, no puede resolver a un número que no le corresponde.

## Pruebas
- `tsc --noEmit` → 0. · `vitest run` → **411/411** (4 nuevos). · `next build` → OK.
- **Límite honesto:** las lecturas de Firestore (índice `whatsapp_channels`, escaneo por `status`) no se ejecutan aquí (necesitan runtime). La **decisión de aislamiento** (la única con riesgo de fuga) sí está aislada en función pura y probada. Las vías por índice/activo son consultas directas de igualdad (apiKey/phoneNumberId), no heurísticas.

## Quality Gate
```
QUALITY GATE: PASS — tenant resuelto SIEMPRE del activo (índice phoneNumberId /
apiKey); identificador desconocido en multi-tenant → null (cero acceso cruzado,
fijado por prueba); catch-all restringido y probado a instalación single-tenant;
regla extraída a función pura (permiteFallbackUnicoTenant). tsc 0, 411/411, build
OK. production_deployment_allowed: false.
```

## Siguiente iteración recomendada (no implementada)
**Iteración 5 — CONSENT_AND_OPTOUT** (WA-2: consentimiento granular + STOP/opt-out, base legal por contacto) — verificable por código y de alto impacto de cumplimiento. Alternativa de mayor impacto de negocio: adelantar el **P0 WA-1** (plantillas HSM + lógica de ventana de 24 h para recordatorios).
