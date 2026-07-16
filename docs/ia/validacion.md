# Arnés de validación de la IA clínica

Instrumento para MEDIR la calidad de la nota por IA (exactitud, error, alucinación).
Es "la única cosa" que más acerca el producto a clase mundial: convierte "ingeniería
inteligente" en "IA defendible con datos".

## Qué mide (`src/lib/ia/evaluacion.ts`, puro y probado)
- **exactitudCampo**: % de campos esperados que la IA acertó.
- **tasaError**: % de campos incorrectos + faltantes.
- **alucinacionesPorCaso**: promedio de afirmaciones sin sustento (dato en la salida
  que no está ni en la entrada ni en el oro).

## Cómo se corre un estudio (paso del Dr., con datos de-identificados)
1. Arma un **conjunto ORO**: N consultas reales DE-IDENTIFICADAS, cada una con la
   nota "correcta" validada por un médico. Formato `CasoOro[]`:
   `{ id, entrada, esperado: { diagnostico, motivo, plan, ... }, prohibidos? }`.
2. Genera las salidas de la IA para esas mismas entradas (`SalidaGenerada[]`).
3. `evaluarConjunto(oro, generadas)` → `{ resultados, resumen }` con las métricas.
4. Fija una **línea base** y una **meta** (p. ej. exactitud ≥ 0.9, alucinación ≈ 0),
   y repite tras cada cambio de prompt/modelo. Combínalo con el `provenance` que ya
   se guarda por nota (modelo/versión) para saber qué versión rindió mejor.

## Por qué importa (panel de clase mundial)
- **Regulatorio/SaMD**: sin una tasa de error medida, la IA no es defendible.
- **Comprador hospitalario**: un número validado separa el producto del 95% del mercado.
- **Seguridad del paciente**: mide de verdad cuándo y cómo se equivoca la IA.

El instrumento está listo; el **estudio** lo corre el Dr. con sus datos reales.
