# Workflow State Machines

Se documenta aquí la máquina de estados de cada golden workflow **cuando se
trabaje** (V14-WORKFLOWS-001), con sus estados, transiciones, dueños y
criterios de cierre — derivada del código real, no de la intención.

Máquinas ya existentes en el producto (fuente de verdad en el código):

- `PatientVisitPackage`: `DRAFT → RELEASED` (aprobación con approvedAt/By/version;
  compuerta en `/api/portal`, servidor).
- Nota de encuentro: borrador → firmada (acto medicolegal, separado de liberar).
- Tarea de revisión de laboratorio: creada por resultado (REG-252).

Pendiente: formalizar aquí ORDER/RESULT/REVIEW/CLOSED (§17) por flujo.
