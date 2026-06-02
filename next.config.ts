import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // El portal público puede embeberse en sitios externos (web del médico, blogs, etc.)
      // Esto es seguro porque el portal NO maneja sesiones autenticadas ni datos clínicos:
      // solo recolecta nombre/teléfono/motivo y crea la cita vía API pública con rate-limiting.
      {
        source: "/reservar/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          // Sobrescribe el default por si Vercel/Next inyecta X-Frame-Options: SAMEORIGIN
          { key: "X-Frame-Options", value: "ALLOWALL" },
        ],
      },
      // El resto de rutas (dashboard, API, login) NO se pueden embeber → protege contra clickjacking
      {
        source: "/((?!reservar).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
