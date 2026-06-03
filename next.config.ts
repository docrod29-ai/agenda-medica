import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // El portal público puede embeberse en sitios externos (web del médico).
      // Seguro porque NO maneja sesiones autenticadas: solo recolecta
      // nombre/teléfono/motivo y crea la cita vía API pública con rate-limiting.
      {
        source: "/reservar/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },
      {
        source: "/privacidad/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },
      // Headers de seguridad globales (no afectan routing, no usan lookahead regex)
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
