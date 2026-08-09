# Supuestos declarados

Un supuesto no declarado se vuelve un hecho falso a los seis meses.

| # | Supuesto | Por qué se asume | Cómo se confirma |
|---|---|---|---|
| S-01 | El corpus V3 de 6 000 audios es **sintético** (voz `coral`, una sola voz) | Lo dice su propio manifiesto y el nombre de la carpeta | Confirmado en `MANIFEST_6000_CORAL.csv` |
| S-02 | Ningún audio del corpus contiene pacientes reales | Se generó por TTS a partir de frases escritas | Confirmado por los scripts de generación |
| S-03 | La medición de texto sobre el corpus V3 **no** predice el WER del reconocedor | Mide el pipeline sobre el texto canónico | Sólo se resuelve gastando audio (B-01) |
| S-04 | El médico revisa la nota antes de firmar | Es el diseño: nada es final sin revisión | Medible con distancia de edición (no medido) |
| S-05 | Un balance hídrico negativo es clínicamente normal | Aritmética de ingresos/egresos; no es una decisión clínica | El propio corpus del dueño lo trae 25 veces |
| S-06 | **TMview refleja el registro de IMPI, pero con un desfase de sincronización que no medí** | Es un agregador de las oficinas nacionales, no la fuente primaria | Repetir cada candidato finalista en MARCANET con **búsqueda fonética** antes de pagar |
| S-07 | **No comprobé que `nexusmed.mx` tenga catch-all activo**; sólo que tiene MX de Cloudflare Email Routing publicados y resolviendo | `dig +short nexusmed.mx MX` → route1/2/3.mx.cloudflare.net | Enviar un correo de prueba a una dirección inventada de ese dominio y ver si rebota. Si no rebota, hay catch-all y el incidente de datos personales pasa de potencial a ocurrido |
| S-08 | **No cité la tarifa del IMPI por solicitud de marca** | No tengo a la vista el Acuerdo de tarifas vigente publicado en el DOF | Consultarlo en el DOF del ejercicio en curso; cambia cada año |
| S-09 | «Una solicitud por clase» y «declaración de uso real y efectivo a los 3 años» se enuncian como reglas vigentes de la LFPPI | Es el régimen que entiendo aplicable desde la reforma de 2020 | Confirmarlo con el abogado de PI junto con la búsqueda de antecedentes; no se apostó dinero a este dato |
| S-10 | Los candidatos se declararon libres de colisión **registral y de presencia pública**, no de **uso comercial no registrado** | Un tercero puede tener derechos por uso previo sin haber registrado nada | Sólo lo cierra una búsqueda de antecedentes formal + revisión del RPC y de redes sociales por el abogado |
| S-11 | Se asume que el `appId` `mx.nexusmed.app` **aún no está publicado** en App Store / Play | No encontré evidencia de publicación; si ya lo está, cambiar el appId cuesta la base instalada | Revisar App Store Connect y Play Console antes de tocar `capacitor.config.ts` |
