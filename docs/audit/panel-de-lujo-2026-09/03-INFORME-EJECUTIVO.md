# 03 — Informe ejecutivo · Auditoría «Panel de Lujo» · 6-sep-2026

Para el Dr. David Alonso Rodríguez Luna. Una pantalla. El detalle vive en los
otros doce archivos de esta carpeta.

## Qué se hizo

43 auditores simulados (3 de ingeniería, 5 médicos, 30 pacientes, 5
asistentes) más ciberseguridad, diseño y negocio auditaron el producto
completo sobre `main` en `595c89a`: código, reglas de Firestore, y la app
levantada con datos sintéticos en emuladores. Cada hallazgo pasó por un equipo
rojo que intentó refutarlo con `archivo:línea`; cada P0 y P1 confirmado tiene
una prueba que falla hoy. La auditoría **no reparó nada**: `src/` está intacto.

## Los tres números

| Confirmados (más parciales) | Refutados | Piezas del inventario sin auditor |
|---:|---:|---:|
| 370 (+95) de 493 | 28 (5,7 %) | 0 de 506, tras la oleada de cierre |

En pie: **4 P0 · 44 P1 · 186 P2 · 231 P3**. Reproducidos: 43 pruebas, 103
casos rojos, 0 importes rotos. Línea base: vitest 12 876 verdes y 1 falla
ambiental; lint 93 = techo; build compila con las variables del arnés.

## Los cuatro P0 (todos reproducidos)

1. **Receta pediátrica en mililitros sin concentración.** «Amoxicilina 5 mL
   cada 8 h» se firma, se imprime y llega al cuidador sin decir de qué
   presentación. `src/lib/seguridad/dosis.ts:476` · REP-001 · MP-005.
2. **Ningún cobro se puede anular.** La transacción escribe antes de leer y
   Firestore la rechaza el 100 % de las veces; el cobro suelto lo niega la
   regla. `src/lib/cobros.ts:441` · REP-030 · ASC-001 (+ASC-002).
3. **Cambiar de plan cancela la suscripción anual sin abono.**
   `src/app/api/stripe/webhook/route.ts:216` · REP-002 · N-001.
4. **El anticipo del paciente cae en la cuenta de la plataforma** y se
   asienta como ingreso del consultorio.
   `src/app/api/payment/create-checkout/route.ts:103` · REP-003 · N-002.

## Los patrones detrás de los 44 P1

- **El embarazo no es un estado de la paciente** (ningún motor de receta lo
  consulta) y **el neonato no existe para el motor pediátrico**.
- **La lateralidad la escribe el modelo** y nadie la coteja contra el dictado;
  la orden de imagen es texto libre sin lado ni proyección.
- **«Alergias: negadas» por omisión** en la receta impresa; alergia a
  «cefalosporinas» no dispara; «betametasona» bloquea la firma.
- **El portal contesta cuando debía escalar** («si no como, ¿me tomo la
  metformina?»), y la urgencia obstétrica y pediátrica no está en el
  vocabulario.
- **El dato no llega**: indicaciones postoperatorias, carta de referencia,
  signos de la enfermera (pierden la segunda tecla), teléfono corregido.
- **Dinero y rastro**: cortesía sin motivo, `cobroId` inventable, «SÍ» del
  recordatorio que caduca a las 2 h, teléfono +1 convertido en mexicano.
- **Lo que el modelo dice queda con cédula debajo**: cita «[4]» inventada en
  la nota firmada, prompt que ordena ajustar dosis, cruce de alergias sin
  guarda anti-inyección.

## Lo que resistió (medido, no supuesto)

Aislamiento entre consultorios: 13 de 13 ataques denegados con las reglas
reales. La IA del paciente no tiene modelo y no origina ningún dato. Un paquete
en borrador no se persiste. El dolor torácico dispara urgencia y abre tarea sin
depender del teléfono. El service worker no cachea PHI. Las 100 rutas validan
sesión y consultorio.

## Lo que sólo usted puede decidir

`04-DECISIONES-DEL-DUENO.md` trae 54 decisiones en cola. Las cinco que
desbloquean más: el vocabulario de urgencia del portal (PL-C9), el estado
gestacional como campo (PL-C8), el alcance del enlace del paciente (PL-P1),
las unidades válidas por fármaco (REG-PL-45) y la corrección contable de los
cobros ya asentados. Las tres lentes que usted pidió están en `11`, `12` y
`13`: 30 botones muertos, 55 pantallas con fila de facilidad, 37 candidatos a
retirar. Ningún residual crítico fue aceptado por el panel.

## Siguiente paso

Reparar es otro programa: cada candidato de `10-CANDIDATOS-A-REG.md` ya trae
su prueba y su sello propuesto. Hospital y UCI siguen en pausa (D-030).
