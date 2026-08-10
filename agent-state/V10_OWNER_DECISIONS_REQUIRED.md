# Decisiones V10 que sólo puede tomar el dueño — cola, no interrupciones

| # | Decisión | Recomendación por omisión | Qué queda bloqueado | Qué sigue sin ella |
|---|---|---|---|---|
| V10-O1 | ¿Cablear emulador de Firebase **sólo en dev** en `src/lib/firebase.ts` para que los agentes puedan ver las pantallas `medico` corriendo con datos sintéticos? (cambio reversible, condicionado a `NEXT_PUBLIC_USAR_EMULADOR=1`, cero efecto en producción) | Sí — sin esto, la mitad de V10 no puede puntuarse con evidencia real | V10-TRUTH-001 parte 2 y toda puntuación de pantallas `medico` | Superficie pública, demo, constitución de tokens, regresión visual de lo público |

Nada de esta cola detiene el programa; cada entrada dice qué sigue sin ella.
