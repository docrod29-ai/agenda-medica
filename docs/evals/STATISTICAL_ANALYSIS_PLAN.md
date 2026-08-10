# Statistical Analysis Plan (V14 §29)

Aplica a Silver, Gold y Real-world. Bronze reporta conteos crudos con
numerador/denominador y sin claims amplios.

1. Toda métrica se reporta numerador/denominador, nunca porcentaje solo.
2. Estratificación por especialidad y dificultad cuando el N lo permita.
3. Intervalos de confianza (binomial exacto o Wilson para tasas) cuando
   aplique; para tasas de error raras, reportar el IC superior aunque el
   conteo observado sea 0.
4. Métricas por caso y por hecho, separadas.
5. Casos faltantes/inevaluables: contados y explicados, jamás excluidos en
   silencio.
6. Corridas fallidas se preservan en el registro.
7. Endpoints predefinidos antes de la corrida (en el registro del benchmark);
   los análisis post-hoc se etiquetan como tales.
8. Sin cherry-picking: la corrida que cuenta es la registrada, no la mejor.

Los umbrales estadísticos concretos por benchmark (potencia, N mínimo por
estrato) se fijan al diseñar cada benchmark — no se inventan aquí.
