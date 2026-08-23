# Taxonomía de incidentes

**Fuente de verdad:** `src/lib/incidents/taxonomia.ts`. Este documento explica el
porqué; la tabla de dimensiones vive **generada** en
[`RUNBOOKS.md`](RUNBOOKS.md) para que no pueda desfasarse.

---

## Un evento no es un incidente

```
EVENTO     un fallo. Se anota, se firma, se agrupa, se cuenta. No despierta a nadie.
INCIDENTE  un grupo que cruzó una raya. Tiene dueño, runbook y reloj.
```

Un timeout suelto a media tarde es la vida normal de una red. Quinientos
timeouts en cinco minutos en la misma función es una caída. Si las dos cosas
despiertan a alguien, en dos semanas nadie mira los avisos — y ésa es la forma
más común de que un sistema de detección deje de funcionar sin que nadie lo
apague.

**La excepción:** el aislamiento entre consultorios y la autorización no tienen
raya. Ahí una vez ya es demasiadas. `NUNCA_SE_AGREGA_POR_RUIDO` no es una lista
de «lo grave»: es la lista de lo que no tiene tasa aceptable.

## Tres taxonomías, tres preguntas distintas

Este producto tiene ahora tres vocabularios de fallo y **ninguno sobra**, porque
cada uno contesta algo que los otros no:

| Dónde | Qué contesta | Ejemplo |
|---|---|---|
| `src/lib/ia/fallo-proveedor.ts` (`ClaseFallo`) | **¿Qué le pasó al proveedor de IA, y a quién le toca pagarlo?** | `sin_saldo` con llave de la plataforma |
| `src/lib/observability/evento.ts` de #310/#342 (`TaxonomiaError`) | **¿Cómo falló la llamada?** | `timeout`, `saturacion` |
| `src/lib/incidents/taxonomia.ts` (`CategoriaIncidente`) | **¿Qué parte del producto se rompió, y quién sufre?** | `autosave`, `scheduling` |

Se cruzan: un `timeout` de transporte puede ser categoría `transcription` o
`payment`, y lo que hay que hacer no se parece en nada.

`ClaseFallo` **se reutiliza entera**: es el *subtipo* de la categoría
`ai_provider`, no un competidor suyo. El puente vive en
`src/lib/incidents/puente-ia.ts` y delega —no repite— la clasificación por
cuerpo de respuesta, la distinción llave-del-consultorio contra
llave-de-la-plataforma, y el aviso al dueño.

## Por qué WhatsApp no tiene categoría propia

Porque en este producto WhatsApp **es** el proveedor de notificaciones, así que
va como `notification` + `proveedor: 'whatsapp'`. Una categoría por proveedor
haría que cambiar de proveedor cambiara la taxonomía, que es justo lo que una
taxonomía no debe hacer.

## La identidad es vocabulario cerrado

Todo lo que entra en la firma sale en la alerta, en la agrupación y en la consola
de soporte. Un mensaje de error libre —«no se pudo guardar la nota de Ana Ruiz»—
es PHI, y ninguna lista de patrones prohibidos la caza entera: no parece un CURP
ni un teléfono, parece una frase.

Así que la compuerta es de **forma**, no de contenido:

```
categoria | subtipo | feature | ruta | proveedor | codigo | appVersion
```

Cada componente es una etiqueta `^[a-z0-9][a-z0-9_.-]{0,63}$`, y la ruta entra
como **plantilla** (`/consulta/[id]`, nunca `/consulta/8f2a…`). Un evento que no
se puede firmar **no se descarta en silencio**: se devuelve en `rechazados`.

### La versión entra en la firma

Sin ella, la regresión que trajo el despliegue de esta mañana se suma al
contador del incidente de la semana pasada y desaparece dentro de él. Con ella,
la firma es nueva y la **familia** (la misma firma sin versión) tiene historia:
eso es exactamente lo que significa «regresión», dicho en datos.

## Lo que la taxonomía NO puede hacer, declarado

**No detecta un nombre propio suelto.** «María González» y «monoterapia con
vancomicina» son dos cadenas y ninguna regla determinista las distingue sin un
diccionario que no existe. La defensa real es que **ningún campo de la identidad
acepta texto libre**; el redactor de `security/sanitize.ts` es el cinturón, no
los tirantes.
