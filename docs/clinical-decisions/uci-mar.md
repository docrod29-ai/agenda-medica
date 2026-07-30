# ADR · MAR de UCI (§37)

**Motor:** `uci-mar` · `src/lib/uci/mar.ts`
**Estado:** `validado` para lo que hace: leer la orden y contar el tiempo.

## Fuente de verdad

El backlog del **ICU-001** enuncia §37 con la restricción incluida:

> «Vista MAR de UCI sobre la farmacia existente, **sin duplicar inventario**».

El registro que se lee es `Indicacion[]` / `Administracion[]` de
`src/types/hospital.ts` — el mismo que ya usa el piso. **No** se define un
segundo catálogo de medicamentos, ni existencias, ni lotes.

## Referencia

Ninguna fuente clínica externa. El módulo **no decide fármacos, dosis ni vías**:
sólo interpreta el horario que el médico escribió y compara contra el reloj.

El único juicio que emite —«atrasada»— es aritmético, y su margen (la gracia)
**lo aporta quien llama**.

## El riesgo real aquí es la alarma falsa

Un MAR que marca «ATRASADO» donde no lo hay es peor que uno mudo. Si la
norepinefrina en infusión y el paracetamol PRN salen en rojo cada hora, el rojo
deja de significar algo y **la dosis que sí se pasó se pierde en el ruido**.

Por eso hay cuatro estados que **nunca** se atrasan, y están congelados en un
caso: `infusion_continua`, `prn`, `completado`, `suspendido` y
`horario_no_interpretable`.

## Por qué NO reusa `extraerTomasDia`

`src/lib/seguridad/dosis.ts` ya interpreta frecuencias, pero para **techos
diarios**: ante «cada 4 a 6 horas» toma deliberadamente el intervalo **más
corto**, porque para un techo el peor caso es el que más veces se toma — y eso
está bien ahí.

Copiar ese sesgo al MAR marcaría atrasada una dosis que va a tiempo. Aquí el
rango se conserva **como rango**: toca a las 4 h, no se atrasa hasta las 6 h.
Un caso del golden ejecuta los dos motores lado a lado para dejar la diferencia
escrita, no supuesta.

## Golden

`src/__tests__/uci-mar.test.ts` — **39 casos**.

| Congela |
|---|
| Las variantes de «cada 8 h» dan un solo intervalo |
| El rango se conserva; el motor de techos lo colapsa y el MAR no |
| «5 veces al día» **no** es «cada 4.8 h» → no interpretable |
| Infusión continua, PRN, dosis única y suspendida **nunca** se atrasan |
| «infusión continua a 5 mL/h» no se lee como intervalo pese al número |
| Un horario ilegible **no** produce un atraso inventado |
| Borde de la gracia **inclusivo** |
| Una omisión **no** cuenta como dosis dada, y **no** desaparece |
| Sin dosis dadas nunca dice «al día» |
| Control negativo: no hay inventario, stock, lote ni catálogo |

## Dato faltante

- **Horario ilegible** → `horario_no_interpretable` con el texto original a la
  vista. No se adivina: un horario adivinado produce un atraso inventado.
- **Sin administraciones** → se cuenta desde la hora de la **orden**, y el estado
  es `nunca_administrado`, jamás `al_dia`.

## Lo que NO se asume

La **gracia** en minutos es obligatoria en la firma. Depende de turnos, ronda de
enfermería y tipo de fármaco: es una decisión operativa de la unidad, no un
número que el módulo pueda inventar. Ver `FALTA_GRACIA`; una gracia inválida
**lanza** en vez de caer a un valor por defecto, y un caso comprueba que no hay
ningún `DEFAULT` exportado.
