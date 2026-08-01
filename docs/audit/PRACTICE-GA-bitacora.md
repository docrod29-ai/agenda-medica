# Bitácora PRACTICE-GA — correcciones y pendientes

> Registro vivo del programa **Master Execution System V5**, track P (NexusMED
> Practice → GA comercial). Se actualiza al cerrar cada iteración.
>
> Dos secciones y las dos importan igual: lo que **arreglé** y lo que **dije mal**.
> Un informe de auditoría que sólo lista aciertos no sirve para decidir dónde
> mirar la próxima vez.

Última actualización: **31-jul-2026**, tras PRACTICE-GA-004.

---

## 1. Correcciones a mi propia auditoría

Dos de los siete P0 de `PRACTICE-GA-001` estaban mal planteados. Los dos se
cazaron **al bajar a leer el código antes de programar**, no después.

| # | Lo que afirmé | Lo que era verdad | Cómo se cazó |
|---|---|---|---|
| **P0-1** | «Sin horario configurado no hay huecos: el médico nuevo no puede agendar» | **Falso.** `DEFAULT_CONFIG` trae lunes a viernes 9-18h y las duraciones; la agenda funciona recién creado el consultorio | Leyendo `DEFAULT_CONFIG` antes de construir el asistente de onboarding |
| **P0-4** | «Clickjacking abierto: sin `X-Frame-Options` y CSP en report-only» | **Falso para la zona autenticada.** `/dashboard`, `/consulta`, `/uci`, `/pacientes`, `/login` y `/setup` ya iban con `DENY` + `frame-ancestors 'none'` en enforce | Midiendo ruta por ruta contra producción, en vez de hacer `curl` a `/` y generalizar |

**Lección de método.** Las dos afirmaciones salieron de leer código y probar *una*
URL de muestra. Al medir caso por caso, las dos se cayeron — **y las dos escondían
un hallazgo mejor**:

- Bajo P0-1 estaba el muro real: la **cédula profesional** vacía dejaba el botón
  de *Firmar* muerto en la primera nota de todo médico nuevo.
- Bajo P0-4 estaba el hueco real: el **portal del paciente** (`/mi`, `/resena`,
  `/verificar`, `/teleconsulta`) sin ninguna cabecera anti-encuadre.

Regla para lo que queda: **verificar cada P0 contra la realidad antes de
programar nada**, no después.

**P0-3 se confirmó tal cual** (`grep` sobre todo el repo: cero manejo de refund o
dispute). Pero al implementarlo apareció debajo un defecto que la auditoría no
vio: la consola del dueño sumaba `platform_payments` de **dos formas
incompatibles** —el ingreso total descartaba los negativos, el pagado-por-cliente
los incluía—. Sin arreglar eso, escribir los reembolsos los habría dejado
invisibles justo en el número grande.

---

## 2. Cerrado

| Iteración | Qué | Versión |
|---|---|---|
| **GA-002** | Muro de la primera firma (cédula), zona horaria adivinada del navegador, especialidad que se perdía | v766 |
| **GA-003** | Anti-encuadre en las 4 rutas del paciente con PHI; corregido el malentendido de `frame-ancestors` en teleconsulta | v767 |
| **GA-004** | Reembolsos y contracargos en el webhook + ingreso NETO con una sola definición de signo | v768 |

Fuera del programa, el mismo día: gateway de fallos de IA (`fallo-proveedor.ts`),
exención de fundador (`fuente: 'fundador'`), incidencias de plataforma visibles
en `/superadmin/costos`, y la pantalla que dice **qué llave se usa de verdad**
(v764-v765).

---

## 3. Pendientes abiertos

### En cola, decididos por el Dr. (sí/no del 31-jul)

| # | Qué | Estado |
|---|---|---|
| 7 | ~~Reembolsos y contracargos en el webhook de Stripe~~ | ✅ GA-004 |
| 2 | Sello «no validado clínicamente» en los 4 motores pendientes + hoja de reglas para revisarlos | pendiente |
| 3 | Buscar tarifas de Anthropic/OpenAI, presentarlas, cargarlas **sólo con su confirmación** | pendiente |
| 5 | Fin del trial: bloquear IA, agenda y expediente en solo lectura | pendiente |

### P0 de la auditoría todavía sin abordar

| # | Qué | Bloqueado en |
|---|---|---|
| **P0-2** | 4 motores en `pendiente_validacion`, dos de ellos en el camino de la receta (`Prescripción segura`, `Farmacovigilancia`) | **Criterio clínico del Dr.** — `NEEDS_CLINICAL_REVIEW` |
| **P0-5** | No existe el E2E del Golden Flow; Playwright tiene 2 specs y **no corre en CI** | mí |
| **P0-6** | Backup / PITR / restore drill: cero evidencia | consola de Firebase (él) + documentar (yo) |
| **P0-7** | `TARIFAS` es un array vacío → sin COGS ni margen | sus cifras (cola #3) |

### P1

| # | Qué |
|---|---|
| **P1-1** | Sin detección de pacientes duplicados: el mismo paciente entra dos veces con dos expedientes |
| **P1-2** | Provenance de 3 estados (`dictado \| ia \| manual`). Falta **`PHYSICIAN_CONFIRMED`**: no queda registrado si el médico confirmó lo que la IA propuso |
| **P1-3** | Precios `$349/$899` cableados en `layout.tsx` y `configuracion/page.tsx` |

### Deuda técnica congelada

- **Lint: 105 errores** en el trinquete (`docs/audit/lint-techo.json`). Sólo puede bajar.
- **CSP sigue en report-only** salvo `frame-ancestors`. Pasarla a enforce exige
  días de observación de reportes; la observación **no se ha arrancado**.
- **A7**: 13 de 16 rutas de IA con asiento en el libro; 5 de 16 enrutadas al gateway.
- **A8**: el dataset V3 de antimicrobianos fusiona ficha y guía en 11 de 49 entradas.

---

## 4. Decisiones tomadas por el Dr. — asentadas

| Decisión | Qué implica |
|---|---|
| **MFA queda OPCIONAL** por usuario | **Riesgo aceptado por el dueño**, declarado aquí a propósito para que el pentest lo vea asentado y no lo descubra como hallazgo. No es un olvido. |
| **Sin paquetes para terceros** (#8) | El de abogado se trata aparte. Los de pentest y contador quedan disponibles si los pide. |
| **Trial: 14 días**, y al terminar se bloquea la IA con agenda y expediente en **solo lectura** | Nunca se le borra nada ni se le cierra el expediente a un médico que no pagó. Implementación en cola (#5). |
| **Precios**: se conservan $349 / $899 / $1,590 | Hasta tener COGS y comportamiento real. No optimizar precio sin datos. |

---

## 5. Lo que NO está roto (no volver a auditar)

Comprobado ejecutando, no de memoria:

- **Doble reserva**: transacción real en las dos vías (interna y portal público)
- **Webhook de Stripe**: firma verificada + candado atómico `create()` por sesión e invoice
- **Trial**: `trial_period_days: 14` en el checkout, con tarjeta obligatoria
- **Cobro de consulta**: `runTransaction`, sin doble cobro
- **kg ↔ lb en pediatría**: la guarda **existe** (`pediatria.ts`) — cierra un `NEEDS_CLINICAL_REVIEW` que seguía abierto en mis notas
- **Zona autenticada**: anti-clickjacking en enforce desde antes de esta sesión
- **Aislamiento entre consultorios**, **sanitización de logs**, **arquitectura sin ciclos**
