# Briefing común para cada auditor del Panel de Lujo

Lee esto completo antes de empezar. Después lee tu tarjeta de rol en
`docs/ai/NEXUSMED_AUDITORIA_PANEL_DE_LUJO_MASTER_PROMPT.md` (§4.0 y tu rol de §4)
y las reglas de `.claude/rules/` que toquen tu dominio.

## Reglas que no se negocian
1. SÓLO LECTURA. No modificas nada en `src/`, `firestore.rules`, `public/`,
   `package.json`, `scripts/`. Lo único que escribes es TU archivo de salida.
2. Todo hallazgo lleva `archivo` y `linea` reales, que tú abriste. Cita literal.
   Sin evidencia el equipo rojo lo refuta y cuenta en tu contra.
3. Ninguna cifra clínica se inventa. Si crees que falta una dosis, umbral o
   rango, escribe `NEEDS_CLINICAL_REVIEW` en la propuesta. No propongas el número.
4. Cero datos reales. No leas nada de producción. Ejemplos sintéticos.
5. PHI nunca en tu salida.
6. Hospital y UCI están en pausa (D-030): audítalos si te tocan, etiqueta
   `modulo: hospital|uci`, no propongas retirarlos.
7. Respeta las decisiones ya tomadas (CLAUDE.md, `agent-state/DECISION_LOG.md`).
   Si no estás de acuerdo, `tipo: mejora` y dilo como desacuerdo argumentado.
8. NO repares nada. Ni «de paso». Tu trabajo es encontrar y documentar.
9. Antes de reportar algo como defecto, busca si ya está en
   `docs/audit/regression-ledger.md` (grep del tema) o en
   `agent-state/RISK_REGISTER.md`. Si está y sigue abierto, cítalo en `relacionado`.
   Si está cerrado y tú ves que reapareció, es P0/P1 y lo dices.
10. Verifica «escrito y sin conectar»: antes de afirmar que una función existe
    en la app, comprueba con grep que alguien la llama desde `src/app`, `src/hooks`
    o `src/components`.

## Las tres lentes del dueño (aplican a todos, además de tu rol)
- `boton_muerto`: control que no hace nada, hace otra cosa, lleva a ruta
  inexistente, está deshabilitado sin explicación, promete algo detrás de una
  bandera apagada, guarda sin persistir.
- `friccion`: pantalla sin propósito en una frase; tarea frecuente en más de
  tres clics; texto que habla como sistema; todo pesa igual; no lo entiende un
  médico cansado o un paciente de 70 años.
- `innecesario`: pantalla, botón, campo, ajuste o texto que no aporta a la
  misión. Con evidencia (nadie lo enlaza / sin pruebas / duplica otro sitio) y
  recomendación (retirar · esconder · fusionar · dejar). No borras: propones.

## Formato de salida — OBLIGATORIO
Escribe un único archivo JSON en la ruta que te indica tu tarea, con esta forma:

```json
{
  "rol": "tu-rol",
  "fecha": "2026-09-06",
  "revisado": [
    { "pieza": "src/app/(dashboard)/citas/page.tsx", "veredicto": "sin hallazgo | con hallazgos", "nota": "opcional" }
  ],
  "hallazgos": [
    {
      "id": "ROL-001",
      "panel": "medico|paciente|asistente|ingenieria|seguridad|diseno|negocio",
      "rol": "tu-rol",
      "modulo": "practice|hospital|uci|portal|publico|nucleo",
      "tipo": "defecto|boton_muerto|friccion|innecesario|mejora",
      "titulo": "Una frase con el efecto en el paciente o el usuario",
      "archivo": "ruta/relativa.ts",
      "linea": 123,
      "evidencia": "Cita literal del código (1-5 líneas) o del comportamiento observado",
      "reproduccion": "Pasos o entrada sintética; o 'recorrido' si es de paciente",
      "impacto": { "paciente": "…", "medico": "…", "negocio": "…" },
      "severidad": 1,
      "probabilidad": "alta|media|baja",
      "control_existente": "qué lo mitiga hoy, o 'ninguno'",
      "prioridad": "P0|P1|P2|P3",
      "propuesta": "qué cambiar, sin cambiarlo",
      "prueba_que_faltaria": "qué prueba fallaría hoy y pasaría con el arreglo",
      "que_no_cubre": "qué caso vecino este hallazgo NO resuelve",
      "decision_del_dueno": null,
      "relacionado": ["REG-…", "R-…"]
    }
  ]
}
```

Prioridades: P0 = daño posible al paciente, fuga de PHI o entre consultorios,
dinero mal cobrado, firma/receta forjable, IA del paciente que origina un dato
clínico. P1 = error clínico o legal con control parcial; dato que no llega;
nota firmada incompleta; accesibilidad que impide la tarea. P2 = fricción
medible, botón muerto, prueba tautológica. P3 = mejora.

`revisado` DEBE listar cada pieza de tu rebanada que abriste, tenga o no
hallazgos: es la prueba de cobertura.

## Cómo escribir el archivo
Usa la herramienta Write si la tienes; si sólo tienes Bash, escribe con
`cat > RUTA <<'JSONEOF' … JSONEOF`. Valida al final con
`node -e "JSON.parse(require('fs').readFileSync('RUTA','utf8'))"`.

## Lo que devuelves en tu mensaje final (corto, ≤ 25 líneas)
- Ruta del archivo escrito y que el JSON valida.
- Conteo de hallazgos por prioridad y por tipo.
- Los 5 títulos más graves con archivo:línea.
- Qué de tu rebanada NO alcanzaste a revisar.
Nada más: el archivo es el entregable, no el mensaje.
