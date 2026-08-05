# El dato tiene que LLEGAR

Regla nacida el 5-ago-2026, después de que tres defectos del mismo tipo
aparecieran el mismo día — los tres con las pruebas en verde.

## La regla

Una prueba de contrato comprueba que el código **diga** lo acordado. No comprueba
que el destinatario lo **acepte**, ni que el dato **quede escrito**.

Cuando algo cruza una frontera —API de terceros, escritura a la base, formato que
otro sistema lee— hay que mirar del otro lado antes de dar nada por entregado.

## Qué pasó

- **REG-167** — La petición llevaba el sesgo de vocabulario. El proveedor lo
  rechazaba por incompatible y, al venir junto a una lista de modelos,
  **degradaba el motor al modelo viejo** sin error ni aviso. Semanas así.
- **REG-170** — La nota escribía `transcripcionMotor`. Ninguna nota firmada lo
  tenía, así que el bucle de corrección **nunca aprendió una palabra**.
- **REG-160** — El importador validaba la colección declarada y **escribía en la
  ruta**, que era otro campo.

## Antes de dar algo por entregado

1. ¿Dónde acaba este dato? Si la respuesta es «en la función que lo escribe»,
   todavía no ha llegado.
2. ¿Quién lo lee después, y encuentra lo que espera?
3. ¿Lo he mirado del otro lado **hoy**? No la documentación: la respuesta real
   del proveedor, o el documento real en la base.

## Cómo

`scripts/verificar-invariantes-de-datos.md`. Sobre datos reales se cuentan
recuentos, nunca contenido: llevan PHI y por eso esto no puede vivir en CI.

## Hermana de otra regla que ya existía

«Escrito y sin conectar» — buscar el símbolo en `app/`, `hooks/`, `components/`
antes de declarar algo entregado. Ésta es el paso siguiente: **conectado, pero el
dato no llega**.
