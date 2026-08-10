# Workflow Red Team (V14 §39)

Ataques obligatorios por flujo crítico:

- paciente equivocado;
- doble clic / doble envío;
- página obsoleta (stale);
- dos pestañas a la vez;
- refresh a media acción;
- offline;
- timeout;
- interrupción (llamada, cambio de app en móvil);
- permisos ausentes;
- fallo parcial de API;
- interrupción móvil con grabación activa.

Todo fallo válido: REPRODUCCIÓN → ARREGLO → PRUEBA DE REGRESIÓN → CASO
PERMANENTE (y entrada en `docs/audit/regression-ledger.md` + sello, regla del
repo). Hallazgos históricos ya cazados por esta vía: REG-283 (regrabar borraba
audio), REG-287 (salir grabando), REG-294…297 (persistencia de audio).

Resultados de corridas red-team V14: ninguno aún.
