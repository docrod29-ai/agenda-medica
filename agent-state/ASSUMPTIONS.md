# Supuestos declarados

Un supuesto no declarado se vuelve un hecho falso a los seis meses.

| # | Supuesto | Por qué se asume | Cómo se confirma |
|---|---|---|---|
| S-01 | El corpus V3 de 6 000 audios es **sintético** (voz `coral`, una sola voz) | Lo dice su propio manifiesto y el nombre de la carpeta | Confirmado en `MANIFEST_6000_CORAL.csv` |
| S-02 | Ningún audio del corpus contiene pacientes reales | Se generó por TTS a partir de frases escritas | Confirmado por los scripts de generación |
| S-03 | La medición de texto sobre el corpus V3 **no** predice el WER del reconocedor | Mide el pipeline sobre el texto canónico | Sólo se resuelve gastando audio (B-01) |
| S-04 | El médico revisa la nota antes de firmar | Es el diseño: nada es final sin revisión | Medible con distancia de edición (no medido) |
| S-05 | Un balance hídrico negativo es clínicamente normal | Aritmética de ingresos/egresos; no es una decisión clínica | El propio corpus del dueño lo trae 25 veces |
