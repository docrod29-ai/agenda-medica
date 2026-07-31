# ADR · Guardián de sustituciones del dictado

**Motor:** `asr-guardian-sustituciones` · `src/lib/asr/guardian-sustituciones.ts`
**Envoltorio:** `src/lib/asr/corrector-vigilado.ts`
**Política portada:** `src/lib/asr/politica-critica.ts`
**Estado:** `validado`.

## Fuente de verdad

`config/critical-error-policy.json` y `config/units-and-numbers.json` del paquete
**NexusMED_CLINICAL_ASR_PIPELINE_V1** entregado por el Dr. (2026-07-30). De ahí
salen, sin añadir ninguna clase que él no haya declarado:

- las 14 clases de error crítico (`CLASES_ERROR_CRITICO`),
- los pares que jamás se autocorrigen el uno por el otro (`never_autocorrect`,
  `dangerous_confusions`),
- los seis motivos por los que la pantalla debe pedir confirmación.

Y de su `PARA_CLAUDE_CODE.md`, la regla que ordena todo el módulo:

> No convertir silenciosamente PEEP en PIP, mg en mcg, ECMO VV en VA, etc.
> No borrar el transcript crudo.

## Referencia

Ninguna clínica. Es una política de seguridad de software sobre la salida del
reconocedor: no decide nada médico, sólo decide si una **corrección de texto** es
aceptable.

## Por qué existe

El 30-jul-2026, midiendo el corpus de 498 audios, se descubrió que el corrector
léxico propio se comía las dosis: «Meropenem dos gramos» salía «Meropenem
gramos». Estaba pasando en producción, en cada dictado, y **nada lo detectaba** —
el corrector anotaba el cambio en `cambios[]` y nadie leía esa lista.

REG-065 tapó esa causa concreta con dos guardas dentro de `corregirNGramas`. Este
módulo cierra **la clase entera**: da igual qué regla del corrector produzca el
cambio, si el resultado

1. pierde una cifra,
2. cambia una unidad o una frecuencia (`mg`↔`mcg`, `/h`↔`/min`),
3. intercambia una sigla crítica (`PEEP`↔`PIP`, `PaO2`↔`PaCO2`, `ECMO VV`↔`VA`,
   `CVVH`↔`CVVHD`↔`CVVHDF`),
4. voltea una negación,
5. o cambia el lado del paciente,

**se descarta la corrección y se conserva lo que dijo el médico.**

La diferencia con REG-065 importa: aquello es acordarse de un caso; esto es que
la clase no pueda volver a pasar sin que alguien lo vea.

## Decisiones de diseño

**Se cuenta, no se pregunta si está.** Con detección por presencia, el caso real
`PEEP 12, PIP 30` → `PIP 12, PIP 30` pasaba desapercibido: los dos miembros del
par están antes y después. Sólo la **cuenta por término** lo delata.

**Aparecer no es violación; desaparecer sí.** Que el corrector escriba `CVVHDF`
donde el reconocedor puso `cbvhdf` es exactamente su trabajo. Lo que se vigila es
la dirección contraria.

**No toda cifra es una cantidad.** `T4`, `CD4`, `HbA1c`, `H1N1`, `PaO2`, `cmH2O`,
`COVID-19`, `IL-6`, `CA 19-9`, `5-FU`, `B12` llevan dígitos que forman parte del
nombre. Contarlos como dosis haría que el guardián revirtiera correcciones
buenas, así que `cifrasLibres()` excluye los dígitos pegados a una letra o a un
guion. Un caso del golden lo fija.

**Ante la duda, el crudo.** El texto del médico sin tocar vale más que una mejora
que no se puede verificar.

**Envuelve, no reemplaza.** `corregirTranscripcion()` funciona y se queda. Lo que
le faltaba no era capacidad: era alguien que mirara su salida.

## Lo que NO garantiza

- **No detecta lo que el reconocedor ya entendió mal.** Compara el crudo contra
  el corregido; si el audio decía «dos gramos» y llegó «gramos» desde el
  reconocedor, aquí no hay nada que comparar — de eso se ocupa
  `uci-dosis-sin-numero`, que sí mira el texto final.
- **No cubre todos los pares peligrosos que existen**, sólo los que el Dr.
  declaró en su política. Ampliar la lista es ampliar `PARES_PROHIBIDOS`.
- **No corrige.** Revertir es su única acción.

## Golden

`src/__tests__/asr-guardian-sustituciones.test.ts` — 21 casos.

Los diez casos críticos de `tests/critical-test-cases.json` del paquete del Dr.
se ejercitan contra el corrector **real**, no contra un doble: ninguno puede
perder una cifra ni salir revertido.

La parte de esos casos que exige normalizar «cero punto quince» → `0.15` y
«microgramos por kilo por minuto» → `mcg/kg/min` **no** la cubre este módulo:
pertenece a la etapa de normalización de cifras y unidades, que tiene su propio
golden.
