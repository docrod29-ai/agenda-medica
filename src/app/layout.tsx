import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Fraunces } from "next/font/google"
import "./globals.css"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Fraunces — serif editorial, uso restringido a hero/citas/momentos editoriales
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "NexusMED",
    template: "%s · NexusMED",
  },
  description: "El consultorio, conectado. Agenda, expediente, recetas y cobros en una sola herramienta.",
  applicationName: "NexusMED",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NexusMED",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "NexusMED",
    description: "El consultorio, conectado.",
    type: "website",
    locale: "es_MX",
  },
}

export const viewport: Viewport = {
  themeColor: "#0B0C0E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full`}>
      <head>
        {/*
          Kill-switch único por versión de deploy.
          Si el usuario tiene un SW viejo cacheando HTML/JS desactualizados,
          este script lo desregistra UNA SOLA VEZ y recarga la página.
          El flag se guarda en localStorage para no entrar en bucle.
          La versión se sube cuando hay deploys que rompen compatibilidad
          de routing (rutas nuevas, layouts movidos, etc.).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try{
                var KEY='__am_sw_reset_v6';
                if(localStorage.getItem(KEY)) return;
                if(!('serviceWorker' in navigator)) { localStorage.setItem(KEY,'1'); return; }
                navigator.serviceWorker.getRegistrations().then(function(rs){
                  return Promise.all(rs.map(function(r){return r.unregister()}));
                }).then(function(){
                  return ('caches' in window)
                    ? caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))})
                    : null;
                }).then(function(){
                  localStorage.setItem(KEY,'1');
                  location.reload();
                }).catch(function(){ localStorage.setItem(KEY,'1'); });
              }catch(e){}
            })();`,
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
