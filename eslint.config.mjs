import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

/**
 * ACCESIBILIDAD — V9 · DESIGN-SYSTEM-001 · A11Y-GATE-001.
 *
 * `next/core-web-vitals` enciende SEIS reglas de accesibilidad, todas sobre
 * atributos ARIA. Ninguna mira lo que la regla de diseño nombra como mínimos
 * que fallan la compuerta: un control interactivo que no es `<button>`, un campo
 * sin etiqueta. Y la auditoría de V9 lo midió: **1** prueba de accesibilidad
 * entre 566, y es una expresión regular sobre `layout.tsx`.
 *
 * Aquí se enciende el conjunto recomendado del plugin **en AVISO, no en error**,
 * y por una razón concreta: `scripts/lint-trinquete.mjs` cuenta ERRORES contra
 * un techo de 96, y meter 400 hallazgos nuevos ahí destruiría el instrumento que
 * lleva meses funcionando. La accesibilidad tiene su propio trinquete con su
 * propio techo: `scripts/design/trinquete-a11y.mjs`.
 *
 * Se respeta la severidad que el propio plugin recomienda —lo que él apaga sigue
 * apagado— y sólo se degrada `error` a `warn`. Encender a mano las que el plugin
 * apaga (`label-has-for`, obsoleta, y `control-has-associated-label`) añadía 596
 * avisos que el propio plugin considera ruido, y un medidor que grita de más se
 * aprende a ignorar: la lección de REG-245.
 */
const a11yEnAviso = Object.fromEntries(
  Object.entries(jsxA11y.configs.recommended.rules).map(([regla, nivel]) => {
    const apagada = nivel === "off" || nivel === 0 ||
      (Array.isArray(nivel) && (nivel[0] === "off" || nivel[0] === 0));
    if (apagada) return [regla, nivel];
    return [regla, Array.isArray(nivel) ? ["warn", ...nivel.slice(1)] : "warn"];
  }),
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.tsx"],
    rules: a11yEnAviso,
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
