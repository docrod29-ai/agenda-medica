import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
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

export const metadata: Metadata = {
  title: "Agenda Médica",
  description: "Agenda inteligente y expediente clínico electrónico para médicos en México",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Agenda Médica",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
}

export const viewport: Viewport = {
  themeColor: "#040b12",
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
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
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
