# Registro de riesgos

Severidad: 1 (molestia) … 5 (daño grave al paciente).
Un control que nadie ejecuta **no es un control**.

| # | Peligro | Sev | Control actual | Riesgo residual | Estado |
|---|---|---|---|---|---|
| R-01 | Una dosis pierde su número al dictarse («meropenem dos gramos» → «meropenem gramos») | 5 | Detector determinista + compuerta que pregunta; no se completa nunca sola | Bajo | Controlado |
| R-02 | **Fatiga de alerta**: la compuerta pregunta donde no debe (balance hídrico negativo) | 3 | Ninguno hasta hoy — medido el 2026-08-04 | **Alto**: un aviso que salta de más se acaba ignorando, y con él los que importan | En reparación (VOICE-004) |
| R-03 | Un antecedente que el paciente negó acaba afirmado en la nota | 4 | Motor de negaciones + aviso rojo + regla 23 del prompt | Bajo | Controlado |
| R-04 | Un padecimiento pasado se escribe como actual y se arrastra | 3 | Motor de temporalidad + aviso ámbar + regla 24 (v1027-v1030) | Medio: **sin corpus oro**, no está medido | Controlado, no medido |
| R-05 | Un alérgeno mal transcrito hace que el cruce alergia↔fármaco nunca salte | 5 | Sesgo del reconocedor con las alergias del expediente | **Medio-alto**: cuatro parsers distintos del campo; «Penicilina y sulfas» viaja como un solo término | En reparación (v1031, local) |
| R-06 | Datos de un consultorio visibles en otro | 5 | Reglas con forma congelada + matriz de acceso + prueba de aislamiento en CI | Bajo | Controlado |
| R-07 | Pérdida de datos sin poder restaurar | 5 | Respaldo servidor + importador + simulacro de ida y vuelta | Medio: la **restauración real** no se ha cronometrado (B-05) | Parcial |
| R-08 | El sistema afirma una cifra clínica que nadie validó | 5 | 23 motores marcados `pendiente_validacion`; `NEEDS_CLINICAL_REVIEW` | Medio: depende de la revisión del dueño (B-07) | Declarado |
