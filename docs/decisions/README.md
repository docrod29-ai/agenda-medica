# Registros de decisión de arquitectura (ADR)

**Formato**: §5.1 del charter Master Loop V7.
**Abierto**: 6-ago-2026.

---

## Qué es un ADR y por qué aquí importa más de lo normal

Un ADR registra **una decisión de arquitectura, su contexto, las alternativas que
se descartaron y las consecuencias que se aceptaron**. No es documentación de
cómo funciona el código: eso está en el propio código.

En este proyecto sirve para algo concreto: **impedir que una decisión tomada con
un dato delante se deshaga meses después por alguien que no vio ese dato**. Ha
pasado ya —una regla se acota y otra mención queda viva diciendo lo contrario
(REG-180, REG-184)— y un ADR es más barato que la reparación.

## Reglas de este directorio

1. **Un ADR se escribe cuando la decisión ya se tomó**, no antes. No son
   propuestas.
2. **Las alternativas descartadas se escriben.** Un ADR sin alternativas no
   documenta una decisión: documenta un hecho consumado.
3. **Las consecuencias negativas también.** Toda decisión de arquitectura cuesta
   algo; callarlo hace que el coste se descubra tarde y parezca un defecto.
4. **Nunca se borra un ADR.** Si se revierte, se escribe uno nuevo que lo
   sustituye y el viejo queda marcado como `SUSTITUIDO POR ADR-xxx`.
5. **Las decisiones clínicas del médico dueño no son ADR.** Viven en
   `docs/audit/regression-ledger.md` con su REG, y en
   `agent-state/OWNER_DECISIONS_REQUIRED.md` cuando están pendientes. Un ADR es
   de software; confundirlos haría parecer que el sistema decidió algo clínico.

## Estado

| ADR | Decisión | Estado |
|---|---|---|
| [ADR-001](ADR-001-una-fuente-de-verdad-clinica.md) | Una sola fuente de verdad por entidad clínica | Vigente |
| [ADR-002](ADR-002-el-llm-no-calcula.md) | El LLM nunca calcula una cifra clínica | Vigente |
| [ADR-003](ADR-003-el-sello-tiene-version.md) | El sello de integridad tiene versión propia | Vigente |
| [ADR-004](ADR-004-tres-niveles-de-aviso.md) | Tres niveles de aviso, no un recuadro por motor | Vigente |

Faltan por escribir (decisiones ya tomadas, sin ADR): separación Consulta /
Hospital tras feature flag, el modelo de proveedores intercambiables de voz, y la
política de multi-inquilino.
