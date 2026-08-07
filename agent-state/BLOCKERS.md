# Bloqueadores — sólo lo que exige una decisión o credencial del dueño

Cada uno dice **exactamente** qué se necesita. Nada de esto detiene el resto del
trabajo.

| # | Bloqueador | Qué se necesita | Impacto mientras tanto |
|---|---|---|---|
| B-01 | Medir el **reconocedor** sobre los 6 000 audios del corpus V3 | Autorización para gastar en la API de transcripción (hay caché: se paga una sola vez). Los audios ya están en disco | Hoy sólo está medido el pipeline sobre texto, no lo que el motor OYE en ese corpus |
| B-02 | Corpus de **consulta ambulatoria con diálogo** (médico + paciente + acompañante) | Decisión: grabaciones reales desidentificadas **con consentimiento**, o autorizar audio actuado/sintético con guion | Sin él no se mide diarización, atribución de rol ni solapamiento |
| B-03 | `TIPO_CAMBIO_USD_MXN` en Vercel | La variable | La contabilidad no convierte el costo de IA a pesos y lo declara como supuesto |
| B-04 | `OPS_ALERTA_WEBHOOK` | Un buzón real (Slack, correo, lo que use) | Las alertas de operación no llegan a un humano |
| B-05 | Simulacro de restauración `gcloud firestore databases restore` | Sus consolas y un cronómetro | La mitad del simulacro está medida (ida y vuelta del respaldo); falta la restauración real |
| B-06 | Las ~39 recomendaciones de inmuno sin fuente | Que el médico las cite o las retire | Se muestran declarando que no tienen fuente |
| B-07 | Validación de los 23 motores en `pendiente_validacion` | Revisión clínica del dueño | Marcados como no validados en el registro |
| B-08 | Clasificación de seguridad por fármaco (P7/P8) | Decisión clínica | El esquema existe y está vacío |
| B-09 | Pentest externo y PITR | Contratación y consolas | Declarado en el registro de riesgos |
| B-10 | Cuenta de prueba en los secretos de CI | Credencial | El E2E sólo cubre lo público |

---

## B-11 — EL PROGRAMA AUTÓNOMO ESTÁ EN BUCLE (7-ago-2026)

**Qué se necesita**: que el dueño **fusione o cierre** la cola de PRs abiertos.
Es lo único que desbloquea; no hay nada que el agente pueda arreglar en el
código.

**Qué pasa**. `main` no se mueve desde REG-191 (v1073). Cada iteración arranca
desde `main`, lee un `agent-state/` que no conoce ninguna rama abierta, y por
tanto:

- toma **el mismo siguiente número de regresión**: hay **13 PRs abiertos
  titulados REG-192**, y varios REG-194 distintos;
- toma **la misma versión de service worker**: casi todos suben a `v1074`;
- audita **el mismo vecindario** —`negaciones.ts` y `temporalidad.ts`—, porque
  es el último punto abierto que el plan de la auditoría deja escrito en `main`.

Los PRs 232-248 son en su mayoría reparaciones reales y verificadas, pero
**tocan las mismas líneas del mismo archivo**: fusionarlos en cualquier orden va
a dar conflicto, y el ledger tiene el número 192 repetido trece veces.

**Impacto mientras tanto**: cada iteración gasta su presupuesto redescubriendo
defectos ya reparados en una rama que no ve. Esta misma (SAFE-003-negacion-duda)
reprodujo con el motor real dos defectos que el PR #241 ya arregla.

**Sugerencia de orden**: #241 primero (es el más completo sobre `negaciones.ts`:
cubre REG-192/193/194), y renumerar el resto contra el ledger ya fusionado.
