# ADR · Motor de dosificación V2

**Motor:** `dosing-motor` · `src/lib/dosing/motor.ts`
**Dataset:** `src/lib/dosing/data/dosing-v2.json` (copia byte a byte) · `dataset.ts`
**Estado:** `validado` como software. **Los números NO están validados por el médico.**

## Fuente de verdad

`NexusMED_UCI_Drug_Dosing_V2_REAL_DOSING.json`, entregado por el Dr. el
30-jul-2026 junto con su prompt de ingestión, un catálogo en Excel y dos PDF.

- **54 fármacos** de adulto hospital/UCI, cada uno con cuatro reglas (dosis,
  función renal, reemplazo renal, paciente crítico), monitoreo, reglas duras y
  fuentes.
- **12 reglas duras globales.**
- **22 fuentes** citadas: UCSF IDMP (no-diálisis, RRT y meropenem), consenso de
  vancomicina ASHP/IDSA/PIDS/SIDP 2020, consenso internacional de betalactámicos
  en infusión prolongada 2023, Surviving Sepsis 2026, PADIS 2025 y fichas de
  producto.

El Excel `Drug_Master_v1` **no se usa para dosificar**: cada fila declara
`Seed catalog only. Numeric dosing NEEDS_VALIDATION`. De él se toman la
gobernanza (`Global_Rules`, `Source_Register`) y los `Validated_Examples`.

## Referencia

Las del dataset. Este módulo no añade ninguna regla clínica.

## Por qué existe

Hasta hoy la app sólo tenía el algoritmo de meropenem y `FARMACOS_SIN_ALGORITMO`
declaraba en pantalla que no sabía dosificar los demás. Ahora hay 54.

## La decisión que ordena todo el módulo

**Las reglas del dataset son PROSA, no campos numéricos.**

```
"dose_rule": "Standard: CrCl >50: 1 g IV q8h; 26-50: 1 g q12h; 10-25: 500 mg q12h; ..."
```

Convertir eso en ramas de código es una **transcripción**, y transcribir es donde
se pierde una dosis — hoy mismo se descubrió que el corrector de voz se comía el
«dos» de «Meropenem dos gramos» y llevaba meses haciéndolo.

Así que el motor **elige la rama y devuelve el texto literal**. No recalcula la
cifra: la cifra es la del dataset. Lo único que decide es cuál de las cuatro
reglas corresponde a este paciente, y ese sí es un problema de software.

## Orden de selección, y por qué

1. **Reemplazo renal primero.** Quien está en CVVHD no se dosifica por su CrCl:
   el filtro elimina fármaco. Es la regla dura que más se incumple —«RRT no
   equivale a CrCl <10»— y por eso va antes que nada.
2. Contexto de choque.
3. Ajuste renal.
4. Estándar.

## Reglas duras implementadas

Con condición comprobable desde el contexto: daptomicina en neumonía (BLOQUEO,
y **no se enseña la dosis** — enseñar el número y decir «pero no» invita a leer
sólo el número), mg/kg sin peso ni escalar declarado, modalidad de reemplazo
renal desconocida, efluente ausente donde el fármaco lo exige, función renal
inestable, y bloqueador neuromuscular sin sedación y ventilación confirmadas.

Las que el motor no puede comprobar viajan como texto en la salida: una regla
que no se puede verificar sigue siendo una regla, y esconderla sería peor.

## Lo que NO garantiza

- **Los números no están validados por un médico de este consultorio.** El
  dataset se marca a sí mismo `VERIFIED_NUMERIC_CORE`, y eso describe de dónde
  viene el dato. Toda salida viaja `sin_validar` hasta que el Dr. firma —
  ver `dosing-validacion`.
- **No cubre el formulario entero**: son 54 fármacos, no todos los del hospital.
  Uno que no está devuelve `SPECIALIST_REVIEW`, nunca la dosis del más parecido.
- **No calcula CrCl, ni peso ajustado, ni AUC.** Recibe los datos ya calculados.
- **Conflicto declarado con `uci-dosificacion-critica`:** el algoritmo de
  meropenem que el Dr. entregó por la mañana y este dataset no dicen lo mismo
  (aquél ofrece 2 g q8h en infusión extendida como alta exposición; éste advierte
  «do not encode 2 g q8h as universal shock dose»). Son dos artefactos suyos que
  discrepan y **la elección es clínica, no de software**. Los dos motores
  coexisten y ninguno pisa al otro.

## Golden

`src/__tests__/dosing-motor.test.ts` — 22 casos, incluida la **huella SHA-256 del
dataset**: si alguien edita una dosis dentro del repo, el CI se cae.
