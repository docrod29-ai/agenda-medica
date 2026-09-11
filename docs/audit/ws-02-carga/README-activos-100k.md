# WS-02 — el segundo objetivo: 100 000 personas activas a la vez

**Qué es.** El dueño confirmó el 9-sep-2026 («Las dos») dos objetivos
independientes: 100 000 cuentas registradas y **100 000 usuarios activos
simultáneos**. El primero ya tenía modelo (`modelo-de-concurrencia.mjs`); el
segundo no se deriva de él —es la entrada— y exigía decir **quiénes** son esas
personas. `scripts/escala/escenario-de-activos.mjs` lo hace.

## La mezcla, declarada (supuesto, `medidoEn: null`)

| Rol | Fracción | Ventana | Peticiones por persona y ventana | Por qué |
|---|---|---|---|---|
| médico | 8 % | 20 min | la consulta del modelo hermano (lecturas, escrituras, IA, evidencia) | ~18 consultas/día por médico: por cada persona del consultorio hay muchas pacientes con motivo para abrir el portal |
| recepción | 4 % | 10 min | 12 lecturas · 3 escrituras · 0 IA | una recepción por consultorio de dos médicos |
| paciente | 88 % | 8 min | 6 lecturas · 1 escritura · 0 IA | el portal se abre alrededor de la cita; son la mayoría de las personas distintas activas |

## Lo que sale para 100 000 activos

| | |
|---|---|
| Sesiones concurrentes | **100 000** (una por persona, por contrato) |
| Ráfaga | 300 000 (factor 3 del modelo) |
| Caudal sostenido | ~1 519 peticiones/s (médicos 135 · recepción 100 · pacientes 1 283) |
| Escrituras | ~283/s |
| Llamadas de IA | ~13/s (sólo la fracción de médicos) |
| Documentos residentes | ~816 000 |
| Identidades sintéticas | 100 000 (personal por Auth, pacientes por token de portal) |

Ningún umbral es un número: `umbrales: NEEDS_OWNER_DECISION`, casillas medidas
en `null`.

## Qué NO cabe aquí, con nombre

`ejecutable.faltaFuera` lo enumera: concurrencia (cota local 400 sesiones),
volumen (cota local 50 000 documentos), proveedores (voz/IA/evidencia de verdad
para los médicos) y navegador (pantalla en blanco y borrador perdido sólo se ven
con navegador). Lo que hace falta del dueño no cambia respecto a la bitácora del
10-sep: **proyecto de Firebase de ensayo** aparte con reglas e índices
desplegados y un despliegue de Vercel apuntando a él; **presupuesto** para los
generadores distribuidos y el consumo; confirmar la **mezcla** y la duración del
pico; verificar el **plan de Vercel**.

## El corte local, y lo que es

400 sesiones con la misma mezcla (32 médicos · 16 recepción · 352 pacientes).
Sirve para comprobar que el generador reparte roles, acuña identidades y
produce el JSON que el validador lee. **No es evidencia del objetivo** y el
escenario lo lleva escrito (`corteLocal.noEsEvidenciaDelObjetivo: true`).

Prueba: `src/__tests__/cien-mil-activos-no-son-cien-mil-medicos.test.ts`.
