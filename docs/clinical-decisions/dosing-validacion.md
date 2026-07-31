# ADR · Validación médica del dataset de dosis

**Motor:** `dosing-validacion` · `src/lib/dosing/validacion.ts`
**Pantalla:** `/uci/dosificacion` · **Persistencia:** `clinics/{id}/dosing_validations`
**Estado:** `validado`.

## Fuente de verdad

La petición del Dr. el 30-jul-2026: «haz lo que puedas tú y déjame verificar los
datos yo».

## Referencia

Ninguna clínica. Esto no dosifica: registra quién comprobó qué, cuándo y sobre
qué versión del dataset.

## Por qué existe

El dataset declara `VERIFIED_NUMERIC_CORE` en los 54 fármacos. Eso describe **el
origen del dato**: viene de UCSF, de la guía de vancomicina, de una ficha de
producto. **No dice que un médico de este consultorio lo haya cotejado.**

Son dos cosas distintas y la pantalla no puede confundirlas, porque la diferencia
es exactamente la que separa «según UCSF» de «yo lo revisé». Mientras no exista
lo segundo, toda salida del motor viaja marcada `sin_validar` y la pantalla lo
dice.

El Dr. lo pidió así: «haz lo que puedas tú y déjame verificar los datos yo».

## La firma caduca con el dataset

Una validación vale para **la versión que se validó**. Si mañana entra un dataset
con dosis corregidas, las firmas viejas ya no describen lo que hay en pantalla:
seguirían diciendo «validado» sobre un número que nadie miró.

Por eso cada firma guarda la versión **y la huella SHA-256** del dataset, y
`estadoDe()` sólo la acepta si las dos coinciden. La huella cubre el caso
peligroso: alguien corrige una dosis sin subir el número de versión.

Al cambiar el dataset, los 54 vuelven a «sin validar». Es incómodo y es lo
correcto.

## Autorización

`read: isMember` — farmacia y enfermería necesitan saber qué está validado y qué
no. `write, delete: isMedico` — validar una dosis es un acto clínico y lleva
nombre.

El `delete` es la única concesión, y es deliberada: un médico tiene que poder
retirar una validación equivocada. Dejarla puesta por no poder deshacerla sería
peor que borrarla.

## Lo que NO garantiza

- **No comprueba que la validación sea correcta.** Registra que alguien firmó,
  con su nombre y su fecha. La responsabilidad clínica es de quien firma.
- La firma es por consultorio: no vale para el de al lado.

## Golden

`src/__tests__/dosing-validacion.test.ts` — 13 casos, incluido que un dataset
nuevo tira el avance a cero.
