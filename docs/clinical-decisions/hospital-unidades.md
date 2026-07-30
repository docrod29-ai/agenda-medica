# ADR · Unidades: el nombre lo pone el hospital, el tipo lo entiende el software

**Motor:** `hospital-unidades` · `src/lib/hospital/unidades.ts`
**Estado:** `validado`.

## Fuente de verdad

Pregunta del Dr. (2026-07-30):

> «La mayoría de los hospitales no se dividen por nombre de servicio, tienen su
> nombre. ¿Cómo se puede arreglar eso?»

## Referencia

Modelo de HL7/FHIR: `Location` con un **tipo físico** separado de su nombre. No
es una regla clínica — es la única forma de que la aplicación sobreviva a que
cada hospital nombre distinto.

## El defecto que cierra

El listado de UCI decidía quién era paciente crítico con una expresión sobre el
**texto** del servicio: `/uci|intensiv/`. Consecuencias reales:

- un hospital que llame a su unidad **«UTI»**, **«Terapia Adultos»**,
  **«5º Norte»** o **«Torre B»** perdía a sus pacientes de la pantalla de
  terapia — **sin error y sin aviso**;
- **«Terapia Física»** habría entrado como terapia intensiva.

## La regla

**Nunca se razona sobre el nombre.** El hospital nombra su unidad como quiera y
le asigna un `tipo`; el software razona sobre el tipo. **Renombrar una unidad no
puede cambiar el comportamiento clínico de la aplicación**, y hay un caso que lo
congela.

El nombre se compara **completo** y sin distinguir mayúsculas, nunca por
subcadena: con `includes` o una regex, «Terapia Física» casaría con «Terapia
Intensiva».

## Un servicio sin tipo NO desaparece: se declara

`desconocida` **no** es «no es crítica». Tratarlo como no-crítico haría
desaparecer pacientes de la pantalla en silencio — que es exactamente el defecto
que este módulo cierra. `sinTipoConfigurado()` da la lista y la pantalla la
muestra arriba, con enlace a configurarlas.

## El catálogo es una sugerencia, no una verdad

`TIPO_SUGERIDO` da tipo de arranque a los 17 servicios de fábrica para que nada
deje de funcionar el día del cambio. **Una unidad configurada por el hospital
siempre gana**, y una unidad inactiva no manda.

No se adivina fuera de esa lista: «Terapia» puede ser terapia intensiva o
terapia física, y ésa la confirma el hospital. `unidadesDelCatalogo()` es una
**propuesta** pura; nada se aplica solo.

## Lo que habilita

Con tipo de unidad + las marcas de tiempo de cada traslado, se vuelven
calculables sobre hechos registrados: días-UCI vs días-piso dentro del mismo
episodio, tiempo en urgencias antes de cama, reingreso a terapia en la ventana
que la unidad defina, y ocupación por tipo. Ninguno necesita un umbral clínico.

## Golden

`src/__tests__/hospital-unidades.test.ts` — **20 casos**.

| Congela |
|---|
| «5º Norte» / «UTI Adultos» / «Torre B» configuradas como críticas **lo son** |
| «Terapia Física» configurada como piso **no** lo es |
| El nombre casa completo, **nunca** por subcadena |
| Renombrar no cambia el comportamiento clínico |
| La unidad configurada gana sobre el catálogo; la inactiva no manda |
| `desconocida` **no** es «no es crítica» |
| En el catálogo, la única crítica es la que se llama así de fábrica |
| El catálogo cubre los 17 servicios, sin huecos |
