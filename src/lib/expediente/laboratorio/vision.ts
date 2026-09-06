/**
 * Prompt de VISIÓN para leer un PDF/foto de laboratorio.
 *
 * Foso idéntico al del antibiograma: la IA SOLO TRANSCRIBE lo que ve. No
 * interpreta si un valor es normal o crítico (de eso se encarga el motor
 * determinista `evaluarCriticoLab` después), no calcula, no adivina lo ilegible.
 *
 * ── POR QUÉ AHORA SÍ SE PIDE EL NOMBRE (REG-323) ─────────────────────────────
 *
 * Este prompt ordenaba lo contrario: «NO transcribas el nombre del paciente».
 * La intención era buena —no persistir identificadores— pero se aplicó un paso
 * demasiado lejos: al no EXTRAER el nombre, se destruía la única evidencia con
 * la que se podía verificar de quién era la hoja, y el panel acababa archivado
 * bajo el paciente que estuviera abierto en la pantalla.
 *
 * La privacidad se cumple donde toca, en la ESCRITURA: el nombre se lee, se
 * compara contra el paciente de destino (`dictaminarSujeto`) y se descarta. Lo
 * único que llega al expediente es el veredicto. Un nombre ajeno no se guarda
 * nunca, porque cuando no coincide no se guarda nada.
 *
 * Lo que sigue prohibido —y es la mayor parte de la hoja— es todo lo demás:
 * CURP, folio, número de expediente, dirección, teléfono, aseguradora. Nada de
 * eso sirve para verificar el sujeto y todo eso es superficie de fuga.
 *
 * ── POR QUÉ SE PIDE LA MUESTRA (REG-559, §27.3 de D-032) ────────────────────
 *
 * Una hoja de orina que pone «Examen general de orina» en la cabecera y luego
 * escribe «Glucosa» a secas caía en la serie de la glucosa SÉRICA. El nombre del
 * renglón no nombra la muestra; la cabecera sí.
 *
 * Pedirla NO rompe el foso de «sólo transcribe»: la muestra está IMPRESA en el
 * documento, igual que la unidad o la fecha. Lo que el prompt prohíbe con todas
 * las letras es DEDUCIRLA —del analito, del valor, de las unidades—: si no está
 * escrita, se devuelve vacía y manda el nombre del renglón, como antes.
 */

export const LAB_VISION_SYSTEM = `Eres un transcriptor de reportes de laboratorio clínico. Tu única tarea es TRANSCRIBIR, con máxima fidelidad, lo que aparece en el documento. NO interpretas, NO calculas, NO deduces, NO completas lo que no está.

REGLAS ABSOLUTAS:
1. PRIVACIDAD: transcribe ÚNICAMENTE el nombre del paciente (sirve para verificar a quién pertenece la hoja y no se almacena). NO transcribas CURP, folio, número de expediente, dirección, teléfono, correo, aseguradora, médico solicitante ni ningún otro dato. Ignóralos por completo.
2. Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma:
{
  "pacientes": ["APELLIDOS NOMBRES"],   // los nombres de PACIENTE distintos que aparezcan, tal cual; [] si ninguno es legible
  "fecha": "YYYY-MM-DD",                // fecha de toma o de reporte del estudio; "" si no es legible
  "filas": [
    { "estudio": "Glucosa", "valor": "92", "unidad": "mg/dL", "referencia": "70-100", "muestra": "" }
  ]
}
3. "pacientes" lleva SOLO nombres de la persona estudiada. NO metas ahí al médico que solicita, al que valida, al laboratorio ni a la aseguradora. Si el documento trae resultados de varios pacientes, ponlos todos: no elijas uno.
4. Si el nombre del paciente no se lee con seguridad, deja "pacientes": [] — NO lo adivines ni lo completes. Un nombre inventado es peor que ninguno.
5. Un valor por fila, tal como aparece. Si el valor trae "<" o ">", consérvalo en "valor".
5b. "muestra": de qué muestra es ESE renglón, SÓLO si está impreso en el documento — en la cabecera de la sección ("Examen general de orina", "Líquido cefalorraquídeo") o en el propio renglón. Usa exactamente una de estas palabras: "suero", "orina", "lcr", "liquido". Si el documento no lo dice, deja "" — NO lo deduzcas del nombre del estudio, ni del valor, ni de las unidades. Una glucosa no es de orina por ser alta.
6. Si un renglón es ilegible, OMÍTELO — no inventes.
7. Si el documento no es un laboratorio, devuelve {"pacientes":[],"fecha":"","filas":[]}.
8. No agregues texto fuera del JSON.`

export function buildLabVisionPrompt(): string {
  return 'Transcribe los resultados de laboratorio de este documento en el JSON indicado. Incluye el nombre del paciente en "pacientes" (sirve sólo para verificar de quién es la hoja); ningún otro identificador. Y en "muestra" pon de qué muestra es cada renglón SÓLO si el documento lo dice; si no lo dice, déjalo vacío.'
}
