# Regla — sistema de diseño y experiencia

Aplica a: `src/app/**`, `src/components/**`, y a cualquier pantalla nueva.

Nace con el Master Loop V9 (`docs/ai/NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md`).

## El sistema va ANTES del rediseño

Repintar 78 pantallas sin sistema es repintarlas dos veces. `DESIGN-SYSTEM-001`
precede a `VISUAL-EXCELLENCE-001` por eso, no por orden alfabético.

## Diez principios, y cada pantalla responde a ellos

**CALMA · CLARIDAD · JERARQUÍA · CONTEXTO · CONTINUIDAD · REVELACIÓN
PROGRESIVA · REVERSIBILIDAD · PROCEDENCIA · ACCESIBILIDAD · VELOCIDAD**

De ellos, dos son propios de este producto y no se negocian:

- **PROCEDENCIA** — lo que escribió la IA enseña de dónde salió. Ya existe
  (REG-213, REG-250): pulsar una frase y oír el segundo exacto del dictado. El
  sistema de diseño le da forma estable, no lo reinventa.
- **REVERSIBILIDAD** — toda corrección automática es visible y deshacible. Es la
  regla 3 de seguridad clínica dicha en lenguaje de interfaz.

## Cada pantalla tiene UN propósito primario

Si no se puede nombrar en una frase, la pantalla está haciendo dos trabajos y hay
que partirla. Un tablero donde todo pesa lo mismo no tiene jerarquía: tiene
inventario.

## Lo que la interfaz NO debe parecer

- SaaS genérico salido de un generador
- producto de IA con degradado morado
- tablero hecho enteramente de tarjetas redondeadas
- exceso de píldoras
- exceso de sombras
- glassmorphism en todas partes
- **todo con el mismo peso visual**

Esto se **mide**, no se opina: hay conteos en
`docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` y la compuerta compara contra ellos.

## Escritorio y móvil no son la misma app estirada

- **Escritorio**: navegación persistente + espacio de trabajo clínico + IA
  contextual **sólo cuando sirve**.
- **Móvil**: **4–5 destinos primarios como máximo.** Ni seis.

## Accesibilidad: WCAG 2.2 AA o mejor

No es una casilla de cumplimiento. Un médico con la vista cansada a las nueve de
la noche y un paciente de 70 años usando el portal son el mismo problema.

Mínimos que fallan la compuerta: control interactivo que no es `<button>` ·
campo sin etiqueta · modal que no atrapa el foco ni cierra con Escape · foco
invisible · contraste por debajo de 4.5:1 en texto normal · objetivo táctil por
debajo de 44×44.

## No se aprueba una interfaz leyendo el código

Tras cada cambio de UI relevante: **se lanza el producto, se mira, se recorre el
flujo de verdad, se prueba en móvil, se prueba con teclado, se comprueba la
consola y la red, y se comprueba que el estado sobrevive.**

Un `git diff` que se ve bien no es una pantalla que funciona. Esta regla es la
hermana visual de «el dato tiene que LLEGAR».

## Un núcleo global, paquetes por país

es-MX primero; en-US y el resto **arquitectados**, no bifurcados. El producto no
se clona por país: se le añade un paquete de locale. Texto de cara al usuario
fuera del componente desde el primer día — retroajustar i18n a 78 pantallas es el
trabajo que nadie hace nunca.
