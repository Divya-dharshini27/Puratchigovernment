import type { Metadata, Viewport } from "next";
import "./globals.css";
import GlobalPageTransition from "./components/GlobalPageTransition";

export const metadata: Metadata = {
  title: "PURATCHI — Government & Authority Administrative Console",
  description: "Official administrative and statutory oversight portal for public assemblies and civic regulation."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#450a0a"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased bg-[#fffdf7] text-slate-900 selection:bg-red-600/20 selection:text-red-950 overflow-x-hidden">
        <GlobalPageTransition>
          {children}
        </GlobalPageTransition>
      </body>
    </html>
  );
}