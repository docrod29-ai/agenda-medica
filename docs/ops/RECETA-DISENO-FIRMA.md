# `RECETA_DISENO_FIRMA=obligatoria` — qué cierra, y qué hay que comprobar antes

> **Estado**: el paso 1 del plan de dos pasos quedó completo el 1-sep-2026 con
> **REG-507**. Falta la comprobación en vivo y una condición previa en Vercel;
> hasta entonces **no se activa**.

## Qué agujero cierra

`/api/receta/diseno` sirve el membrete, la firma, el sello **y la fotografía
clínica** (todo vive bajo `receta-diseno/{uid-del-médico}/`, que es el riesgo
R-05). Es un `GET` sin sesión: una `<img src>` no manda `Authorization`.

Hoy los candados reales son: rutas con uid de 28 caracteres —no enumerables—,
`cache-control: private`, anti-traversal, validación estricta del parámetro y
**verificación siempre que venga una firma**. Lo que falta es lo último: que una
URL **sin** firma deje de servir. Eso es el candado, y es R-06 en el registro de
riesgos.

Sin él, una URL filtrada —un PDF compartido, el historial del navegador, una
caché— da acceso **indefinido** a papelería y fotografía clínica.

## Lo que se arregló para poder activarlo (REG-507)

El plan escrito en el propio código decía: *«primero se acuñan URLs firmadas en
el camino de impresión y se PRUEBA la papelería real; sólo entonces se pone el
candado»*. Al verificarlo salió que **faltaba un camino**:

| Camino | ¿Firma antes de usar la imagen? |
|---|---|
| Impresión (`print-element`) | sí |
| Descargar PDF (`pdf-download`) | sí |
| Vista previa en el dashboard (`FirmadorDisenos`) | sí |
| Portal del paciente (`/mi/[token]`) | no le hace falta — su config no lleva membrete |
| **Descargar Word (`receta-word`)** | **no, y no podía**: no pasa por el DOM |

El `.doc` incrustaba un **enlace absoluto sin firma** y Word lo pedía al abrir el
archivo desde el disco, sin sesión. Con el candado puesto habría dado 403 y el
membrete habría salido roto en una receta con cédula profesional.

Cerrado: el membrete ahora **viaja dentro** del `.doc` como data URI. No se firmó
a propósito — una firma caduca a las 24 h y un `.doc` se reabre semanas después.

## Condición previa que hay que comprobar EN VERCEL

**El secreto tiene que existir.** La firma es HMAC con
`RECETA_DISENO_SECRET`, y si no está usa `PORTAL_PACIENTE_SECRET`.

Si **ninguna de las dos** está configurada, `firmarPathDiseno` devuelve `null`,
`/api/receta/diseno-url` contesta con las URLs **sin firmar**, y entonces activar
el candado **rompe toda la papelería y toda la fotografía clínica del producto**,
no una parte.

Compruébelo antes de tocar nada: en Vercel → Settings → Environment Variables,
que exista `PORTAL_PACIENTE_SECRET` (o `RECETA_DISENO_SECRET`) en Production.

## La comprobación en vivo, antes de activar

Con el candado **todavía apagado**, y sobre el despliegue que ya lleve REG-507:

1. **Vista previa** — abrir `/receta/…` de un paciente de prueba y ver el
   membrete. Debe aparecer. En la pestaña de red, la petición del membrete debe
   llevar `&exp=` y `&sig=` (la firma el `FirmadorDisenos` al montar).
2. **Imprimir** — el membrete debe salir en la hoja.
3. **Descargar PDF** — igual.
4. **Descargar Word y abrirlo en Word de verdad** — el membrete debe verse, y
   **desconectando la red** debe seguir viéndose: ahí se comprueba que va dentro
   y no como enlace. Ésta es la que REG-507 hizo posible y la que no se puede
   automatizar desde el repositorio.
5. **Fotografía clínica** en el expediente: debe verse, y su petición debe llevar
   firma.

Si en algún paso la imagen aparece **sin** `sig=` en la URL, ese camino todavía
no está cubierto: **no active el candado** y dígalo, porque es un camino que
nadie ha encontrado.

## Activarlo

Vercel → Production:

```
RECETA_DISENO_FIRMA=obligatoria
```

Y **redesplegar**: una variable de Vercel no surte efecto hasta el siguiente
despliegue (ver `docs/ops/VARIABLES-DE-ENTORNO.md`, incluida la advertencia de
que un despliegue arrastra todo lo no publicado).

## Qué se rompe a propósito al activarlo, y está declarado

- **La rama legada `?u=`** queda cerrada por completo: esa forma no se puede
  firmar (la firma liga un path del bucket). El cliente migra al vuelo `?u=` →
  `?path=` **sólo** si el objeto vive bajo `receta-diseno/`. Una config vieja que
  apunte a otra carpeta del bucket pierde su imagen.
- **Las URLs `https://` de Storage** guardadas en configs antiguas: no se
  incrustan en el Word (sería cross-origin) y no se firman.

Las dos son la deuda que el candado saca a la luz, no un daño nuevo. Si aparecen,
la reparación es re-subir esa imagen desde `Configuración → Recetas`, que la
guarda ya en la forma firmable.

## Cómo revertir

Quitar la variable (o ponerle cualquier otro valor) y redesplegar. El candado se
apaga y las URLs sin firma vuelven a servir. **Las firmadas siguen verificándose
igual**: el modo estricto nunca degrada una firma inválida a «sin firma».
