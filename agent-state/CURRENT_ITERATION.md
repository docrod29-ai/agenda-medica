# Iteración actual — REG-215 · «No sé» no es «No»

**Modo**: reparación con golden. **Restricción del dueño**: PR sí, despliegue no.

## De dónde salió

Hallazgos C2/C3 de la auditoría de nueve dimensiones (6-ago). Eran los
siguientes por valor en el plan, después de D1/D2 (REG-189), G1 (REG-190) y E3
(REG-191).

## Qué se verificó antes de tocar nada

Con el motor real, no con el informe: de veinte respuestas de habla real de una
consulta mexicana, **siete se leían al revés de como se dijeron**. El hallazgo
tal como venía escrito («No padece diabetes» sale como antecedente positivo) NO
se reprodujo — `NIEGA_EN_LINEA` ya cubría «no padece». Lo que sí se reprodujo, y
es peor, fue lo de al lado: `^no\b` leyendo «No sé, doctor» como una negación.

## Hecho

- El relleno se quita y se juzga el núcleo; la duda se comprueba antes que la
  negación.
- `condicionesInciertas()`, y la duda **se señala, no se reclasifica**.
- Cableado hasta las dos pantallas: barra de la consulta y panel de entidades.
- Golden de 21 casos, comprobado en rojo (8 fallan sin el arreglo) y sellado.

## Siguiente

`VOICE-005` — el motor de negaciones se queda ciego si al dictado le llegan
turnos etiquetados. Hoy no ocurre; el día que la diarización alimente esta ruta,
sí.
