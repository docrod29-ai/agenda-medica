# ADR · Indicadores del episodio (días por tipo, boarding, reingreso)

**Motor:** `hospital-indicadores-episodio` · `src/lib/hospital/indicadores-episodio.ts`
**Estado:** `validado`.

## Fuente de verdad

Ninguna clínica. Son **cuentas sobre hechos ya registrados**: los tramos del
episodio y el tipo de cada unidad.

Lo que las hace posibles no es una fórmula nueva — es [`hospital-unidades`](hospital-unidades.md).
Con el servicio como texto libre, ninguna de estas cuentas se podía hacer.

## Referencia

No aplica. El módulo **no emite ningún juicio**: devuelve horas.

## Lo que NO decide

**«Reingreso a terapia» se devuelve con las horas reales fuera.** Si esa
separación cuenta como *bounce-back* lo define la unidad, y por eso la ventana
es un parámetro **opcional**: sin ella no hay veredicto, sólo el hecho. Ver
`FALTA_VENTANA_REINGRESO`.

## El tiempo sin clasificar no se reparte

Un tramo en una unidad **sin tipo configurado** va a `horasSinClasificar` con el
nombre del servicio, y **no se suma a ningún tipo**. Repartirlo inflaría los
días-UCI o los días-piso con tiempo que nadie sabe dónde ocurrió — y en un
costeo por paquete eso es **dinero inventado**.

Sí cuenta en `horasTotales`: el tiempo existió, sólo que no se sabe dónde.

## Golden

`src/__tests__/hospital-indicadores-episodio.test.ts` — **24 casos**.

| Congela |
|---|
| Separa terapia de piso dentro del **mismo** episodio |
| El boarding en urgencias sale solo |
| Los nombres del hospital no aparecen en la cuenta: sólo los tipos |
| El tiempo sin clasificar va a su cajón y **no** se reparte |
| El reingreso da **horas reales**; sin ventana, **sin juicio** |
| Dos tramos críticos seguidos no son una segunda entrada |
| Un tramo invertido **no resta** tiempo |
| Sin unidades configuradas, el catálogo de fábrica sigue contando |
