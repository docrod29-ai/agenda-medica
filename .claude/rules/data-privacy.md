# Regla — datos y privacidad

## Cero pacientes reales

Ni en pruebas, ni en fixtures, ni en corpus de evaluación, ni en ejemplos de
documentación. Los datos de prueba son **sintéticos** y viven en
`synthetic-data/` y `fixtures/`.

## La voz es biométrica

Un audio «desidentificado» sigue identificando a quien habla. Ningún audio de
paciente real entra al conjunto de evaluación sin decisión explícita del dueño y
consentimiento documentado. El gold nace **sintético o actuado**.

## Lo aprendido del dictado

Se guarda una palabra, cuántas veces se corrigió y cómo se oyó mal. **Nunca
partes del nombre del paciente**: se comparte entre pacientes del consultorio.

## Derechos ARCO

El acceso se **entrega** (expediente completo + acuse con hash), no se resuelve
escribiendo un texto. Lo que no se pudo leer **se declara**.
