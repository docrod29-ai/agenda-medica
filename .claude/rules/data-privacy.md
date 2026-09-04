# Regla — datos y privacidad

## Cero pacientes reales

Ni en pruebas, ni en fixtures, ni en corpus de evaluación, ni en ejemplos de
documentación. Los datos de prueba son **sintéticos** y viven en
`synthetic-data/` y `fixtures/`.

## La voz es biométrica

Un audio «desidentificado» sigue identificando a quien habla. Ningún audio de
paciente real entra al conjunto de evaluación sin decisión explícita del dueño y
consentimiento documentado. El gold nace **sintético o actuado**.

**Preguntado y contestado (D-029, 4-sep-2026)**: se le planteó al dueño si podían
reinyectarse al corpus transcripciones de producción **desidentificadas**, a
cambio de tener por fin el número «de verdad» sobre consulta real. Dijo que
**no**, y la regla de arriba queda como está.

Lo que se pierde queda dicho, para que nadie crea que la decisión salió gratis:
**hoy no hay medición sobre habla de consulta real.** El corpus actuado mide
atribución de rol y diarización, y eso es lo que se puede afirmar. La vía que sí
queda abierta es grabar con **consentimiento explícito y documentado** — no
desidentificar a posteriori, que es lo que se descartó.

## Lo aprendido del dictado

Se guarda una palabra, cuántas veces se corrigió y cómo se oyó mal. **Nunca
partes del nombre del paciente**: se comparte entre pacientes del consultorio.

## Derechos ARCO

El acceso se **entrega** (expediente completo + acuse con hash), no se resuelve
escribiendo un texto. Lo que no se pudo leer **se declara**.
