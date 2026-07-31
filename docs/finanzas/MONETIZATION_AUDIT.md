# Auditoría de monetización — Master Loop V3

> **ESTADO AL 30-JUL-2026, 23:35.** Fase 0 (auditoría) y Fase 1 completas y
> desplegadas, v739 → v745. Lo que sigue abajo es el diagnóstico original; esta
> cabecera dice qué quedó cerrado y qué no.
>
> ## Cerrado y en producción
>
> | # | Qué era | Dónde quedó |
> |---|---|---|
> | P0-1 | El costo real era **desconocido**: los proveedores devolvían los tokens en cada respuesta y se tiraban | Libro de costos (`platform_cost_ledger`) + tablero en `/superadmin/costos` |
> | P0-2 | **Dos catálogos de precios que se contradecían** (349/899/3499 contra 399/699/999/1799) | Catálogo único en `planes-ia.ts` |
> | P1-1 | Dieciséis rutas llamaban a los proveedores por su cuenta | Gateway (`src/lib/ia/`). **5 enrutadas, 11 con asiento.** Ver «lo que falta» |
> | P1-2 | Los créditos se contaban **después** de gastarlos | Cartera reservar → confirmar → devolver |
> | P1-3 | **Nada impedía vender un módulo en construcción** | Estados de producto + rechazo en `/api/stripe/checkout` |
> | P1-4 | El fundador y un cliente de cortesía eran la misma cuenta | Tres clases: fundador · cortesía · cliente |
>
> ## Lo que falta, y por qué se dejó
>
> **1. Cargar las tarifas de los modelos.** `src/lib/finanzas/precios-modelo.ts`
> nace **vacío a propósito**: escribir un precio de memoria daría un tablero que
> parece exacto y miente. Los tokens ya se registran completos; falta el precio.
> El tablero dice cuántas llamadas quedan sin costo y qué modelos son. **Es lo
> primero que hay que hacer, y no lo puede hacer nadie más que quien mire la
> página de precios del proveedor.**
>
> **2. Enrutar las once rutas que sólo anotan.** `expediente/procesar` —la nota
> de consulta— hace descubrimiento de modelos contra `/v1/models`, usa
> razonamiento extendido y reintenta sin él ante un 400. Migrarla cambiaría de
> callado cómo razona la nota que se firma, y eso se revisa despierto. Mientras
> tanto su costo **sí** se ve.
>
> **3. Las fases 2 a 16** (organizaciones y asientos, facturación, estado
> clínico del paciente, motor de riesgo, enrutadores, simulador, benchmarks).
> Tocan esquema de datos o comportamiento clínico: no se hacen sin revisión.
>
> ## Decisiones que quedaron escritas en el código
>
> · Costo desconocido es `null`, **nunca** `0`. Un cero se suma en los totales y
>   hace pasar por gratis lo que sólo es desconocido.
> · En el libro de costos **no entra nada clínico**: ni prompt, ni respuesta, ni
>   paciente. Sólo tokens, modelo, latencia y precio.
> · Que el fundador pueda **usar** un módulo no lo pone **a la venta**. No es
>   diferencia de permisos: es de promesa.
> · El gasto del fundador es I+D, el de una cortesía es costo de servir. Los dos
>   entran sin pagar y ahí se acaba el parecido.
> · La cartera falla **abierto**: dejar a un intensivista sin su nota a las tres
>   de la mañana es peor que regalar unos créditos. Cobrar por una llamada que
>   falló no se hace nunca.

---

# MONETIZATION AUDIT — Fase 0 del Master Loop V3

**Fecha:** 30-jul-2026 · **Alcance:** estado actual, sin modificar nada.
**Regla que se respetó:** *«FASE 0 — AUDIT. Mapear estado actual. No modificar todavía.»*

Todo lo que sigue está **medido en el repo**, con archivo y línea. Donde no hay
dato suficiente se escribe `INSUFFICIENT_DATA` en vez de estimarlo.

---

## RESUMEN EN UNA PÁGINA

| Bloque del loop | Estado | Peor hallazgo |
|---|---|---|
| A · Catálogo de precios | ⚠️ Parcial | **Dos catálogos que se contradicen** |
| B · Productos | ⚠️ No coincide | Los 4 planes actuales no son los 8 del loop; no existe FREE |
| C · Entitlements | ⚠️ Parcial | Hay módulos y roles, no hay entitlements como capa propia |
| E–L · Nexus AI Router | ❌ No existe | 16 rutas llaman al proveedor a pelo |
| P–U · Créditos | ⚠️ Parcial | Contador mensual, no wallet: sin reserva, sin rollover, sin top-up |
| W–X · Cost Ledger | ❌ **No existe** | **Cero tokens registrados. Cero costo real.** |
| Y–AF · Control financiero | ❌ No existe | No se puede calcular ni un COGS |
| BJ–BO · Estados de producto | ❌ No existe | Nada distingue INTERNAL de PUBLIC |
| BK · Founder | ⚠️ Sustituto | `paseLibre: boolean`, no un rol |

**Veredicto de la fase:** hay **2 P0** que bloquean todo lo demás. Ninguno es
difícil; los dos son de fontanería, no de arquitectura.

---

## P0 — bloquean el avance

### P0-1 · No se registra ni un token. El costo real es desconocido.

**Evidencia:** `src/lib/ai-keys.ts:287` — `registrarUso()` incrementa un contador
de **llamadas**:

```ts
uso: { [mes]: { total: increment(1), ...(fuente === 'prueba' ? { prueba: increment(1) } : {}) } }
```

Búsqueda de `input_tokens`, `prompt_tokens`, `usage.total_tokens` en `src/`:
**cero coincidencias.**

**Por qué es P0:** el propio loop lo clasifica así (§BD, «costos sin
registrar»). Y sin esto:

- No se puede calcular AI COGS (§V), ni gross margin, ni unit economics (§AD).
- El objetivo «AI COGS < 8% del revenue» **no es verificable hoy**.
- La calibración de créditos por costo real (§Q) es imposible: los valores
  actuales se pusieron a estimación.
- El semáforo de margen (§AE) no tiene entrada.

**Dato medido hoy, para dimensionar:** el Copilot de UCI manda ~3 200 tokens de
entrada por turno (481 del *system* + ~2 700 del snapshot y la discusión) y hasta
16 000 de salida. Con eso se puede calcular el costo — pero **nadie lo guarda**.

**Esfuerzo:** bajo. Los proveedores ya devuelven `usage` en cada respuesta; hoy
se descarta.

---

### P0-2 · Dos catálogos de precios que se contradicen.

**Evidencia A** — `src/lib/planes-ia.ts:117`:

| clave | nombre | precioMXN | créditos |
|---|---|---|---|
| `agenda` | Agenda | 349 | 0 |
| `clinica` | Clínica | 899 | 200 |
| `premium` | Pro | 1 590 | 450 |
| `hospital` | Hospital + UCI | 3 499 | 500 |

**Evidencia B** — `src/app/superadmin/page.tsx:493-497`, **quemado en el
componente**:

```ts
{ nombre: 'Solo agenda', precio: 399, ... }
{ nombre: 'Consulta',    precio: 699, ... }
{ nombre: 'Hospital',    precio: 999, ... }
{ nombre: 'Todo',        precio: 1799, ... }
```

**Ninguno de los cuatro precios coincide.** Agenda vale 349 o 399 según dónde se
mire.

**Por qué es P0:** viola directamente la regla del loop —*«NUNCA dispersar
precios directamente en componentes frontend/backend»*— y el riesgo no es
cosmético: son los paquetes que el superadmin puede sembrar y vender.

**Nota:** `src/app/page.tsx:61` **sí** lee de `PLANES`, con un comentario que dice
que se centralizó por «duplicados que causaban inconsistencias de precio». La
centralización se hizo a medias y quedó esta isla.

---

## P1 — necesarios antes de facturar en serio

### P1-1 · No existe el Nexus AI Gateway. 16 rutas llaman al proveedor a pelo.

`api.anthropic.com` / `api.openai.com` aparecen directamente en **16 rutas**:

```
inmuno/redactar · consultor-evidencia · receta/detectar-campos
expediente/{corregir, procesar, transcribir, evidencia, laboratorio-vision,
            antibiograma-vision, antibiograma-razonar, atribuir-roles,
            extraer-entidades} · uci/copilot · …
```

Consecuencias, todas del loop:

- **§M** sin fallback multi-proveedor: si Anthropic cae, cada ruta falla a su modo.
- **§W** el ledger no puede existir: no hay un punto por donde pase todo.
- **§AM** no se puede medir `% Native / Clinical / Deep / Verify`.
- Cada ruta repite su propia lista de modelos y su propio manejo de error. Hoy
  mismo se vio la consecuencia: el Copilot topaba en 4 000 tokens mientras la
  nota usaba 24 000, porque son dos listas separadas que nadie compara.

### P1-2 · Los créditos son un contador, no un wallet.

`registrarCreditos()` incrementa; `creditosUsadosDelMes()` lee. Falta todo lo
que §AX exige: **reservar antes de ejecutar**, confirmar al terminar y
**reembolsar si falla**. Hoy, si el proveedor devuelve error tras cobrarse el
crédito, el crédito se pierde.

Tampoco existen: top-ups (§S), auto-recharge (§T) ni rollover (§U).

### P1-3 · No hay estados de producto.

Búsqueda de `INTERNAL`, `ALPHA`, `PUBLIC_PURCHASE_ENABLED` en `planes-ia.ts`:
**cero**. Hoy nada distingue un módulo terminado de uno experimental, así que
§BH–BO (lanzamiento progresivo) no se puede aplicar: **UCI y Hospital son
vendibles hoy mismo si alguien cambia un plan.**

### P1-4 · El acceso del fundador es un booleano en el documento de la clínica.

`src/lib/modulos.ts:148` — `if (clinic?.paseLibre) return TODOS_LOS_MODULOS`.

Funciona, pero es lo que §BK pide evitar: el fundador no es «un cliente con todo
desbloqueado», necesita además administración, feature flags y costos, y su
acceso **no debe depender de una suscripción**. Falta el rol `FOUNDER_SUPERADMIN`
y la separación `PUBLIC ENTITLEMENT` ≠ `INTERNAL PRODUCT ACCESS` (§BM).

---

## P2

- **Los planes actuales no son los del loop.** Hoy: `agenda · clinica · premium ·
  hospital`. El loop pide `FREE · AGENDA · CONSULTA · UCI · HOSPITAL · ACUTE ·
  COMPLETE · ENTERPRISE`. **No existe FREE** (`grep -c free planes-ia.ts` = 0).
- **No hay `Organization` ni seats** (§AJ). El modelo actual es clínica → médicos,
  con `entitlementsDe()` escalando créditos por médico (`ai-keys.ts:209`) — que es
  media pieza de asientos, sin el resto.
- **No existe `PatientClinicalState`** (§G) ni `ContextBuilder` (§H). Cada ruta
  arma su contexto a mano.
- **Nexus Native existe pero no está nombrado ni medido.** Los motores
  deterministas ya están (SOFA, NEWS2, gasometría, CKRT, ECMO, ventilación,
  dosificación) y **ya no consumen créditos** — que es lo que §F pide. Falta el
  registro que lo demuestre.

## P3

- Sin simulador (§AA) ni escenarios (§AB).
- Sin métricas de calidad clínica por feature (§AO): hay 👍/👎 del Copilot, sin
  acceptance/edit/reject por tipo de tarea.
- Sin medición de latencia (§N).

---

## LO QUE YA ESTÁ BIEN — y no hay que rehacer

Conviene decirlo, porque la lista de arriba es larga:

1. **Idempotencia de Stripe: existe.** `webhook/route.ts:272` escribe en
   `platform_payments` con `doc(invoice.id)`, y hay un corte explícito por
   carrera perdida (`:174`). Es justo lo que §AH pide.
2. **El tope de créditos ya no se puede saltar.** `gateCreditos` corta cuando la
   llave es la del dueño y el consultorio agotó créditos o prueba.
3. **La degradación no bloquea al médico.** Sin créditos, la nota baja a Rápida
   en vez de fallar — el comportamiento de §R.
4. **Los motores deterministas no cobran créditos.** Es exactamente el principio
   de §F, ya implementado.
5. **El menú de IA por motor ya existe** (⚡/⭐/💎 con su costo), y hoy se extendió
   al Copilot de UCI.
6. **La matriz de autorización es comprobable**: un `match` nuevo en
   `firestore.rules` sin clasificar rompe el CI.

---

## LO QUE NO PUEDO CALCULAR HOY, Y POR QUÉ

El loop pide en §BG catorce cifras. Con el estado actual:

| Cifra pedida | Se puede | Por qué |
|---|---|---|
| Costo medio por médico | ❌ | `INSUFFICIENT_DATA` — no hay tokens (P0-1) |
| AI COGS | ❌ | Ídem |
| COGS total | ❌ | Faltan además infra, WhatsApp, storage (§X) |
| Gross margin | ❌ | Depende de COGS |
| Consumo P50/P90/P95 | ❌ | Hay contador de llamadas, no de créditos por usuario |
| % Native/Clinical/Deep/Verify | ❌ | No existe el router (P1-1) |
| Latencias | ❌ | No se mide (§N) |
| ARPU | ⚠️ | Calculable de `platform_payments`, con el sesgo de P0-2 |
| OPEX / break-even | ❌ | No hay gastos fijos cargados |

**No las voy a estimar.** Una cifra inventada en un dashboard financiero es peor
que un hueco declarado: el hueco se llena, la cifra inventada se cita.

---

## RECOMENDACIÓN DE ORDEN

El loop propone 16 fases. Con lo medido, el orden que desbloquea más por menos
trabajo es:

1. **P0-1 · Cost Ledger mínimo** (fase 10 adelantada). Guardar `usage` de cada
   respuesta. Es la entrada de todo el bloque financiero, y sin él las fases
   11-13 no tienen de qué alimentarse. Con una semana de uso real ya habría
   costo por médico.
2. **P0-2 · Un solo catálogo.** Borrar la isla de `superadmin/page.tsx` y que lea
   de `PLANES`. Es media hora.
3. **P1-3 · Estados de producto.** Antes de tocar precios: hoy nada impide vender
   UCI, y el loop es explícito en que no debe venderse.
4. **P1-1 · Gateway.** Es el refactor más grande y el que más habilita
   (fallback, ledger, router, métricas). Va después del ledger a propósito: así
   se puede medir el antes y el después.

**Nota sobre las fases 6-9 (Native, ClinicalState, Router).** Son las de más
valor estratégico y las más caras. No las pondría antes de tener el ledger
funcionando: sin costo real medido, no hay forma de demostrar que el router
ahorró algo.

---

## UNA OBSERVACIÓN QUE NO ESTABA EN EL LOOP

El loop asume que el problema es de arquitectura financiera. Por lo medido, hoy
**el problema es de instrumentación**: casi todo lo comercial existe —planes,
créditos, gate, degradación, Stripe idempotente— pero **nada mide lo que
cuesta**. Es un negocio con caja registradora y sin contabilidad.

Eso cambia la urgencia relativa: el ledger no es la fase 10, es la fase 1.
