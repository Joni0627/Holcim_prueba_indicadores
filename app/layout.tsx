import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import QueryProvider from "../components/providers/QueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PSC QUBE | Expedición Malagueño",
  description: "Dashboard de análisis industrial para monitorización de OEE, ranking de paros y tendencias de producción.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider 
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#2563eb",
          colorText: "#0f172a",
          colorBackground: "#ffffff",
          colorInputBackground: "#f8fafc",
          colorInputText: "#0f172a",
          borderRadius: "0.5rem",
        },
        elements: {
          footer: "hidden",
          card: "shadow-xl border border-slate-200",
          headerTitle: "text-slate-900 font-bold",
          headerSubtitle: "text-slate-500",
          socialButtonsBlockButton: "border-slate-200 hover:bg-slate-50 text-slate-600",
          formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white font-bold",
          formFieldLabel: "text-slate-700 font-medium",
          formFieldInput: "border-slate-200 focus:border-blue-500 focus:ring-blue-500",
          identityPreviewText: "text-slate-900",
          identityPreviewEditButton: "text-blue-600 hover:text-blue-700",
        }
      }}
    >
      <html lang="es">
        <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
          <QueryProvider>
            {children}
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
